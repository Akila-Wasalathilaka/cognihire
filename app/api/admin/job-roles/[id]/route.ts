import { NextRequest, NextResponse } from 'next/server';
import { updateJobRoleSchema } from '../../../../../lib/validation/schemas';
import { executeQuery, generateId } from '../../../../../lib/db/oracle';
import { requireAdmin } from '../../../../../lib/auth/jwt';
import logger from '../../../../../lib/logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { payload } = await requireAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jobRoleId = params.id;
    const body = await request.json();
    const updateData = updateJobRoleSchema.parse(body);

    // Check if job role exists and belongs to same tenant
    const jobRoleResult = await executeQuery(
      'SELECT title FROM JOB_ROLES WHERE id = :jobRoleId AND tenant_id = :tenantId',
      [jobRoleId, payload.tenantId]
    );

    if (!jobRoleResult.rows || jobRoleResult.rows.length === 0) {
      return NextResponse.json({ error: 'Job role not found' }, { status: 404 });
    }

    const currentJobRole = jobRoleResult.rows[0] as any;

    // Build update query dynamically
    const updateFields: string[] = [];
    const bindParams: any[] = [];
    const updatePayload: any = {};

    if (updateData.title !== undefined) {
      updateFields.push('title = :title');
      bindParams.push(updateData.title);
      updatePayload.title = updateData.title;
    }

    if (updateData.description !== undefined) {
      updateFields.push('description = :description');
      bindParams.push(updateData.description);
      updatePayload.description = updateData.description;
    }

    if (updateData.traitsJson !== undefined) {
      updateFields.push('traits_json = :traitsJson');
      bindParams.push(updateData.traitsJson);
      updatePayload.traitsJson = updateData.traitsJson;
    }

    if (updateData.configJson !== undefined) {
      updateFields.push('config_json = :configJson');
      bindParams.push(updateData.configJson);
      updatePayload.configJson = updateData.configJson;
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Update job role
    const updateSql = `UPDATE JOB_ROLES SET ${updateFields.join(', ')} WHERE id = :jobRoleId`;
    bindParams.push(jobRoleId);

    await executeQuery(updateSql, bindParams);

    // Log audit event
    await executeQuery(
      `INSERT INTO AUDIT_LOGS (id, tenant_id, actor_user_id, action, target_type, target_id, ip, user_agent, payload_json, created_at)
       VALUES (:id, :tenantId, :actorId, :action, :targetType, :targetId, :ip, :userAgent, :payload, SYSTIMESTAMP)`,
      [
        generateId(),
        payload.tenantId,
        payload.userId,
        'JOB_ROLE_UPDATED',
        'JOB_ROLE',
        jobRoleId,
        request.ip || null,
        request.headers.get('user-agent') || null,
        JSON.stringify(updatePayload),
      ]
    );

    logger.info('Job role updated by admin', {
      adminId: payload.userId,
      adminUsername: payload.username,
      jobRoleId,
      oldTitle: currentJobRole.TITLE,
      changes: updatePayload,
      ip: request.ip,
    });

    return NextResponse.json({ message: 'Job role updated successfully' });
  } catch (error) {
    logger.error('Update job role error', { error: error.message, jobRoleId: params.id });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { payload } = await requireAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jobRoleId = params.id;

    // Check if job role exists and belongs to same tenant
    const jobRoleResult = await executeQuery(
      'SELECT title FROM JOB_ROLES WHERE id = :jobRoleId AND tenant_id = :tenantId',
      [jobRoleId, payload.tenantId]
    );

    if (!jobRoleResult.rows || jobRoleResult.rows.length === 0) {
      return NextResponse.json({ error: 'Job role not found' }, { status: 404 });
    }

    const currentJobRole = jobRoleResult.rows[0] as any;

    // Check if job role is being used by any candidates
    const usageResult = await executeQuery(
      'SELECT COUNT(*) as count FROM CANDIDATE_PROFILES WHERE job_role_id = :jobRoleId',
      [jobRoleId]
    );

    if (usageResult.rows && usageResult.rows[0].COUNT > 0) {
      return NextResponse.json({
        error: 'Cannot delete job role that is assigned to candidates'
      }, { status: 400 });
    }

    // Check if job role is being used by any assessments
    const assessmentResult = await executeQuery(
      'SELECT COUNT(*) as count FROM ASSESSMENTS WHERE job_role_id = :jobRoleId',
      [jobRoleId]
    );

    if (assessmentResult.rows && assessmentResult.rows[0].COUNT > 0) {
      return NextResponse.json({
        error: 'Cannot delete job role that has assessments'
      }, { status: 400 });
    }

    // Check if job role is being used by any role game packages
    const roleGameResult = await executeQuery(
      'SELECT COUNT(*) as count FROM ROLE_GAME_PACKAGE WHERE job_role_id = :jobRoleId',
      [jobRoleId]
    );

    if (roleGameResult.rows && roleGameResult.rows[0].COUNT > 0) {
      return NextResponse.json({
        error: 'Cannot delete job role that has configured game packages'
      }, { status: 400 });
    }

    // Delete job role
    await executeQuery('DELETE FROM JOB_ROLES WHERE id = :jobRoleId', [jobRoleId]);

    // Log audit event
    await executeQuery(
      `INSERT INTO AUDIT_LOGS (id, tenant_id, actor_user_id, action, target_type, target_id, ip, user_agent, payload_json, created_at)
       VALUES (:id, :tenantId, :actorId, :action, :targetType, :targetId, :ip, :userAgent, :payload, SYSTIMESTAMP)`,
      [
        generateId(),
        payload.tenantId,
        payload.userId,
        'JOB_ROLE_DELETED',
        'JOB_ROLE',
        jobRoleId,
        request.ip || null,
        request.headers.get('user-agent') || null,
        JSON.stringify({ title: currentJobRole.TITLE }),
      ]
    );

    logger.info('Job role deleted by admin', {
      adminId: payload.userId,
      adminUsername: payload.username,
      jobRoleId,
      title: currentJobRole.TITLE,
      ip: request.ip,
    });

    return NextResponse.json({ message: 'Job role deleted successfully' });
  } catch (error: any) {
    logger.error('Delete job role error', { 
      error: error.message, 
      stack: error.stack,
      jobRoleId: params.id 
    });
    
    // Check if it's a foreign key constraint error
    if (error.message && error.message.includes('ORA-02292')) {
      return NextResponse.json({ 
        error: 'Cannot delete job role as it is referenced by other records' 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: `Failed to delete job role: ${error.message}` 
    }, { status: 500 });
  }
}
