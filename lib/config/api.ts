// API Configuration for CogniHire Platform
export const API_CONFIG = {
  // Base URL for the FastAPI backend
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  
  // API endpoints
  ENDPOINTS: {
    // Authentication
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    PROFILE: '/auth/profile',
    CHANGE_PASSWORD: '/auth/change-password',
    REFRESH: '/auth/refresh',
    
    // Users Management
    USERS: '/auth/users',
    USER_STATUS: (userId: string) => `/auth/users/${userId}/status`,
    
    // Assessments
    ASSESSMENTS: '/assessments',
    ASSESSMENT_DETAIL: (id: string) => `/assessments/${id}`,
    ASSESSMENT_START: (id: string) => `/assessments/${id}/start`,
    ASSESSMENT_COMPLETE: (id: string) => `/assessments/${id}/complete`,
    ASSESSMENT_ITEMS: (id: string) => `/assessments/${id}/items`,
    CURRENT_ASSESSMENT: '/assessments/current',
    
    // Assessment Items
    ITEM_START: (assessmentId: string, itemId: string) => `/assessments/${assessmentId}/items/${itemId}/start`,
    ITEM_SUBMIT: (assessmentId: string, itemId: string) => `/assessments/${assessmentId}/items/${itemId}/submit`,
    ITEM_TELEMETRY: (assessmentId: string, itemId: string) => `/assessments/${assessmentId}/items/${itemId}/telemetry`,
    
    // Games
    GAMES: '/games',
    GAME_SESSIONS: '/game-sessions',
    GAME_SESSION_DETAIL: (id: string) => `/game-sessions/${id}`,
    
    // Job Roles
    JOB_ROLES: '/job-roles',
    JOB_ROLE_DETAIL: (id: string) => `/job-roles/${id}`,
    
    // Candidates
    CANDIDATES: '/candidates',
    CANDIDATE_DETAIL: (id: string) => `/candidates/${id}`,
    
    // Reports
    REPORTS: '/reports',
    REPORT_PDF: (assessmentId: string) => `/reports/${assessmentId}/pdf`,
    
    // Analytics
    ANALYTICS_OVERVIEW: '/admin/analytics/overview',
    ANALYTICS_GAMES: '/admin/analytics/games',
    
    // Dashboard Stats
    DASHBOARD_STATS: '/dashboard/stats',
    
    // Telemetry
    TELEMETRY: '/telemetry',
  },
  
  // Request timeouts
  TIMEOUT: {
    DEFAULT: 30000, // 30 seconds
    UPLOAD: 120000, // 2 minutes for file uploads
    GAME: 60000,    // 1 minute for game sessions
  },
  
  // Retry configuration
  RETRY: {
    ATTEMPTS: 3,
    DELAY: 1000, // 1 second
  }
};

// API response types
export interface ApiResponse<T> {
  data?: T;
  message?: string;
  detail?: string;
  status: 'success' | 'error';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Error types
export interface ApiError {
  detail: string;
  status_code?: number;
  errors?: Record<string, string[]>;
}