import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy to handle route protection.
 * Note: Full authentication check happens in layout components because
 * tokens are stored in localStorage which is not accessible in proxy.
 * This proxy handles basic route patterns and redirects.
 */

/** Cookie name set by api.service.ts interceptor when backend returns 503 MAINTENANCE_MODE */
const MAINTENANCE_COOKIE = 'maintenance_active';

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
            return NextResponse.redirect(new URL('/maintenance', request.url));
        }
    }

    // Check if the route is public
    const isPublicRoute = publicRoutes.includes(pathname) ||
                         publicPrefixes.some(prefix => pathname.startsWith(prefix));

    // Allow public routes
    if (isPublicRoute) {
        return NextResponse.next();
    }

    // For all other routes, allow through and let client-side handle auth
    // The layout components will redirect to login if not authenticated
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
