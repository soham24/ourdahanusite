import { GOOGLE_EMPLOYMENT_TYPE, isValidWorkType, type PayPeriod } from './options'

const UNIT_TEXT: Record<PayPeriod, string> = { month: 'MONTH', day: 'DAY', hour: 'HOUR' }

/** Everything the markup may use. Deliberately has no contact fields. */
export interface JobPostingSource {
  id: string
  title: string
  description: string | null
  category: string
  work_types: string[]
  area: string
  employer_name: string
  pay_min: number | null
  pay_max: number | null
  pay_period: PayPeriod | null
  published_at: string
  expires_at: string
}

/** schema.org JobPosting for Google for Jobs. Hiring posts only. */
export function buildJobPostingLd(post: JobPostingSource, url: string): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: post.title,
    description: post.description?.trim() || `${post.title} — ${post.category} job in ${post.area}, Dahanu.`,
    datePosted: post.published_at,
    validThrough: post.expires_at,
    employmentType: post.work_types.filter(isValidWorkType).map((type) => GOOGLE_EMPLOYMENT_TYPE[type]),
    hiringOrganization: { '@type': 'Organization', name: post.employer_name },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: post.area,
        addressRegion: 'Maharashtra',
        addressCountry: 'IN',
      },
    },
    url,
    identifier: { '@type': 'PropertyValue', name: 'OurDahanu Jobs', value: post.id },
  }

  // Pay goes to Google only as an exact amount or a full range. A lone minimum
  // or maximum ("From ₹500 / day") is not a shape Google documents, so it is
  // left out of the markup; the page itself still shows it.
  if (post.pay_period !== null && post.pay_min !== null && post.pay_max !== null) {
    ld.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'INR',
      value:
        post.pay_min === post.pay_max
          ? { '@type': 'QuantitativeValue', value: post.pay_min, unitText: UNIT_TEXT[post.pay_period] }
          : {
              '@type': 'QuantitativeValue',
              minValue: post.pay_min,
              maxValue: post.pay_max,
              unitText: UNIT_TEXT[post.pay_period],
            },
    }
  }

  return ld
}
