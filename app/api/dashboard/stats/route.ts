import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { requireAdmin } from '@/lib/auth/jwt';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { payload } = await requireAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get overall statistics
    const statsResult = await executeQuery(`
      SELECT
        COUNT(DISTINCT a.id) as total_assessments,
        COUNT(DISTINCT CASE WHEN a.status = 'COMPLETED' THEN a.id END) as completed_assessments,
        COUNT(DISTINCT u.id) as total_candidates,
        COUNT(DISTINCT jr.id) as total_job_roles,
        AVG(CASE WHEN a.status = 'COMPLETED' THEN a.total_score END) as average_score
      FROM ASSESSMENTS a
      LEFT JOIN USERS u ON a.candidate_id = u.id
      LEFT JOIN JOB_ROLES jr ON a.job_role_id = jr.id
      WHERE a.tenant_id = :tenantId
    `, [payload.tenantId]);

    const stats = statsResult.rows?.[0] || {};

    // Get recent assessments
    const recentAssessments = await executeQuery(`
      SELECT
        a.id,
        a.status,
        a.total_score,
        a.started_at,
        a.completed_at,
        u.username as candidate_name,
        jr.title as job_role_title
      FROM ASSESSMENTS a
      JOIN USERS u ON a.candidate_id = u.id
      JOIN JOB_ROLES jr ON a.job_role_id = jr.id
      WHERE a.tenant_id = :tenantId
      ORDER BY a.created_at DESC
      FETCH FIRST 10 ROWS ONLY
    `, [payload.tenantId]);

    // Get game performance stats
    const gameStats = await executeQuery(`
      SELECT
        g.title as game_title,
        g.code as game_code,
        COUNT(ai.id) as total_attempts,
        AVG(ai.score) as average_score,
        COUNT(CASE WHEN ai.status = 'SUBMITTED' THEN 1 END) as completed_attempts
      FROM GAMES g
      LEFT JOIN ASSESSMENT_ITEMS ai ON g.id = ai.game_id
      LEFT JOIN ASSESSMENTS a ON ai.assessment_id = a.id
      WHERE a.tenant_id = :tenantId
      GROUP BY g.id, g.title, g.code
      ORDER BY total_attempts DESC
    `, [payload.tenantId]);

    return NextResponse.json({
      stats: {
        totalAssessments: Number(stats.TOTAL_ASSESSMENTS) || 0,
        completedAssessments: Number(stats.COMPLETED_ASSESSMENTS) || 0,
        totalCandidates: Number(stats.TOTAL_CANDIDATES) || 0,
        totalJobRoles: Number(stats.TOTAL_JOB_ROLES) || 0,
        averageScore: Number(stats.AVERAGE_SCORE) || 0
      },
      recentAssessments: recentAssessments.rows || [],
      gameStats: gameStats.rows || []
    });

  } catch (error) {
    logger.error('Dashboard stats error', { error: error.message });
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}

