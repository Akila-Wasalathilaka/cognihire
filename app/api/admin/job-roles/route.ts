import { NextRequest, NextResponse } from 'next/server';
import { createJobRoleSchema } from '../../../../lib/validation/schemas';
import { executeQuery, generateId } from '../../../../lib/db/oracle';
import { requireAdmin } from '../../../../lib/auth/jwt';
import logger from '../../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { payload } = await requireAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    let whereConditions = ['tenant_id = :tenantId'];
    let bindParams: any = { tenantId: payload.tenantId };

    if (q) {
      whereConditions.push('(title LIKE :query OR description LIKE :query)');
      bindParams.query = `%${q}%`;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get job roles
    const sql = `
      SELECT id, title, description, traits_json, config_json, created_at
      FROM JOB_ROLES
      WHERE ${whereClause}
      ORDER BY created_at DESC
      OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
    `;

    bindParams.offset = offset;
    bindParams.limit = limit;

    const result = await executeQuery(sql, bindParams);

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total
      FROM JOB_ROLES
      WHERE ${whereClause}
    `;

    const countParams: any = { tenantId: payload.tenantId };
    if (q) {
      countParams.query = `%${q}%`;
    }

    const countResult = await executeQuery(countSql, countParams);

    const total = countResult.rows?.[0]?.TOTAL || 0;

    // Parse JSON fields
    const jobRoles = result.rows?.map((row: any) => ({
      id: row.ID,
      title: row.TITLE,
      description: row.DESCRIPTION,
      traits: row.TRAITS_JSON ? JSON.parse(row.TRAITS_JSON) : null,
      config: row.CONFIG_JSON ? JSON.parse(row.CONFIG_JSON) : null,
      createdAt: row.CREATED_AT,
    })) || [];

    return NextResponse.json({
      jobRoles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get job roles error', { error: error.message });
    return NextResponse.json({ error: 'Failed to get job roles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { payload } = await requireAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createJobRoleSchema.parse(body);
    const { title, description, requirements, traitsJson, configJson } = validatedData;

    const jobRoleId = generateId();

    // Transform requirements to traits_json if provided
    let finalTraitsJson = traitsJson;
    if (requirements && !traitsJson) {
      finalTraitsJson = JSON.stringify({ requirements });
    }

    // Create job role
    await executeQuery(
      `INSERT INTO JOB_ROLES (id, tenant_id, title, description, traits_json, config_json, created_at)
       VALUES (:id, :tenantId, :title, :description, :traitsJson, :configJson, SYSTIMESTAMP)`,
      [
        jobRoleId,
        payload.tenantId,
        title,
        description || null,
        finalTraitsJson || null,
        configJson || null,
      ]
    );

    // Log audit event
    await executeQuery(
      `INSERT INTO AUDIT_LOGS (id, tenant_id, actor_user_id, action, target_type, target_id, ip, user_agent, payload_json, created_at)
       VALUES (:id, :tenantId, :actorId, :action, :targetType, :targetId, :ip, :userAgent, :payload, SYSTIMESTAMP)`,
      [
        generateId(),
        payload.tenantId,
        payload.userId,
        'JOB_ROLE_CREATED',
        'JOB_ROLE',
        jobRoleId,
        request.ip || null,
        request.headers.get('user-agent') || null,
        JSON.stringify({ title }),
      ]
    );

    logger.info('Job role created by admin', {
      adminId: payload.userId,
      adminUsername: payload.username,
      jobRoleId,
      title,
      ip: request.ip,
    });

    return NextResponse.json({
      message: 'Job role created successfully',
      jobRole: {
        id: jobRoleId,
        title,
        description,
        traits: traitsJson ? JSON.parse(traitsJson) : null,
        config: configJson ? JSON.parse(configJson) : null,
      },
    }, { status: 201 });
  } catch (error) {
    logger.error('Create job role error', { error: error.message });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

