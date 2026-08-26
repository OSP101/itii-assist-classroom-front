/**
 * Client-side bookkeeping for the backend's absolute 12h session cap (see
 * MaxSessionDuration in itii-assist-classroom-back/handlers/auth_handler.go).
 *
 * The access/refresh tokens are httpOnly cookies the frontend can never read,
 * so the deadline itself travels as a plain `sessionExpiresAt` field in the
 * login/refresh/me JSON bodies instead, and gets mirrored here into
 * localStorage so every tab (and a full page reload) can see the same
 * deadline without an extra round trip.
 */

const SESSION_EXPIRES_AT_KEY = "session_expires_at";
const SESSION_TIMEOUT_REASON_KEY = "session_timeout_reason";

// Fired whenever the stored deadline changes (new login, refresh rotation,
// logout) so a mounted SessionTimeoutWatcher can re-schedule its timers
// without polling.
export const SESSION_EXPIRY_EVENT = "session:expiry-updated";

export function setSessionExpiresAt(value?: string | Date | null): void {
  if (typeof window === "undefined") return;

  if (!value) {
    localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
  } else {
    const iso = typeof value === "string" ? value : value.toISOString();
    localStorage.setItem(SESSION_EXPIRES_AT_KEY, iso);
  }
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRY_EVENT));
}

export function getSessionExpiresAt(): Date | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(SESSION_EXPIRES_AT_KEY);
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function clearSessionExpiresAt(): void {
  setSessionExpiresAt(null);
}

// One-shot flag: set right before a forced logout caused by the absolute
// session cap, read (and cleared) by the login page so it can show a toast
// explaining *why* the user landed there instead of just "logged out".
export function markSessionExpiredByTimeout(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_TIMEOUT_REASON_KEY, "absolute");
}

export function consumeSessionExpiredFlag(): boolean {
  if (typeof window === "undefined") return false;

  const flagged = sessionStorage.getItem(SESSION_TIMEOUT_REASON_KEY) === "absolute";
  if (flagged) sessionStorage.removeItem(SESSION_TIMEOUT_REASON_KEY);
  return flagged;
}
