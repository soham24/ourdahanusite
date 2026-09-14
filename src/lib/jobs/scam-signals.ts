import type { JobPostFields } from './validation'

export type ReviewFlag = 'scam_words' | 'link_or_phone' | 'reports'

// Phrases that turn a job post into a request for money, in English, Marathi
// and Hindi. Matched as whole words, so "advanced" and "coffee" never match.
// A false alarm costs one review; a missed scam costs a victim — which is why
// "No registration fee" deliberately flags too.
const SCAM_TERMS = [
  'registration fee',
  'registration fees',
  'registration charge',
  'registration charges',
  'security deposit',
  'processing fee',
  'processing fees',
  'joining fee',
  'joining fees',
  'training fee',
  'training fees',
  'advance payment',
  'advance',
  'नोंदणी शुल्क',
  'शुल्क',
  'फीस',
  'फी',
  'डिपॉझिट',
  'डिपॉजिट',
  'अनामत',
]

// Letters, combining marks (Devanagari vowel signs) and digits count as part
// of a word, so a term only matches when nothing word-like touches either end.
const WORD_CHAR = '[\\p{L}\\p{M}\\p{N}]'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const SCAM_PATTERN = new RegExp(
  `(?<!${WORD_CHAR})(?:${[...SCAM_TERMS]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')})(?!${WORD_CHAR})`,
  'iu',
)

// Links, including bare domains ("details on jobs-now.in") and the short-link
// hosts scams favour. Requiring two characters before a bare domain's dot keeps
// qualifications like "B.Com" and "M.Com" from matching.
const LINK_PATTERN =
  /(?:https?:\/\/|www\.)\S+|\b(?:t\.me|wa\.me|bit\.ly)\/\S*|\b[a-z0-9-]{2,}\.(?:com|in|net|org|co|me|ly|io|link|app|xyz|info)\b/i

// A mobile number typed into free text would bypass the login-gated contact.
const PHONE_PATTERN = /(?<!\d)(?:\+?91[\s-]?)?0?[6-9](?:[\s-]?\d){9}(?!\d)/

export function detectReviewFlags(texts: ReadonlyArray<string | null | undefined>): ReviewFlag[] {
  const text = texts
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.replace(/\s+/g, ' '))
    .join(' | ')

  const flags: ReviewFlag[] = []
  if (SCAM_PATTERN.test(text)) flags.push('scam_words')
  if (LINK_PATTERN.test(text) || PHONE_PATTERN.test(text)) flags.push('link_or_phone')
  return flags
}

/** Flags for every free-text field of a post. */
export function detectPostFlags(
  fields: Pick<JobPostFields, 'title' | 'employer_name' | 'display_name' | 'area' | 'timings' | 'description'>,
): ReviewFlag[] {
  return detectReviewFlags([
    fields.title,
    fields.employer_name,
    fields.display_name,
    fields.area,
    fields.timings,
    fields.description,
  ])
}
