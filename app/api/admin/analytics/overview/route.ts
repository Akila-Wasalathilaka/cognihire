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

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d
    const tenantId = payload.tenantId;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get overview statistics
    const overviewStats = await getOverviewStats(tenantId, startDate, endDate);
    const gamePerformance = await getGamePerformanceStats(tenantId, startDate, endDate);
    const candidateEngagement = await getCandidateEngagementStats(tenantId, startDate, endDate);
    const integrityStats = await getIntegrityStats(tenantId, startDate, endDate);

    return NextResponse.json({
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      overview: overviewStats,
      gamePerformance,
      candidateEngagement,
      integrityStats
    });

  } catch (error) {
    logger.error('Error fetching analytics overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}

async function getOverviewStats(tenantId: string, startDate: Date, endDate: Date) {
  // Total candidates
  const candidatesResult = await executeQuery(`
    SELECT COUNT(*) as total
    FROM USERS
    WHERE tenant_id = :tenantId AND role = 'CANDIDATE'
  `, [tenantId]);

  // Active candidates (completed assessment in period)
  const activeCandidatesResult = await executeQuery(`
    SELECT COUNT(DISTINCT a.candidate_id) as total
    FROM ASSESSMENTS a
    WHERE a.tenant_id = :tenantId
    AND a.completed_at BETWEEN :startDate AND :endDate
  `, [tenantId, startDate, endDate]);

  // Total assessments
  const assessmentsResult = await executeQuery(`
    SELECT COUNT(*) as total
    FROM ASSESSMENTS
    WHERE tenant_id = :tenantId
    AND created_at BETWEEN :startDate AND :endDate
  `, [tenantId, startDate, endDate]);

  // Completed assessments
  const completedAssessmentsResult = await executeQuery(`
    SELECT COUNT(*) as total
    FROM ASSESSMENTS
    WHERE tenant_id = :tenantId
    AND status = 'COMPLETED'
    AND completed_at BETWEEN :startDate AND :endDate
  `, [tenantId, startDate, endDate]);

  // Average completion time
  const avgCompletionTimeResult = await executeQuery(`
    SELECT AVG(
      EXTRACT(DAY FROM (completed_at - started_at)) * 24 * 60 +
      EXTRACT(HOUR FROM (completed_at - started_at)) * 60 +
      EXTRACT(MINUTE FROM (completed_at - started_at))
    ) as avg_minutes
    FROM ASSESSMENTS
    WHERE tenant_id = :tenantId
    AND status = 'COMPLETED'
    AND completed_at BETWEEN :startDate AND :endDate
  `, [tenantId, startDate, endDate]);

  return {
    totalCandidates: candidatesResult.rows[0]?.TOTAL || 0,
    activeCandidates: activeCandidatesResult.rows[0]?.TOTAL || 0,
    totalAssessments: assessmentsResult.rows[0]?.TOTAL || 0,
    completedAssessments: completedAssessmentsResult.rows[0]?.TOTAL || 0,
    completionRate: assessmentsResult.rows[0]?.TOTAL > 0
      ? (completedAssessmentsResult.rows[0]?.TOTAL || 0) / assessmentsResult.rows[0]?.TOTAL * 100
      : 0,
    averageCompletionTime: Math.round(avgCompletionTimeResult.rows[0]?.AVG_MINUTES || 0)
  };
}

async function getGamePerformanceStats(tenantId: string, startDate: Date, endDate: Date) {
  const result = await executeQuery(`
    SELECT
      g.title as game_title,
      g.code as game_code,
      COUNT(ai.id) as times_played,
      AVG(ai.score) as avg_score,
      AVG(JSON_VALUE(ai.metrics_json, '$.serverScoring.accuracy')) as avg_accuracy,
      AVG(JSON_VALUE(ai.metrics_json, '$.serverScoring.averageResponseTime')) as avg_response_time
    FROM ASSESSMENT_ITEMS ai
    JOIN ASSESSMENTS a ON ai.assessment_id = a.id
    JOIN GAMES g ON ai.game_id = g.id
    WHERE a.tenant_id = :tenantId
    AND ai.status = 'SUBMITTED'
    AND a.completed_at BETWEEN :startDate AND :endDate
    GROUP BY g.title, g.code
    ORDER BY times_played DESC
  `, [tenantId, startDate, endDate]);

  return result.rows.map((row: any) => ({
    gameTitle: row.GAME_TITLE,
    gameCode: row.GAME_CODE,
    timesPlayed: row.TIMES_PLAYED,
    averageScore: Math.round(row.AVG_SCORE || 0),
    averageAccuracy: Math.round(row.AVG_ACCURACY || 0),
    averageResponseTime: Math.round(row.AVG_RESPONSE_TIME || 0)
  }));
}

async function getCandidateEngagementStats(tenantId: string, startDate: Date, endDate: Date) {
  // Daily assessment starts
  const dailyStartsResult = await executeQuery(`
    SELECT
      TRUNC(started_at) as day,
      COUNT(*) as starts
    FROM ASSESSMENTS
    WHERE tenant_id = :tenantId
    AND started_at BETWEEN :startDate AND :endDate
    GROUP BY TRUNC(started_at)
    ORDER BY TRUNC(started_at)
  `, [tenantId, startDate, endDate]);

  // Completion rates by day
  const dailyCompletionsResult = await executeQuery(`
    SELECT
      TRUNC(completed_at) as day,
      COUNT(*) as completions
    FROM ASSESSMENTS
    WHERE tenant_id = :tenantId
    AND status = 'COMPLETED'
    AND completed_at BETWEEN :startDate AND :endDate
    GROUP BY TRUNC(completed_at)
    ORDER BY TRUNC(completed_at)
  `, [tenantId, startDate, endDate]);

  return {
    dailyStarts: dailyStartsResult.rows.map((row: any) => ({
      date: row.DAY,
      starts: row.STARTS
    })),
    dailyCompletions: dailyCompletionsResult.rows.map((row: any) => ({
      date: row.DAY,
      completions: row.COMPLETIONS
    }))
  };
}

async function getIntegrityStats(tenantId: string, startDate: Date, endDate: Date) {
  const result = await executeQuery(`
    SELECT
      COUNT(*) as total_assessments,
      SUM(CASE WHEN JSON_VALUE(a.integrity_flags, '$.summary.suspiciousActivity') = 'true' THEN 1 ELSE 0 END) as suspicious_count,
      AVG(JSON_VALUE(a.integrity_flags, '$.summary.tabSwitches')) as avg_tab_switches,
      AVG(JSON_VALUE(a.integrity_flags, '$.summary.focusLoss')) as avg_focus_loss
    FROM ASSESSMENTS a
    WHERE a.tenant_id = :tenantId
    AND a.completed_at BETWEEN :startDate AND :endDate
  `, [tenantId, startDate, endDate]);

  const stats = result.rows[0];
  const totalAssessments = stats?.TOTAL_ASSESSMENTS || 0;
  const suspiciousCount = stats?.SUSPICIOUS_COUNT || 0;

  return {
    totalAssessments,
    suspiciousAssessments: suspiciousCount,
    integrityRate: totalAssessments > 0 ? ((totalAssessments - suspiciousCount) / totalAssessments * 100) : 100,
    averageTabSwitches: Math.round(stats?.AVG_TAB_SWITCHES || 0),
    averageFocusLoss: Math.round(stats?.AVG_FOCUS_LOSS || 0)
  };
}

