/**
 * Whether a clamped block of text is actually hiding anything.
 *
 * `line-clamp` cuts the text visually but says nothing about whether it had
 * to, so a "More" button rendered unconditionally would appear on a one-line
 * description and do nothing when pressed. Comparing the full height against
 * the visible height is how the DOM answers that.
 *
 * The tolerance matters more than it looks. Browsers compute these from
 * fractional line heights and round differently, so an unclamped paragraph
 * routinely reports a scrollHeight one pixel over its clientHeight. Without
 * the slack, roughly every description grows a "More" button that expands to
 * reveal the same text.
 */
export function isTextClamped(scrollHeight: number, clientHeight: number): boolean {
  if (!Number.isFinite(scrollHeight) || !Number.isFinite(clientHeight)) return false
  return scrollHeight - clientHeight > 2
}

/**
 * Soften the line breaks an owner's description arrived with.
 *
 * Descriptions are typed or pasted at whatever width the owner's editor
 * happened to be, and `whitespace-pre-line` then reproduces those breaks
 * faithfully at every other width. On a phone that leaves orphan words
 * stranded on their own lines mid-sentence — which is what the ragged
 * rendering complaints are actually about.
 *
 * In this catalogue 46 of the 76 descriptions contain a newline and only 2
 * contain a blank line, so the breaks are overwhelmingly soft wraps rather
 * than structure. The rule follows that:
 *
 *   - a blank line is a paragraph break and is kept
 *   - a single newline is a soft wrap and becomes a space
 *   - unless the next line opens a list item, where the break is the meaning
 *
 * Display only: the stored text is never modified, so an owner editing a
 * description still sees exactly what they wrote.
 */
const LIST_ITEM = /^\s*([-*•·]|\d+[.)])\s*\S/u

/**
 * A line that opens with a short label and a colon -- "Family Floater Plans:
 * One policy covers the entire family".
 *
 * Three descriptions in this catalogue are written as one labelled entry per
 * line with no bullet characters at all, and joining those into a paragraph
 * reads far worse than the ragged wrapping this function exists to fix. The
 * label is capped at 40 characters so an ordinary sentence that happens to
 * contain a colon further along does not qualify.
 */
// Not `[A-Z]`: Devanagari has no case, and this is a catalogue for a town
// where a description may well be written in it. The anchor is instead "does
// not open with a lowercase Latin letter", because that is what a wrapped
// English sentence continuing onto the next line looks like.
const LABELLED_LINE = /^\s*[^\p{Ll}\s][^:\n]{0,40}:\s/u

function isStructured(line: string): boolean {
  return LIST_ITEM.test(line) || LABELLED_LINE.test(line)
}

export function softenLineBreaks(text: string): string {
  if (!text) return ''

  // Normalise newline conventions first so a pasted Windows description is
  // not left with stray carriage returns.
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let out = ''

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    out += line
    if (i === lines.length - 1) break

    const next = lines[i + 1]
    const blankLineAhead = next.trim() === ''

    // What matters is whether the NEXT line starts something, not whether
    // this one did. A break before a list item or a labelled entry separates
    // two entries and is kept; a break after one is just where the entry ran
    // out of room, so a wrapped "Delivery: free on orders / above Rs 500."
    // joins back up rather than stranding its own tail.
    if (blankLineAhead || isStructured(next) || line.trim() === '') {
      out += '\n'
    } else {
      out += ' '
    }
  }

  // Joining can leave doubled spaces where a line ended in one.
  return out.replace(/[^\S\n]{2,}/g, ' ')
}

/**
 * A description trimmed to fit a social preview.
 *
 * og:description and twitter:description are read by WhatsApp, Facebook and
 * X, all of which cut what they are given and none of which cut it politely.
 * Raising the editor's limit to 1500 characters made that reachable, so the
 * trim happens here, at a word boundary, with an ellipsis that says the text
 * continues.
 *
 * 200 is comfortably inside every major platform's display budget; going
 * longer only means the platform does the cutting instead, mid-word.
 */
export function metaDescription(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  // Count by code point throughout, so an emoji is one character to both the
  // budget check and the slice. Comparing flat.length (UTF-16 units) against
  // a code-point slice would let emoji-heavy text out at twice the budget.
  const points = Array.from(flat)
  if (points.length <= max) return flat

  // Slice by code point: cutting mid-surrogate leaves half an emoji, which
  // renders as a replacement glyph in a link preview.
  const cut = points.slice(0, max).join('')
  const lastSpace = cut.lastIndexOf(' ')
  // Prefer the word boundary. Falling back to a hard cut only matters when a
  // single word would swallow most of the budget -- the point of this is to
  // avoid ending mid-word, so giving up a few characters to do that is the
  // trade worth making, not the one to avoid.
  const body = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut
  return `${body.replace(/[\s.,;:—-]+$/, '')}…`
}

/**
 * A cheap guess, before any measurement, at whether a three-line clamp will
 * bite.
 *
 * The toggle can only be decided for real in the browser, but deciding it
 * only there means it appears after hydration and shoves every card below it
 * down the page. Seeding the first render from the text length gets the
 * common case right, and the measurement that follows corrects the rest.
 *
 * Roughly 42 characters fit a line in a catalog card at phone width, so three
 * lines is about 125. The threshold sits a little above that: guessing "no
 * toggle" and adding one is a smaller, later shift than guessing "toggle" and
 * taking it away.
 */
export function likelyClamped(text: string, perLine = 42, lines = 3): boolean {
  return softenLineBreaks(text).length > perLine * lines
}
