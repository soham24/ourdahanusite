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
const LIST_ITEM = /^\s*([-*•·]|\d+[.)])\s+/

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
    const listAhead = LIST_ITEM.test(next)
    const thisIsListItem = LIST_ITEM.test(line)

    // Keep the break for a paragraph gap, for a list that is starting or
    // continuing, and after an empty line. Otherwise join with a space.
    if (blankLineAhead || listAhead || thisIsListItem || line.trim() === '') {
      out += '\n'
    } else {
      out += ' '
    }
  }

  // Joining can leave doubled spaces where a line ended in one.
  return out.replace(/[^\S\n]{2,}/g, ' ')
}
