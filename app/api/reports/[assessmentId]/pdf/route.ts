import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { getAuthFromRequest } from '@/lib/auth/auth';
import { aggregateTraitScores } from '@/lib/scoring/gameScoring';
import logger from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { assessmentId: string } }
) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assessmentId = params.assessmentId;

    // Verify user has access to this assessment
    const accessCheck = await executeQuery(`
      SELECT
        a.id,
        a.candidate_id,
        a.job_role_id,
        a.status,
        a.total_score,
        a.started_at,
        a.completed_at,
        a.integrity_flags,
        u.username,
        u.email,
        cp.full_name,
        jr.title as job_role_title,
        jr.traits_json
      FROM ASSESSMENTS a
      JOIN USERS u ON a.candidate_id = u.id
      LEFT JOIN CANDIDATE_PROFILES cp ON u.id = cp.user_id
      JOIN JOB_ROLES jr ON a.job_role_id = jr.id
      WHERE a.id = :assessmentId
    `, [assessmentId]);

    if (!accessCheck.rows || accessCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const assessment = accessCheck.rows[0] as any;

    // Check permissions (admin can access all, candidates only their own)
    if (auth.role !== 'ADMIN' && assessment.CANDIDATE_ID !== auth.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get assessment items with detailed results
    const itemsResult = await executeQuery(`
      SELECT
        ai.id,
        ai.game_id,
        ai.score,
        ai.metrics_json,
        ai.status,
        ai.timer_seconds,
        g.title as game_title,
        g.code as game_code
      FROM ASSESSMENT_ITEMS ai
      JOIN GAMES g ON ai.game_id = g.id
      WHERE ai.assessment_id = :assessmentId
      ORDER BY ai.order_index
    `, [assessmentId]);

    const items = itemsResult.rows || [];

    // Generate comprehensive report data
    const reportData = await generateReportData(assessment, items);

    // Generate PDF
    const pdfBuffer = await generatePDF(reportData);

    // Return PDF with appropriate headers
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="assessment-report-${assessmentId}.pdf"`,
      },
    });

  } catch (error) {
    logger.error('Error generating PDF report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

async function generateReportData(assessment: any, items: any[]) {
  // Parse integrity flags
  let integrityFlags = { summary: { suspiciousActivity: false } };
  if (assessment.INTEGRITY_FLAGS) {
    integrityFlags = JSON.parse(assessment.INTEGRITY_FLAGS);
  }

  // Collect all game results for trait aggregation
  const gameResults = items
    .filter(item => item.METRICS_JSON)
    .map(item => {
      const metrics = JSON.parse(item.METRICS_JSON);
      return metrics.serverScoring;
    })
    .filter(Boolean);

  // Aggregate trait scores
  const traitScores = aggregateTraitScores(gameResults);

  // Calculate overall assessment metrics
  const completedItems = items.filter(item => item.STATUS === 'SUBMITTED');
  const averageScore = completedItems.length > 0
    ? completedItems.reduce((sum, item) => sum + (item.SCORE || 0), 0) / completedItems.length
    : 0;

  return {
    assessment: {
      id: assessment.ID,
      candidateName: assessment.FULL_NAME || assessment.USERNAME,
      candidateEmail: assessment.EMAIL,
      jobRole: assessment.JOB_ROLE_TITLE,
      status: assessment.STATUS,
      startedAt: assessment.STARTED_AT,
      completedAt: assessment.COMPLETED_AT,
      overallScore: Math.round(assessment.TOTAL_SCORE || averageScore),
      integrityFlags: integrityFlags.summary
    },
    traitScores,
    gameResults: items.map(item => ({
      gameTitle: item.GAME_TITLE,
      gameCode: item.GAME_CODE,
      score: item.SCORE || 0,
      status: item.STATUS,
      timerSeconds: item.TIMER_SECONDS,
      metrics: item.METRICS_JSON ? JSON.parse(item.METRICS_JSON) : null
    })),
    summary: {
      totalGames: items.length,
      completedGames: completedItems.length,
      averageScore: Math.round(averageScore),
      suspiciousActivity: integrityFlags.summary.suspiciousActivity
    }
  };
}

async function generatePDF(reportData: any): Promise<Buffer> {
  // For now, generate a simple HTML-based PDF
  // In production, you'd use puppeteer or a similar library
  const html = generateReportHTML(reportData);

  // This is a placeholder - in a real implementation, you'd use puppeteer
  // to convert HTML to PDF
  const pdfBuffer = Buffer.from(html);

  return pdfBuffer;
}

function generateReportHTML(data: any): string {
  const { assessment, traitScores, gameResults, summary } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>CogniHire Assessment Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .trait-scores { display: flex; flex-wrap: wrap; gap: 20px; }
        .trait-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; min-width: 150px; }
        .game-result { border: 1px solid #eee; padding: 10px; margin: 10px 0; border-radius: 4px; }
        .score-bar { background: #f0f0f0; height: 20px; border-radius: 10px; overflow: hidden; }
        .score-fill { background: #3b82f6; height: 100%; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CogniHire Cognitive Assessment Report</h1>
        <h2>${assessment.candidateName}</h2>
        <p>Job Role: ${assessment.jobRole}</p>
        <p>Assessment Date: ${new Date(assessment.completedAt || assessment.startedAt).toLocaleDateString()}</p>
      </div>

      <div class="section">
        <h2>Assessment Summary</h2>
        <p><strong>Overall Score:</strong> ${assessment.overallScore}%</p>
        <p><strong>Games Completed:</strong> ${summary.completedGames}/${summary.totalGames}</p>
        <p><strong>Status:</strong> ${assessment.status}</p>

        ${assessment.integrityFlags.suspiciousActivity ?
          '<div class="warning"><strong>⚠️ Integrity Concern:</strong> Suspicious activity was detected during this assessment.</div>' :
          '<div style="color: green;">✅ No integrity concerns detected.</div>'}
      </div>

      <div class="section">
        <h2>Cognitive Trait Scores</h2>
        <div class="trait-scores">
          ${Object.entries(traitScores).map(([trait, score]) => `
            <div class="trait-card">
              <h3>${trait.charAt(0).toUpperCase() + trait.slice(1)}</h3>
              <div class="score-bar">
                <div class="score-fill" style="width: ${Math.min(100, score as number)}%"></div>
              </div>
              <p style="text-align: center; margin-top: 5px;">${Math.round(score as number)}%</p>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section">
        <h2>Game Results</h2>
        ${gameResults.map((game: any) => `
          <div class="game-result">
            <h3>${game.gameTitle} (${game.gameCode})</h3>
            <p><strong>Score:</strong> ${game.score}% | <strong>Status:</strong> ${game.status}</p>
            ${game.metrics?.serverScoring ? `
              <p><strong>Accuracy:</strong> ${game.metrics.serverScoring.accuracy}%</p>
              <p><strong>Average Response Time:</strong> ${game.metrics.serverScoring.averageResponseTime}ms</p>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <div class="section">
        <h2>Report Information</h2>
        <p><strong>Report Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Assessment ID:</strong> ${assessment.id}</p>
        <p style="font-size: 12px; color: #666;">
          This report was generated by CogniHire's automated assessment system.
          Scores represent cognitive performance metrics based on scientifically validated tasks.
        </p>
      </div>
    </body>
    </html>
  `;
}