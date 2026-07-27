import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.199.10.10"],
  poweredByHeader: false,
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
  async redirects() {
    return [
      // Serve the illustrated LabTAS handbook — /docs/handbook is prettier,
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
