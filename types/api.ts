// User and authentication related types
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'CANDIDATE';
  is_active: boolean;
  last_login_at?: string;
  created_at?: string;
  full_name?: string;
  job_role_id?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role?: 'ADMIN' | 'CANDIDATE';
  full_name?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface PasswordChangeRequest {
  old_password: string;
  new_password: string;
}

// Assessment related types
export interface Assessment {
  id: string;
  tenant_id: string;
  candidate_id: string;
  job_role_id?: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  started_at?: string;
  completed_at?: string;
  total_score?: number;
  integrity_flags?: Record<string, any>;
  items?: AssessmentItem[];
  candidate?: User;
  job_role?: JobRole;
}

export interface AssessmentItem {
  id: string;
  assessment_id: string;
  game_id: string;
  order_index: number;
  timer_seconds: number;
  server_started_at?: string;
  server_deadline_at?: string;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'SUBMITTED';
  score?: number;
  metrics_json?: Record<string, any>;
  config_snapshot?: Record<string, any>;
  game?: Game;
}

// Game related types
export interface Game {
  id: string;
  code: string;
  title: string;
  description?: string;
  base_config?: Record<string, any>;
}

export interface GameSession {
  id: string;
  game_id: string;
  user_id: string;
  session_data?: Record<string, any>;
  score?: number;
  completed_at?: string;
  created_at: string;
}

// Job role types
export interface JobRole {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  traits_json?: Record<string, any>;
  config_json?: Record<string, any>;
  created_at: string;
}

// Candidate types
export interface CandidateProfile {
  user_id: string;
  full_name?: string;
  job_role_id?: string;
  metadata_json?: Record<string, any>;
  user?: User;
  job_role?: JobRole;
}

// Report types
export interface Report {
  id: string;
  assessment_id: string;
  storage_key: string;
  created_at: string;
  assessment?: Assessment;
}

// Analytics types
export interface AnalyticsOverview {
  total_assessments: number;
  completed_assessments: number;
  active_candidates: number;
  average_score: number;
  completion_rate: number;
  recent_activity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'assessment_started' | 'assessment_completed' | 'user_registered';
  description: string;
  timestamp: string;
  user?: User;
}

export interface GameAnalytics {
  game_id: string;
  game_title: string;
  total_sessions: number;
  average_score: number;
  completion_rate: number;
  difficulty_distribution: Record<string, number>;
}

// Dashboard stats
export interface DashboardStats {
  total_users: number;
  total_assessments: number;
  completed_assessments: number;
  average_completion_time: number;
  recent_assessments: Assessment[];
  top_performers: User[];
}

// Telemetry types
export interface TelemetryData {
  event_type: string;
  timestamp: string;
  data: Record<string, any>;
  user_id?: string;
  session_id?: string;
}

// API Response wrapper types
export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  detail?: string;
  status?: 'success' | 'error';
}

export interface PaginatedResponse<T = any> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ApiError {
  detail: string;
  status_code?: number;
  errors?: Record<string, string[]>;
}

// Form types
export interface ProfileUpdateData {
  email?: string;
  full_name?: string;
  job_role_id?: string;
}

export interface UserStatusUpdate {
  is_active: boolean;
}

// Assessment flow types
export interface AssessmentStartResponse {
  assessment: Assessment;
  current_item?: AssessmentItem;
  message: string;
}

export interface AssessmentItemStartResponse {
  item: AssessmentItem;
  game_config: Record<string, any>;
  start_time: string;
  deadline: string;
}

export interface AssessmentItemSubmission {
  responses: any[];
  metrics: Record<string, any>;
  completion_time: number;
  integrity_data?: Record<string, any>;
}

// Audit log types
export interface AuditLog {
  id: string;
  tenant_id?: string;
  actor_user_id?: string;
  action: string;
  target_type: string;
  target_id: string;
  ip?: string;
  user_agent?: string;
  payload_json?: Record<string, any>;
  created_at: string;
}