import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    publicFast: {
      stale: 300,
      revalidate: 600,
      expire: 3600,
    },
    emergencyShort: {
      stale: 30,
      revalidate: 60,
      expire: 300,
    },
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
