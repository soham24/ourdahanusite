'use server'

import { createAdminClient } from '@/lib/supabase/admin-client'
import { classifyRazorpayKeyId } from '@/lib/selling/keys'
import { createClient } from '@/lib/supabase/server'

export interface Order {
  id: string
  listing_id: string | null
  product_id: string | null
  buyer_id: string | null
  buyer_name: string
  buyer_phone: string
  delivery_address: string | null
  notes: string | null
  service_name: string
  option_label: string | null
  service_price: number
  quantity: number
  amount_total: number
  owner_razorpay_order_id: string | null
  owner_razorpay_payment_id: string | null
  owner_razorpay_signature: string | null
  payment_status: string
  status: string
  /** Paid with Razorpay test keys: a practice purchase, no real money. */
  is_test: boolean
  created_at: string
  updated_at: string
  listing?: { name: string; subdomain: string | null } | null
}

async function getListingOrdersForOwner(listingId: string, ownerId: string): Promise<Order[]> {
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listingId)
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (!listing) return []

  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })

  return (data ?? []) as Order[]
}

export async function getMyListingOrders(): Promise<{
  orders: Order[]
  listingId: string | null
  /** Live keys connected: practice orders are old news, so hide them by default. */
  hideTestByDefault: boolean
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { orders: [], listingId: null, hideTestByDefault: false }

  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!listing) return { orders: [], listingId: null, hideTestByDefault: false }

  const [orders, { data: configData }] = await Promise.all([
    getListingOrdersForOwner(listing.id, user.id),
    supabase
      .from('listing_payment_configs')
      .select('razorpay_key_id, verified_at')
      .eq('listing_id', listing.id)
      .maybeSingle(),
  ])
  const config = (configData ?? null) as { razorpay_key_id: string; verified_at: string | null } | null
  const hideTestByDefault =
    Boolean(config?.verified_at) && classifyRazorpayKeyId(config?.razorpay_key_id) === 'live'

  return { orders, listingId: listing.id, hideTestByDefault }
}

export async function getAllOrders(): Promise<Order[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { getUserRole } = await import('@/app/actions/admin')
  const { role } = await getUserRole(supabase)
  if (role !== 'admin' && role !== 'moderator') return []

  const adminClient = createAdminClient()
  if (!adminClient) return []

  const { data } = await adminClient
    .from('orders')
    .select('*, listing:listing_id(name, subdomain)')
    .order('created_at', { ascending: false })

  return (data ?? []) as Order[]
}
