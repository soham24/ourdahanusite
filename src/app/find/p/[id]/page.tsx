import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Star, MapPin, Phone, MessageCircle, ArrowLeft } from 'lucide-react'
import { getProfessionalById, getApprovedRatings } from '@/lib/data/find'
import type { ProfessionalWithStats } from '@/lib/find/types'
import { createClient } from '@/lib/supabase/server'
import RatingForm from './RatingForm'

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const rounded = Math.round(value)
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size}
          className={n <= rounded ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
      ))}
    </span>
  )
}

function professionLabel(p: ProfessionalWithStats) {
  return p.profession === 'Other' && p.profession_other ? p.profession_other : p.profession
}

export default async function ProfessionalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const pro = await getProfessionalById(id)
  if (!pro) notFound()
  const ratings = await getApprovedRatings(id)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let alreadyRated = false
  if (user) {
    const { data: mine } = await supabase
      .from('find_ratings')
      .select('id')
      .eq('professional_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    alreadyRated = !!mine
  }

  return (
    <div>
      <Link href="/find" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} /> Back to directory
      </Link>

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{pro.name}</h1>
            <p className="text-[var(--od-brand,#c0582e)] font-medium">{professionLabel(pro)}</p>
          </div>
          <div className="text-right">
            <Stars value={pro.avg_rating} />
            <p className="mt-1 text-xs text-gray-500">
              {pro.rating_count > 0 ? `${pro.avg_rating.toFixed(1)} from ${pro.rating_count} rating${pro.rating_count > 1 ? 's' : ''}` : 'No ratings yet'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700">
          <a href={`tel:${pro.phone}`} className="flex items-center gap-1 hover:underline">
            <Phone size={14} /> {pro.phone}
          </a>
          {pro.whatsapp && (
            <a href={`https://wa.me/${pro.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-green-600 hover:underline">
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          {pro.locality && <span className="flex items-center gap-1"><MapPin size={14} /> {pro.locality}</span>}
        </div>
        {pro.note && <p className="mt-3 text-sm text-gray-600">{pro.note}</p>}
      </div>

      <div className="mt-6">
        {user ? (
          <RatingForm professionalId={pro.id} alreadyRated={alreadyRated} />
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center text-sm">
            <p className="mb-2 text-gray-700">Log in to rate this professional.</p>
            <Link href="/login" className="rounded-md bg-[var(--od-brand,#c0582e)] px-4 py-2 font-semibold text-white">Log in</Link>
          </div>
        )}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Ratings</h2>
        {ratings.length === 0 ? (
          <p className="text-sm text-gray-500">No approved ratings yet. Be the first to rate.</p>
        ) : (
          <ul className="space-y-3">
            {ratings.map((r) => (
              <li key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <Stars value={r.rating} size={13} />
                <p className="mt-2 text-sm text-gray-700">{r.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
