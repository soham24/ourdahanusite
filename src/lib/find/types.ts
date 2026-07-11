export type ModerationStatus = 'pending' | 'approved' | 'rejected'

export interface FindProfessional {
  id: string
  name: string
  phone: string
  whatsapp: boolean
  profession: string
  profession_other: string | null
  locality: string | null
  note: string | null
  status: ModerationStatus
  is_active: boolean
  submitted_by: string | null
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

// Public-facing professional plus computed rating aggregates.
export interface ProfessionalWithStats extends FindProfessional {
  avg_rating: number // 0 when no approved ratings
  rating_count: number
}
