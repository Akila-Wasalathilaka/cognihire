import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken } from './lib/auth/middleware-auth';

// Routes that don't require authentication
const publicRoutes = [
  '/login',
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/',
];

// Admin-only routes
const adminRoutes = [
  '/admin',
  '/api/admin',
];

// Candidate-only routes
const candidateRoutes = [
  '/candidate',
  '/api/assessments',
  '/api/auth/profile',
  '/api/auth/change-password',
];

// Temporarily disabled middleware for debugging
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

