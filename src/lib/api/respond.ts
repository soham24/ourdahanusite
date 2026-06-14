import { NextResponse } from 'next/server'

import { CORS_HEADERS } from './cors'

/** JSON success response with CORS headers attached. */
export function apiJson<T>(data: T, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: { ...CORS_HEADERS, ...(init?.headers ?? {}) },
  })
}

/** JSON error response with CORS headers attached. */
export function apiError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: message, ...(extra ?? {}) },
    { status, headers: CORS_HEADERS },
  )
}
