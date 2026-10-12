import type { NextConfig } from "next";

import { ROOT_DOMAIN } from "./src/lib/site-config";
import { RESERVED_SUBDOMAINS } from "./src/lib/subdomain";

// A business subdomain (`organic.ourdahanu.in`), not www/jobs/find/... .
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BUSINESS_HOST = `(?!(?:${[...RESERVED_SUBDOMAINS].map(escapeRegex).join("|")})\\.)[^.]+\\.${escapeRegex(ROOT_DOMAIN)}`;

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
      {
        // A business subdomain is the business page (`/`) and its catalog
        // (`/p/…`, `/s/…`), but the whole main site answers there too:
        // `organic.ourdahanu.in/emergency` is the emergency page. Those copies
        // stay reachable -- sign-in and checkout start from them -- but are
        // kept out of search, which had them as duplicates on every subdomain.
        source: '/:path((?!p/|s/|robots\\.txt$).+)',
        has: [{ type: 'host', value: BUSINESS_HOST }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }],
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
