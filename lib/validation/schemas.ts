import { z } from 'zod';

// Auth schemas
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email').optional(),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  role: z.enum(['ADMIN', 'CANDIDATE']),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// User schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email').optional(),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'CANDIDATE']),
  fullName: z.string().min(1, 'Full name is required').optional(),
  jobRoleId: z.string().uuid('Invalid job role ID').optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email').optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  isActive: z.boolean().optional(),
  jobRoleId: z.string().uuid('Invalid job role ID').optional(),
  fullName: z.string().min(1, 'Full name is required').optional(),
});

// Job role schemas
export const createJobRoleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  traitsJson: z.string().refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid JSON').optional(),
  configJson: z.string().refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid JSON').optional(),
});

export const updateJobRoleSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
  traitsJson: z.string().refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid JSON').optional(),
  configJson: z.string().refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid JSON').optional(),
});

// Assessment schemas
export const createAssessmentSchema = z.object({
  candidateId: z.string().uuid('Invalid candidate ID'),
  jobRoleId: z.string().uuid('Invalid job role ID'),
});

export const startAssessmentSchema = z.object({
  assessmentId: z.string().uuid('Invalid assessment ID'),
});

export const startItemSchema = z.object({
  assessmentId: z.string().uuid('Invalid assessment ID'),
  itemId: z.string().uuid('Invalid item ID'),
});

export const telemetrySchema = z.object({
  assessmentId: z.string().uuid('Invalid assessment ID'),
  itemId: z.string().uuid('Invalid item ID'),
  data: z.any(), // Game-specific telemetry data
});

export const submitItemSchema = z.object({
  assessmentId: z.string().uuid('Invalid assessment ID'),
  itemId: z.string().uuid('Invalid item ID'),
  score: z.number().min(0).max(100).optional(),
  metricsJson: z.string().refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid JSON'),
});

export const completeAssessmentSchema = z.object({
  assessmentId: z.string().uuid('Invalid assessment ID'),
});

// Game schemas
export const gameConfigSchema = z.object({
  timer: z.number().min(1).max(3600).optional(),
  rounds: z.number().min(1).max(100).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  trials: z.number().min(1).max(1000).optional(),
  colors: z.array(z.string()).optional(),
  maxLength: z.number().min(1).max(20).optional(),
  trialsPerLength: z.number().min(1).max(10).optional(),
});

// API key schema
export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

// Audit log schema
export const auditLogSchema = z.object({
  action: z.string().min(1, 'Action is required'),
  targetType: z.string().min(1, 'Target type is required'),
  targetId: z.string().uuid('Invalid target ID').optional(),
  payloadJson: z.string().refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid JSON').optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateJobRoleInput = z.infer<typeof createJobRoleSchema>;
export type UpdateJobRoleInput = z.infer<typeof updateJobRoleSchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type StartAssessmentInput = z.infer<typeof startAssessmentSchema>;
export type StartItemInput = z.infer<typeof startItemSchema>;
export type TelemetryInput = z.infer<typeof telemetrySchema>;
export type SubmitItemInput = z.infer<typeof submitItemSchema>;
export type CompleteAssessmentInput = z.infer<typeof completeAssessmentSchema>;
export type GameConfig = z.infer<typeof gameConfigSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type AuditLogInput = z.infer<typeof auditLogSchema>;

