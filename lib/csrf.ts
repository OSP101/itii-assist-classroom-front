// Single source of truth for the double-submit CSRF token.
//
// Normally the backend sets `csrf_token` as a deliberately non-httpOnly
// cookie (see utils.SetAuthCookies on the Go side) and JS just reads it back.
// That breaks on cocolabs.computing.kku.ac.th: the university's reverse proxy
// rewrites every Set-Cookie it relays and forces `HttpOnly` on, so the cookie
// arrives intact but is invisible to JS — `document.cookie` never shows it.
// The symptom is a successful login that bounces straight back to /login,
// because a readable csrf_token doubles as the "we have a session" signal.
//
// So the backend also returns the token in an `X-CSRF-Token` response header
// (on every response that sets auth cookies, plus GET /api/auth/me), and we
// mirror it here. The cookie stays authoritative wherever it is readable; the
// stored copy is only a fallback for hosts where the proxy hides it.
//
// Keeping the token in localStorage is no weaker than the cookie it replaces:
// the cookie was JS-readable by design, so anything able to read one could
// read the other. It is not a session secret — the httpOnly access_token is.

const STORAGE_KEY = "csrf_token";
export const CSRF_HEADER = "X-CSRF-Token";

let inMemoryToken: string | null = null;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function readStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private-mode / storage-disabled browsers: the in-memory copy still
    // covers everything except a full page reload.
    return null;
  }
}

// Cookie first: it is what the server will compare against, so where it is
// readable it is always the freshest truth. The stored copy only fills in
// when the proxy has hidden the cookie from JS.
export function getCsrfToken(): string | null {
  const fromCookie = readCookie(STORAGE_KEY);
  if (fromCookie) {
    inMemoryToken = fromCookie;
    return fromCookie;
  }
  return inMemoryToken ?? readStoredToken();
}

export function rememberCsrfToken(token: string | null | undefined): void {
  if (!token) {
    return;
  }
  inMemoryToken = token;
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Non-fatal — the in-memory copy carries this tab.
  }
}

// Call on every response that might carry a refreshed token, so a rotated
// token never drifts out of sync with the cookie the server holds.
export function captureCsrfToken(response: { headers: Headers }): void {
  rememberCsrfToken(response.headers.get(CSRF_HEADER));
}

export function clearCsrfToken(): void {
  inMemoryToken = null;
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — the in-memory copy is already gone.
  }
}

// Convenience for the many call sites that build a headers object for a
// mutating request. Returns an empty object when no token is available, so
// spreading it is always safe.
export function csrfHeader(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { [CSRF_HEADER]: token } : {};
}
