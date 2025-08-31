import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
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

// Check if PostgreSQL is available
const isPostgresAvailable = () => {
  try {
    require('pg');
    return true;
  } catch {
    return false;
  }
};

// Dynamic import for database functions
async function getDatabaseFunctions() {
  if (!isPostgresAvailable()) {
    throw new Error('PostgreSQL database not available. Please install pg package and configure database connection.');
  }

  const { executeQuery, generateId } = await import('../db/postgres');
  return { executeQuery, generateId };
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

// Authenticate user
export async function authenticateUser(username: string, password: string): Promise<User | null> {
  try {
    const { executeQuery } = await getDatabaseFunctions();

    const result = await executeQuery(
      `SELECT id, tenant_id, email, username, password_hash, role, is_active, mfa_enabled, last_login_at, created_at
       FROM users
       WHERE username = $1 AND is_active = true`,
      [username]
    );

    if (result.rows && result.rows.length > 0) {
      const user = result.rows[0];
      const isValidPassword = await verifyPassword(password, user.password_hash);

      if (isValidPassword) {
        // Update last login
        await executeQuery(
          'UPDATE users SET last_login_at = NOW() WHERE id = $1',
          [user.id]
        );

        return {
          id: user.id,
          tenantId: user.tenant_id,
          email: user.email,
          username: user.username,
          role: user.role,
          isActive: user.is_active,
          mfaEnabled: user.mfa_enabled,
          lastLoginAt: user.last_login_at ? new Date(user.last_login_at) : undefined,
          createdAt: new Date(user.created_at),
        };
      }
    }
    return null;
  } catch (err) {
    console.error('Authentication error:', err);
    return null;
  }
}

// Create user
export async function createUser(
  tenantId: string,
  email: string | null,
  username: string,
  password: string,
  role: 'ADMIN' | 'CANDIDATE'
): Promise<User> {
  const { generateId, executeQuery } = await getDatabaseFunctions();

  const id = generateId();
  const passwordHash = await hashPassword(password);

  await executeQuery(
    `INSERT INTO users (id, tenant_id, email, username, password_hash, role, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, NOW())`,
    [id, tenantId, email, username, passwordHash, role]
  );

  return {
    id,
    tenantId,
    email: email || undefined,
    username,
    role,
    isActive: true,
    mfaEnabled: false,
    createdAt: new Date(),
  };
}

// Get user by ID
export async function getUserById(id: string): Promise<User | null> {
  try {
    const { executeQuery } = await getDatabaseFunctions();

    const result = await executeQuery(
      `SELECT id, tenant_id, email, username, role, is_active, mfa_enabled, last_login_at, created_at
       FROM users
       WHERE id = $1`,
      [id]
    );

    if (result.rows && result.rows.length > 0) {
      const user = result.rows[0];
      return {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.is_active,
        mfaEnabled: user.mfa_enabled,
        lastLoginAt: user.last_login_at ? new Date(user.last_login_at) : undefined,
        createdAt: new Date(user.created_at),
      };
    }
    return null;
  } catch (err) {
    console.error('Get user error:', err);
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

