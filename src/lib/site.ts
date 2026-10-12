/**
 * Re-exports the deployment's identity from `site-config.ts`, which is the
 * file a fork edits.
 *
 * This module kept its name because a lot of the codebase already imports
 * `SITE_URL` and `buildAbsoluteUrl` from `@/lib/site`, and rewriting those
 * imports would have buried the interesting part of the change in churn.
 * New code can import from either; they are the same values.
 */
export { SITE_URL, ROOT_DOMAIN, ADDRESS_REGION, FIND_NAME, JURISDICTION, siteConfig, buildAbsoluteUrl } from './site-config'
