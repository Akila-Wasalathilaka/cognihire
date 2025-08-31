import { NextRequest, NextResponse } from 'next/server';
import { completeAssessmentSchema } from '@/lib/validation/schemas';
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

    // Verify assessment belongs to candidate and is in progress
    const assessmentResult = await executeQuery(
      `SELECT a.status, a.candidate_id, a.job_role_id, a.tenant_id, a.total_score,
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

    if (assessment.STATUS !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Assessment is not in progress' }, { status: 400 });
    }

    // Calculate total score from completed items
    const scoreResult = await executeQuery(
      'SELECT SUM(score) as total_score FROM ASSESSMENT_ITEMS WHERE assessment_id = :assessmentId AND status = :status',
      [assessmentId, 'SUBMITTED']
    );

    const totalScore = scoreResult.rows?.[0]?.TOTAL_SCORE || 0;

    // Complete assessment
    await executeQuery(
      'UPDATE ASSESSMENTS SET status = :status, completed_at = SYSTIMESTAMP, total_score = :totalScore WHERE id = :assessmentId',
      ['COMPLETED', totalScore, assessmentId]
    );

    // Log audit event
    await executeQuery(
      `INSERT INTO AUDIT_LOGS (id, tenant_id, actor_user_id, action, target_type, target_id, ip, user_agent, payload_json, created_at)
       VALUES (:id, :tenantId, :actorId, :action, :targetType, :targetId, :ip, :userAgent, :payload, SYSTIMESTAMP)`,
      [
        generateId(),
        payload.tenantId,
        payload.userId,
        'ASSESSMENT_COMPLETED',
        'ASSESSMENT',
        assessmentId,
        request.ip || null,
        request.headers.get('user-agent') || null,
        JSON.stringify({ totalScore, jobRoleTitle: assessment.JOB_ROLE_TITLE }),
      ]
    );

    logger.info('Assessment completed by candidate', {
      candidateId: payload.userId,
      candidateUsername: payload.username,
      assessmentId,
      jobRoleTitle: assessment.JOB_ROLE_TITLE,
      totalScore,
      ip: request.ip,
    });

    return NextResponse.json({
      message: 'Assessment completed successfully',
      assessment: {
        id: assessmentId,
        status: 'COMPLETED',
        totalScore,
      },
    });
  } catch (error) {
    logger.error('Complete assessment error', { error: error.message, assessmentId: params.id });
    return NextResponse.json({ error: 'Failed to complete assessment' }, { status: 500 });
  }
}
