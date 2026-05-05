/**
 * API Service - HTTP Client for Backend Communication
 */

import { API_BASE_URL } from '@/config/api';

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
}

class ApiService {
  private baseURL: string;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];
  
  // Rate limit handling
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 second

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  // Sleep utility for retry delays
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getAccessToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken');
    }
    return null;
  }

  private getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('refreshToken');
    }
    return null;
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  private clearTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  }

  // Subscribe to token refresh
  private subscribeTokenRefresh(callback: (token: string) => void): void {
    this.refreshSubscribers.push(callback);
  }

  // Notify all subscribers with new token
  private onTokenRefreshed(token: string): void {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          this.setTokens(data.data.accessToken, data.data.refreshToken);
          this.onTokenRefreshed(data.data.accessToken);
          return true;
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    this.clearTokens();
    return false;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
    retry = true,
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseURL}${endpoint}`);
    
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      ...options?.headers,
    };

    // Only set Content-Type for non-FormData requests
    const isFormData = body instanceof FormData;
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    // ส่งโทเคนเพื่อยืนยันตัวตนในการใช้งาน
    const accessToken = this.getAccessToken();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? (isFormData ? body as FormData : JSON.stringify(body)) : undefined,
      });

      // Handle 429 Too Many Requests - retry with exponential backoff
      if (response.status === 429 && retryCount < this.MAX_RETRIES) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : this.INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        
        console.warn(`Rate limited (429). Retrying in ${delay}ms... (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
        await this.sleep(delay);
        return this.request<T>(method, endpoint, body, options, retry, retryCount + 1);
      }

      // Handle 401 Unauthorized - try to refresh token (but not for login/refresh endpoints)
      const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh');
      if (response.status === 401 && retry && !isAuthEndpoint) {
        // If already refreshing, wait for the refresh to complete
        if (this.isRefreshing) {
          return new Promise((resolve) => {
            this.subscribeTokenRefresh((newToken: string) => {
              headers['Authorization'] = `Bearer ${newToken}`;
              // Retry the request with new token
              resolve(this.request<T>(method, endpoint, body, options, false));
            });
          });
        }

        this.isRefreshing = true;
        const refreshed = await this.refreshAccessToken();
        this.isRefreshing = false;

        if (refreshed) {
          return this.request<T>(method, endpoint, body, options, false);
        }
        
        // Redirect to login if refresh failed (but not if already on login)
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return { success: false, error: 'Session expired. Please login again.' };
      }

      const rawText = await response.text();
      let data: ApiResponse<T> | null = null;

      if (rawText) {
        try {
          data = JSON.parse(rawText) as ApiResponse<T>;
        } catch {
          // Keep null and map to a standard error response below.
        }
      }

      if (data) {
        return data;
      }

      if (!response.ok) {
        return {
          success: false,
          error: rawText || `HTTP ${response.status}`,
          message: rawText || response.statusText,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      // Retry on network errors (but not too many times)
      if (retryCount < this.MAX_RETRIES && error instanceof TypeError && error.message.includes('fetch')) {
        const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        console.warn(`Network error. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
        await this.sleep(delay);
        return this.request<T>(method, endpoint, body, options, retry, retryCount + 1);
      }
      
      console.error(`API Error [${method} ${endpoint}]:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // HTTP Methods
  async get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, body, options);
  }

  async put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, body, options);
  }

  async patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, body, options);
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }

  // Token management
  setAuthTokens(accessToken: string, refreshToken: string): void {
    this.setTokens(accessToken, refreshToken);
  }

  clearAuthTokens(): void {
    this.clearTokens();
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}

// Export singleton instance
export const apiService = new ApiService(API_BASE_URL);
export default apiService;
