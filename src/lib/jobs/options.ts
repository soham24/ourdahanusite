import { siteConfig } from '@/lib/site'

export const WORK_TYPES = ['Full-time', 'Part-time', 'Daily wage', 'Seasonal', 'Internship'] as const

export type WorkType = (typeof WORK_TYPES)[number]

export function isValidWorkType(value: string): value is WorkType {
  return (WORK_TYPES as readonly string[]).includes(value)
}

/** schema.org `employmentType` values that Google for Jobs understands. */
export const GOOGLE_EMPLOYMENT_TYPE: Record<WorkType, string> = {
  'Full-time': 'FULL_TIME',
  'Part-time': 'PART_TIME',
  'Daily wage': 'PER_DIEM',
  Seasonal: 'TEMPORARY',
  Internship: 'INTERN',
}

export const PAY_PERIODS = ['month', 'day', 'hour'] as const

export type PayPeriod = (typeof PAY_PERIODS)[number]

export function isPayPeriod(value: string): value is PayPeriod {
  return (PAY_PERIODS as readonly string[]).includes(value)
}

/** Suggestions only — the area field accepts any text. */
export const AREA_SUGGESTIONS = [
  `${siteConfig.town} Road`,
  `${siteConfig.town} Town`,
  'Bordi',
  'Gholvad',
  'Chinchani',
  'Vangaon',
  'Kasa',
  'Talasari',
  'Boisar',
  'Tarapur',
  'Palghar',
] as const
