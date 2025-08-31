import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth/auth';
import { getAuthFromRequest } from '@/lib/auth/auth';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const payload = getAuthFromRequest(request);

    const response = NextResponse.json({ message: 'Logged out successfully' });

    // Clear auth cookies
    clearAuthCookies(response);

    if (payload) {
      logger.info('User logged out', {
        userId: payload.userId,
        username: payload.username,
        ip: request.ip,
      });
    }

    return response;
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}

