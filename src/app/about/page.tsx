import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  HeartHandshake,
  MessageCircle,
  MessagesSquare,
  Radio,
  ShoppingBag,
  Sparkles,
  Store,
  UsersRound,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'About OurDahanu',
  description:
    'The story of OurDahanu, founded by Soham Railkar and grown with a core community group to connect Dahanu through social pages, WhatsApp groups and a local marketplace.',
  alternates: {
    canonical: 'https://ourdahanu.in/about',
  },
}

const coreGroup = [
  { name: 'Soham Railkar', role: 'Founder', detail: 'Started OurDahanu as a local Facebook, Instagram and WhatsApp community.' },
  { name: 'Ankit Thakkar', role: 'Core Group', detail: 'Helps manage community conversations and local coordination.' },
  { name: 'Khushboo Kapadia', role: 'Core Group', detail: 'Part of the team shaping useful community spaces for Dahanu.' },
  { name: 'Ajay Bari', role: 'Core Group', detail: 'Supports group management and day-to-day community operations.' },
  { name: 'Nupur Mestry', role: 'Core Group', detail: 'Helps keep OurDahanu active, helpful and locally relevant.' },
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
    title: 'A page for Dahanu',
    text: 'OurDahanu began as a simple idea by Soham Railkar: create a place where Dahanu people could see, share and support what is happening locally.',
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
    text: 'OurDahanu is moving to the next level: a structured marketplace and directory for Dahanu people, businesses, services and opportunities.',
  },
]

export default function AboutPage() {
  return (
    <main className="overflow-hidden bg-[#FAFAF7]">
      <section className="relative min-h-[680px] overflow-hidden bg-[#2E1205] text-white">
        <div className="absolute inset-0 warli-pattern opacity-[0.08]" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#140600] to-transparent" />
        <div
          className="absolute right-[-18%] top-[-18%] h-[520px] w-[520px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(240,200,122,0.36), transparent 68%)' }}
        />
        <div
          className="absolute bottom-[16%] left-[-12%] h-[420px] w-[420px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(192,88,46,0.28), transparent 68%)' }}
        />

        <div className="relative mx-auto grid min-h-[680px] max-w-[1160px] items-center gap-10 px-5 py-20 md:grid-cols-[1.05fr_0.95fr] md:px-6">
          <div className="about-reveal">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#F0C87A] backdrop-blur-sm">
              <Sparkles size={13} />
              Built by Dahanu, for Dahanu
            </div>
            <h1 className="max-w-[720px] font-display text-[46px] leading-[0.98] tracking-normal md:text-[76px]">
              From a community page to a local marketplace.
            </h1>
            <p className="mt-6 max-w-[610px] text-base leading-8 text-[#F8E9D5]/78 md:text-lg">
              OurDahanu was founded by <strong className="font-semibold text-white">Soham Railkar</strong> as a Facebook,
              Instagram and WhatsApp community. What started as a local voice is now becoming a platform where Dahanu
              people can discover businesses, services, jobs, stories and trusted community connections in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/listings"
                className="inline-flex items-center gap-2 rounded-xl bg-[#F0C87A] px-5 py-3 text-sm font-bold text-[#2E1205] shadow-[0_16px_36px_rgba(240,200,122,0.22)] transition-transform hover:-translate-y-0.5"
              >
                Explore OurDahanu <ArrowRight size={15} />
              </Link>
              <Link
                href="/listings/submit"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/16"
              >
                List your business
              </Link>
            </div>
          </div>

          <div id="core" className="about-float scroll-mt-24 rounded-3xl border border-white/12 bg-white/[0.08] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl">
            <div className="rounded-2xl bg-[#FAFAF7] p-5 text-[#2E1205]">
              <div className="flex items-center justify-between gap-4 border-b border-[#E8DDD2] pb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C0582E]">OurDahanu Core</p>
                  <h2 className="mt-1 font-display text-3xl">Community in motion</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FBF0DC] text-[#C0582E]">
                  <UsersRound size={22} />
                </div>
              </div>
              <div className="mt-5">
                <div className="rounded-3xl border border-[#D7B16A] bg-[#2E1205] p-4 text-white shadow-[0_18px_42px_rgba(46,18,5,0.16)]">
                  <div className="flex gap-4">
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-[#F0C87A] font-bold text-[#2E1205]">
                      {founder.name.split(' ').map((part) => part[0]).join('')}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#F0C87A]">
                        Founder
                      </p>
                      <p className="mt-1 font-display text-3xl leading-tight">{founder.name}</p>
                      <p className="mt-2 text-sm leading-6 text-[#F8E9D5]/76">{founder.detail}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {teamMembers.map((member) => (
                    <div key={member.name} className="flex min-h-[92px] gap-3 rounded-2xl border border-[#E8DDD2] bg-white p-3">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#2E1205] font-bold text-[#F0C87A]">
                        {member.name.split(' ').map((part) => part[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold leading-5">{member.name}</p>
                        <p className="text-xs font-semibold uppercase tracking-[0.10em] text-[#C0582E]">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-y border-[#E8DDD2] bg-[#fffdf9]">
        <div className="mx-auto grid max-w-[1160px] gap-4 px-5 py-8 md:grid-cols-4 md:px-6">
          {[
            { value: '30,000+', label: 'local reach' },
            { value: '6', label: 'core members' },
            { value: '4', label: 'advisors' },
            { value: 'Many', label: 'WhatsApp groups' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[#E8DDD2] bg-white p-5 text-center shadow-[0_10px_28px_rgba(46,18,5,0.04)]">
              <p className="font-display text-4xl text-[#2E1205]">{stat.value}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#C0582E]">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-5 py-16 md:px-6 md:py-20">
        <div className="mb-10 max-w-2xl">
          <p className="od-eyebrow">The journey</p>
          <h2 className="mt-2 font-display text-[36px] leading-tight text-[#2E1205] md:text-[50px]">
            A local story, built one conversation at a time.
          </h2>
        </div>

        <div className="relative">
          <div className="about-line absolute left-[18px] top-0 hidden h-full w-px bg-[#E8DDD2] md:block" />
          <div className="grid gap-5">
            {timeline.map((item, index) => (
              <article
                key={item.title}
                className="about-reveal rounded-3xl border border-[#E8DDD2] bg-white p-6 shadow-[0_16px_42px_rgba(46,18,5,0.05)] md:ml-14"
                style={{ animationDelay: `${index * 110}ms` }}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#C0582E] text-sm font-bold text-white md:-ml-[76px]">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C0582E]">{item.year}</p>
                    <h3 className="mt-1 font-display text-2xl text-[#2E1205]">{item.title}</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-[#7B6658]">{item.text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F4EADC] py-16 md:py-20">
        <div className="mx-auto max-w-[1160px] px-5 md:px-6">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="od-eyebrow">What we manage</p>
              <h2 className="mt-2 font-display text-[34px] leading-tight text-[#2E1205] md:text-[46px]">
                Community spaces with real local value.
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#7B6658] shadow-sm">
              <MessageCircle size={15} className="text-[#C0582E]" />
              WhatsApp-first community
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {communitySpaces.map((space, index) => {
              const Icon = space.icon
              return (
                <article
                  key={space.title}
                  className="about-reveal group rounded-3xl border border-[#E8DDD2] bg-white p-6 shadow-[0_14px_36px_rgba(46,18,5,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(192,88,46,0.38)]"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FBF0DC] text-[#C0582E] transition-transform duration-300 group-hover:rotate-[-3deg] group-hover:scale-105">
                    <Icon size={22} />
                  </div>
                  <h3 className="font-display text-2xl text-[#2E1205]">{space.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#7B6658]">{space.text}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-5 py-8 md:px-6 md:py-10">
        <div className="grid gap-5 rounded-3xl border border-[#E8DDD2] bg-white p-5 shadow-[0_14px_36px_rgba(46,18,5,0.04)] lg:grid-cols-[0.95fr_1.05fr] md:p-6">
          <div>
            <p className="od-eyebrow">Advisors</p>
            <h2 className="mt-2 font-display text-[28px] leading-tight text-[#2E1205] md:text-[36px]">
              Guided by people who understand the local pulse.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#7B6658]">
              Alongside the core group, OurDahanu is supported by advisors who bring local context,
              perspective and steady guidance as the community grows into a marketplace.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {advisors.map((advisor, index) => (
              <article
                key={advisor.name}
                className="about-reveal rounded-2xl border border-[#E8DDD2] bg-[#FAFAF7] p-3"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#2E1205] text-xs font-bold text-[#F0C87A]">
                  {advisor.name.split(' ').map((part) => part[0]).join('')}
                </div>
                <h3 className="text-sm font-bold leading-5 text-[#2E1205]">{advisor.name}</h3>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#C0582E]">
                  Advisor
                </p>
                <p className="mt-1 text-xs leading-4 text-[#7B6658]">{advisor.focus}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-5 py-16 md:px-6 md:py-20">
        <div className="grid gap-8 rounded-[28px] bg-[#2E1205] p-6 text-white shadow-[0_28px_80px_rgba(46,18,5,0.22)] md:grid-cols-[0.9fr_1.1fr] md:p-10">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#F0C87A]">The next level</p>
            <h2 className="mt-3 font-display text-[36px] leading-tight md:text-[52px]">
              A marketplace for Our Dahanu people.
            </h2>
            <p className="mt-5 text-sm leading-7 text-[#F8E9D5]/78">
              The mission is growing from posts and groups into a structured platform: listings, services, local products,
              jobs, recommendations and trusted discovery. Not a generic marketplace. A Dahanu-first marketplace.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: BriefcaseBusiness, title: 'Local businesses', text: 'Help shops, services and creators get discovered online.' },
              { icon: ShoppingBag, title: 'Local buying', text: 'Make products and services easier to find and order.' },
              { icon: HeartHandshake, title: 'Community trust', text: 'Build around recommendations, real people and known groups.' },
              { icon: Camera, title: 'Social to platform', text: 'Carry the existing social community into a stronger digital home.' },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.07] p-5">
                  <Icon size={22} className="text-[#F0C87A]" />
                  <h3 className="mt-4 font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#F8E9D5]/70">{item.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-[900px] px-5 text-center md:px-6">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FBF0DC] text-[#C0582E]">
            <CheckCircle2 size={26} />
          </div>
          <p className="od-eyebrow">Our promise</p>
          <h2 className="mt-2 font-display text-[34px] leading-tight text-[#2E1205] md:text-[48px]">
            We are building a digital home for the town we belong to.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#7B6658] md:text-base">
            OurDahanu is not just a website. It is the next version of a community that already exists in people,
            conversations, recommendations and trust. The platform is here to make that trust easier to find, support and grow.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/listings"
              className="inline-flex items-center gap-2 rounded-xl bg-[#C0582E] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#8A3618]"
            >
              Explore the marketplace <ArrowRight size={15} />
            </Link>
            <Link
              href="/about#core"
              className="inline-flex items-center gap-2 rounded-xl border border-[#E8DDD2] px-5 py-3 text-sm font-bold text-[#2E1205] transition-colors hover:bg-[#F6F1EA]"
            >
              Meet the core group
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
