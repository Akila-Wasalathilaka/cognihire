// Development mode configuration
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';

// Database configuration
export const isDatabaseEnabled = () => {
  // Check if Oracle is available
  try {
    require('oracledb');
    return true;
  } catch {
    return false;
  }
};

// Check if we should use mock data in development
export const useMockData = isDevelopment && !isDatabaseEnabled();

// API response helpers for development mode
export const createMockResponse = (data: any) => ({
  success: true,
  data,
  message: 'Mock data response (database not configured)'
});

export const createMockError = (message: string) => ({
  success: false,
  error: message,
  message: 'Mock error response (database not configured)'
});

// Development mode user data
export const mockUsers = [
  {
    id: 'admin-1',
    tenantId: 'tenant-1',
    username: 'admin',
    email: 'admin@cognihire.com',
    role: 'ADMIN' as const,
    isActive: true,
    mfaEnabled: false,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'candidate-1',
    tenantId: 'tenant-1',
    username: 'candidate',
    email: 'candidate@cognihire.com',
    role: 'CANDIDATE' as const,
    isActive: true,
    mfaEnabled: false,
    createdAt: new Date('2024-01-01'),
  }
];

// Development mode assessment data
export const mockAssessments = [
  {
    id: 'assessment-1',
    tenantId: 'tenant-1',
    title: 'Sample Cognitive Assessment',
    description: 'A sample assessment for testing',
    jobRoleId: 'job-role-1',
    durationMinutes: 60,
    isActive: true,
    createdAt: new Date('2024-01-01'),
  }
];

