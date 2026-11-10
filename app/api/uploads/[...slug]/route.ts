import { NextRequest, NextResponse } from "next/server";

// next/image's built-in optimizer resolves a relative `src` (e.g.
// /api/uploads/course-covers/xxx.jpg) by dispatching an in-process request
// through Next's own router — it never goes through nginx, so it can't reach
// this path, which nginx normally routes straight to the separate Go backend
// container. Without a real route here, every avatar/course-cover
// /_next/image request 400s ('"url" parameter is valid but internal response
// is invalid'), even though the file exists and loads fine directly through
// nginx. This route handler gives Next's own router something to resolve to.
//
// Real browser requests never reach this file: nginx's `location /api/`
// proxies straight to the backend before Next.js ever sees the request. This
// only serves the optimizer's internal lookup (and `next dev` without nginx).
//
// Uses INTERNAL_API_BASE_URL the same way app/api/display/[...slug]/route.ts
// does, read at request time (not next.config.ts's build-time rewrites) so
// each blue/green container talks to its own backend slot correctly.
function normalizeBackendOrigin(rawBase: string): string {
    return rawBase.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
}

const BACKEND_ORIGIN = normalizeBackendOrigin(
    process.env.INTERNAL_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000/api",
);

export async function GET(
    request: NextRequest,
    ctx: { params: Promise<{ slug: string[] }> },
) {
    const { slug } = await ctx.params;
    const path = slug.join("/");
    if (slug.some((part) => part === "." || part === ".." || /[\\/?#%]/.test(part))) {
        return NextResponse.json({ success: false }, { status: 400 });
    }
    const targetUrl = `${BACKEND_ORIGIN}/api/uploads/${path}`;

    const range = request.headers.get("range");
    const privateEvidence = slug[0] === "score-edit-requests" || slug[0] === "private";
    const upstreamHeaders = new Headers();
    if (range) upstreamHeaders.set("Range", range);
    if (privateEvidence) {
        for (const name of ["cookie", "authorization", "x-client-type"]) {
            const value = request.headers.get(name);
            if (value) upstreamHeaders.set(name, value);
        }
    }
    let upstream: Response;
    try {
        upstream = await fetch(targetUrl, {
            headers: upstreamHeaders,
            cache: "no-store",
            signal: AbortSignal.timeout(15_000),
        });
    } catch (err) {
        console.error("[uploads proxy] upstream fetch failed:", err);
        return NextResponse.json({ success: false, error: "Backend unreachable" }, { status: 502 });
    }

    if (!upstream.ok && upstream.status !== 206) {
        return new NextResponse(null, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
    }

    const headers: Record<string, string> = {
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": privateEvidence ? "private, no-store" : (upstream.headers.get("cache-control") ?? "public, max-age=31536000, immutable"),
    };
    const etag = upstream.headers.get("etag");
    if (etag) headers["ETag"] = etag;

    return new NextResponse(upstream.body, { status: upstream.status, headers });
}
