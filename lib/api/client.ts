import { API_CONFIG, ApiResponse, ApiError } from '@/lib/config/api';
import { 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest, 
  User, 
  Assessment, 
  Game, 
  JobRole, 
  DashboardStats,
  AnalyticsOverview,
  GameAnalytics,
  PasswordChangeRequest,
  ProfileUpdateData,
  UserStatusUpdate,
  PaginatedResponse
} from '@/types/api';

class ApiClient {
  private baseUrl: string;
  private timeout: number;
  
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT.DEFAULT;
  }
  
  private getAuthHeaders(): Record<string, string> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }
  
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = 'An error occurred';
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }
    
    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    
    return response.text() as T;
  }
  
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    timeout: number = this.timeout
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return this.handleResponse<T>(response);
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
      
      throw new Error('Network error');
    }
  }
  
  // GET request
  async get<T>(endpoint: string, timeout?: number): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'GET' }, timeout);
  }
  
  // POST request
  async post<T>(endpoint: string, data?: any, timeout?: number): Promise<T> {
    return this.makeRequest<T>(
      endpoint,
      {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      },
      timeout
    );
  }
  
  // PUT request
  async put<T>(endpoint: string, data?: any, timeout?: number): Promise<T> {
    return this.makeRequest<T>(
      endpoint,
      {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      },
      timeout
    );
  }
  
  // DELETE request
  async delete<T>(endpoint: string, timeout?: number): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' }, timeout);
  }
  
  // PATCH request
  async patch<T>(endpoint: string, data?: any, timeout?: number): Promise<T> {
    return this.makeRequest<T>(
      endpoint,
      {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
      },
      timeout
    );
  }
  
  // File upload
  async uploadFile<T>(endpoint: string, file: File, additionalData?: Record<string, any>): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
      });
    }
    
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
      
      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Upload failed');
    }
  }
  
  // Download file
  async downloadFile(endpoint: string): Promise<Blob> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }
      
      return response.blob();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Download failed');
    }
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Convenience functions for common operations
export const api = {
  // Authentication
  login: (credentials: LoginRequest): Promise<LoginResponse> =>
    apiClient.post<LoginResponse>(API_CONFIG.ENDPOINTS.LOGIN, credentials),
  
  register: (userData: RegisterRequest): Promise<{ message: string; user_id: string }> =>
    apiClient.post(API_CONFIG.ENDPOINTS.REGISTER, userData),
  
  logout: (): Promise<{ message: string }> => 
    apiClient.post(API_CONFIG.ENDPOINTS.LOGOUT),
  
  getProfile: (): Promise<User> => 
    apiClient.get<User>(API_CONFIG.ENDPOINTS.PROFILE),
  
  updateProfile: (profileData: ProfileUpdateData): Promise<{ message: string }> =>
    apiClient.put(API_CONFIG.ENDPOINTS.PROFILE, profileData),
  
  changePassword: (passwordData: PasswordChangeRequest): Promise<{ message: string }> =>
    apiClient.post(API_CONFIG.ENDPOINTS.CHANGE_PASSWORD, passwordData),
  
  // Users
  getUsers: (params?: { skip?: number; limit?: number; role?: string }): Promise<{ users: User[]; total: number }> => {
    const queryParams = new URLSearchParams();
    if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params?.role) queryParams.append('role', params.role);
    
    const endpoint = `${API_CONFIG.ENDPOINTS.USERS}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get(endpoint);
  },
  
  updateUserStatus: (userId: string, statusData: UserStatusUpdate): Promise<{ message: string }> =>
    apiClient.put(API_CONFIG.ENDPOINTS.USER_STATUS(userId), statusData),
  
  // Assessments
  getAssessments: (): Promise<Assessment[]> => 
    apiClient.get<Assessment[]>(API_CONFIG.ENDPOINTS.ASSESSMENTS),
  
  getAssessment: (id: string): Promise<Assessment> => 
    apiClient.get<Assessment>(API_CONFIG.ENDPOINTS.ASSESSMENT_DETAIL(id)),
  
  startAssessment: (id: string): Promise<{ assessment: Assessment; message: string }> => 
    apiClient.post(API_CONFIG.ENDPOINTS.ASSESSMENT_START(id)),
  
  completeAssessment: (id: string): Promise<{ message: string }> => 
    apiClient.post(API_CONFIG.ENDPOINTS.ASSESSMENT_COMPLETE(id)),
  
  getCurrentAssessment: (): Promise<Assessment | null> => 
    apiClient.get(API_CONFIG.ENDPOINTS.CURRENT_ASSESSMENT),
  
  // Games
  getGames: (): Promise<Game[]> => 
    apiClient.get<Game[]>(API_CONFIG.ENDPOINTS.GAMES),
  
  // Reports
  downloadReport: (assessmentId: string): Promise<Blob> =>
    apiClient.downloadFile(API_CONFIG.ENDPOINTS.REPORT_PDF(assessmentId)),
  
  // Dashboard
  getDashboardStats: (): Promise<DashboardStats> => 
    apiClient.get<DashboardStats>(API_CONFIG.ENDPOINTS.DASHBOARD_STATS),
  
  // Analytics
  getAnalyticsOverview: (): Promise<AnalyticsOverview> => 
    apiClient.get<AnalyticsOverview>(API_CONFIG.ENDPOINTS.ANALYTICS_OVERVIEW),
  
  getAnalyticsGames: (): Promise<GameAnalytics[]> => 
    apiClient.get<GameAnalytics[]>(API_CONFIG.ENDPOINTS.ANALYTICS_GAMES),
};