import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { getAuthFromRequest } from '@/lib/auth/auth';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereConditions = [];
    let bindParams: any[] = [];

    // Add tenant filter
    if (tenantId) {
      whereConditions.push('u.tenant_id = :tenantId');
      bindParams.push(tenantId);
    } else {
      // If no specific tenant requested, use current user's tenant
      whereConditions.push('u.tenant_id = :tenantId');
      bindParams.push(auth.tenantId);
    }

    // Add role filter
    if (role) {
      whereConditions.push('u.role = :role');
      bindParams.push(role);
    }

    // Add status filter
    if (status) {
      whereConditions.push('u.is_active = :isActive');
      bindParams.push(status === 'active' ? 1 : 0);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get users
    const sql = `
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
        jr.title as job_role_title
      FROM USERS u
      LEFT JOIN CANDIDATE_PROFILES cp ON u.id = cp.user_id
      LEFT JOIN JOB_ROLES jr ON cp.job_role_id = jr.id
      ${whereClause}
      ORDER BY u.created_at DESC
      OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
    `;

    bindParams.push(offset, limit);

    const result = await executeQuery(sql, bindParams);

    const users = (result.rows || []).map((row: any) => ({
      id: row.ID,
      username: row.USERNAME,
      email: row.EMAIL,
      role: row.ROLE,
      isActive: row.IS_ACTIVE === 1,
      createdAt: row.CREATED_AT,
      lastLoginAt: row.LAST_LOGIN_AT,
      tenantId: row.TENANT_ID,
      fullName: row.FULL_NAME,
      jobRoleTitle: row.JOB_ROLE_TITLE
    }));

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total
      FROM USERS u
      ${whereClause}
    `;

    const countParams = bindParams.slice(0, -2); // Remove offset and limit
    const countResult = await executeQuery(countSql, countParams);
    const total = countResult.rows?.[0]?.TOTAL || 0;

    return NextResponse.json({
      users,
      total,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { username, email, password, role = 'CANDIDATE', fullName, jobRoleId } = body;

    if (!username || !email || !password) {
      return NextResponse.json({
        error: 'Username, email, and password are required'
      }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await executeQuery(
      'SELECT id FROM USERS WHERE username = :username OR email = :email',
      [username, email]
    );

    if (existingUser.rows && existingUser.rows.length > 0) {
      return NextResponse.json({
        error: 'User with this username or email already exists'
      }, { status: 400 });
    }

    // Create user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await executeQuery(`
      INSERT INTO USERS (id, username, email, password_hash, role, tenant_id, is_active, created_at)
      VALUES (:id, :username, :email, :passwordHash, :role, :tenantId, :isActive, SYSTIMESTAMP)
    `, [
      userId,
      username,
      email,
      password, // Note: In production, this should be hashed
      role,
      auth.tenantId,
      1
    ]);

    // Create candidate profile if fullName or jobRoleId provided
    if (fullName || jobRoleId) {
      const profileId = `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await executeQuery(`
        INSERT INTO CANDIDATE_PROFILES (id, user_id, full_name, job_role_id)
        VALUES (:id, :userId, :fullName, :jobRoleId)
      `, [
        profileId,
        userId,
        fullName || null,
        jobRoleId || null
      ]);
    }

    logger.info('User created by admin', {
      userId,
      username,
      email,
      role,
      createdBy: auth.userId
    });

    return NextResponse.json({
      message: 'User created successfully',
      userId
    }, { status: 201 });
  } catch (error) {
    logger.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

