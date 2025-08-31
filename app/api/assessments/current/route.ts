import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { requireCandidate } from '@/lib/auth/jwt';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { payload } = await requireCandidate(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current assessment for candidate
    const result = await executeQuery(
      `SELECT a.id, a.job_role_id, a.status, a.started_at, a.total_score,
              jr.title as job_role_title, jr.traits_json, jr.config_json
       FROM ASSESSMENTS a
       JOIN JOB_ROLES jr ON a.job_role_id = jr.id
       WHERE a.candidate_id = :candidateId
       AND a.status IN ('NOT_STARTED', 'IN_PROGRESS')
       ORDER BY a.created_at DESC
       FETCH FIRST 1 ROW ONLY`,
      [payload.userId]
    );

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ assessment: null });
    }

    const assessment = result.rows[0] as any;

    return NextResponse.json({
      assessment: {
        id: assessment.ID,
        jobRoleId: assessment.JOB_ROLE_ID,
        status: assessment.STATUS,
        startedAt: assessment.STARTED_AT,
        totalScore: assessment.TOTAL_SCORE,
        jobRole: {
          title: assessment.JOB_ROLE_TITLE,
          traits: assessment.TRAITS_JSON ? JSON.parse(assessment.TRAITS_JSON) : null,
          config: assessment.CONFIG_JSON ? JSON.parse(assessment.CONFIG_JSON) : null,
        },
      },
    });
  } catch (error) {
    logger.error('Get current assessment error', { error: error.message });
    return NextResponse.json({ error: 'Failed to get current assessment' }, { status: 500 });
  }
}

