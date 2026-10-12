import { headers } from 'next/headers'

import { buildStandaloneLoginHref, getStandaloneSubdomain } from '@/lib/standalone-hosts'
import { siteConfig } from '@/lib/site'

/**
 * Main-site login URL that brings the user back to a jobs page.
 *
 * `returnPath` is jobs-relative (`/post`, `/j/<id>`). On jobs.ourdahanu.in that
 * is the real path; on the main domain the same page lives under /jobs, so the
 * prefix is added there.
 */
export async function jobsLoginHref(returnPath: string): Promise<string> {
  const h = await headers()
  const rawHost = (h.get('x-forwarded-host') ?? h.get('host') ?? `jobs.${siteConfig.domain}`).split(',')[0].trim()
  const path =
    getStandaloneSubdomain(rawHost) === 'jobs' ? returnPath : `/jobs${returnPath === '/' ? '' : returnPath}`
  return buildStandaloneLoginHref(rawHost, path)
}
