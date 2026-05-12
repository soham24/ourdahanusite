import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    publicContent: {
      stale: 3600,
      revalidate: 86400,
      expire: 604800,
    },
    urgentPublic: {
      stale: 3600,
      revalidate: 86400,
      expire: 604800,
    },
    sitemap: {
      stale: 86400,
      revalidate: 604800,
      expire: 2592000,
    },
  },
  images: {
    // We pre-generate thumbnails at upload time (see ImageUpload.tsx and
    // backfill-listing-thumbs.mjs), so Vercel's Image Optimization API has
    // nothing useful to add — and on the Hobby plan it returns 402
    // OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED once monthly quota is hit,
    // which is what was breaking listing card thumbnails. Bypass it.
    unoptimized: true,
    // Kept for reference even though `unoptimized: true` makes this a no-op.
    // If we ever re-enable optimization, Supabase storage public buckets
    // need to be whitelisted.
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
