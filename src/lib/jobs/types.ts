import type { PayPeriod } from './options'
import type { JobKind } from './validation'

/** A linked business, present only while its listing is approved. */
export interface JobBusiness {
  id: string
  name: string
  subdomain: string | null
}

/** A live post as the public sees it. It never carries contact details. */
export interface PublicJobPost {
  id: string
  kind: JobKind
  title: string
  category: string
  work_types: string[]
  area: string
  description: string | null
  employer_name: string | null
  openings: number | null
  pay_min: number | null
  pay_max: number | null
  pay_period: PayPeriod | null
  timings: string | null
  display_name: string | null
  experience_years: number | null
  collected_source: string | null
  published_at: string
  expires_at: string
  business: JobBusiness | null
}
