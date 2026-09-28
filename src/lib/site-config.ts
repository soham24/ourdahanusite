/**
 * Everything that makes this deployment OurDahanu rather than the same code
 * serving another town.
 *
 * The point of this file is that forking should be an edit, not a hunt. The
 * name used to be written out across 159 files; someone standing this up for
 * Pune or Mumbai changes the values here and the interface follows.
 *
 * ## What belongs here
 *
 * Names, places and addresses — the things that differ for every town running
 * this code, and that appear somewhere in the interface.
 *
 * ## What does not
 *
 * Local *content*: the guides, the emergency phone numbers, the business
 * categories, the Chikoo Catcher game (a chikoo is Dahanu's fruit, and the
 * game is themed on it). No config turns those into Pune, and pretending
 * otherwise would leave a fork quietly publishing another town's facts as its
 * own. They are yours to write — SETUP.md lists the files to visit.
 *
 * Also not here: the `--od-` CSS custom properties and the `dahanu-loader`
 * class names. They are a namespace prefix no reader ever sees, and renaming
 * them would have meant 855 lines of diff for nobody's benefit.
 *
 * ## Why a file rather than environment variables
 *
 * These values are the same in every environment a given town runs — local,
 * preview and production are all still the same town. Keeping them in typed
 * code makes a mistake a build error rather than a blank space on a live
 * page. Only the *current origin* comes from the environment, because that
 * genuinely does differ between localhost, a preview deployment and
 * production.
 */

export const siteConfig = {
  /**
   * The brand, as written in the interface: page titles, the navbar, email
   * signatures, structured data. Capitalised the way you want it seen.
   */
  name: 'OurDahanu',

  /**
   * The town, on its own. Used wherever the interface talks about the place
   * rather than the product — "businesses in Dahanu", "Local Jobs in Dahanu".
   */
  town: 'Dahanu',

  /**
   * The town in its own script, shown under the logo on the loading screen.
   *
   * An empty string shows nothing there rather than leaving a gap. A non-Latin
   * script also needs a font that has the glyphs — see the Devanagari subset
   * loaded in src/app/layout.tsx.
   */
  townLocal: 'आपले डहाणू',

  /**
   * The production domain, with no protocol: `ourdahanu.in`.
   *
   * This is deliberately *not* the current deployment's host. Canonical URLs,
   * share links and the per-business subdomains are all built from it, so a
   * preview deployment still hands out links that point at production rather
   * than at a preview URL that will stop resolving next week. The current
   * origin is SITE_URL, below.
   */
  domain: 'ourdahanu.in',

  /**
   * The surrounding places this covers, as a reader would list them.
   *
   * A lot of the copy says "Dahanu, Bordi, Gholvad and Palghar" rather than
   * just "Dahanu", because the site serves the villages around the town too.
   * Substituting only the town name into those sentences would have produced
   * "Pune, Bordi, Gholvad and Palghar" for a fork, so the whole phrase lives
   * here instead.
   */
  areas: 'Dahanu, Bordi, Gholvad and Palghar',

  /**
   * Where the town is, for structured data and for search engines deciding
   * which region a result belongs to. Written as a person would say it,
   * narrowest first.
   */
  region: 'Palghar, Maharashtra, India',

  /**
   * Shown on the contact, privacy and terms pages, and wherever the site asks
   * people to get in touch. It is published, so expect it to be scraped.
   */
  contactEmail: 'railkarsoham@gmail.com',

  /**
   * One sentence, used as the default meta description and as the fallback
   * description in structured data. Keep it under about 160 characters or
   * search engines will truncate it.
   */
  tagline:
    'OurDahanu is the local platform for Dahanu businesses, services, restaurants, hotels, jobs, and community updates.',
} as const

/**
 * This deployment's own origin, with no trailing slash.
 *
 * `NEXT_PUBLIC_SITE_URL` overrides it, which is what makes local development
 * and preview deployments resolve their own links to themselves instead of to
 * production.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || `https://${siteConfig.domain}`
).replace(/\/$/, '')

/**
 * The production domain — the same value as `siteConfig.domain`, kept as a
 * named export because that is how the rest of the codebase already refers to
 * it.
 */
export const ROOT_DOMAIN = siteConfig.domain

/**
 * `path` resolved against this deployment's origin.
 *
 * Everything that must be absolute — canonical URLs, structured data, links
 * inside emails and Telegram messages — goes through here, so a preview
 * deployment never emails anyone a link to production.
 */
export function buildAbsoluteUrl(path = '/'): string {
  return new URL(path, SITE_URL).toString()
}
