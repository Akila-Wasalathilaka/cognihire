import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/auth/auth';
import { registerSchema } from '@/lib/validation/schemas';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, username, password, fullName, role } = registerSchema.parse(body);

    // For now, use default tenant
    const tenantId = 'default-tenant-id';

    // Create user
    const user = await createUser(tenantId, email || null, username, password, role);

    // If candidate, create candidate profile
    if (role === 'CANDIDATE' && fullName) {
      // This will be implemented when we create candidate profile management
      logger.info('Candidate profile creation needed', { userId: user.id, fullName });
    }

    logger.info('User registered successfully', {
      userId: user.id,
      username: user.username,
      role: user.role,
      ip: request.ip,
    });

    return NextResponse.json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId,
      },
    }, { status: 201 });
  } catch (error) {
    logger.error('Registration error', { error: error.message });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

