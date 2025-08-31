// API utility functions for authenticated requests

// Get the API base URL - use environment variable or default to relative path for proxy
const getApiBaseUrl = () => {
  // In production, use relative path so Nginx can proxy to backend
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || '/api';
  }
  return '/api'; // For server-side rendering
};

export const API_BASE_URL = getApiBaseUrl();

export const apiRequest = async (url: string, options: RequestInit = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  // Convert relative URLs to full URLs
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(fullUrl, {
    ...options,
    headers,
  });
};

export const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Specific API endpoints
export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    profile: '/auth/profile',
    refresh: '/auth/refresh',
    changePassword: '/auth/change-password',
  },
  assessments: {
    current: '/assessments/current',
    items: (assessmentId: string) => `/assessments/${assessmentId}/items`,
    start: (assessmentId: string) => `/assessments/${assessmentId}/start`,
    complete: (assessmentId: string) => `/assessments/${assessmentId}/complete`,
  },
  reports: {
    pdf: (assessmentId: string) => `/reports/${assessmentId}/pdf`,
  },
  admin: {
    dashboard: '/admin/dashboard',
    analytics: '/admin/analytics',
    candidates: '/admin/candidates',
    assessments: '/admin/assessments',
  },
};