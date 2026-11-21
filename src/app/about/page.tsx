import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import {
  ArrowRight,
  AtSign,
  BriefcaseBusiness,
  Camera,
  HeartHandshake,
  MessageCircle,
  MessagesSquare,
  Radio,
  ShoppingBag,
  Sparkles,
  Store,
} from 'lucide-react'

import TeamAvatar from '@/components/TeamAvatar'
import { advisors, contact, team } from '@/content/local'
import { getHomeHeroData } from '@/lib/data/home'
import { siteConfig } from '@/lib/site'

// The team lives with the other town-specific content (src/content/local.ts),
// so the home page and this page read one list.
const [founder, ...teamMembers] = team

export const metadata: Metadata = {
  title: `About ${siteConfig.name}`,
  description:
    `The story of ${siteConfig.name}, founded by ${founder?.name} and grown with a core community group to connect ${siteConfig.town} through social pages, WhatsApp groups and a local marketplace.`,
  alternates: {
    canonical: `https://${siteConfig.domain}/about`,
  },
}

const communitySpaces = [
  {
    title: 'Food Group',
    text: 'A place for local food discovery, home cooks, recommendations and trusted suggestions.',
    icon: MessagesSquare,
  },
  {
    title: 'Local Business Group',
    text: 'A practical space where local businesses can be discovered, recommended and supported.',
    icon: Store,
  },
  {
    title: 'Buy & Sell Groups',
    text: 'Community-led groups for second-hand items, useful deals and local exchange.',
    icon: ShoppingBag,
  },
  {
    title: 'Issues Discussion Group',
    text: 'A civic conversation space for local problems, updates, ideas and coordination.',
    icon: Radio,
  },
]

const listOfNames = (names: string[]) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

const timeline = [
  {
    year: 'The beginning',
    title: `A page for ${siteConfig.town}`,
    text: `${siteConfig.name} began as a simple idea by ${founder?.name}: create a place where ${siteConfig.town} people could see, share and support what is happening locally.`,
  },
  {
    year: 'The community grows',
    title: 'From social pages to WhatsApp communities',
    text: 'The Facebook and Instagram presence expanded into WhatsApp communities where people could talk, ask, recommend, buy, sell and solve local problems together.',
  },
  {
    year: 'The core group forms',
    title: 'A team starts carrying the work',
    text: `${listOfNames(teamMembers.map((m) => m.name))} joined ${founder?.name.split(' ')[0]}, forming a core group that manages multiple spaces with care.`,
  },
  {
    year: 'Now',
    title: 'Building the marketplace layer',
    text: `${siteConfig.name} is moving to the next level: a structured marketplace and directory for ${siteConfig.town} people, businesses, services and opportunities.`,
  },
]

const nextLevelPillars = [
  { icon: BriefcaseBusiness, title: 'Local businesses', text: 'Help shops, services and creators get discovered online.' },
  { icon: ShoppingBag, title: 'Local buying', text: 'Make products and services easier to find and order.' },
  { icon: HeartHandshake, title: 'Community trust', text: 'Built around recommendations, real people and known groups.' },
  { icon: Camera, title: 'Social to platform', text: 'Carry the existing social community into a stronger digital home.' },
]

const number = (n: number) => n.toLocaleString('en-IN')

/** Real totals from the directory, beside the community's reach. */
async function AboutStats() {
  const { counts } = await getHomeHeroData()
  const stats = [
    { value: '30,000+', label: 'People reached' },
    { value: number(counts.businesses), label: 'Businesses listed' },
    { value: number(counts.reviews), label: 'Reviews written' },
    { value: number(counts.professionals), label: 'Local professionals' },
  ]
  return <StatsRow stats={stats} />
}

function StatsRow({ stats }: { stats: { value: string; label: string }[] }) {
  return (
    <div className="mx-auto grid max-w-[1080px] grid-cols-2 gap-y-6 px-5 py-8 md:grid-cols-4 md:divide-x md:divide-[#EFE5D8] md:px-6">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col items-center justify-center px-4 text-center">
          <p className="font-display text-[36px] leading-none tabular-nums text-[#2E1205] md:text-[44px]">{stat.value}</p>
          <p className="mt-2 text-xs font-medium text-[#7B6658]">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}

export default function AboutPage() {
  const whatsappHref = `https://wa.me/${contact.whatsappCountryCode}${contact.whatsapp}`
  const instagramHref = `https://instagram.com/${contact.instagram}`

  return (
    <main className="overflow-hidden bg-[#FAFAF7]">
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#2E1205] text-white">
        <div
          className="absolute right-[-22%] top-[-20%] h-[640px] w-[640px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(240,200,122,0.22), transparent 70%)' }}
        />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#1c0a02] to-transparent" />

        <div className="relative mx-auto max-w-[1080px] px-5 pb-24 pt-20 md:px-6 md:pb-32 md:pt-28">
          <div className="about-reveal max-w-[760px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-[#F0C87A]">
              <Sparkles size={13} aria-hidden />
              Built by {siteConfig.town}, for {siteConfig.town}
            </div>
            <h1 className="mt-6 text-balance font-display text-[44px] leading-[0.98] tracking-[-0.02em] md:text-[76px]">
              From a community page to a <em className="italic text-[#F0C87A]">local marketplace.</em>
            </h1>
            <p className="mt-6 max-w-[580px] text-pretty text-base leading-8 text-[#F8E9D5]/80 md:text-lg">
              Started by <strong className="font-semibold text-white">{founder?.name}</strong> as a Facebook, Instagram and
              WhatsApp community, and now the digital home for {siteConfig.town}&apos;s businesses, services and everyday
              discoveries.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="#team"
                className="inline-flex items-center gap-2 rounded-xl bg-[#F0C87A] px-5 py-3 text-sm font-semibold text-[#2E1205] shadow-[0_16px_36px_rgba(240,200,122,0.22)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Meet the team <ArrowRight size={15} aria-hidden />
              </Link>
              <Link
                href="/listings"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Explore {siteConfig.name}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats strip ──────────────────────────────────────────────────── */}
      <section className="border-y border-[#EFE5D8] bg-white">
        <Suspense
          fallback={<StatsRow stats={[{ value: '30,000+', label: 'People reached' }, { value: '–', label: 'Businesses listed' }, { value: '–', label: 'Reviews written' }, { value: '–', label: 'Local professionals' }]} />}
        >
          <AboutStats />
        </Suspense>
      </section>

      {/* ─── Founder ──────────────────────────────────────────────────────── */}
      {founder && (
        <section id="team" className="scroll-mt-20 py-20 md:py-28">
          <div className="mx-auto grid max-w-[1080px] items-center gap-10 px-5 md:grid-cols-[auto_minmax(0,1fr)] md:gap-14 md:px-6">
            <div className="about-reveal relative mx-auto md:mx-0">
              <div className="absolute -inset-3 rounded-[48px] bg-[radial-gradient(circle_at_30%_20%,rgba(240,200,122,0.45),transparent_70%)]" aria-hidden />
              <div className="relative">
                <TeamAvatar name={founder.name} photo={founder.photo} index={0} size="xl" />
              </div>
            </div>
            <div className="about-reveal text-center md:text-left">
              <p className="od-eyebrow">{founder.role}</p>
              <h2 className="mt-2 font-display text-[40px] leading-[1.02] tracking-[-0.02em] text-[#2E1205] md:text-[56px]">
                {founder.name}
              </h2>
              <p className="mx-auto mt-5 max-w-[560px] text-pretty text-base leading-8 text-[#5E4A3D] md:mx-0 md:text-lg">
                {founder.detail} What began as a page for sharing what was happening in {siteConfig.town} grew into
                WhatsApp communities, a core team, and now this directory.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 md:justify-start">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#C0582E] hover:text-[#8A3618]"
                >
                  <MessageCircle size={15} aria-hidden /> Message on WhatsApp
                </a>
                <a
                  href={instagramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#C0582E] hover:text-[#8A3618]"
                >
                  <AtSign size={15} aria-hidden /> {contact.instagram} on Instagram
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Core team ────────────────────────────────────────────────────── */}
      <section className="pb-20 md:pb-28">
        <div className="mx-auto max-w-[1080px] px-5 md:px-6">
          <div className="mb-10 max-w-2xl">
            <p className="od-eyebrow">Core group</p>
            <h2 className="mt-2 font-display text-[32px] leading-tight text-[#2E1205] md:text-[44px]">
              The people carrying the work.
            </h2>
          </div>

          {/* Six columns so any count balances: rows of three, and a last
              row of two (or one) that stretches instead of leaving a gap. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {teamMembers.map((member, index) => {
              const remainder = teamMembers.length % 3
              const inLastRow = index >= teamMembers.length - remainder
              const span = remainder === 0 || !inLastRow ? 'lg:col-span-2' : remainder === 2 ? 'lg:col-span-3' : 'lg:col-span-6'
              return (
                <article
                  key={member.name}
                  className={`about-reveal flex gap-4 rounded-2xl bg-white p-5 ring-1 ring-[#EFE5D8] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(110,43,19,0.3)] ${span}`}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <TeamAvatar name={member.name} photo={member.photo} index={index + 1} size="md" />
                  <div className="min-w-0">
                    <h3 className="font-display text-xl leading-tight text-[#2E1205]">{member.name}</h3>
                    <p className="mt-1 text-xs font-semibold text-[#C0582E]">{member.role}</p>
                    <p className="mt-2 text-sm leading-6 text-[#7B6658]">{member.detail}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── Timeline ─────────────────────────────────────────────────────── */}
      <section className="bg-[#FFFCF6] py-20 md:py-28">
        <div className="mx-auto max-w-[920px] px-5 md:px-6">
          <div className="mb-14 max-w-2xl">
            <p className="od-eyebrow">The journey</p>
            <h2 className="mt-3 font-display text-[36px] leading-tight text-[#2E1205] md:text-[50px]">
              A local story, built one conversation at a time.
            </h2>
          </div>

          <ol className="relative border-l border-[#EFE5D8] pl-7 md:pl-10">
            {timeline.map((item, index) => (
              <li
                key={item.title}
                className="about-reveal relative pb-12 last:pb-0"
                style={{ animationDelay: `${index * 110}ms` }}
              >
                <span className="absolute -left-[32px] top-1.5 flex h-3.5 w-3.5 items-center justify-center md:-left-[44px]">
                  <span className="h-3.5 w-3.5 rounded-full bg-[#C0582E] ring-4 ring-[#FFFCF6]" />
                </span>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C0582E]">{item.year}</p>
                <h3 className="mt-2 font-display text-2xl leading-tight text-[#2E1205] md:text-[28px]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#7B6658] md:text-[15px]">{item.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── Community spaces ─────────────────────────────────────────────── */}
      <section className="bg-[#FAFAF7] py-20 md:py-28">
        <div className="mx-auto max-w-[1080px] px-5 md:px-6">
          <div className="mb-12 max-w-2xl">
            <p className="od-eyebrow">What we manage</p>
            <h2 className="mt-3 font-display text-[34px] leading-tight text-[#2E1205] md:text-[46px]">
              Community spaces with real local value.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {communitySpaces.map((space, index) => {
              const Icon = space.icon
              return (
                <article
                  key={space.title}
                  className="about-reveal group rounded-3xl bg-white p-7 ring-1 ring-[#EFE5D8] transition-all duration-300 hover:-translate-y-1 hover:ring-[#C0582E]/35"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FBF0DC] text-[#C0582E] transition-transform duration-300 group-hover:rotate-[-3deg]">
                    <Icon size={22} />
                  </div>
                  <h3 className="font-display text-2xl text-[#2E1205]">{space.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#7B6658]">{space.text}</p>
                </article>
              )
            })}
          </div>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2E1205] px-5 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[#8A3618] active:scale-[0.98]"
          >
            <MessageCircle size={15} aria-hidden /> Ask to join a group
          </a>
        </div>
      </section>

      {/* ─── Advisors ─────────────────────────────────────────────────────── */}
      {advisors.length > 0 && (
        <section className="bg-[#FFFCF6] py-20 md:py-28">
          <div className="mx-auto max-w-[1080px] px-5 md:px-6">
            <div className="mb-10 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
              <div>
                <p className="od-eyebrow">Advisors</p>
                <h2 className="mt-2 font-display text-[32px] leading-tight text-[#2E1205] md:text-[44px]">
                  Guided by people who understand the local pulse.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-7 text-[#7B6658] md:text-[15px]">
                Alongside the core group, {siteConfig.name} is supported by advisors who bring local context, perspective
                and steady guidance as the community grows into a marketplace.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {advisors.map((advisor, index) => (
                <article
                  key={advisor.name}
                  className="about-reveal flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#EFE5D8]"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <TeamAvatar name={advisor.name} photo={advisor.photo} index={index + team.length} size="sm" />
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold text-[#2E1205]">{advisor.name}</h3>
                    <p className="truncate text-xs text-[#7B6658]">{advisor.focus}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Closer (mission + CTA, single elegant block) ─────────────────── */}
      <section className="relative overflow-hidden bg-[#2E1205] py-24 text-white md:py-32">
        <div
          className="absolute left-1/2 top-0 h-[420px] w-[760px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(240,200,122,0.18), transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-[1080px] px-5 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F0C87A]">The next level</p>
            <h2 className="mt-3 font-display text-[40px] leading-[1.05] md:text-[60px]">
              A digital home for the town we belong to.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#F8E9D5]/82 md:text-lg">
              A {siteConfig.town}-first marketplace, not a generic one. The mission is moving from posts and groups into
              a structured platform: listings, services, local products, recommendations and trusted discovery.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-3xl gap-3 sm:grid-cols-2 lg:max-w-none lg:grid-cols-4">
            {nextLevelPillars.map((item, index) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="about-reveal rounded-2xl border border-white/8 bg-white/[0.04] p-5"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <Icon size={20} className="text-[#F0C87A]" />
                  <h3 className="mt-4 font-display text-lg leading-tight">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#F8E9D5]/72">{item.text}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-14 flex flex-wrap justify-center gap-3">
            <Link
              href="/listings"
              className="inline-flex items-center gap-2 rounded-xl bg-[#F0C87A] px-6 py-3 text-sm font-semibold text-[#2E1205] transition-transform hover:-translate-y-0.5"
            >
              Explore the marketplace <ArrowRight size={15} />
            </Link>
            <Link
              href="/listings/submit"
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              List your business
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
