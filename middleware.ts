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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, API routes that handle their own auth, and public routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') ||
    publicRoutes.some(route => pathname === route || pathname.startsWith(route))
  ) {
    return NextResponse.next();
  }

  // Check for authentication
  const accessToken = request.cookies.get('accessToken')?.value;

  if (!accessToken) {
    // No token, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify token
  const payload = verifyAccessToken(accessToken);

  if (!payload) {
    // Invalid token, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check role-based access
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));
  const isCandidateRoute = candidateRoutes.some(route => pathname.startsWith(route));

  if (isAdminRoute && payload.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/candidate/dashboard', request.url));
  }

  if (isCandidateRoute && payload.role !== 'CANDIDATE') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  // Token is valid and user has appropriate access
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

