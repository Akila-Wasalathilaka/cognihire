import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, generateId } from '@/lib/db/postgres';
import { verifyAccessToken, hashPassword, generateRandomPassword } from '@/lib/auth/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const isActive = url.searchParams.get('is_active');
    
    let query = `
      SELECT u.id, u.username, u.email, u.is_active, u.created_at, u.last_login_at,
             cp.full_name, jr.title as job_role_title
      FROM users u
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN job_roles jr ON cp.job_role_id = jr.id
      WHERE u.role = 'CANDIDATE'
    `;
    
    const params: any[] = [];
    if (isActive !== null) {
      query += ' AND u.is_active = $1';
      params.push(isActive === 'true');
    }
    
    query += ' ORDER BY u.created_at DESC';

    const result = await executeQuery(query, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, full_name, username } = await request.json();

    // Check if email already exists
    const existingUser = await executeQuery(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    // Generate password and user ID
    const password = generateRandomPassword(8);
    const userId = generateId();
    const passwordHash = await hashPassword(password);

    // Get default tenant
    const tenantResult = await executeQuery('SELECT id FROM tenants LIMIT 1');
    const tenantId = tenantResult.rows[0]?.id || 'default-tenant';

    // Create user
    await executeQuery(
      `INSERT INTO users (id, tenant_id, username, email, password_hash, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, 'CANDIDATE', true, NOW())`,
      [userId, tenantId, username, email, passwordHash]
    );

    // Create candidate profile
    await executeQuery(
      `INSERT INTO candidate_profiles (user_id, full_name, created_at)
       VALUES ($1, $2, NOW())`,
      [userId, full_name]
    );

    return NextResponse.json({
      message: 'Candidate created successfully',
      candidate: {
        id: userId,
        username,
        email,
        full_name,
        password
      }
    });
  } catch (error) {
    console.error('Error creating candidate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}