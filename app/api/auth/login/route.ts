import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, generateAccessToken, generateRefreshToken, setAuthCookies } from '../../../../lib/auth/auth';
import { loginSchema } from '../../../../lib/validation/schemas';
import logger from '../../../../lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = loginSchema.parse(body);

    // Authenticate user
    const user = await authenticateUser(username, password);

    if (!user) {
      logger.warn('Failed login attempt', { username, ip: request.ip });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!user.isActive) {
      logger.warn('Login attempt for inactive user', { username, userId: user.id });
      return NextResponse.json({ error: 'Account is inactive' }, { status: 401 });
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      username: user.username,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      username: user.username,
    });

    // Create response
    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId,
      },
    });

    // Set auth cookies
    setAuthCookies(response, accessToken, refreshToken);

    logger.info('User logged in successfully', {
      userId: user.id,
      username: user.username,
      role: user.role,
      ip: request.ip,
    });

    return response;
  } catch (error) {
    logger.error('Login error', { error: error.message });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

