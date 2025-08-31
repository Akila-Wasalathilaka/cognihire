import { NextRequest, NextResponse } from 'next/server';
import { startAssessmentSchema } from '@/lib/validation/schemas';
import { executeQuery, generateId } from '@/lib/db/postgres';
import { requireCandidate } from '@/lib/auth/jwt';
import logger from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { payload } = await requireCandidate(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assessmentId = params.id;

    // Verify assessment belongs to candidate and is in correct state
    const assessmentResult = await executeQuery(
      `SELECT a.status, a.candidate_id, a.job_role_id, a.tenant_id,
              jr.title as job_role_title
       FROM ASSESSMENTS a
       JOIN JOB_ROLES jr ON a.job_role_id = jr.id
       WHERE a.id = :assessmentId`,
      [assessmentId]
    );

    if (!assessmentResult.rows || assessmentResult.rows.length === 0) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const assessment = assessmentResult.rows[0] as any;

    if (assessment.CANDIDATE_ID !== payload.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (assessment.STATUS !== 'NOT_STARTED') {
      return NextResponse.json({ error: 'Assessment already started' }, { status: 400 });
    }

    if (assessment.TENANT_ID !== payload.tenantId) {
      return NextResponse.json({ error: 'Tenant mismatch' }, { status: 403 });
    }

    // Start assessment
    await executeQuery(
      'UPDATE ASSESSMENTS SET status = :status, started_at = SYSTIMESTAMP WHERE id = :assessmentId',
      ['IN_PROGRESS', assessmentId]
    );

    // Get assessment items (games) for this job role
    const itemsResult = await executeQuery(
      `SELECT rgp.game_id, g.code, g.title, rgp.order_index, rgp.timer_seconds,
              rgp.config_override, g.base_config
       FROM ROLE_GAME_PACKAGE rgp
       JOIN GAMES g ON rgp.game_id = g.id
       WHERE rgp.job_role_id = :jobRoleId
       ORDER BY rgp.order_index`,
      [assessment.JOB_ROLE_ID]
    );

    const items = itemsResult.rows?.map((item: any) => ({
      gameId: item.GAME_ID,
      gameCode: item.CODE,
      gameTitle: item.TITLE,
      orderIndex: item.ORDER_INDEX,
      timerSeconds: item.TIMER_SECONDS,
      configOverride: item.CONFIG_OVERRIDE ? JSON.parse(item.CONFIG_OVERRIDE) : null,
      baseConfig: item.BASE_CONFIG ? JSON.parse(item.BASE_CONFIG) : null,
    })) || [];

    logger.info('Assessment started by candidate', {
      candidateId: payload.userId,
      candidateUsername: payload.username,
      assessmentId,
      jobRoleTitle: assessment.JOB_ROLE_TITLE,
      itemCount: items.length,
      ip: request.ip,
    });

    return NextResponse.json({
      message: 'Assessment started successfully',
      assessment: {
        id: assessmentId,
        status: 'IN_PROGRESS',
        items,
      },
    });
  } catch (error) {
    logger.error('Start assessment error', { error: error.message, assessmentId: params.id });
    return NextResponse.json({ error: 'Failed to start assessment' }, { status: 500 });
  }
}
