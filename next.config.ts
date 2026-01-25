import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents requires Suspense boundaries for dynamic data
  // Disabled until we properly implement them
};

export default nextConfig;
