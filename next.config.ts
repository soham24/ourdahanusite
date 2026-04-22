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
    // Allow Next's built-in Image Optimization API to fetch from Supabase
    // Storage public buckets. `**.supabase.co` matches any project hostname.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
