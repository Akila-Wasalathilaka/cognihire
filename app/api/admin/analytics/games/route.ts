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
    const gameCode = searchParams.get('gameCode');
    const period = searchParams.get('period') || '30d';
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

    let whereClause = 'a.tenant_id = :tenantId AND ai.status = \'SUBMITTED\' AND a.completed_at BETWEEN :startDate AND :endDate';
    let bindParams: any = { tenantId, startDate, endDate };

    if (gameCode) {
      whereClause += ' AND g.code = :gameCode';
      bindParams.gameCode = gameCode;
    }

    // Get game performance data
    const gameStats = await getGameStats(whereClause, bindParams);
    const traitPerformance = await getTraitPerformance(whereClause, bindParams);
    const difficultyAnalysis = await getDifficultyAnalysis(whereClause, bindParams);
    const timeBasedAnalysis = await getTimeBasedAnalysis(whereClause, bindParams);

    return NextResponse.json({
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      gameCode: gameCode || 'all',
      gameStats,
      traitPerformance,
      difficultyAnalysis,
      timeBasedAnalysis
    });

  } catch (error) {
    logger.error('Error fetching games analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch games analytics' },
      { status: 500 }
    );
  }
}

async function getGameStats(whereClause: string, bindParams: any) {
  const result = await executeQuery(`
    SELECT
      g.title as game_title,
      g.code as game_code,
      COUNT(ai.id) as total_attempts,
      COUNT(DISTINCT a.candidate_id) as unique_candidates,
      AVG(ai.score) as avg_score,
      MIN(ai.score) as min_score,
      MAX(ai.score) as max_score,
      STDDEV(ai.score) as score_stddev,
      AVG(JSON_VALUE(ai.metrics_json, '$.serverScoring.accuracy')) as avg_accuracy,
      AVG(JSON_VALUE(ai.metrics_json, '$.serverScoring.averageResponseTime')) as avg_response_time,
      AVG(ai.timer_seconds) as avg_timer_seconds
    FROM ASSESSMENT_ITEMS ai
    JOIN ASSESSMENTS a ON ai.assessment_id = a.id
    JOIN GAMES g ON ai.game_id = g.id
    WHERE ${whereClause}
    GROUP BY g.title, g.code
    ORDER BY total_attempts DESC
  `, bindParams);

  return result.rows.map((row: any) => ({
    gameTitle: row.GAME_TITLE,
    gameCode: row.GAME_CODE,
    totalAttempts: row.TOTAL_ATTEMPTS,
    uniqueCandidates: row.UNIQUE_CANDIDATES,
    averageScore: Math.round(row.AVG_SCORE || 0),
    minScore: row.MIN_SCORE || 0,
    maxScore: row.MAX_SCORE || 0,
    scoreStdDev: Math.round(row.SCORE_STDDEV || 0),
    averageAccuracy: Math.round(row.AVG_ACCURACY || 0),
    averageResponseTime: Math.round(row.AVG_RESPONSE_TIME || 0),
    averageTimerSeconds: Math.round(row.AVG_TIMER_SECONDS || 0)
  }));
}

async function getTraitPerformance(whereClause: string, bindParams: any) {
  const result = await executeQuery(`
    SELECT
      trait,
      COUNT(*) as assessments,
      AVG(score) as avg_score,
      MIN(score) as min_score,
      MAX(score) as max_score
    FROM (
      SELECT
        a.id as assessment_id,
        JSON_VALUE(ai.metrics_json, '$.serverScoring.traitScores[*].trait') as trait,
        JSON_VALUE(ai.metrics_json, '$.serverScoring.traitScores[*].score') as score
      FROM ASSESSMENT_ITEMS ai
      JOIN ASSESSMENTS a ON ai.assessment_id = a.id
      WHERE ${whereClause}
    )
    GROUP BY trait
    ORDER BY avg_score DESC
  `, bindParams);

  return result.rows.map((row: any) => ({
    trait: row.TRAIT,
    assessments: row.ASSESSMENTS,
    averageScore: Math.round(row.AVG_SCORE || 0),
    minScore: row.MIN_SCORE || 0,
    maxScore: row.MAX_SCORE || 0
  }));
}

async function getDifficultyAnalysis(whereClause: string, bindParams: any) {
  // Analyze performance by different difficulty levels
  // This is a simplified version - in practice you'd have difficulty metadata
  const result = await executeQuery(`
    SELECT
      CASE
        WHEN ai.score >= 80 THEN 'Easy'
        WHEN ai.score >= 60 THEN 'Medium'
        ELSE 'Hard'
      END as difficulty_level,
      COUNT(*) as count,
      AVG(ai.score) as avg_score,
      AVG(JSON_VALUE(ai.metrics_json, '$.serverScoring.accuracy')) as avg_accuracy
    FROM ASSESSMENT_ITEMS ai
    JOIN ASSESSMENTS a ON ai.assessment_id = a.id
    WHERE ${whereClause}
    GROUP BY
      CASE
        WHEN ai.score >= 80 THEN 'Easy'
        WHEN ai.score >= 60 THEN 'Medium'
        ELSE 'Hard'
      END
    ORDER BY avg_score DESC
  `, bindParams);

  return result.rows.map((row: any) => ({
    difficultyLevel: row.DIFFICULTY_LEVEL,
    count: row.COUNT,
    averageScore: Math.round(row.AVG_SCORE || 0),
    averageAccuracy: Math.round(row.AVG_ACCURACY || 0)
  }));
}

async function getTimeBasedAnalysis(whereClause: string, bindParams: any) {
  // Analyze performance patterns over time
  const result = await executeQuery(`
    SELECT
      TRUNC(a.completed_at, 'HH') as hour_of_day,
      COUNT(*) as attempts,
      AVG(ai.score) as avg_score,
      AVG(JSON_VALUE(ai.metrics_json, '$.serverScoring.averageResponseTime')) as avg_response_time
    FROM ASSESSMENT_ITEMS ai
    JOIN ASSESSMENTS a ON ai.assessment_id = a.id
    WHERE ${whereClause}
    GROUP BY TRUNC(a.completed_at, 'HH')
    ORDER BY hour_of_day
  `, bindParams);

  return result.rows.map((row: any) => ({
    hourOfDay: row.HOUR_OF_DAY,
    attempts: row.ATTEMPTS,
    averageScore: Math.round(row.AVG_SCORE || 0),
    averageResponseTime: Math.round(row.AVG_RESPONSE_TIME || 0)
  }));
}

