import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { getAuthFromRequest } from '@/lib/auth/auth';
import logger from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;

    // Get user details with profile information
    const userResult = await executeQuery(`
      SELECT
        u.id,
        u.username,
        u.email,
        u.role,
        u.is_active,
        u.created_at,
        u.last_login_at,
        u.tenant_id,
        cp.full_name,
        cp.job_role_id,
        jr.title as job_role_title,
        jr.traits_json
      FROM USERS u
      LEFT JOIN CANDIDATE_PROFILES cp ON u.id = cp.user_id
      LEFT JOIN JOB_ROLES jr ON cp.job_role_id = jr.id
      WHERE u.id = :userId
    `, [userId]);

    if (!userResult.rows || userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0] as any;

    // Check permissions
    if (auth.role !== 'ADMIN' && user.TENANT_ID !== auth.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Format response
    const userData = {
      id: user.ID,
      username: user.USERNAME,
      email: user.EMAIL,
      role: user.ROLE,
      isActive: user.IS_ACTIVE === 1,
      createdAt: user.CREATED_AT,
      lastLoginAt: user.LAST_LOGIN_AT,
      tenantId: user.TENANT_ID,
      profile: user.FULL_NAME ? {
        fullName: user.FULL_NAME,
        jobRoleId: user.JOB_ROLE_ID,
        jobRoleTitle: user.JOB_ROLE_TITLE,
        traits: user.TRAITS_JSON ? JSON.parse(user.TRAITS_JSON) : null
      } : null
    };

    return NextResponse.json({ user: userData });
  } catch (error) {
    logger.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;
    const body = await request.json();
    const { email, isActive, fullName, jobRoleId } = body;

    // Verify user exists and check permissions
    const userResult = await executeQuery(
      'SELECT role, tenant_id FROM USERS WHERE id = :userId',
      [userId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0] as any;

    if (auth.role !== 'ADMIN' && user.TENANT_ID !== auth.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build update query
    const updateFields: string[] = [];
    const bindParams: any[] = [];

    if (email !== undefined) {
      updateFields.push('email = :email');
      bindParams.push(email);
    }

    if (isActive !== undefined) {
      updateFields.push('is_active = :isActive');
      bindParams.push(isActive ? 1 : 0);
    }

    if (updateFields.length > 0) {
      const updateSql = `UPDATE USERS SET ${updateFields.join(', ')} WHERE id = :userId`;
      bindParams.push(userId);

      await executeQuery(updateSql, bindParams);
    }

    // Update candidate profile if needed
    if (fullName !== undefined || jobRoleId !== undefined) {
      const profileFields: string[] = [];
      const profileParams: any[] = [];

      if (fullName !== undefined) {
        profileFields.push('full_name = :fullName');
        profileParams.push(fullName);
      }

      if (jobRoleId !== undefined) {
        profileFields.push('job_role_id = :jobRoleId');
        profileParams.push(jobRoleId);
      }

      if (profileFields.length > 0) {
        // Check if profile exists
        const profileResult = await executeQuery(
          'SELECT id FROM CANDIDATE_PROFILES WHERE user_id = :userId',
          [userId]
        );

        if (profileResult.rows && profileResult.rows.length > 0) {
          // Update existing profile
          const profileSql = `UPDATE CANDIDATE_PROFILES SET ${profileFields.join(', ')} WHERE user_id = :userId`;
          profileParams.push(userId);
          await executeQuery(profileSql, profileParams);
        } else {
          // Create new profile
          const profileSql = `INSERT INTO CANDIDATE_PROFILES (id, user_id, ${profileFields.map(f => f.split(' = ')[0]).join(', ')}) VALUES (:id, :userId, ${profileFields.map(() => '?').join(', ')})`;
          const newProfileId = `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await executeQuery(profileSql, [newProfileId, userId, ...profileParams]);
        }
      }
    }

    logger.info('User updated', {
      userId,
      updatedBy: auth.userId,
      changes: { email, isActive, fullName, jobRoleId }
    });

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (error) {
    logger.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;

    // Verify user exists and belongs to same tenant
    const userResult = await executeQuery(
      'SELECT username, tenant_id FROM USERS WHERE id = :userId',
      [userId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0] as any;

    if (user.TENANT_ID !== auth.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Soft delete by deactivating
    await executeQuery(
      'UPDATE USERS SET is_active = 0 WHERE id = :userId',
      [userId]
    );

    logger.info('User deactivated', {
      userId,
      username: user.USERNAME,
      deactivatedBy: auth.userId
    });

    return NextResponse.json({ message: 'User deactivated successfully' });
  } catch (error) {
    logger.error('Error deactivating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
