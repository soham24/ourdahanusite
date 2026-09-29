import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BriefcaseBusiness,
  Camera,
  HeartHandshake,
  MessagesSquare,
  Radio,
  ShoppingBag,
  Sparkles,
  Store,
} from 'lucide-react'
import { siteConfig } from '@/lib/site'

export const metadata: Metadata = {
  title: `About ${siteConfig.name}`,
  description:
    `The story of ${siteConfig.name}, founded by Soham Railkar and grown with a core community group to connect ${siteConfig.town} through social pages, WhatsApp groups and a local marketplace.`,
  alternates: {
    canonical: 'https://ourdahanu.in/about',
  },
}

const coreGroup = [
  { name: 'Soham Railkar', role: 'Founder', detail: `Started ${siteConfig.name} as a local Facebook, Instagram and WhatsApp community.` },
  { name: 'Ankit Thakkar', role: 'Core Group', detail: 'Helps manage community conversations and local coordination.' },
  { name: 'Khushboo Kapadia', role: 'Core Group', detail: `Part of the team shaping useful community spaces for ${siteConfig.town}.` },
  { name: 'Ajay Bari', role: 'Core Group', detail: 'Supports group management and day-to-day community operations.' },
  { name: 'Nupur Mestry', role: 'Core Group', detail: `Helps keep ${siteConfig.name} active, helpful and locally relevant.` },
  { name: 'Khushbu Bari', role: 'Content / Media', detail: 'Supports the community with content, media and storytelling.' },
]

const founder = coreGroup[0]
const teamMembers = coreGroup.slice(1)

const advisors = [
  { name: 'Mayur Vayeda', focus: 'Community guidance' },
  { name: 'Mayuresh Patil', focus: 'Local network' },
  { name: 'Ketan Patil', focus: 'Strategic support' },
  { name: 'Tanvi Nayak', focus: 'Community perspective' },
]

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

const timeline = [
  {
    year: 'The beginning',
    title: `A page for ${siteConfig.town}`,
    text: `${siteConfig.name} began as a simple idea by Soham Railkar: create a place where ${siteConfig.town} people could see, share and support what is happening locally.`,
  },
  {
    year: 'The community grows',
    title: 'From social pages to WhatsApp communities',
    text: 'The Facebook and Instagram presence expanded into WhatsApp communities where people could talk, ask, recommend, buy, sell and solve local problems together.',
  },
  {
    year: 'The core group forms',
    title: 'A team starts carrying the work',
    text: 'Ankit Thakkar, Khushboo Kapadia, Ajay Bari, Nupur Mestry and Khushbu Bari joined Soham, forming a core group that manages multiple spaces with care.',
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

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
}

export default function AboutPage() {
  return (
    <main className="overflow-hidden bg-[#FAFAF7]">
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#2E1205] text-white">
        <div
          className="absolute right-[-22%] top-[-20%] h-[640px] w-[640px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(240,200,122,0.22), transparent 70%)' }}
        />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#1c0a02] to-transparent" />

        <div className="relative mx-auto max-w-[1080px] px-5 pt-24 pb-32 text-center md:px-6 md:pt-32 md:pb-40">
          <div className="about-reveal">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#F0C87A] backdrop-blur-sm">
              <Sparkles size={13} />
              Built by {siteConfig.town}, for {siteConfig.town}
            </div>
            <h1 className="mx-auto mt-7 max-w-[820px] font-display text-[44px] leading-[0.98] tracking-normal md:text-[80px]">
              From a community page to a <em className="italic text-[#F0C87A]">local marketplace.</em>
            </h1>
            <p className="mx-auto mt-7 max-w-[640px] text-base leading-8 text-[#F8E9D5]/80 md:text-lg">
              Founded by <strong className="font-semibold text-white">Soham Railkar</strong> as a Facebook, Instagram
              and WhatsApp community — now becoming the digital home for {siteConfig.town}&apos;s businesses, services and
              everyday discoveries.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link
                href="/listings"
                className="inline-flex items-center gap-2 rounded-xl bg-[#F0C87A] px-5 py-3 text-sm font-bold text-[#2E1205] shadow-[0_16px_36px_rgba(240,200,122,0.22)] transition-transform hover:-translate-y-0.5"
              >
                Explore {siteConfig.name} <ArrowRight size={15} />
              </Link>
              <Link
                href="#core"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                Meet the team
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats strip ──────────────────────────────────────────────────── */}
      <section className="border-y border-[#EFE5D8] bg-white">
        <div className="mx-auto grid max-w-[1080px] grid-cols-2 divide-x divide-[#EFE5D8] px-5 py-8 md:grid-cols-4 md:px-6">
          {[
            { value: '30,000+', label: 'Local reach' },
            { value: '6', label: 'Core members' },
            { value: '4', label: 'Advisors' },
            { value: 'Many', label: 'WhatsApp groups' },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center justify-center px-4 py-2 text-center">
              <p className="font-display text-[36px] leading-none text-[#2E1205] md:text-[44px]">{stat.value}</p>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#C0582E]">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Founder spotlight ────────────────────────────────────────────── */}
      <section id="core" className="scroll-mt-20 bg-[#FAFAF7] py-20 md:py-28">
        <div className="mx-auto max-w-[1080px] px-5 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="od-eyebrow">Founder</p>
            <h2 className="mt-3 font-display text-[40px] leading-[1.05] text-[#2E1205] md:text-[56px]">
              {founder.name}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[#7B6658] md:text-lg">
              {founder.detail}
            </p>
            <div className="mx-auto mt-10 h-px w-16 bg-[#D7B16A]" />
          </div>
        </div>
      </section>

      {/* ─── Core team grid ───────────────────────────────────────────────── */}
      <section className="bg-[#FAFAF7] pb-20 md:pb-28">
        <div className="mx-auto max-w-[1080px] px-5 md:px-6">
          <div className="mb-12 text-center">
            <p className="od-eyebrow">Core group</p>
            <h2 className="mt-3 font-display text-[32px] leading-tight text-[#2E1205] md:text-[44px]">
              The people carrying the work.
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {teamMembers.map((member, index) => (
              <article
                key={member.name}
                className="about-reveal flex flex-col items-center rounded-2xl bg-white px-5 py-7 text-center shadow-[0_10px_30px_rgba(46,18,5,0.04)] ring-1 ring-[#EFE5D8] transition-transform hover:-translate-y-1"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2E1205] font-display text-lg text-[#F0C87A]">
                  {initials(member.name)}
                </div>
                <h3 className="mt-4 font-display text-lg leading-tight text-[#2E1205]">{member.name}</h3>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#C0582E]">{member.role}</p>
                <p className="mt-3 text-xs leading-6 text-[#7B6658]">{member.detail}</p>
              </article>
            ))}
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
        </div>
      </section>

      {/* ─── Advisors ─────────────────────────────────────────────────────── */}
      <section className="bg-[#FFFCF6] py-20 md:py-28">
        <div className="mx-auto max-w-[1080px] px-5 md:px-6">
          <div className="mb-12 mx-auto max-w-2xl text-center">
            <p className="od-eyebrow">Advisors</p>
            <h2 className="mt-3 font-display text-[32px] leading-tight text-[#2E1205] md:text-[44px]">
              Guided by people who understand the local pulse.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#7B6658] md:text-[15px]">
              Alongside the core group, {siteConfig.name} is supported by advisors who bring local context, perspective and
              steady guidance as the community grows into a marketplace.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {advisors.map((advisor, index) => (
              <article
                key={advisor.name}
                className="about-reveal flex flex-col items-center rounded-2xl bg-white px-5 py-7 text-center ring-1 ring-[#EFE5D8]"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FBF0DC] text-sm font-bold text-[#C0582E]">
                  {initials(advisor.name)}
                </div>
                <h3 className="mt-4 font-display text-lg leading-tight text-[#2E1205]">{advisor.name}</h3>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#C0582E]">Advisor</p>
                <p className="mt-2 text-xs leading-5 text-[#7B6658]">{advisor.focus}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

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
              Not a generic marketplace — a Dahanu-first one. The mission is moving from posts and groups into a
              structured platform: listings, services, local products, recommendations and trusted discovery.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-3xl gap-3 sm:grid-cols-2 lg:max-w-none lg:grid-cols-4">
            {nextLevelPillars.map((item, index) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="about-reveal rounded-2xl border border-white/8 bg-white/[0.04] p-5 backdrop-blur-sm"
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
              className="inline-flex items-center gap-2 rounded-xl bg-[#F0C87A] px-6 py-3 text-sm font-bold text-[#2E1205] transition-transform hover:-translate-y-0.5"
            >
              Explore the marketplace <ArrowRight size={15} />
            </Link>
            <Link
              href="/listings/submit"
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              List your business
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
