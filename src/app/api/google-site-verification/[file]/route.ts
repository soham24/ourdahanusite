import { connection } from 'next/server'

/**
 * Google Search Console's HTML-file ownership check, from configuration
 * instead of a file in public/.
 *
 * A committed `public/google<token>.html` would be served by every fork too,
 * letting whoever owns the token verify the fork's domain in their own
 * Search Console. With the token in GOOGLE_SITE_VERIFICATION (the file name
 * Google gives you, without `.html`), each deployment answers only for its
 * own. next.config.ts rewrites `/google<hex>.html` here.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  await connection()
  const token = process.env.GOOGLE_SITE_VERIFICATION?.trim()
  const { file } = await params
  if (!token || file !== `${token}.html`) {
    return new Response('Not found', { status: 404 })
  }
  return new Response(`google-site-verification: ${token}.html`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
