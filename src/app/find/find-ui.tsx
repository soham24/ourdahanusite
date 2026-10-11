import { ShieldCheck, ExternalLink, Star } from 'lucide-react'
import type { ProfessionalWithStats, LinkedBusiness } from '@/lib/find/types'
import { professionMarathi } from '@/lib/find/professions'
import { getCanonicalListingUrl } from '@/lib/listing-url'
import { siteConfig } from '@/lib/site'

/** Marathi label rendered in the loaded Devanagari font, muted, beside the
 *  English name. Returns null so callers can `{mr(x)}` unconditionally. */
export function Mr({ text, className = '' }: { text: string | null; className?: string }) {
  if (!text) return null
  return (
    <span
      lang="mr"
      className={`font-[family-name:var(--font-devanagari)] opacity-70 ${className}`}
    >
      {text}
    </span>
  )
}

/** Resolve the display labels for a professional's categories: the English (or
 *  free-text for 'Other') plus the Marathi label when it is a known category. */
export function professionLabels(
  p: Pick<ProfessionalWithStats, 'professions' | 'profession_other'>,
): { label: string; mr: string | null }[] {
  return p.professions.map((x) =>
    x === 'Other' && p.profession_other
      ? { label: p.profession_other, mr: null }
      : { label: x, mr: professionMarathi(x) },
  )
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
      className={`flex shrink-0 select-none items-center justify-center bg-gradient-to-br from-[var(--color-cream)] to-[var(--color-sand)] font-display text-[var(--od-brand-strong)] ${cls}`}
    >
      {letter}
    </span>
  )
}

/** Business logo avatar for premium cards; falls back to the monogram. */
export function BusinessAvatar({
  business,
  name,
  size = 'md',
}: {
  business: LinkedBusiness
  name: string
  size?: 'md' | 'lg'
}) {
  const cls = size === 'lg' ? 'h-16 w-16 rounded-[20px]' : 'h-11 w-11 rounded-[14px]'
  if (!business.image_url) return <Monogram name={name} size={size} />
  return (
    <img
      src={business.image_url}
      alt=""
      aria-hidden
      className={`${cls} shrink-0 object-cover ring-1 ring-[var(--od-gold)]`}
    />
  )
}

/** "Verified by OurDahanu" pill for premium (business-linked) professionals. */
export function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--od-gold)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--od-brand-strong)]">
      <ShieldCheck size={12} className="text-[var(--od-gold)]" aria-hidden />
      Verified by {siteConfig.name}
    </span>
  )
}

/** Link out to the linked business page. */
export function VisitBusinessLink({ business, className = '' }: { business: LinkedBusiness; className?: string }) {
  return (
    <a
      href={businessHref(business)}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--od-gold)] bg-[var(--od-gold)]/10 py-2 text-sm font-bold text-[var(--od-brand-strong)] transition-colors hover:bg-[var(--od-gold)]/20 active:scale-[0.98] ${className}`}
    >
      <ExternalLink size={14} className="shrink-0" aria-hidden />
      <span className="truncate">Visit {business.name}</span>
    </a>
  )
}

/** Premium surface visuals (border + warm sheen), no layout/padding — compose
 *  with per-card layout so landing and detail can size themselves. */
export const premiumSurfaceClass =
  'relative rounded-[var(--od-radius)] border border-[var(--od-gold)] bg-gradient-to-br from-[var(--color-cream)]/50 to-white shadow-[0_10px_30px_rgba(200,136,30,0.12)]'
/** Premium card for the landing grid. */
export const premiumCardClass = `${premiumSurfaceClass} flex flex-col p-4 sm:p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(200,136,30,0.18)]`

/** Shared filter/toggle chip styling — one source so the category rail and
 *  the submit form's profession toggles can't drift apart. */
export const chipBase =
  'whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors duration-150 active:scale-[0.97]'
export const chipOn =
  'border-[var(--od-brand-strong)] bg-[var(--od-brand-strong)] text-[#FFFAF3]'
export const chipOff =
  'border-[var(--od-border)] bg-white/70 text-[var(--od-ink-2)] hover:border-[rgba(192,88,46,0.4)] hover:text-[var(--od-brand-strong)]'

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

/** Coarse relative time ("2 weeks ago") — deliberately no finer than hours,
 *  since rating lists are cached and may be up to a day stale. */
export function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 24) return 'today'
  const days = Math.floor(hours / 24)
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return weeks === 1 ? 'last week' : `${weeks} weeks ago`
  const months = Math.floor(days / 30)
  if (months < 12) return months <= 1 ? 'last month' : `${months} months ago`
  const years = Math.floor(days / 365)
  return years <= 1 ? 'last year' : `${years} years ago`
}

/** tel: href with only dial-safe characters. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`
}

/** Canonical URL of a linked business page (its subdomain, or the /listings
 *  fallback) — reuses the same helper the listings feature uses. */
export function businessHref(b: LinkedBusiness): string {
  return getCanonicalListingUrl(b.id, b.subdomain)
}

/** wa.me needs a country code — local Indian numbers (with or without the
 *  leading trunk zero) get 91 prefixed. */
export function waHref(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '')
  const full = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${full}`
}
