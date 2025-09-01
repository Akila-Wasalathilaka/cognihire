import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// User interface
export interface User {
  id: string;
  tenantId: string;
  email?: string;
  username: string;
  role: 'ADMIN' | 'CANDIDATE';
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

// JWT payload interface
export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: 'ADMIN' | 'CANDIDATE';
  username: string;
  iat?: number;
  exp?: number;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// Generate access token
export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

// Generate refresh token
export function generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

// Verify access token
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (err) {
    return null;
  }
}

// Verify refresh token
export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  } catch (err) {
    return null;
  }
}

// Set auth cookies
export function setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string): void {
  response.cookies.set('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60, // 15 minutes
  });

  response.cookies.set('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

// Clear auth cookies
export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set('accessToken', '', { maxAge: 0 });
  response.cookies.set('refreshToken', '', { maxAge: 0 });
}

// Get auth from request
export function getAuthFromRequest(request: NextRequest): JWTPayload | null {
  const accessToken = request.cookies.get('accessToken')?.value;
  if (!accessToken) return null;

  return verifyAccessToken(accessToken);
}

// Middleware helper to require authentication
export function requireAuth(request: NextRequest, requiredRole?: 'ADMIN' | 'CANDIDATE'): JWTPayload | null {
  const payload = getAuthFromRequest(request);
  if (!payload) return null;

  if (requiredRole && payload.role !== requiredRole) return null;

  return payload;
}

// Generate random password
export function generateRandomPassword(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Mock authenticate user (for build compatibility)
export async function authenticateUser(username: string, password: string): Promise<User | null> {
  // Mock admin user for testing
  if (username === 'admin' && password === 'admin123') {
    return {
      id: 'admin-id',
      tenantId: 'default',
      username: 'admin',
      role: 'ADMIN',
      isActive: true,
      mfaEnabled: false,
      createdAt: new Date()
    };
  }
  return null;
}

// Mock get user by ID (for build compatibility)
export async function getUserById(id: string): Promise<User | null> {
  if (id === 'admin-id') {
    return {
      id: 'admin-id',
      tenantId: 'default',
      username: 'admin',
      role: 'ADMIN',
      isActive: true,
      mfaEnabled: false,
      createdAt: new Date()
    };
  }
  return null;
}