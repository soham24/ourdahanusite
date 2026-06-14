import { NextResponse } from 'next/server'

/**
 * CORS for the public `/api/v1` namespace. Auth is via `Authorization: Bearer`
 * (no cookies), so a wildcard origin is safe — there are no credentialed
 * cross-site requests to protect. Native apps ignore CORS entirely; this is for
 * Expo web and browser-based testing.
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}

/** Preflight handler — export as `OPTIONS` from any /api/v1 route. */
export function handleOptions() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
