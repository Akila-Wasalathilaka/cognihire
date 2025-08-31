import { NextRequest, NextResponse } from 'next/server';
import { updateUserSchema } from '@/lib/validation/schemas';
import { executeQuery, generateId } from '@/lib/db/postgres';
import { requireAdmin } from '@/lib/auth/jwt';
import logger from '@/lib/logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { payload } = await requireAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;
    const body = await request.json();
    const updateData = updateUserSchema.parse(body);

    // Check if user exists and belongs to same tenant
    const userResult = await executeQuery(
      'SELECT username, role FROM USERS WHERE id = :userId AND tenant_id = :tenantId',
      [userId, payload.tenantId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentUser = userResult.rows[0] as any;

    // Build update query dynamically
    const updateFields: string[] = [];
    const bindParams: any[] = [];
    const updatePayload: any = {};

    if (updateData.email !== undefined) {
      updateFields.push('email = :email');
      bindParams.push(updateData.email);
      updatePayload.email = updateData.email;
    }

    if (updateData.username !== undefined) {
      updateFields.push('username = :username');
      bindParams.push(updateData.username);
      updatePayload.username = updateData.username;
    }

    if (updateData.isActive !== undefined) {
      updateFields.push('is_active = :isActive');
      bindParams.push(updateData.isActive ? 1 : 0);
      updatePayload.isActive = updateData.isActive;
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Update user
    const updateSql = `UPDATE USERS SET ${updateFields.join(', ')} WHERE id = :userId`;
    bindParams.push(userId);

    await executeQuery(updateSql, bindParams);

    // Update candidate profile if needed
    if (updateData.fullName !== undefined || updateData.jobRoleId !== undefined) {
      const profileFields: string[] = [];
      const profileParams: any[] = [];

      if (updateData.fullName !== undefined) {
        profileFields.push('full_name = :fullName');
        profileParams.push(updateData.fullName);
        updatePayload.fullName = updateData.fullName;
      }

      if (updateData.jobRoleId !== undefined) {
        profileFields.push('job_role_id = :jobRoleId');
        profileParams.push(updateData.jobRoleId);
        updatePayload.jobRoleId = updateData.jobRoleId;
      }

      if (profileFields.length > 0) {
        const profileSql = `UPDATE CANDIDATE_PROFILES SET ${profileFields.join(', ')} WHERE user_id = :userId`;
        profileParams.push(userId);

        await executeQuery(profileSql, profileParams);
      }
    }

    // Log audit event
    await executeQuery(
      `INSERT INTO AUDIT_LOGS (id, tenant_id, actor_user_id, action, target_type, target_id, ip, user_agent, payload_json, created_at)
       VALUES (:id, :tenantId, :actorId, :action, :targetType, :targetId, :ip, :userAgent, :payload, SYSTIMESTAMP)`,
      [
        generateId(),
        payload.tenantId,
        payload.userId,
        'USER_UPDATED',
        'USER',
        userId,
        request.ip || null,
        request.headers.get('user-agent') || null,
        JSON.stringify(updatePayload),
      ]
    );

    logger.info('User updated by admin', {
      adminId: payload.userId,
      adminUsername: payload.username,
      updatedUserId: userId,
      updatedUsername: currentUser.USERNAME,
      changes: updatePayload,
      ip: request.ip,
    });

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (error) {
    logger.error('Update user error', { error: error.message, userId: params.id });
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

    const userId = params.id;

    // Check if user exists and belongs to same tenant
    const userResult = await executeQuery(
      'SELECT username, role FROM USERS WHERE id = :userId AND tenant_id = :tenantId',
      [userId, payload.tenantId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentUser = userResult.rows[0] as any;

    // Soft delete by deactivating
    await executeQuery(
      'UPDATE USERS SET is_active = 0 WHERE id = :userId',
      [userId]
    );

    // Log audit event
    await executeQuery(
      `INSERT INTO AUDIT_LOGS (id, tenant_id, actor_user_id, action, target_type, target_id, ip, user_agent, payload_json, created_at)
       VALUES (:id, :tenantId, :actorId, :action, :targetType, :targetId, :ip, :userAgent, :payload, SYSTIMESTAMP)`,
      [
        generateId(),
        payload.tenantId,
        payload.userId,
        'USER_DEACTIVATED',
        'USER',
        userId,
        request.ip || null,
        request.headers.get('user-agent') || null,
        JSON.stringify({ username: currentUser.USERNAME, role: currentUser.ROLE }),
      ]
    );

    logger.info('User deactivated by admin', {
      adminId: payload.userId,
      adminUsername: payload.username,
      deactivatedUserId: userId,
      deactivatedUsername: currentUser.USERNAME,
      ip: request.ip,
    });

    return NextResponse.json({ message: 'User deactivated successfully' });
  } catch (error) {
    logger.error('Delete user error', { error: error.message, userId: params.id });
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
  }
}
