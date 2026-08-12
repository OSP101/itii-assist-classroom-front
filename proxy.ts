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

/** Must match utils.AccessTokenCookieName on the Go backend. */
const ACCESS_TOKEN_COOKIE = 'access_token';

// A bare NextResponse.redirect() carries no body and no Content-Type header
// — harmless (redirects have nothing to render), but flagged by scanners
// (e.g. ZAP "Content-Type Header Missing") on the RSC prefetch requests
// Next.js's own router fires against protected routes. Set one explicitly
// so the redirect response is unambiguous either way.
function redirectWithContentType(url: URL) {
    const res = NextResponse.redirect(url);
    res.headers.set('Content-Type', 'text/plain; charset=utf-8');
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

    // Check if it's an API route or static file - skip these
    const isApiRoute = pathname.startsWith('/api');
    const isStaticFile = pathname.startsWith('/_next') ||
                         pathname.startsWith('/images') ||
                         pathname.includes('.') ||
                         pathname === '/favicon.ico';

    if (isApiRoute || isStaticFile) {
        return NextResponse.next();
    }

    // Maintenance redirect — must come before auth check so blocked users see the maintenance page
    const isMaintenanceExempt = maintenanceExempt.some(
        (p) => pathname === p || pathname.startsWith(p),
    );
    if (!isMaintenanceExempt) {
        const maintenanceCookie = request.cookies.get(MAINTENANCE_COOKIE);
        if (maintenanceCookie?.value === '1') {
            return redirectWithContentType(new URL('/maintenance', request.url));
        }
    }

    // Check if the route is public
    const isPublicRoute = publicRoutes.includes(pathname) ||
                         publicPrefixes.some(prefix => pathname.startsWith(prefix));

    // Allow public routes
    if (isPublicRoute) {
        return NextResponse.next();
    }

    // Optimistic auth gate: bounce unambiguously-protected routes to /login
    // before any protected UI ships, if there's no access-token cookie at all.
    const isProtectedRoute = protectedPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix),
    );
    if (isProtectedRoute && !request.cookies.get(ACCESS_TOKEN_COOKIE)) {
        const nextPath = `${pathname}${request.nextUrl.search}`;
        return redirectWithContentType(new URL(buildPreferredLoginHref(nextPath), request.url));
    }

    // For all other routes, allow through and let client-side handle auth.
    // The layout components will redirect to login if not authenticated.
    return NextResponse.next();
}

// Configure which routes the proxy should run on
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|images/).*)',
    ],
};
