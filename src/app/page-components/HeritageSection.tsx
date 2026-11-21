import { ArrowRight, MessageCircle } from 'lucide-react'

import SafeAppLink from '@/components/SafeAppLink'
import { contact, team } from '@/content/local'
import { siteConfig } from '@/lib/site'

// Warm, distinct backgrounds so six sets of initials don't read as one block.
const AVATAR_TONES = [
  'from-[#C0582E] to-[#8A3618]',
  'from-[#D9944A] to-[#A8601F]',
  'from-[#7A8F5A] to-[#4F6436]',
  'from-[#B5654A] to-[#7E3A26]',
  'from-[#C8881E] to-[#8C5A0E]',
  'from-[#6F7FA0] to-[#45526E]',
]

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')

function Avatar({ name, photo, index, size }: { name: string; photo?: string; index: number; size: 'lg' | 'sm' }) {
  const box = size === 'lg' ? 'h-16 w-16 rounded-[20px] text-xl' : 'h-11 w-11 rounded-[14px] text-sm'
  if (photo) {
    return <img src={photo} alt={name} loading="lazy" decoding="async" className={`${box} shrink-0 object-cover`} />
  }
  return (
    <span
      aria-hidden
      className={`${box} flex shrink-0 items-center justify-center bg-gradient-to-br font-semibold tracking-wide text-white ${AVATAR_TONES[index % AVATAR_TONES.length]}`}
    >
      {initials(name)}
    </span>
  )
}

/** "Who runs OurDahanu": the real people behind the site, by name. */
export default function HeritageSection() {
  const [founder, ...members] = team
  if (!founder) return null
  const whatsappHref = `https://wa.me/${contact.whatsappCountryCode}${contact.whatsapp}`

  return (
    <section className="od-mobile-section py-12 md:py-20">
      <div className="mx-auto grid max-w-[1160px] gap-10 px-4 md:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-14">
        <div>
          <p className="od-eyebrow">Who runs {siteConfig.name}</p>
          <h2 className="mt-2 text-balance font-display text-[32px] leading-[1.05] tracking-[-0.02em] text-[var(--od-ink)] md:text-[42px]">
            Run by people who <em className="italic text-[var(--od-brand)]">live here.</em>
          </h2>
          <p className="mt-4 max-w-[460px] text-pretty text-[15px] leading-relaxed text-[var(--od-muted)]">
            {siteConfig.name} began as {founder.name}&apos;s Facebook, Instagram and WhatsApp community. Today a core
            group of {team.length} keeps those groups and this directory going, so the businesses you find here are
            ones your neighbours know.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <SafeAppLink
              href="/about"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--od-ink)] px-5 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[var(--od-brand-strong)] active:scale-[0.98]"
            >
              Meet the team <ArrowRight size={15} aria-hidden />
            </SafeAppLink>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 px-1 text-sm font-semibold text-[var(--od-brand)] transition-colors hover:text-[var(--od-brand-strong)]"
            >
              <MessageCircle size={15} aria-hidden /> Message us on WhatsApp
            </a>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--od-border)] bg-[linear-gradient(160deg,#FFFDF9_0%,#FBF0E1_100%)] p-4 shadow-[0_24px_60px_-30px_rgba(110,43,19,0.35)] sm:p-6">
          <article className="flex items-start gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_0_rgba(46,18,5,0.04)] ring-1 ring-[var(--od-border)] sm:p-5">
            <Avatar name={founder.name} photo={founder.photo} index={0} size="lg" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--od-brand)]">{founder.role}</p>
              <h3 className="mt-0.5 font-display text-[24px] leading-tight text-[var(--od-ink)]">{founder.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--od-muted)]">{founder.detail}</p>
            </div>
          </article>

          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {members.map((member, i) => (
              <li
                key={member.name}
                className={`flex items-center gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-[var(--od-border)] ${
                  // An odd count leaves the last one alone; let it span the row.
                  members.length % 2 === 1 && i === members.length - 1 ? 'sm:col-span-2' : ''
                }`}
              >
                <Avatar name={member.name} photo={member.photo} index={i + 1} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--od-ink)]">{member.name}</p>
                  <p className="truncate text-xs text-[var(--od-muted)]">{member.role}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
