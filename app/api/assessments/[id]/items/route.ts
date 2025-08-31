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
    if (!auth || auth.role !== 'CANDIDATE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assessmentId = params.id;

    // Verify assessment belongs to candidate
    const assessmentResult = await executeQuery(`
      SELECT a.id, a.candidate_id, a.job_role_id, a.tenant_id
      FROM ASSESSMENTS a
      WHERE a.id = :assessmentId
    `, [assessmentId]);

    if (!assessmentResult.rows || assessmentResult.rows.length === 0) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const assessment = assessmentResult.rows[0] as any;

    if (assessment.CANDIDATE_ID !== auth.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get assessment items with game details
    const itemsResult = await executeQuery(`
      SELECT
        ai.id,
        ai.game_id,
        ai.order_index,
        ai.timer_seconds,
        ai.config_override,
        ai.status,
        g.code as game_code,
        g.title as game_title,
        g.base_config
      FROM ASSESSMENT_ITEMS ai
      JOIN GAMES g ON ai.game_id = g.id
      WHERE ai.assessment_id = :assessmentId
      ORDER BY ai.order_index
    `, [assessmentId]);

    const items = (itemsResult.rows || []).map((item: any) => ({
      id: item.ID,
      gameId: item.GAME_ID,
      gameCode: item.GAME_CODE,
      gameTitle: item.GAME_TITLE,
      orderIndex: item.ORDER_INDEX,
      timerSeconds: item.TIMER_SECONDS,
      configOverride: item.CONFIG_OVERRIDE ? JSON.parse(item.CONFIG_OVERRIDE) : null,
      baseConfig: item.BASE_CONFIG ? JSON.parse(item.BASE_CONFIG) : null,
      status: item.STATUS
    }));

    return NextResponse.json({ items });
  } catch (err) {
    logger.error('Error fetching assessment items:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
