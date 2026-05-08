import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN/dev host to access Next.js dev resources (HMR, etc.)
  allowedDevOrigins: ["10.199.10.10"],
  // Enable Next.js Cache Components — allows `"use cache"` directive with cacheLife/cacheTag
  // See: https://nextjs.org/docs/app/api-reference/directives/use-cache
  experimental: {
    useCache: true,
  },
};

export default nextConfig;
