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
  // cocolabs.computing.kku.ac.th buffers response headers at nginx's 4k
  // default and answers 502 once the whole block exceeds it — which is what
  // took the site down on 2026-08-24 (Link alone had grown to 3807 bytes).
  // Our non-Link headers run ~1515 bytes, so cap Link at 1000 to stay well
  // under 4k while keeping preloads for the highest-priority fonts.
  reactMaxHeadersLength: 1000,
  output: "standalone",
  experimental: {
    useCache: true,
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
