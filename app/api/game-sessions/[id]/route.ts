import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { getAuthFromRequest } from '@/lib/auth/auth';
import logger from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = params.id;

    // Get game session details
    const sessionResult = await executeQuery(`
      SELECT
        gs.id,
        gs.assessment_item_id,
        gs.started_at,
        gs.completed_at,
        gs.status,
        gs.metrics_json,
        ai.game_id,
        ai.score,
        ai.timer_seconds,
        g.title as game_title,
        g.code as game_code,
        a.candidate_id,
        a.job_role_id
      FROM GAME_SESSIONS gs
      JOIN ASSESSMENT_ITEMS ai ON gs.assessment_item_id = ai.id
      JOIN GAMES g ON ai.game_id = g.id
      JOIN ASSESSMENTS a ON ai.assessment_id = a.id
      WHERE gs.id = :sessionId
    `, [sessionId]);

    if (!sessionResult.rows || sessionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Game session not found' }, { status: 404 });
    }

    const session = sessionResult.rows[0] as any;

    // Check permissions (admin can access all, candidates only their own)
    if (auth.role !== 'ADMIN' && session.CANDIDATE_ID !== auth.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      session: {
        id: session.ID,
        assessmentItemId: session.ASSESSMENT_ITEM_ID,
        gameId: session.GAME_ID,
        gameTitle: session.GAME_TITLE,
        gameCode: session.GAME_CODE,
        startedAt: session.STARTED_AT,
        completedAt: session.COMPLETED_AT,
        status: session.STATUS,
        score: session.SCORE,
        timerSeconds: session.TIMER_SECONDS,
        metrics: session.METRICS_JSON ? JSON.parse(session.METRICS_JSON) : null
      }
    });

  } catch (error) {
    logger.error('Game session fetch error', { error: error.message, sessionId: params.id });
    return NextResponse.json({ error: 'Failed to fetch game session' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'CANDIDATE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = params.id;
    const body = await request.json();
    const { action, metrics } = body;

    // Verify session belongs to candidate
    const sessionResult = await executeQuery(`
      SELECT
        gs.id,
        gs.status,
        a.candidate_id
      FROM GAME_SESSIONS gs
      JOIN ASSESSMENT_ITEMS ai ON gs.assessment_item_id = ai.id
      JOIN ASSESSMENTS a ON ai.assessment_id = a.id
      WHERE gs.id = :sessionId
    `, [sessionId]);

    if (!sessionResult.rows || sessionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Game session not found' }, { status: 404 });
    }

    const session = sessionResult.rows[0] as any;

    if (session.CANDIDATE_ID !== auth.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (action === 'complete') {
      // Update session with completion data
      await executeQuery(`
        UPDATE GAME_SESSIONS
        SET status = 'COMPLETED',
            completed_at = SYSTIMESTAMP,
            metrics_json = :metrics
        WHERE id = :sessionId
      `, [JSON.stringify(metrics), sessionId]);

      logger.info('Game session completed', {
        sessionId,
        candidateId: auth.userId,
        metrics: metrics
      });

      return NextResponse.json({ message: 'Game session completed successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    logger.error('Game session update error', { error: error.message, sessionId: params.id });
    return NextResponse.json({ error: 'Failed to update game session' }, { status: 500 });
  }
}
