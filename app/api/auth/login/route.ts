import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, generateAccessToken } from '@/lib/auth/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const user = await authenticateUser(username, password);
    if (!user) {
      return NextResponse.json({ detail: 'Invalid credentials' }, { status: 401 });
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      username: user.username
    });

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'bearer',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_active: user.isActive
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ detail: 'Login failed' }, { status: 500 });
  }
}