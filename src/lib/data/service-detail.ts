import 'server-only'

import { createPublicClient } from '@/lib/supabase/public'
import type { ServiceImageAspect } from '@/lib/service-image'

export interface StandaloneService {
  name: string
  price?: string
  desc?: string
  image?: string
  imageAspect?: ServiceImageAspect
  type?: 'service' | 'product'
}

export interface StandaloneServiceListing {
  id: string
  name: string
  subdomain: string | null
  whatsapp: string | null
  phone: string | null
  services: unknown
  approved: boolean
}

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    if (Array.isArray(value) || (value !== null && typeof value === 'object')) return value as T
    if (typeof value === 'string') return JSON.parse(value)
  } catch { /* empty */ }
  return fallback
}

export async function fetchListingAndService(subdomain: string, index: number) {
  'use cache'
  const supabase = createPublicClient()
  const { data: listingData } = await supabase
    .from('listings')
    .select('id, name, subdomain, whatsapp, phone, services, approved')
    .eq('subdomain', subdomain)
    .eq('approved', true)
    .maybeSingle()
  const listing = listingData as StandaloneServiceListing | null

  if (!listing) return null

  const services = parseJson<StandaloneService[]>(listing.services, [])
  const service = services[index]
  if (!service) return null

  return { listing, service }
}
