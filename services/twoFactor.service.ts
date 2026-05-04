import { apiService } from "./api.service";
import { API_ENDPOINTS } from "@/config/api";

export interface TwoFactorStatus {
  enabled: boolean;
  method: "totp" | "email" | null;
  confirmedAt: string | null;
}

export interface TOTPSetupResponse {
  qrCode: string;
  secret: string;
  issuer: string;
}

export interface EmailSetupResponse {
  email: string;
}

export interface VerifyResponse {
  backupCodes: string[];
  enabled: boolean;
  method: string;
}

export interface TwoFactorLoginData {
  requiresTwoFactor: true;
  twoFactorMethod: "totp" | "email";
  userId: number;
  email: string | null;
}

class TwoFactorService {
  /**
   * Get 2FA status for current user
   */
  async getStatus(): Promise<{ success: boolean; data?: TwoFactorStatus; error?: string }> {
    const response = await apiService.get<TwoFactorStatus>("/auth/2fa/status");
    
    if (response.success && response.data) {
      return { success: true, data: response.data };
    }
    
    return { success: false, error: response.message || "ไม่สามารถดึงข้อมูลได้" };
  }

  /**
   * Setup TOTP 2FA
   */
  async setupTOTP(): Promise<{ success: boolean; data?: TOTPSetupResponse; error?: string }> {
    const response = await apiService.post<TOTPSetupResponse>("/auth/2fa/setup/totp");
    
    if (response.success && response.data) {
      return { success: true, data: response.data };
    }
    
    const err = response.error as unknown;
    const errorMessage = response.message || 
      (typeof err === 'object' && err !== null && 'message' in err ? (err as { message: string }).message : null) || 
      "ไม่สามารถเริ่มตั้งค่าได้";
    
    return { success: false, error: errorMessage };
  }

  /**
   * Setup Email 2FA
   */
  async setupEmail(): Promise<{ success: boolean; data?: EmailSetupResponse; error?: string }> {
    const response = await apiService.post<EmailSetupResponse>("/auth/2fa/setup/email");
    
    if (response.success && response.data) {
      return { success: true, data: response.data };
    }
    
    const err = response.error as unknown;
    const errorMessage = response.message || 
      (typeof err === 'object' && err !== null && 'message' in err ? (err as { message: string }).message : null) || 
      "ไม่สามารถเริ่มตั้งค่าได้";
    
    return { success: false, error: errorMessage };
  }

  /**
   * Verify code and enable 2FA
   */
  async verify(code: string, method: "totp" | "email"): Promise<{ success: boolean; data?: VerifyResponse; error?: string }> {
    const response = await apiService.post<VerifyResponse>("/auth/2fa/verify", { code, method });
    
    if (response.success && response.data) {
      return { success: true, data: response.data };
    }
    
    const err = response.error as unknown;
    const errorMessage = response.message || 
      (typeof err === 'object' && err !== null && 'message' in err ? (err as { message: string }).message : null) || 
      "รหัสไม่ถูกต้อง";
    
    return { success: false, error: errorMessage };
  }

  /**
   * Resend email verification code
   */
  async resendEmailCode(): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.post("/auth/2fa/resend-email");
    
    if (response.success) {
      return { success: true };
    }
    
    return { success: false, error: response.message || "ไม่สามารถส่งรหัสใหม่ได้" };
  }

  /**
   * Disable 2FA
   */
  async disable(password: string, code?: string): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.post("/auth/2fa/disable", { password, code });
    
    if (response.success) {
      return { success: true };
    }
    
    const err = response.error as unknown;
    const errorMessage = response.message || 
      (typeof err === 'object' && err !== null && 'message' in err ? (err as { message: string }).message : null) || 
      "ไม่สามารถปิดการใช้งานได้";
    
    return { success: false, error: errorMessage };
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(password: string): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
    const response = await apiService.post<{ backupCodes: string[] }>("/auth/2fa/backup-codes", { password });
    
    if (response.success && response.data) {
      return { success: true, backupCodes: response.data.backupCodes };
    }
    
    const err = response.error as unknown;
    const errorMessage = response.message || 
      (typeof err === 'object' && err !== null && 'message' in err ? (err as { message: string }).message : null) || 
      "ไม่สามารถสร้างรหัสสำรองใหม่ได้";
    
    return { success: false, error: errorMessage };
  }

  /**
   * Complete login with 2FA code
   */
  async completeLogin(userId: number, code: string): Promise<{ 
    success: boolean; 
    data?: { 
      user: unknown; 
      accessToken: string; 
      refreshToken: string;
      mustChangePassword: boolean;
      usedBackupCode: boolean;
    }; 
    error?: string 
  }> {
    const response = await apiService.post<{ 
      user: unknown; 
      accessToken: string; 
      refreshToken: string;
      mustChangePassword: boolean;
      usedBackupCode: boolean;
    }>("/auth/2fa/complete-login", { userId, code });
    
    if (response.success && response.data) {
      return { success: true, data: response.data };
    }
    
    const err = response.error as unknown;
    const errorMessage = response.message || 
      (typeof err === 'object' && err !== null && 'message' in err ? (err as { message: string }).message : null) || 
      "รหัสยืนยันไม่ถูกต้อง";
    
    return { success: false, error: errorMessage };
  }

  /**
   * Send 2FA login code via email
   */
  async sendLoginCode(userId: number): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.post("/auth/2fa/send-login-code", { userId });
    
    if (response.success) {
      return { success: true };
    }
    
    const err = response.error as unknown;
    const errorMessage = response.message || 
      (typeof err === 'object' && err !== null && 'message' in err ? (err as { message: string }).message : null) || 
      "ไม่สามารถส่งรหัสได้";
    
    return { success: false, error: errorMessage };
  }
}

export const twoFactorService = new TwoFactorService();
