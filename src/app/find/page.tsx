import Link from 'next/link'
import { Suspense } from 'react'
import { Star, MapPin, Phone } from 'lucide-react'
import { getApprovedProfessionals } from '@/lib/data/find'
import type { ProfessionalWithStats } from '@/lib/find/types'
import FindSearchControls from './FindSearchControls'

function Stars({ value }: { value: number }) {
  const rounded = Math.round(value)
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14}
          className={n <= rounded ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
      ))}
    </span>
  )
}

function professionLabel(p: ProfessionalWithStats) {
  return p.profession === 'Other' && p.profession_other ? p.profession_other : p.profession
}

function Card({ p }: { p: ProfessionalWithStats }) {
  return (
    <Link href={`/find/p/${p.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-bold text-gray-950">{p.name}</h2>
          <p className="text-sm text-[var(--od-brand,#c0582e)] font-medium">{professionLabel(p)}</p>
        </div>
        <div className="text-right">
          <Stars value={p.avg_rating} />
          <p className="mt-0.5 text-xs text-gray-500">
            {p.rating_count > 0 ? `${p.avg_rating.toFixed(1)} · ${p.rating_count} rating${p.rating_count > 1 ? 's' : ''}` : 'No ratings yet'}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        {p.locality && <span className="flex items-center gap-1"><MapPin size={12} />{p.locality}</span>}
        <span className="flex items-center gap-1"><Phone size={12} />{p.phone}</span>
      </div>
      {p.note && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{p.note}</p>}
    </Link>
  )
}

async function ProfessionalList({ q, profession }: { q?: string; profession?: string }) {
  const pros = await getApprovedProfessionals({ q, profession })
  if (pros.length === 0) {
    return <p className="py-12 text-center text-gray-500">No professionals found. Try a different search, or add one.</p>
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pros.map((p) => <Card key={p.id} p={p} />)}
    </div>
  )
}

export default async function FindHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; profession?: string }>
}) {
  const { q, profession } = await searchParams
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Trusted local professionals in Dahanu</h1>
      <p className="mb-5 text-sm text-gray-600">Browse and rate — every rating is verified by a moderator.</p>
      <Suspense fallback={null}>
        <FindSearchControls />
      </Suspense>
      <Suspense fallback={<p className="py-12 text-center text-gray-500">Loading…</p>}>
        <ProfessionalList q={q} profession={profession} />
      </Suspense>
    </div>
  )
}
