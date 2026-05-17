import apiService from './api.service';
import { API_ENDPOINTS } from '@/config/api';
import { clearAppearanceHintCookieString } from '@/lib/appearance-hint';
import type { AppRole } from '@/lib/auth-routing';

export const AUTH_USER_UPDATED_EVENT = 'auth:user-updated';
export const PENDING_PREFERENCES_STORAGE_KEY = 'auth:pending-preferences';

let authChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined') {
  authChannel = new BroadcastChannel('auth-sync');
}

export interface UserPreferences {
  theme: 'system' | 'light' | 'dark';
  fontSize: 'sm' | 'md' | 'lg';
  language: 'th' | 'en';
}

export interface User {
  id: number;
  username: string;
  student_id?: string;
  email: string;
  full_name: string;
  role: AppRole;
  avatar: string | null;
  preferences?: UserPreferences;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: number;
  jti: string;
  ip: string;
  browser: string;
  os: string;
  device: string;
  provider: string;
  loginAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  mustChangePassword?: boolean;
  // 2FA fields (when 2FA is required)
  requiresTwoFactor?: boolean;
  twoFactorMethod?: 'totp' | 'email';
  userId?: number;
  email?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Local type for 2FA data to avoid circular import
interface TwoFactorResult {
  requiresTwoFactor: true;
  userId: number;
  twoFactorMethod: 'totp' | 'email';
  email: string | null;
}

interface PendingPreferencesCache {
  userId: number;
  preferences: Partial<UserPreferences>;
}

class AuthService {
  private getRawStoredUser(): User | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const userStr = localStorage.getItem('user');
    if (!userStr) {
      return null;
    }

    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  private getPendingPreferencesCache(): PendingPreferencesCache | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const pendingStr = localStorage.getItem(PENDING_PREFERENCES_STORAGE_KEY);
    if (!pendingStr) {
      return null;
    }

    try {
      return JSON.parse(pendingStr) as PendingPreferencesCache;
    } catch {
      return null;
    }
  }

  private withStoredPreferences(user: User): User {
    if (user.preferences) {
      return user;
    }

    const storedUser = this.getRawStoredUser();
    if (storedUser?.preferences) {
      return { ...user, preferences: storedUser.preferences };
    }

    return user;
  }

  private persistUser(user: User | null): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (!user) {
      localStorage.removeItem(PENDING_PREFERENCES_STORAGE_KEY);
      document.cookie = clearAppearanceHintCookieString();
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent(AUTH_USER_UPDATED_EVENT, { detail: null }));
      return;
    }

    const persistedUser = this.withStoredPreferences(user);
    localStorage.setItem('user', JSON.stringify(persistedUser));
    window.dispatchEvent(new CustomEvent(AUTH_USER_UPDATED_EVENT, { detail: persistedUser }));
  }

  getPendingPreferences(userId?: number | null): Partial<UserPreferences> | null {
    const pendingCache = this.getPendingPreferencesCache();
    if (!pendingCache) {
      return null;
    }

    const effectiveUserId = userId ?? this.getRawStoredUser()?.id;
    if (!effectiveUserId || pendingCache.userId !== effectiveUserId) {
      return null;
    }

    return pendingCache.preferences ?? null;
  }

  cachePendingPreferences(preferences: Partial<UserPreferences>): void {
    if (typeof window === 'undefined') {
      return;
    }

    const storedUser = this.getRawStoredUser();
    if (!storedUser) {
      return;
    }

    const existingPendingPreferences = this.getPendingPreferences(storedUser.id) ?? {};

    localStorage.setItem(
      PENDING_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        userId: storedUser.id,
        preferences: {
          ...existingPendingPreferences,
          ...preferences,
        },
      }),
    );
  }

  clearPendingPreferences(userId?: number | null): void {
    if (typeof window === 'undefined') {
      return;
    }

    const pendingCache = this.getPendingPreferencesCache();
    if (!pendingCache) {
      return;
    }

    if (userId && pendingCache.userId !== userId) {
      return;
    }

    localStorage.removeItem(PENDING_PREFERENCES_STORAGE_KEY);
  }

   // Login with username and password
  async login(credentials: LoginCredentials): Promise<{ 
    success: boolean; 
    user?: User; 
    mustChangePassword?: boolean; 
    requiresTwoFactor?: boolean;
    twoFactorData?: TwoFactorResult;
    error?: string 
  }> {
    const response = await apiService.post<LoginResponse>(API_ENDPOINTS.LOGIN, credentials);

    if (response.success && response.data) {
      // Check if 2FA is required
      if (response.data.requiresTwoFactor) {
        return {
          success: true,
          requiresTwoFactor: true,
          twoFactorData: {
            requiresTwoFactor: true as const,
            userId: response.data.userId!,
            twoFactorMethod: response.data.twoFactorMethod!,
            email: response.data.email ?? null
          }
        };
      }

      const { user, accessToken, refreshToken, mustChangePassword } = response.data;
      
      // Store tokens
      apiService.setAuthTokens(accessToken, refreshToken);
      
      // Store user info
      this.clearPendingPreferences(user.id);
      this.persistUser(user);
      authChannel?.postMessage({ type: 'login' });

      return { success: true, user, mustChangePassword };
    }

    // Extract error message - handle both string and object errors
    let errorMessage = 'เข้าสู่ระบบไม่สำเร็จ';
    if (response.message) {
      errorMessage = response.message;
    } else if (response.error) {
      if (typeof response.error === 'string') {
        errorMessage = response.error;
      } else if (typeof response.error === 'object' && response.error !== null) {
        errorMessage = (response.error as { message?: string }).message || errorMessage;
      }
    }

    return { 
      success: false, 
      error: errorMessage 
    };
  }

   // Logout
  async logout(): Promise<void> {
    try {
      // Get refresh token before clearing to send to server
      const refreshToken = typeof window !== 'undefined' 
        ? localStorage.getItem('refreshToken') 
        : null;
      
      // Send refresh token to revoke it on server
      await apiService.post(API_ENDPOINTS.LOGOUT, { refreshToken });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      apiService.clearAuthTokens();
      this.persistUser(null);
      // Broadcast logout to other tabs
      authChannel?.postMessage({ type: 'logout' });
    }
  }


   // Subscribe to auth changes from other tabs


  onAuthChange(callback: (event: { type: 'logout' | 'login' }) => void): () => void {
    if (!authChannel) return () => {};
    
    const handler = (event: MessageEvent) => {
      callback(event.data);
    };
    
    authChannel.addEventListener('message', handler);
    return () => authChannel?.removeEventListener('message', handler);
  }

  /**
   * Get current user from API
   */
  async getCurrentUser(): Promise<User | null> {
    if (!apiService.isAuthenticated()) {
      return null;
    }

    const response = await apiService.get<{ user: User }>(API_ENDPOINTS.ME);

    if (response.success && response.data) {
      const user = this.withStoredPreferences(response.data.user);
      this.persistUser(user);
      return user;
    }

    return null;
  }

  /**
   * Get stored user from localStorage
   */
  getStoredUser(): User | null {
    return this.getRawStoredUser();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return apiService.isAuthenticated();
  }


   // Change password

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.post(API_ENDPOINTS.CHANGE_PASSWORD, {
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (response.success) {
      return { success: true };
    }

    // Handle error object format: { code: number, message: string }
    const err = response.error as unknown;
    const errorMessage = response.message || 
      (typeof err === 'object' && err !== null && 'message' in err ? (err as { message: string }).message : null) || 
      (typeof err === 'string' ? err : null) || 
      'เปลี่ยนรหัสผ่านไม่สำเร็จ';

    return {
      success: false,
      error: errorMessage,
    };
  }

   // Update user profile (requires password confirmation)
  async updateProfile(data: { full_name?: string; email?: string; current_password: string }): Promise<{ success: boolean; user?: User; error?: string }> {
    const response = await apiService.put<{ user: User }>(API_ENDPOINTS.UPDATE_PROFILE, {
      fullName: data.full_name,
      email: data.email,
      currentPassword: data.current_password,
    });

    if (response.success && response.data) {
      const user = response.data.user;
      this.persistUser(user);
      return { success: true, user };
    }

    // Handle error object format: { code: number, message: string }
    const err = response.error as unknown;
    const errorMessage = response.message || 
      (typeof err === 'object' && err !== null && 'message' in err ? (err as { message: string }).message : null) || 
      (typeof err === 'string' ? err : null) || 
      'อัปเดตโปรไฟล์ไม่สำเร็จ';

    return {
      success: false,
      error: errorMessage,
    };
  }

  async updatePreferences(data: Partial<UserPreferences>): Promise<{ success: boolean; preferences?: UserPreferences; user?: User; error?: string }> {
    const response = await apiService.put<{ preferences: UserPreferences; user: User }>(API_ENDPOINTS.UPDATE_PREFERENCES, data);

    if (response.success && response.data) {
      const user = this.withStoredPreferences({
        ...response.data.user,
        preferences: response.data.preferences ?? response.data.user.preferences,
      });
      this.persistUser(user);
      this.clearPendingPreferences(response.data.user.id);
      return {
        success: true,
        preferences: response.data.preferences,
        user,
      };
    }

    const err = response.error as unknown;
    const errorMessage = response.message ||
      (typeof err === 'object' && err !== null && 'message' in err ? (err as { message: string }).message : null) ||
      (typeof err === 'string' ? err : null) ||
      'บันทึกการตั้งค่าไม่สำเร็จ';

    return {
      success: false,
      error: errorMessage,
    };
  }

  /**
   * Check if user has required role
   */
  hasRole(requiredRoles: string | string[]): boolean {
    const user = this.getStoredUser();
    if (!user) return false;

    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return roles.includes(user.role);
  }

  /**
   * Set tokens manually (for OAuth callback)
   */
  setTokens(accessToken: string, refreshToken: string): void {
    apiService.setAuthTokens(accessToken, refreshToken);
  }

  /**
   * Clear tokens (for logout or error)
   */
  clearTokens(): void {
    apiService.clearAuthTokens();
    if (typeof window !== 'undefined') {
      document.cookie = clearAppearanceHintCookieString();
      localStorage.removeItem(PENDING_PREFERENCES_STORAGE_KEY);
      localStorage.removeItem('user');
    }
  }

  /**
   * Get user info from API (for OAuth callback)
   */
  async getMe(): Promise<{ success: boolean; user?: User; error?: string }> {
    const response = await apiService.get<{ user: User }>(API_ENDPOINTS.ME);

    if (response.success && response.data) {
      const user = response.data.user;
      this.persistUser(user);
      return { success: true, user };
    }

    return {
      success: false,
      error: response.message || 'ไม่สามารถดึงข้อมูลผู้ใช้ได้',
    };
  }

  /**
   * Get Google OAuth URL
   */
  getGoogleAuthUrl(audience?: 'student'): string {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    if (audience === 'student') {
      return `${apiBaseUrl}/auth/google?audience=student`;
    }

    return `${apiBaseUrl}/auth/google`;
  }

  /**
   * Get GitHub OAuth URL
   */
  getGitHubAuthUrl(): string {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    return `${apiBaseUrl}/auth/github`;
  }

  /**
   * Force change password (for first login)
   */
  async forceChangePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.post<{ message: string }>('/auth/force-change-password', { newPassword });

    if (response.success) {
      // Clear tokens after password change - user needs to login again
      this.clearTokens();
      return { success: true };
    }

    return {
      success: false,
      error: response.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้',
    };
  }

  /**
   * Get active sessions
   */
  async getSessions(): Promise<{ success: boolean; sessions?: Session[]; error?: string }> {
    const response = await apiService.get<{ sessions: Session[] }>(API_ENDPOINTS.SESSIONS);

    if (response.success && response.data) {
      return { success: true, sessions: response.data.sessions };
    }

    return {
      success: false,
      error: response.message || 'ไม่สามารถดึงข้อมูล sessions ได้',
    };
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: number): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.delete(API_ENDPOINTS.REVOKE_SESSION(sessionId));

    if (response.success) {
      return { success: true };
    }

    return {
      success: false,
      error: response.message || 'ไม่สามารถยกเลิก session ได้',
    };
  }

  /**
   * Revoke all sessions except current
   */
  async revokeAllSessions(): Promise<{ success: boolean; revokedCount?: number; error?: string }> {
    const response = await apiService.post<{ revokedCount: number }>(API_ENDPOINTS.REVOKE_ALL_SESSIONS);

    if (response.success && response.data) {
      return { success: true, revokedCount: response.data.revokedCount };
    }

    return {
      success: false,
      error: response.message || 'ไม่สามารถยกเลิก sessions ได้',
    };
  }

  /**
   * Upload avatar
   */
  async uploadAvatar(file: File): Promise<{ success: boolean; avatar?: string; error?: string }> {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await apiService.post<{ avatar: string }>(API_ENDPOINTS.UPLOAD_AVATAR, formData);

    if (response.success && response.data) {
      // Update stored user with new avatar
      const storedUser = this.getStoredUser();
      if (storedUser) {
        this.persistUser({ ...storedUser, avatar: response.data.avatar });
      }
      return { success: true, avatar: response.data.avatar };
    }

    return {
      success: false,
      error: response.message || 'ไม่สามารถอัปโหลดรูปภาพได้',
    };
  }

  /**
   * Remove avatar
   */
  async removeAvatar(): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.delete<{ user: User }>(API_ENDPOINTS.REMOVE_AVATAR);

    if (response.success) {
      // Update stored user
      const storedUser = this.getStoredUser();
      if (storedUser) {
        this.persistUser({ ...storedUser, avatar: null });
      }
      return { success: true };
    }

    return {
      success: false,
      error: response.message || 'ไม่สามารถลบรูปภาพได้',
    };
  }

  /**
   * Request password reset (Forgot Password)
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const response = await apiService.post<{ message: string }>('/auth/forgot-password', { email });

    if (response.success) {
      return { success: true, message: response.data?.message || response.message };
    }

    return {
      success: false,
      error: response.message || 'ไม่สามารถส่งคำขอได้',
    };
  }

  /**
   * Validate password reset token
   */
  async validateResetToken(token: string): Promise<{ success: boolean; valid?: boolean; error?: string }> {
    const response = await apiService.post<{ valid: boolean }>('/auth/validate-reset-token', { token });

    if (response.success && response.data) {
      return { success: true, valid: response.data.valid };
    }

    return {
      success: false,
      error: response.message || 'Token ไม่ถูกต้องหรือหมดอายุ',
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const response = await apiService.post<{ message: string }>('/auth/reset-password', { token, newPassword });

    if (response.success) {
      return { success: true, message: response.data?.message || response.message };
    }

    return {
      success: false,
      error: response.message || 'ไม่สามารถรีเซ็ตรหัสผ่านได้',
    };
  }
}

export const authService = new AuthService();
export default authService;
