import { NextRequest, NextResponse } from "next/server";

// Backend URL is available both client-side (NEXT_PUBLIC_) and in route handlers.
// It must end with /api, e.g. http://10.199.10.10:8000/api
function normalizeBackendApiBase(rawBase: string): string {
    const trimmed = rawBase.replace(/\/+$/, "");
    return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}

const BACKEND_API_BASE = normalizeBackendApiBase(
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000/api",
);

async function handler(
    request: NextRequest,
    slug: string[],
): Promise<NextResponse> {
    const path = slug.join("/");
    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `${BACKEND_API_BASE}/attendance/display/${path}${searchParams ? `?${searchParams}` : ""}`;

    // Forward cookies from the browser to the backend
    const cookieHeader = request.headers.get("cookie") ?? "";

    const init: RequestInit = {
        method: request.method,
        headers: {
            "Content-Type": request.headers.get("content-type") ?? "application/json",
            Cookie: cookieHeader,
        },
    };

    if (!["GET", "HEAD"].includes(request.method)) {
        init.body = await request.text();
    }

    let upstream: Response;
    try {
        upstream = await fetch(targetUrl, init);
    } catch (err) {
        console.error("[display proxy] upstream fetch failed:", err);
        return NextResponse.json(
            { success: false, error: "Backend unreachable" },
            { status: 502 },
        );
    }

    const body = await upstream.text();
    const response = new NextResponse(body, {
        status: upstream.status,
        headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        },
    });

    // Relay Set-Cookie headers so the browser stores them on the frontend origin,
    // which fixes the SameSite=Lax cross-origin cookie blocking issue.
    // Use getSetCookie() (Node 18.14+) which returns each Set-Cookie header as a
    // separate entry. headers.forEach() on older runtimes merges multiple Set-Cookie
    // values into one string with ", " which corrupts both cookies.
    const setCookies: string[] =
        typeof (upstream.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
            ? (upstream.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
            : (() => {
                  const collected: string[] = [];
                  upstream.headers.forEach((value, key) => {
                      if (key.toLowerCase() === "set-cookie") collected.push(value);
                  });
                  return collected;
              })();

    for (const sc of setCookies) {
        response.headers.append("set-cookie", sc);
    }

    return response;
}

export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ slug: string[] }> },
) {
    return handler(req, (await ctx.params).slug);
}

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ slug: string[] }> },
) {
    return handler(req, (await ctx.params).slug);
}
