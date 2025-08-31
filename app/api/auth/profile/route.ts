import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/auth/auth';
import { executeQuery } from '@/lib/db/postgres';
import { requireAuth } from '@/lib/auth/jwt';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { payload } = await requireAuth()(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user details
    const user = await getUserById(payload.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get candidate profile if user is candidate
    let candidateProfile = null;
    if (user.role === 'CANDIDATE') {
      const result = await executeQuery(
        `SELECT full_name, job_role_id, metadata_json
         FROM CANDIDATE_PROFILES
         WHERE user_id = :userId`,
        [user.id]
      );

      if (result.rows && result.rows.length > 0) {
        const profile = result.rows[0] as any;
        candidateProfile = {
          fullName: profile.FULL_NAME,
          jobRoleId: profile.JOB_ROLE_ID,
          metadata: profile.METADATA_JSON ? JSON.parse(profile.METADATA_JSON) : null,
        };
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        isActive: user.isActive,
        mfaEnabled: user.mfaEnabled,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      candidateProfile,
    });
  } catch (error) {
    logger.error('Get profile error', { error: error.message });
    return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
  }
}

