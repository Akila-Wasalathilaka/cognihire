import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { getAuthFromRequest } from '@/lib/auth/auth';
import { calculateGameScore } from '@/lib/scoring/gameScoring';
import logger from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'CANDIDATE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assessmentId = params.id;
    const itemId = params.itemId;
    const body = await request.json();
    const { results, score, metrics } = body;

    // Verify assessment item belongs to candidate and is active
    const itemResult = await executeQuery(`
      SELECT
        ai.id,
        ai.assessment_id,
        ai.status,
        ai.server_started_at,
        ai.server_deadline_at,
        a.candidate_id,
        a.tenant_id,
        g.code as game_code
      FROM ASSESSMENT_ITEMS ai
      JOIN ASSESSMENTS a ON ai.assessment_id = a.id
      JOIN GAMES g ON ai.game_id = g.id
      WHERE ai.id = :itemId AND ai.assessment_id = :assessmentId
    `, [itemId, assessmentId]);

    if (!itemResult.rows || itemResult.rows.length === 0) {
      return NextResponse.json({ error: 'Assessment item not found' }, { status: 404 });
    }

    const item = itemResult.rows[0] as any;

    if (item.CANDIDATE_ID !== auth.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (item.STATUS !== 'ACTIVE') {
      return NextResponse.json({ error: 'Item not active' }, { status: 400 });
    }

    // Check if submission is within deadline
    const now = new Date();
    const deadline = new Date(item.SERVER_DEADLINE_AT);

    let finalStatus = 'SUBMITTED';
    if (now > deadline) {
      finalStatus = 'EXPIRED';
    }

    // Calculate comprehensive score using the new scoring system
    let scoringResult;
    try {
      scoringResult = await calculateGameScore(item.GAME_CODE, results || [], assessmentId);
    } catch (error) {
      logger.warn('Failed to calculate comprehensive score, using client score', { error });
      scoringResult = {
        overallScore: score || 0,
        accuracy: 0,
        averageResponseTime: 0,
        traitScores: [],
        metadata: {
          gameCode: item.GAME_CODE,
          trialsCompleted: results?.length || 0,
          totalTrials: results?.length || 0
        }
      };
    }

    // Merge client metrics with server-calculated metrics
    const finalMetrics = {
      ...metrics,
      serverScoring: scoringResult,
      submittedAt: now.toISOString(),
      deadline: deadline.toISOString(),
      wasLate: now > deadline
    };

    // Update assessment item with results
    await executeQuery(`
      UPDATE ASSESSMENT_ITEMS
      SET status = :status,
          score = :score,
          metrics_json = :metrics,
          server_deadline_at = SYSTIMESTAMP
      WHERE id = :itemId
    `, [finalStatus, scoringResult.overallScore, JSON.stringify(finalMetrics), itemId]);

    logger.info('Assessment item submitted with enhanced scoring', {
      itemId,
      assessmentId,
      candidateId: auth.userId,
      status: finalStatus,
      score: scoringResult.overallScore,
      accuracy: scoringResult.accuracy,
      traitScores: scoringResult.traitScores.length
    });

    return NextResponse.json({
      success: true,
      status: finalStatus,
      score: scoringResult.overallScore,
      accuracy: scoringResult.accuracy,
      traitScores: scoringResult.traitScores,
      submittedAt: now.toISOString()
    });
  } catch (err) {
    logger.error('Error submitting assessment item:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
