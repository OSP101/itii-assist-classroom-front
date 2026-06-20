const FALLBACK_APP_ORIGIN = (process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

export function getAppOrigin(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  return FALLBACK_APP_ORIGIN;
}

export function getAppUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppOrigin()}${normalizedPath}`;
}

export function getAppHostLabel(): string {
  return getAppOrigin().replace(/^https?:\/\//, "");
}
