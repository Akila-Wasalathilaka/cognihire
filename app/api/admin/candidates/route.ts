import { NextRequest, NextResponse } from 'next/server';
import { createUser, generateRandomPassword } from '../../../../lib/auth/auth';
import { createUserSchema } from '../../../../lib/validation/schemas';
import { executeQuery, generateId } from '../../../../lib/db/postgres';
import { requireAdmin } from '../../../../lib/auth/jwt';
import logger from '../../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { payload } = await requireAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role') || 'CANDIDATE';
    const q = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    let whereConditions = ['u.role = :role', 'u.tenant_id = :tenantId'];
    let bindParams: any = { role: role, tenantId: payload.tenantId };

    if (status) {
      bindParams.isActive = status === 'active' ? 1 : 0;
    }

    if (q) {
      bindParams.query = `%${q}%`;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get candidates with profile info
    const sql = `
      SELECT u.id, u.username, u.email, u.is_active, u.created_at, u.last_login_at,
             cp.full_name, cp.job_role_id, jr.title as job_role_title
      FROM USERS u
      LEFT JOIN CANDIDATE_PROFILES cp ON u.id = cp.user_id
      LEFT JOIN JOB_ROLES jr ON cp.job_role_id = jr.id
      WHERE ${whereClause}
      ORDER BY u.created_at DESC
      OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
    `;

    bindParams.offset = offset;
    bindParams.limit = limit;

    // Convert bindParams object to array in correct order
    const bindArray = [
      bindParams.role,
      bindParams.tenantId,
      ...(bindParams.isActive !== undefined ? [bindParams.isActive] : []),
      ...(bindParams.query !== undefined ? [bindParams.query] : []),
      bindParams.offset,
      bindParams.limit
    ];

    const result = await executeQuery(sql, bindArray);

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total
      FROM USERS u
      LEFT JOIN CANDIDATE_PROFILES cp ON u.id = cp.user_id
      WHERE ${whereClause}
    `;

    // Create count parameters array (without offset/limit)
    const countBindArray = [
      bindParams.role,
      bindParams.tenantId,
      ...(bindParams.isActive !== undefined ? [bindParams.isActive] : []),
      ...(bindParams.query !== undefined ? [bindParams.query] : [])
    ];

    const countResult = await executeQuery(countSql, countBindArray);

    const total = countResult.rows?.[0]?.TOTAL || 0;

    return NextResponse.json({
      candidates: result.rows || [],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get candidates error', { error: error.message });
    return NextResponse.json({ error: 'Failed to get candidates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { payload } = await requireAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, username, password, role, fullName, jobRoleId } = createUserSchema.parse(body);

    // Generate random password if not provided
    const finalPassword = password || generateRandomPassword();

    // Create user
    const user = await createUser(payload.tenantId, email || null, username, finalPassword, role);

    // If candidate, create candidate profile
    if (role === 'CANDIDATE') {
      await executeQuery(
        `INSERT INTO CANDIDATE_PROFILES (user_id, full_name, job_role_id, metadata_json)
         VALUES (:userId, :fullName, :jobRoleId, :metadata)`,
        [
          user.id,
          fullName || null,
          jobRoleId || null,
          JSON.stringify({ createdBy: payload.userId }),
        ]
      );
    }

    // Log audit event
    await executeQuery(
      `INSERT INTO AUDIT_LOGS (id, tenant_id, actor_user_id, action, target_type, target_id, ip, user_agent, payload_json, created_at)
       VALUES (:id, :tenantId, :actorId, :action, :targetType, :targetId, :ip, :userAgent, :payload, SYSTIMESTAMP)`,
      [
        generateId(),
        payload.tenantId,
        payload.userId,
        'USER_CREATED',
        'USER',
        user.id,
        request.ip || null,
        request.headers.get('user-agent') || null,
        JSON.stringify({ username: user.username, role: user.role }),
      ]
    );

    logger.info('User created by admin', {
      adminId: payload.userId,
      adminUsername: payload.username,
      newUserId: user.id,
      newUsername: user.username,
      role: user.role,
      ip: request.ip,
    });

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId,
      },
      generatedPassword: password ? undefined : finalPassword, // Only return if auto-generated
    }, { status: 201 });
  } catch (error) {
    logger.error('Create user error', { error: error.message });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

