/**
 * API Service - HTTP Client for Backend Communication
 */

import { API_BASE_URL } from '@/config/api';
import { buildPreferredLoginHref } from '@/lib/auth-resume';
import { captureCsrfToken, clearCsrfToken, getCsrfToken } from '@/lib/csrf';

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  retryOnRateLimit?: boolean;
}

class ApiService {
  private baseURL: string;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string | null) => void> = [];
  private inFlightRequests = new Map<string, Promise<ApiResponse<unknown>>>();
  
  // Rate limit handling
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 second

  // Requests that hang (e.g. flaky mobile network) must fail instead of
  // blocking the UI (auth check spinner, PIN entry, etc.) forever.
  private readonly REQUEST_TIMEOUT_MS = 15000;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  // Sleep utility for retry delays
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // fetch() wrapper that aborts after REQUEST_TIMEOUT_MS so a stalled
  // connection never hangs the caller indefinitely. `credentials: 'include'`
  // makes the browser send the httpOnly access/refresh cookies set by the
  // backend (login/refresh/OAuth callback) — this replaces the old
  // Authorization: Bearer header built from a localStorage token.
  private async fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

    try {
      return await fetch(input, { ...init, credentials: 'include', signal: controller.signal });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection and try again.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private clearTokens(): void {
    clearCsrfToken();
    if (typeof window !== 'undefined') {
      // Legacy keys from before the httpOnly-cookie migration — cleared
      // defensively so a stale tab/service worker can't resurrect them.
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  }

  // Subscribe to token refresh
  private subscribeTokenRefresh(callback: (token: string | null) => void): void {
    this.refreshSubscribers.push(callback);
  }

  // Notify all subscribers with new token
  private onTokenRefreshed(token: string): void {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  }

  // Notify all waiting requests that refresh has failed so they don't hang forever.
  private onTokenRefreshFailed(): void {
    this.refreshSubscribers.forEach(callback => callback(null));
    this.refreshSubscribers = [];
  }

  // The refresh token lives in an httpOnly cookie scoped to /auth — the
  // browser attaches it automatically (credentials: 'include'), so this is
  // a bodiless POST. On success the backend's Set-Cookie response header
  // already replaced both cookies; there's nothing left to store here.
  private async refreshAccessToken(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Client-Type': 'web',
      };
      // This is a mutating POST guarded by the same double-submit CSRF
      // check as every other mutating request (see request()) — it isn't
      // routed through request() itself because it must bypass the normal
      // 401-triggers-refresh loop, so the CSRF header is added here too.
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await this.fetchWithTimeout(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers,
      });

      // A successful refresh rotates the CSRF token along with the auth
      // cookies, so pick the new one up before anything else uses it.
      captureCsrfToken(response);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          this.onTokenRefreshed('ok');
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
    const url = new URL(
      `${this.baseURL}${endpoint}`,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    );
    
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      ...options?.headers,
    };
    const allowRateLimitRetry = options?.retryOnRateLimit !== false;
    // Only the initial, externally-triggered call should participate in
    // de-duplication. Internal retries (401->refresh retry, 429 backoff retry,
    // network-error retry) recurse back into this same method with the same
    // method/endpoint/params — if they looked themselves up in
    // `inFlightRequests` they'd find their OWN still-pending outer promise
    // (registered below, before it's awaited) and return that instead of
    // firing a new fetch, deadlocking forever since the outer promise can
    // only resolve once the retry it's "reusing" resolves.
    const isInitialAttempt = retry === true && retryCount === 0;
    const shouldDeduplicate = method === 'GET' && !body && isInitialAttempt;
    const requestKey = shouldDeduplicate
      ? `${method}:${endpoint}:${JSON.stringify(options?.params ?? {})}`
      : null;

    if (shouldDeduplicate && requestKey) {
      const existing = this.inFlightRequests.get(requestKey);
      if (existing) {
        return existing as Promise<ApiResponse<T>>;
      }
    }

    // Only set Content-Type for non-FormData requests
    const isFormData = body instanceof FormData;
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    // Identifies this as a browser (cookie-auth) request to the backend —
    // see middlewares.Protected()'s cookie fallback on the Go side.
    headers['X-Client-Type'] = 'web';

    // Double-submit CSRF token: mirror the readable csrf_token cookie back
    // in a header the browser can't auto-attach cross-site, so the backend
    // can tell a same-site request (both match) from a forged cross-site one.
    const isMutating = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
    if (isMutating) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }

    const executeRequest = async (): Promise<ApiResponse<T>> => {
      const response = await this.fetchWithTimeout(url.toString(), {
        method,
        headers,
        body: body ? (isFormData ? body as FormData : JSON.stringify(body)) : undefined,
      });

      // Any response may carry a rotated token (login, refresh, /auth/me).
      captureCsrfToken(response);

      // Handle 429 Too Many Requests - retry with exponential backoff
      if (response.status === 429 && allowRateLimitRetry && retryCount < this.MAX_RETRIES) {
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
            this.subscribeTokenRefresh((refreshed: string | null) => {
              if (!refreshed) {
                resolve({ success: false, error: 'Session expired. Please login again.' });
                return;
              }

              // The refreshed access cookie is already attached automatically;
              // just retry the same request.
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

        this.onTokenRefreshFailed();
        
        // Redirect to login if refresh failed (but not if already on login)
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          window.location.href = buildPreferredLoginHref(currentPath);
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
        // Intercept maintenance mode responses and redirect to the maintenance page
        if (
          response.status === 503 &&
          (data as { code?: string }).code === 'MAINTENANCE_MODE' &&
          typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/maintenance') &&
          !window.location.pathname.startsWith('/login')
        ) {
          try {
            const d = data as { message?: string; schedule_type?: string; start_time?: string; end_time?: string };
            sessionStorage.setItem('maintenance_info', JSON.stringify({
              active: true,
              message: d.message,
              schedule_type: d.schedule_type,
              start_time: d.start_time,
              end_time: d.end_time,
            }));
            // Set a cookie so Next.js middleware can redirect on the next navigation
            document.cookie = 'maintenance_active=1; path=/; SameSite=Lax';
          } catch { /* ignore */ }
          window.location.href = '/maintenance';
          return { success: false, error: 'maintenance' };
        }
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
    };

    const requestPromise = (async (): Promise<ApiResponse<T>> => {
      try {
        return await executeRequest();
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
    })();

    if (shouldDeduplicate && requestKey) {
      this.inFlightRequests.set(requestKey, requestPromise as Promise<ApiResponse<unknown>>);
    }

    try {
      return await requestPromise;
    } finally {
      if (shouldDeduplicate && requestKey) {
        this.inFlightRequests.delete(requestKey);
      }
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

  // Token management — the access/refresh tokens themselves are httpOnly
  // cookies set directly by the backend response (login/refresh/OAuth
  // callback); there is nothing left for client JS to store.

  clearAuthTokens(): void {
    this.clearTokens();
  }

  // The CSRF token is issued/cleared by the backend in lockstep with the
  // httpOnly auth cookies (see utils.SetAuthCookies/ClearAuthCookies on the
  // Go side), so having one is a reliable, synchronous "do we have an active
  // web session" signal without needing to read the httpOnly cookies
  // themselves (which client JS can never do).
  //
  // Reads through lib/csrf rather than the cookie directly: behind the KKU
  // reverse proxy the cookie is force-flagged HttpOnly and invisible to JS,
  // and a bare cookie read there reports "logged out" for a perfectly good
  // session — which used to bounce every login straight back to /login.
  isAuthenticated(): boolean {
    return getCsrfToken() !== null;
  }
}

// Export singleton instance
export const apiService = new ApiService(API_BASE_URL);
export default apiService;
