import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken } from '@/lib/auth/auth';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token not found' }, { status: 401 });
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken({
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role,
      username: payload.username,
    });

    const newRefreshToken = generateRefreshToken({
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role,
      username: payload.username,
    });

    const response = NextResponse.json({
      message: 'Token refreshed successfully',
      user: {
        id: payload.userId,
        username: payload.username,
        role: payload.role,
        tenantId: payload.tenantId,
      },
    });

    // Set new cookies
    response.cookies.set('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60, // 15 minutes
    });

    response.cookies.set('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    logger.info('Token refreshed', {
      userId: payload.userId,
      username: payload.username,
      ip: request.ip,
    });

    return response;
  } catch (error) {
    logger.error('Token refresh error', { error: error.message });
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 });
  }
}

