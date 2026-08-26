import type { NextConfig } from "next";

// Where /_next/static/* is served from. Empty (the default) keeps assets on
// the same origin as the page, i.e. behaviour before this existed.
//
// Set it to a Cloudflare-fronted origin to keep static assets off the KKU
// reverse proxy, whose per-URL rate limiter is what breaks the app: once a
// bucket saturates, that chunk 429s for everyone, Next.js retries it in a
// loop, and every component behind it dies while the page still looks fine
// (see deploy-vm-https/scripts/asset-watchdog.sh, which only papers over it
// by rotating ?dpl= on redeploy). Assets served from Cloudflare's edge never
// reach that limiter at all.
//
// Baked in at build time, so changing it requires a rebuild, not a restart.
const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX?.trim() || undefined;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.199.10.10"],
  poweredByHeader: false,
  assetPrefix,
  // React emits font/script preload hints as a "Link" response header, capped
  // at 6000 bytes by default. The university reverse proxy in front of
  // cocolabs.computing.kku.ac.th buffers the whole response header block and
  // answers 502 once it overflows, which took the site down on 2026-08-24.
  //
  // That buffer was 4k then and the cap here was 1000 to survive it. KKU
  // raised it afterwards; measured 2026-08-24 by growing a redirect Location
  // until it broke: 8793 bytes still passes, 9393 returns the 502
  // maintenance page. Re-measure the same way before raising this again.
  //
  // Budget against the 8793 that is known-good: non-Link headers are ~1829
  // bytes, and the uncapped Link header was 3807 (all 18 fonts). 4000 fits
  // every one of them and still leaves ~3KB of headroom — where the default
  // 6000 would leave under 1KB, and overflowing means a site-wide outage,
  // not a degraded page.
  reactMaxHeadersLength: 4000,
  output: "standalone",
  experimental: {
    useCache: true,
  },
  images: {
    // Uploaded avatars/course-covers are served same-origin under
    // /api/uploads/*, so no remotePatterns needed — only external domains
    // require those. AVIF/WebP + responsive srcset via the Next.js image
    // optimizer (requires the `sharp` package, installed as a dependency,
    // to actually run under `next start`/standalone self-hosting).
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  compiler: {
    removeConsole: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), geolocation=(self), microphone=(), browsing-topics=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
  async rewrites() {
    // Dev-only: mirrors the production nginx proxy (frontend + /api same
    // origin) so window.location.origin-based URLs (OAuth buttons, cookie
    // scoping) behave the same when running `next dev` against a bare
    // `go run ./cmd/api` on :8000 with no reverse proxy in front of it.
    // No-op in production builds (output: "standalone" doesn't run this).
    //
    // NOTE: rewrites() is evaluated once at `next build` time and frozen into
    // routes-manifest.json — it can't read a container's runtime env vars.
    // That's fine here since it's dev-only, but it's why the /api/uploads/*
    // route next/image's optimizer needs is a real Route Handler
    // (app/api/uploads/[...slug]/route.ts) instead of a rewrite: that code
    // runs per-request, so it picks up each blue/green container's own
    // INTERNAL_API_BASE_URL correctly.
    if (process.env.NODE_ENV !== "development") {
      return [];
    }
    const localApiOrigin = process.env.LOCAL_DEV_API_ORIGIN || "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${localApiOrigin}/api/:path*` }];
  },
  async redirects() {
    return [
      // Serve the illustrated COCO LABS handbook — /docs/handbook is prettier,
      // but the static HTML uses relative asset paths so we redirect to the
      // real index.html URL so `assets/*` and `ch*.html` resolve correctly.
      { source: "/docs/handbook", destination: "/docs/handbook/index.html", permanent: false },
      { source: "/docs/handbook/", destination: "/docs/handbook/index.html", permanent: false },
      // Legacy path from the initial deploy — keep working for any cached link.
      { source: "/manual", destination: "/docs/handbook/index.html", permanent: false },
      { source: "/manual/:path*", destination: "/docs/handbook/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
