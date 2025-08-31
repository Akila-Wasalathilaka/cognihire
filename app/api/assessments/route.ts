import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth/auth';
import { executeQuery } from '@/lib/db/postgres';
import logger from '@/lib/logger';

// GET /api/assessments - Get current user's assessment
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'CANDIDATE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current assessment for the candidate
    const result = await executeQuery(`
      SELECT
        a.id,
        a.job_role_id,
        a.status,
        a.started_at,
        a.total_score,
        jr.title as job_role_title,
        jr.traits_json,
        jr.config_json
      FROM ASSESSMENTS a
      JOIN JOB_ROLES jr ON a.job_role_id = jr.id
      WHERE a.candidate_id = :candidateId
      AND a.status IN ('NOT_STARTED', 'IN_PROGRESS')
      ORDER BY a.created_at DESC
      FETCH FIRST 1 ROWS ONLY
    `, [auth.userId]);

    if (result.rows && result.rows.length > 0) {
      const assessment = result.rows[0];
      return NextResponse.json({
        assessment: {
          id: assessment.ID,
          jobRoleId: assessment.JOB_ROLE_ID,
          status: assessment.STATUS,
          startedAt: assessment.STARTED_AT,
          totalScore: assessment.TOTAL_SCORE,
          jobRole: {
            title: assessment.JOB_ROLE_TITLE,
            traits: assessment.TRAITS_JSON ? JSON.parse(assessment.TRAITS_JSON) : {},
            config: assessment.CONFIG_JSON ? JSON.parse(assessment.CONFIG_JSON) : {}
          }
        }
      });
    }

    return NextResponse.json({ assessment: null });
  } catch (err) {
    logger.error('Error fetching current assessment:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/assessments - Create new assessment (admin only)
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { candidateId, jobRoleId } = body;

    if (!candidateId || !jobRoleId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if candidate already has an active assessment
    const existingAssessment = await executeQuery(`
      SELECT id FROM ASSESSMENTS
      WHERE candidate_id = :candidateId
      AND status IN ('NOT_STARTED', 'IN_PROGRESS')
    `, [candidateId]);

    if (existingAssessment.rows && existingAssessment.rows.length > 0) {
      return NextResponse.json({ error: 'Candidate already has an active assessment' }, { status: 400 });
    }

    // Create new assessment
    const assessmentId = `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await executeQuery(`
      INSERT INTO ASSESSMENTS (id, tenant_id, candidate_id, job_role_id, status, created_at)
      VALUES (:id, :tenantId, :candidateId, :jobRoleId, 'NOT_STARTED', SYSTIMESTAMP)
    `, [assessmentId, auth.tenantId, candidateId, jobRoleId]);

    logger.info('Assessment created', { assessmentId, candidateId, jobRoleId, adminId: auth.userId });

    return NextResponse.json({
      assessment: {
        id: assessmentId,
        candidateId,
        jobRoleId,
        status: 'NOT_STARTED'
      }
    });
  } catch (err) {
    logger.error('Error creating assessment:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

