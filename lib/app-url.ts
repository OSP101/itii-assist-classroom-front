const FALLBACK_APP_ORIGIN = (process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

// Pins every student-facing link/QR (check-in, queue booking, display
// pairing) to a fixed origin instead of whatever domain the instructor's
// browser happens to be on. Set to the Cloudflare-fronted backup domain in
// production: it never touches the KKU reverse proxy's per-URL rate limiter,
// which is what breaks lazy-loaded chunks for students on off-campus
// networks (see lib/chunk-recovery.ts). Empty (the default) keeps the old
// per-origin behaviour, which is what local dev wants.
//
// Baked in at build time, so changing it requires a rebuild, not a restart.
const STUDENT_LINK_ORIGIN = (process.env.NEXT_PUBLIC_STUDENT_LINK_ORIGIN || "").trim().replace(/\/$/, "");

export function getAppOrigin(): string {
  if (STUDENT_LINK_ORIGIN) {
    return STUDENT_LINK_ORIGIN;
  }

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
