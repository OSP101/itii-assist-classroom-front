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
  async rewrites() {
    return [
      { source: "/manual", destination: "/manual/index.html" },
      { source: "/manual/", destination: "/manual/index.html" },
    ];
  },
};

export default nextConfig;
