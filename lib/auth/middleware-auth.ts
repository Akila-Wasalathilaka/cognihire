import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// JWT payload interface for middleware
export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: 'ADMIN' | 'CANDIDATE';
  username: string;
  iat?: number;
  exp?: number;
}

// Verify access token (middleware-safe version)
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (err) {
    return null;
  }
}

