import type { NextConfig } from "next";

// Baseline security headers applied to every route. A strict Content-Security-Policy
// is intentionally omitted for now — it needs per-domain testing against Razorpay,
// Supabase, Google OAuth and Vercel Analytics before it can be enabled safely.
const securityHeaders = [
  // Force HTTPS for 2 years, including subdomains (all *.ourdahanu.in are HTTPS).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Disallow the site being framed by other origins (clickjacking protection).
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Stop browsers MIME-sniffing responses away from the declared content-type.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Send only the origin on cross-origin navigation; full URL same-origin.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Lock down powerful APIs we don't use.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
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
