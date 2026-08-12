import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, MessageCircle } from 'lucide-react'

import StructuredData from '@/components/StructuredData'
import { SITE_URL } from '@/lib/site'

// lucide-react dropped brand/logo icons — a small inline outline in the same style.
function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

const CONTACT_EMAIL = 'railkarsoham@gmail.com'
const WHATSAPP_NUMBER = '8149314106'
const WHATSAPP_HREF = `https://wa.me/91${WHATSAPP_NUMBER}`
const INSTAGRAM_HANDLE = 'ourdahanu'
const INSTAGRAM_HREF = `https://instagram.com/${INSTAGRAM_HANDLE}`

const TITLE = 'Contact Us'
const DESCRIPTION = 'Get in touch with OurDahanu by email or WhatsApp.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/contact`, type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

const linkClass = 'font-semibold text-[#C0582E] underline decoration-[#C0582E]/30 underline-offset-2 hover:decoration-[#C0582E]'

export default function ContactPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: TITLE,
    url: `${SITE_URL}/contact`,
    about: {
      '@type': 'Organization',
      name: 'OurDahanu',
      url: SITE_URL,
      sameAs: [INSTAGRAM_HREF],
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: CONTACT_EMAIL,
          areaServed: 'IN',
          availableLanguage: ['en', 'mr', 'hi'],
        },
        {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          areaServed: 'IN',
          availableLanguage: ['en', 'mr', 'hi'],
          url: WHATSAPP_HREF,
        },
      ],
    },
  }

  return (
    <main className="bg-[#FAFAF7]">
      <StructuredData data={schema} />
      <div className="mx-auto max-w-[760px] px-5 py-16 md:px-6 md:py-24">
        <p className="od-eyebrow">Get in touch</p>
        <h1 className="mt-2 font-display text-[38px] leading-[1.05] text-[#2E1205] md:text-[52px]">
          Contact Us
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#4B4038]">
          Questions, feedback, or something not working right — reach out and we&apos;ll get back to you. We usually
          reply within 24 hours.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="group flex flex-col rounded-2xl bg-white p-6 ring-1 ring-[#EFE5D8] transition-all hover:-translate-y-1 hover:ring-[#C0582E]/35"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FBF0DC] text-[#C0582E] transition-transform duration-300 group-hover:rotate-[-3deg]">
              <Mail size={22} />
            </span>
            <h2 className="mt-5 font-display text-xl text-[#2E1205]">Email</h2>
            <p className="mt-2 break-words text-sm leading-6 text-[#7B6658]">{CONTACT_EMAIL}</p>
          </a>

          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col rounded-2xl bg-white p-6 ring-1 ring-[#EFE5D8] transition-all hover:-translate-y-1 hover:ring-[#C0582E]/35"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FBF0DC] text-[#C0582E] transition-transform duration-300 group-hover:rotate-[-3deg]">
              <MessageCircle size={22} />
            </span>
            <h2 className="mt-5 font-display text-xl text-[#2E1205]">WhatsApp</h2>
            <p className="mt-2 text-sm leading-6 text-[#7B6658]">+91 {WHATSAPP_NUMBER} — messages only, no calls.</p>
          </a>

          <a
            href={INSTAGRAM_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col rounded-2xl bg-white p-6 ring-1 ring-[#EFE5D8] transition-all hover:-translate-y-1 hover:ring-[#C0582E]/35"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FBF0DC] text-[#C0582E] transition-transform duration-300 group-hover:rotate-[-3deg]">
              <InstagramIcon size={22} />
            </span>
            <h2 className="mt-5 font-display text-xl text-[#2E1205]">Instagram</h2>
            <p className="mt-2 text-sm leading-6 text-[#7B6658]">@{INSTAGRAM_HANDLE}</p>
          </a>
        </div>

        <div className="mt-14 border-t border-[#EFE5D8] pt-6">
          <Link href="/" className={linkClass}>← Back to OurDahanu</Link>
        </div>
      </div>
    </main>
  )
}
