import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { getAuthFromRequest } from '@/lib/auth/auth';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessmentId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = `
      SELECT
        gs.id,
        gs.assessment_id,
        gs.game_id,
        gs.started_at,
        gs.completed_at,
        gs.status,
        gs.score,
        gs.metrics_json,
        g.title as game_title,
        g.code as game_code,
        a.job_role_id
      FROM GAME_SESSIONS gs
      JOIN GAMES g ON gs.game_id = g.id
      JOIN ASSESSMENTS a ON gs.assessment_id = a.id
    `;

    const params: any[] = [];

    // Add filters
    if (assessmentId) {
      query += ' WHERE gs.assessment_id = :assessmentId';
      params.push(assessmentId);
    }

    // Add tenant filter for admin users
    if (auth.role === 'ADMIN') {
      query += params.length > 0 ? ' AND a.tenant_id = :tenantId' : ' WHERE a.tenant_id = :tenantId';
      params.push(auth.tenantId);
    } else {
      // For candidates, only show their own sessions
      query += params.length > 0 ? ' AND a.candidate_id = :candidateId' : ' WHERE a.candidate_id = :candidateId';
      params.push(auth.userId);
    }

    // Add ordering and pagination
    query += ' ORDER BY gs.started_at DESC';
    query += ' OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY';

    params.push(offset, limit);

    const result = await executeQuery(query, params);

    const sessions = (result.rows || []).map((row: any) => ({
      id: row.ID,
      assessmentId: row.ASSESSMENT_ID,
      gameId: row.GAME_ID,
      gameTitle: row.GAME_TITLE,
      gameCode: row.GAME_CODE,
      startedAt: row.STARTED_AT,
      completedAt: row.COMPLETED_AT,
      status: row.STATUS,
      score: row.SCORE,
      metrics: row.METRICS_JSON ? JSON.parse(row.METRICS_JSON) : null
    }));

    return NextResponse.json({ sessions });
  } catch (error) {
    logger.error('Error fetching game sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'CANDIDATE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { assessmentId, gameId, metrics } = body;

    if (!assessmentId || !gameId) {
      return NextResponse.json({ error: 'Assessment ID and Game ID are required' }, { status: 400 });
    }

    // Verify assessment belongs to candidate
    const assessmentResult = await executeQuery(
      'SELECT id FROM ASSESSMENTS WHERE id = :assessmentId AND candidate_id = :candidateId',
      [assessmentId, auth.userId]
    );

    if (!assessmentResult.rows || assessmentResult.rows.length === 0) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Create game session
    const sessionId = `gs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await executeQuery(`
      INSERT INTO GAME_SESSIONS (id, assessment_id, game_id, started_at, status, metrics_json)
      VALUES (:id, :assessmentId, :gameId, SYSTIMESTAMP, :status, :metrics)
    `, [
      sessionId,
      assessmentId,
      gameId,
      'ACTIVE',
      metrics ? JSON.stringify(metrics) : null
    ]);

    logger.info('Game session created', {
      sessionId,
      assessmentId,
      gameId,
      candidateId: auth.userId
    });

    return NextResponse.json({
      success: true,
      sessionId,
      status: 'ACTIVE'
    });
  } catch (error) {
    logger.error('Error creating game session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

