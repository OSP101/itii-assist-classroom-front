import { apiService } from "./api.service";

export interface StepUpChallengeResponse {
  action: string;
  method: "totp" | "email";
  maskedEmail?: string;
  expiresIn: number;
}

interface StepUpVerifyResponse {
  action: string;
  stepUpToken: string;
  expiresAt: string;
}

interface CachedStepUpToken {
  token: string;
  expiresAt: string;
}

const STORAGE_KEY = "step_up_tokens";

function readStepUpStore(): Record<string, CachedStepUpToken> {
  if (typeof window === "undefined") return {};
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, CachedStepUpToken>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function writeStepUpStore(next: Record<string, CachedStepUpToken>): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function getCachedToken(action: string): string | null {
  const store = readStepUpStore();
  const value = store[action];
  if (!value) return null;
  if (new Date(value.expiresAt).getTime() <= Date.now()) {
    delete store[action];
    writeStepUpStore(store);
    return null;
  }
  return value.token;
}

function cacheToken(action: string, token: string, expiresAt: string): void {
  const store = readStepUpStore();
  store[action] = { token, expiresAt };
  writeStepUpStore(store);
}

export interface StepUpChallengeError {
  code?: string;
  message?: string;
}

let _lastChallengeError: StepUpChallengeError | null = null;

async function requestChallenge(action: string): Promise<StepUpChallengeResponse | null> {
  _lastChallengeError = null;
  const response = await apiService.post<StepUpChallengeResponse & { code?: string }>(
    "/auth/2fa/step-up/challenge",
    { action }
  );
  if (!response.success || !response.data) {
    _lastChallengeError = {
      code: (response as unknown as { code?: string }).code,
      message: response.message,
    };
    return null;
  }
  return response.data;
}

async function verifyChallenge(action: string, code: string): Promise<StepUpVerifyResponse | null> {
  const response = await apiService.post<StepUpVerifyResponse>("/auth/2fa/step-up/verify", { action, code });
  if (!response.success || !response.data) return null;
  return response.data;
}

export const stepUpService = {
  getCachedToken,
  requestChallenge,
  getLastChallengeError: () => _lastChallengeError,
  clearCachedToken(action: string): void {
    const store = readStepUpStore();
    delete store[action];
    writeStepUpStore(store);
  },
  async verifyChallenge(action: string, code: string): Promise<string | null> {
    const verified = await verifyChallenge(action, code);
    if (!verified) return null;
    cacheToken(action, verified.stepUpToken, verified.expiresAt);
    return verified.stepUpToken;
  },
};
