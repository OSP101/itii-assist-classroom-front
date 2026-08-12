import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildPreferredLoginHref } from '@/lib/auth-resume';

/**
 * Proxy to handle route protection.
 *
 * The access token now lives in an httpOnly cookie (see
 * utils.SetAuthCookies on the Go backend), so — unlike before, when tokens
 * lived in localStorage and were invisible here — this proxy CAN see
 * whether a session cookie is present and bounce obviously-unauthenticated
 * requests to /login before any protected UI ships to the client.
 *
 * This is still only an OPTIMISTIC check (presence of a cookie, not
 * validation of its contents/expiry) — real authorization stays entirely
 * server-side via the Go backend's Protected()/RequireRole() middleware,
 * unchanged. A request that sails through here with a stale/expired cookie
 * still gets a 401 from the API and is handled by the existing client-side
 * refresh/redirect flow in api.service.ts.
 */

/** Cookie name set by api.service.ts interceptor when backend returns 503 MAINTENANCE_MODE */
const MAINTENANCE_COOKIE = 'maintenance_active';

/**
 * Content-Security-Policy is issued HERE rather than by nginx, because a
 * per-request nonce is the only way to drop `'unsafe-inline'` from script-src
 * and style-src (ZAP flags both as Medium). nginx cannot mint one, so the
 * HTML-serving nginx locations (`location /`, the docs/support block and
 * @frontend_asset_not_found) deliberately no longer set a CSP header — two CSP
 * headers are enforced as an intersection, so a static nginx policy would veto
 * the nonce'd inline scripts Next.js emits and break every page.
 *
 * Next.js parses this header, extracts `'nonce-…'` and applies it to framework
 * scripts, page bundles and its own inline scripts automatically. Anything we
 * hand-write inline (app/layout.tsx's theme bootstrap) must take the nonce
 * explicitly from the `x-nonce` request header set below.
 *
 * NOTE: nonces require dynamic rendering. RootLayout already awaits cookies(),
 * so every HTML route here is dynamic anyway — but a page opted back into
 * static rendering would ship with no nonce and its scripts would be blocked.
 */
function buildCsp(nonce: string) {
    const isDev = process.env.NODE_ENV === 'development';

    return [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "object-src 'none'",
        // 'unsafe-eval' is required in dev only: React uses eval to rebuild
        // server-side error stacks in the browser. Neither React nor Next.js
        // use eval in production.
        `script-src 'self' 'nonce-${nonce}' blob: https://accounts.google.com${isDev ? " 'unsafe-eval'" : ''}`,
        // Stylesheets (<style> elements and <link rel=stylesheet>) are
        // nonce-only in production: SSR emits no inline <style> of its own, and
        // the one third-party injection that exists (react-aria's pressable
        // stylesheet) is pre-rendered with this nonce in app/layout.tsx.
        `style-src 'self'${isDev ? " 'unsafe-inline'" : ` 'nonce-${nonce}'`}`,
        // …but style="…" ATTRIBUTES still need 'unsafe-inline'. React applies
        // `style={{…}}` props by setting the attribute, so locking this down
        // would silently drop layout from any component using inline styles
        // (verified: the docs table-of-contents indentation, HeroUI internals).
        // This is a much weaker vector than script-src or stylesheet injection
        // — an attacker who can already inject markup gains only CSS on the
        // node they injected, with no script execution.
        "style-src-attr 'unsafe-inline'",
        "img-src 'self' data: blob: https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org",
        "font-src 'self' data:",
        "connect-src 'self' https://api.open-meteo.com https://nominatim.openstreetmap.org https://accounts.google.com",
        "frame-src 'self' https://accounts.google.com",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        'upgrade-insecure-requests',
    ].join('; ');
}

/** Must match utils.AccessTokenCookieName on the Go backend. */
const ACCESS_TOKEN_COOKIE = 'access_token';

// A bare NextResponse.redirect() carries no body and no Content-Type header
// — harmless (redirects have nothing to render), but flagged by scanners
// (e.g. ZAP "Content-Type Header Missing") on the RSC prefetch requests
// Next.js's own router fires against protected routes. Set one explicitly
// so the redirect response is unambiguous either way.
function redirectWithContentType(url: URL, csp: string) {
    const res = NextResponse.redirect(url);
    res.headers.set('Content-Type', 'text/plain; charset=utf-8');
    res.headers.set('Content-Security-Policy', csp);
    return res;
}

// Route prefixes that unambiguously require a logged-in session. Kept
// deliberately conservative — anything not listed here just keeps relying
// on the pre-existing client-side redirect (no functional regression),
// since missing a prefix here is a UX miss, not a security hole.
const protectedPrefixes = [
    '/admin',
    '/classroom/',
    '/profile',
    '/settings',
    '/permissions',
    '/student/courses',
    '/student/profile',
    '/student/notifications',
    '/student/scan',
];

// Routes that are completely public (no auth needed)
const publicRoutes = [
    '/login',
    '/auth/callback',
];

// Routes that start with these prefixes are public
const publicPrefixes = [
    '/check-in/',  // Public check-in page for students
    '/display/',   // Public display board (device-authenticated via display grant cookie)
];

// Paths exempt from maintenance redirect
// Note: /login is intentionally NOT exempt — the login page proactively checks
// maintenance status on mount and redirects itself. Admins use /maintenance/alogin.
const maintenanceExempt = [
    '/maintenance',
    '/auth/',
    '/check-in/',
    '/display/',
];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const csp = buildCsp(nonce);

    // Next.js reads the nonce back off the REQUEST headers while rendering, so
    // both of these have to be forwarded upstream, not just set on the response.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);

    const passThrough = () => {
        const res = NextResponse.next({ request: { headers: requestHeaders } });
        res.headers.set('Content-Security-Policy', csp);
        return res;
    };

    // Check if it's an API route or static file - skip these
    const isApiRoute = pathname.startsWith('/api');
    const isStaticFile = pathname.startsWith('/_next') ||
                         pathname.startsWith('/images') ||
                         pathname.includes('.') ||
                         pathname === '/favicon.ico';

    if (isApiRoute || isStaticFile) {
        return passThrough();
    }

    // Maintenance redirect — must come before auth check so blocked users see the maintenance page
    const isMaintenanceExempt = maintenanceExempt.some(
        (p) => pathname === p || pathname.startsWith(p),
    );
    if (!isMaintenanceExempt) {
        const maintenanceCookie = request.cookies.get(MAINTENANCE_COOKIE);
        if (maintenanceCookie?.value === '1') {
            return redirectWithContentType(new URL('/maintenance', request.url), csp);
        }
    }

    // Check if the route is public
    const isPublicRoute = publicRoutes.includes(pathname) ||
                         publicPrefixes.some(prefix => pathname.startsWith(prefix));

    // Allow public routes
    if (isPublicRoute) {
        return passThrough();
    }

    // Optimistic auth gate: bounce unambiguously-protected routes to /login
    // before any protected UI ships, if there's no access-token cookie at all.
    const isProtectedRoute = protectedPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix),
    );
    if (isProtectedRoute && !request.cookies.get(ACCESS_TOKEN_COOKIE)) {
        const nextPath = `${pathname}${request.nextUrl.search}`;
        return redirectWithContentType(new URL(buildPreferredLoginHref(nextPath), request.url), csp);
    }

    // For all other routes, allow through and let client-side handle auth.
    // The layout components will redirect to login if not authenticated.
    return passThrough();
}

// Configure which routes the proxy should run on
export const config = {
    matcher: [
        /*
         * Match all request paths except _next/static, whose immutable build
         * output nginx serves with its own static security headers.
         *
         * _next/image, favicon.ico and /images/ used to be excluded too, but
         * now that this proxy is the only thing issuing a CSP, excluding a path
         * means that response carries no CSP header at all — so they are back
         * in (the handler short-circuits them to a plain pass-through).
         */
        '/((?!_next/static).*)',
    ],
};
