import { useRouter } from 'next/navigation';

/**
 * Secure logout utility that properly clears all authentication data
 * and prevents users from going back using browser buttons
 */
export class SecureLogout {
  private static instance: SecureLogout;
  private router: any = null;

  private constructor() {}

  static getInstance(): SecureLogout {
    if (!SecureLogout.instance) {
      SecureLogout.instance = new SecureLogout();
    }
    return SecureLogout.instance;
  }

  setRouter(router: any) {
    this.router = router;
  }

  /**
   * Perform secure logout with token invalidation
   */
  async performSecureLogout(): Promise<void> {
    try {
      // 1. Call backend logout endpoint to blacklist token
      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
      
      if (token) {
        try {
          await fetch('http://localhost:8000/auth/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        } catch (error) {
          console.error('Backend logout failed:', error);
          // Continue with frontend cleanup even if backend fails
        }
      }

      // 2. Clear all authentication data from browser storage
      this.clearAllAuthData();

      // 3. Clear browser cache and session data
      this.clearBrowserData();

      // 4. Redirect to login with cache busting
      this.redirectToLogin();

    } catch (error) {
      console.error('Logout process failed:', error);
      // Force cleanup and redirect even if something fails
      this.clearAllAuthData();
      this.redirectToLogin();
    }
  }

  /**
   * Clear all authentication data from browser storage
   */
  public clearAllAuthData(): void {
    // Clear localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiry');
    
    // Clear sessionStorage
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('userRole');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('tokenExpiry');

    // Clear any assessment-related data
    localStorage.removeItem('currentAssessment');
    localStorage.removeItem('assessmentState');
    localStorage.removeItem('gameState');
    
    // Clear cookies by setting them to expire
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  }

  /**
   * Clear browser cache and session data
   */
  private clearBrowserData(): void {
    try {
      // Clear browser cache (if supported)
      if ('caches' in window) {
        caches.keys().then(function(names) {
          for (let name of names) {
            caches.delete(name);
          }
        });
      }

      // Clear browser history state to prevent back button access
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '/auth/login');
      }
    } catch (error) {
      console.error('Browser data clearing failed:', error);
    }
  }

  /**
   * Redirect to login page with cache busting and history manipulation
   */
  private redirectToLogin(): void {
    try {
      // Add cache busting parameter
      const timestamp = new Date().getTime();
      const loginUrl = `/auth/login?t=${timestamp}`;

      if (this.router) {
        // Use Next.js router if available
        this.router.replace(loginUrl);
      } else {
        // Fallback to window.location
        window.location.replace(loginUrl);
      }

      // Additional security: reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 100);

    } catch (error) {
      console.error('Redirect failed:', error);
      // Force redirect as last resort
      window.location.href = '/auth/login';
    }
  }

  /**
   * Setup page protection to prevent unauthorized access after logout
   */
  static setupPageProtection(): void {
    // Prevent back button access to protected pages
    window.addEventListener('pageshow', function(event) {
      // Check if page is being restored from cache
      if (event.persisted) {
        // Check if user is still authenticated
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        if (!token) {
          // No token found, redirect to login
          window.location.replace('/auth/login');
        }
      }
    });

    // Prevent using browser back button after logout
    window.addEventListener('popstate', function(event) {
      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
      if (!token && window.location.pathname !== '/auth/login' && window.location.pathname !== '/auth/register') {
        window.location.replace('/auth/login');
      }
    });

    // Disable browser cache for sensitive pages
    window.addEventListener('beforeunload', function() {
      // This helps prevent caching of sensitive pages
      if (performance.navigation.type === 1) {
        // Page is being refreshed
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        if (!token) {
          window.location.replace('/auth/login');
        }
      }
    });
  }
}

/**
 * React hook for secure logout functionality
 */
export function useSecureLogout() {
  const router = useRouter();
  const secureLogout = SecureLogout.getInstance();
  secureLogout.setRouter(router);

  const logout = async () => {
    await secureLogout.performSecureLogout();
  };

  return { logout };
}

/**
 * Utility function to check if user session is valid
 */
export function isSessionValid(): boolean {
  try {
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    if (!token) return false;

    // Check token expiry if stored
    const expiry = localStorage.getItem('tokenExpiry') || sessionStorage.getItem('tokenExpiry');
    if (expiry) {
      const expiryTime = new Date(expiry);
      if (new Date() > expiryTime) {
        // Token expired, clear data
        SecureLogout.getInstance().clearAllAuthData();
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Session validation failed:', error);
    return false;
  }
}