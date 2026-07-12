import { Star } from 'lucide-react'
import type { ProfessionalWithStats } from '@/lib/find/types'

/** Resolve the display labels for a professional's categories, substituting
 *  the free-text description when 'Other' is among them. */
export function professionLabels(
  p: Pick<ProfessionalWithStats, 'professions' | 'profession_other'>,
): string[] {
  return p.professions.map((x) => (x === 'Other' && p.profession_other ? p.profession_other : x))
}

/** Warm monogram squircle — gives each person a visual anchor without photos. */
export function Monogram({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const letter = (name.trim()[0] ?? '?').toUpperCase()
  const cls =
    size === 'lg'
      ? 'h-16 w-16 rounded-[20px] text-3xl'
      : 'h-11 w-11 rounded-[14px] text-xl'
  return (
    <span
      aria-hidden
      className={`flex shrink-0 select-none items-center justify-center bg-gradient-to-br from-[#F6E3D3] to-[#EDCDB2] font-display text-[var(--od-brand-strong)] ${cls}`}
    >
      {letter}
    </span>
  )
}

/** Gold star row, matched to the site's gold token. */
export function GoldStars({ value, size = 14 }: { value: number; size?: number }) {
  const rounded = Math.round(value)
  return (
    <span className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={
            n <= rounded
              ? 'fill-[var(--od-gold)] text-[var(--od-gold)]'
              : 'fill-[var(--color-gray-200)] text-[var(--color-gray-200)]'
          }
        />
      ))}
    </span>
  )
}

/** tel: href with only dial-safe characters. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`
}

/** wa.me needs a country code — local 10-digit Indian numbers get 91 prefixed. */
export function waHref(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const full = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${full}`
}
