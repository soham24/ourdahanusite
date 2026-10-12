export type ModerationStatus = 'pending' | 'approved' | 'rejected'

export interface FindProfessional {
  id: string
  name: string
  phone: string
  whatsapp: boolean
  professions: string[]
  profession_other: string | null
  locality: string | null
  note: string | null
  status: ModerationStatus
  is_active: boolean
  submitted_by: string | null
  business_listing_id: string | null
  created_at: string
  updated_at: string
}

export interface FindRating {
  id: string
  professional_id: string
  user_id: string
  rating: number
  comment: string
  used_service: boolean
  status: ModerationStatus
  created_at: string
  updated_at: string
}

// Minimal shape of the linked business page, resolved at read time.
export interface LinkedBusiness {
  id: string
  name: string
  subdomain: string | null
  image_url: string | null
  /** 240px upload thumbnail, for the small avatar; image_url stays for structured data. */
  image_thumb_url: string | null
}

// Public-facing professional plus computed rating aggregates and the linked
// business (null unless linked to an APPROVED listing).
export interface ProfessionalWithStats extends FindProfessional {
  avg_rating: number // 0 when no approved ratings
  rating_count: number
  business: LinkedBusiness | null
}

export interface AdminFindCounts {
  pending: number
  approved: number
  rejected: number
  inactive: number
  total: number
  pending_ratings: number
}
