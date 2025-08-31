import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '../../../../../../../lib/db/postgres';
import { getAuthFromRequest } from '../../../../../../../lib/auth/auth';
import logger from '../../../../../../../lib/logger';

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

    // Verify assessment belongs to candidate and get assessment item details
    const itemResult = await executeQuery(`
      SELECT
        ai.id,
        ai.assessment_id,
        ai.game_id,
        ai.order_index,
        ai.timer_seconds,
        ai.status,
        ai.config_snapshot,
        a.candidate_id,
        a.tenant_id,
        g.code as game_code,
        g.title as game_title,
        g.base_config
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

    if (item.STATUS !== 'PENDING') {
      return NextResponse.json({ error: 'Item already started or completed' }, { status: 400 });
    }

    // Calculate server deadline
    const timerSeconds = item.TIMER_SECONDS || 300; // Default 5 minutes
    const serverDeadline = new Date(Date.now() + timerSeconds * 1000);

    // Update item status and set server timestamps
    await executeQuery(`
      UPDATE ASSESSMENT_ITEMS
      SET status = 'ACTIVE',
          server_started_at = SYSTIMESTAMP,
          server_deadline_at = :deadline
      WHERE id = :itemId
    `, [serverDeadline, itemId]);

    // Get game configuration
    let gameConfig = {};
    if (item.CONFIG_SNAPSHOT) {
      gameConfig = JSON.parse(item.CONFIG_SNAPSHOT);
    } else if (item.BASE_CONFIG) {
      gameConfig = JSON.parse(item.BASE_CONFIG);
    }

    // Create signed payload for client (in a real implementation, you'd sign this)
    const payload = {
      itemId: item.ID,
      gameCode: item.GAME_CODE,
      gameTitle: item.GAME_TITLE,
      startedAt: new Date().toISOString(),
      deadlineAt: serverDeadline.toISOString(),
      config: gameConfig,
      timerSeconds
    };

    logger.info('Assessment item started', {
      itemId,
      assessmentId,
      gameCode: item.GAME_CODE,
      candidateId: auth.userId
    });

    return NextResponse.json({
      item: {
        id: item.ID,
        gameCode: item.GAME_CODE,
        gameTitle: item.GAME_TITLE,
        timerSeconds,
        config: gameConfig
      },
      payload
    });
  } catch (err) {
    logger.error('Error starting assessment item:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
