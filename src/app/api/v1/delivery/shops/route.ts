import { createClient } from '@/lib/supabase/server'
import { handleOptions } from '@/lib/api/cors'
import { apiJson } from '@/lib/api/respond'

export function OPTIONS() {
  return handleOptions()
}

/** GET /api/v1/delivery/shops — delivery-enabled, approved shops (public). */
export async function GET() {
  const supabase = await createClient()

  const { data: configs } = await supabase
    .from('listing_delivery_config')
    .select('listing_id, prep_time_min, radius_km')
    .eq('delivery_enabled', true)

  const ids = (configs ?? []).map((c) => c.listing_id)
  if (ids.length === 0) return apiJson({ shops: [] })

  const cfgById = new Map((configs ?? []).map((c) => [c.listing_id, c]))
  const { data: listings } = await supabase
    .from('listings')
    .select('id, name, category, image_url, image_thumb_url, lat, lng')
    .in('id', ids)
    .eq('approved', true)
    .order('name')

  const shops = (listings ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    category: l.category,
    image: l.image_url || l.image_thumb_url,
    prepTimeMin: cfgById.get(l.id)?.prep_time_min ?? 20,
    radiusKm: cfgById.get(l.id)?.radius_km ?? 5,
  }))
  return apiJson({ shops })
}
