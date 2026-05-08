import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable Next.js Cache Components — allows `"use cache"` directive with cacheLife/cacheTag
  // See: https://nextjs.org/docs/app/api-reference/directives/use-cache
  experimental: {
    useCache: true,
  },
};

export default nextConfig;
