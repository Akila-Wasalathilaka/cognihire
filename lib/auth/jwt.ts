import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, verifyRefreshToken, generateAccessToken, generateRefreshToken, JWTPayload } from './auth';

// Middleware to verify JWT and refresh if needed
export async function authenticateRequest(request: NextRequest): Promise<{
  payload: JWTPayload | null;
  response: NextResponse | null;
}> {
  const accessToken = request.cookies.get('accessToken')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;

  if (!accessToken || !refreshToken) {
    return { payload: null, response: null };
  }

  // Try to verify access token
  let payload = verifyAccessToken(accessToken);
  if (payload) {
    return { payload, response: null };
  }

  // Access token expired, try refresh token
  const refreshPayload = verifyRefreshToken(refreshToken);
  if (!refreshPayload) {
    return { payload: null, response: null };
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken({
    userId: refreshPayload.userId,
    tenantId: refreshPayload.tenantId,
    role: refreshPayload.role,
    username: refreshPayload.username,
  });

  const newRefreshToken = generateRefreshToken({
    userId: refreshPayload.userId,
    tenantId: refreshPayload.tenantId,
    role: refreshPayload.role,
    username: refreshPayload.username,
  });

  // Create response with new tokens
  const response = NextResponse.next();
  response.cookies.set('accessToken', newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60,
  });

  response.cookies.set('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
  });

  return { payload: refreshPayload, response };
}

// Require authentication middleware
export function requireAuth(requiredRole?: 'ADMIN' | 'CANDIDATE') {
  return async (request: NextRequest): Promise<{
    payload: JWTPayload | null;
    response: NextResponse | null;
  }> => {
    const { payload, response } = await authenticateRequest(request);

    if (!payload) {
      return { payload: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    if (requiredRole && payload.role !== requiredRole) {
      return { payload: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { payload, response };
  };
}

// Admin only middleware
export const requireAdmin = requireAuth('ADMIN');

// Candidate only middleware
export const requireCandidate = requireAuth('CANDIDATE');

