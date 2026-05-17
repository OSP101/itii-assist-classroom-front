const AUTH_RETURN_PATH_KEY = "auth:return-path";
const OAUTH_RETURN_URL_KEY = "oauth_return_url";

function getWindowOrigin(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.location.origin;
}

export function normalizeAppReturnPath(candidate?: string | null): string | null {
  const value = candidate?.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("/")) {
    if (value.startsWith("//")) {
      return null;
    }
    return value;
  }

  const origin = getWindowOrigin();
  if (!origin) {
    return null;
  }

  try {
    const resolved = new URL(value, origin);
    if (resolved.origin !== origin) {
      return null;
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}

export function buildLoginHref(nextPath?: string | null): string {
  const normalized = normalizeAppReturnPath(nextPath);
  if (!normalized) {
    return "/login";
  }

  return `/login?next=${encodeURIComponent(normalized)}`;
}

export function isStudentAuthPath(nextPath?: string | null): boolean {
  const normalized = normalizeAppReturnPath(nextPath);
  if (!normalized) {
    return false;
  }

  return normalized.startsWith("/student") || normalized.startsWith("/check-in/") || normalized.startsWith("/queue/book");
}

export function buildStudentLoginHref(nextPath?: string | null): string {
  const normalized = normalizeAppReturnPath(nextPath);
  if (!normalized) {
    return "/student/login";
  }

  return `/student/login?next=${encodeURIComponent(normalized)}`;
}

export function buildPreferredLoginHref(nextPath?: string | null): string {
  return isStudentAuthPath(nextPath) ? buildStudentLoginHref(nextPath) : buildLoginHref(nextPath);
}

export function storePendingAuthReturnPath(nextPath?: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeAppReturnPath(nextPath);
  if (!normalized) {
    sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
    return;
  }

  sessionStorage.setItem(AUTH_RETURN_PATH_KEY, normalized);
}

export function peekPendingAuthReturnPath(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeAppReturnPath(sessionStorage.getItem(AUTH_RETURN_PATH_KEY));
}

export function consumePendingAuthReturnPath(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = normalizeAppReturnPath(sessionStorage.getItem(AUTH_RETURN_PATH_KEY));
  sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
  return value;
}

export function storeOAuthReturnPath(nextPath?: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeAppReturnPath(nextPath);
  if (!normalized) {
    sessionStorage.removeItem(OAUTH_RETURN_URL_KEY);
    return;
  }

  sessionStorage.setItem(OAUTH_RETURN_URL_KEY, normalized);
}

export function consumeOAuthReturnPath(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = normalizeAppReturnPath(sessionStorage.getItem(OAUTH_RETURN_URL_KEY));
  sessionStorage.removeItem(OAUTH_RETURN_URL_KEY);
  return value;
}

export function getCurrentAppPath(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}