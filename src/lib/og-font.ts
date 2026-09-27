/**
 * DM Sans subsets for the OpenGraph cards built with next/og.
 *
 * Two separate hazards, both learned from production:
 *
 * 1. Glyph drift. Google Fonts' css2 endpoint subsets by `text`, so any
 *    character a card renders but the request forgot is simply absent from
 *    the font that comes back. next/og then fetches a fallback font at
 *    render time just for those characters. On 2026-09-22 that fetch got a
 *    502 and logged `Failed to load dynamic font for ,W&` on
 *    /play/opengraph-image — a comma, a `W` and an `&`, from "Catch, dodge,
 *    climb" and "Weekly & all-time", none of which appeared in the
 *    hand-written subset string a few lines above them. next/og catches
 *    that failure, so the card still rendered; the cost is an extra network
 *    round trip on every single render, and a different typeface for those
 *    glyphs whenever the round trip fails.
 *
 *    Asking for the whole printable-ASCII range instead costs a few KB and
 *    retires the entire class of bug: no caller has to keep a subset string
 *    in step with its own JSX, and adding a word to a card can no longer
 *    silently change how it renders.
 *
 * 2. A font fetch that throws. next/og catches its *own* fallback fetch,
 *    but not ours — a throw in here escapes the route handler and the card
 *    becomes a 500, which scrapers show as no preview card at all. So
 *    failure resolves to an empty list and the caller omits `fonts`
 *    entirely, leaving ImageResponse on its bundled font: layout, colours
 *    and copy all survive, only the typeface falls back. That is what
 *    jobs/j/[id]/opengraph-image.tsx does by design already.
 *
 * Latin only, deliberately. DM Sans's hosted Latin subset carries no
 * Devanagari and neither does next/og's bundled font, so a Devanagari name
 * still takes next/og's own fallback path — this module cannot help there,
 * and pretending otherwise would just mean requesting glyphs that don't
 * come back.
 */

export type OgFont = {
  name: 'DM Sans'
  data: ArrayBuffer
  weight: 400 | 700
  style: 'normal'
}

/** Space (32) through tilde (126) — every ASCII character a card can render. */
const PRINTABLE_ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')

/**
 * The `text` to subset by: printable ASCII, plus any character from
 * `extraText` that isn't already covered.
 *
 * Exported for its own test. Deduplicating matters because `extraText` is a
 * business or professional name straight from the database — repeating its
 * characters would only lengthen the URL, and the css2 endpoint has a
 * request-length limit that a long name plus a full ASCII range can
 * approach.
 */
export function subsetText(extraText = ''): string {
  const seen = new Set(PRINTABLE_ASCII)
  let extra = ''
  for (const char of extraText) {
    if (seen.has(char)) continue
    seen.add(char)
    extra += char
  }
  return PRINTABLE_ASCII + extra
}

/**
 * Bounded because the cache key includes the caller's text, and that text is
 * a name out of the database: a crawler walking every FindDahanu profile
 * would otherwise mint a fresh ~19 KB entry per weight per distinct name and
 * keep all of them for the life of the instance, while almost never reading
 * one back. ASCII-only names all share the one key (subsetText leaves them
 * identical), so in practice this holds that common entry plus a handful of
 * accented or Devanagari ones.
 */
const MAX_CACHED_SUBSETS = 8
const cache = new Map<string, ArrayBuffer>()

function remember(key: string, data: ArrayBuffer): void {
  // Map iterates in insertion order, so the first key is the oldest.
  if (cache.size >= MAX_CACHED_SUBSETS) {
    const oldest = cache.keys().next()
    if (!oldest.done) cache.delete(oldest.value)
  }
  cache.set(key, data)
}

async function fetchWeight(weight: 400 | 700, text: string): Promise<ArrayBuffer> {
  const key = `${weight}:${text}`
  const cached = cache.get(key)
  if (cached) return cached

  const family = weight === 700 ? 'DM+Sans:wght@700' : 'DM+Sans:wght@400'
  const cssRes = await fetch(
    `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`,
  )
  if (!cssRes.ok) throw new Error(`font css request failed: ${cssRes.status}`)

  const match = (await cssRes.text()).match(/src: url\(([^)]+)\)/)
  if (!match) throw new Error('font css had no src url')

  const fontRes = await fetch(match[1])
  if (!fontRes.ok) throw new Error(`font file request failed: ${fontRes.status}`)

  const data = await fontRes.arrayBuffer()
  // Only successes are cached: a transient failure should be retried by the
  // next render, not remembered for the life of the instance.
  remember(key, data)
  return data
}

/**
 * Both DM Sans weights for one card, or an empty list if either could not be
 * loaded.
 *
 * All-or-nothing on purpose: one real weight beside one bundled-font weight
 * looks like a rendering fault, where a card set entirely in the fallback
 * face just looks plainer.
 */
export async function loadDmSansPair(extraText = ''): Promise<OgFont[]> {
  const text = subsetText(extraText)
  try {
    const [bold, regular] = await Promise.all([fetchWeight(700, text), fetchWeight(400, text)])
    return [
      { name: 'DM Sans', data: bold, weight: 700, style: 'normal' },
      { name: 'DM Sans', data: regular, weight: 400, style: 'normal' },
    ]
  } catch (err) {
    console.error('[og-font] falling back to the bundled font:', err)
    return []
  }
}
