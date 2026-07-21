/**
 * Truncates text to at most maxLen characters, breaking at the last whole
 * word rather than mid-word, then appends an ellipsis. A hard character
 * slice (e.g. `.slice(0, 160)`) can cut a meta description off mid-word,
 * which renders as a broken-looking fragment in search results.
 */
export function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const cut = text.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
