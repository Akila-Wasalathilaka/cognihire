import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, hashPassword, getUserById } from '@/lib/auth/auth';
import { changePasswordSchema } from '@/lib/validation/schemas';
import { executeQuery } from '@/lib/db/postgres';
import { requireAuth } from '@/lib/auth/jwt';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { payload } = await requireAuth()(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    // Get current user
    const user = await getUserById(payload.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const isValidPassword = await authenticateUser(user.username, currentPassword);
    if (!isValidPassword) {
      logger.warn('Failed password change attempt - wrong current password', {
        userId: payload.userId,
        username: payload.username,
      });
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await executeQuery(
      'UPDATE USERS SET password_hash = :passwordHash WHERE id = :userId',
      [newPasswordHash, payload.userId]
    );

    logger.info('Password changed successfully', {
      userId: payload.userId,
      username: payload.username,
      ip: request.ip,
    });

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error', { error: error.message });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

