import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How OurDahanu collects, uses, and protects your information, including cookies, Google AdSense advertising, and analytics.',
  alternates: {
    canonical: 'https://ourdahanu.in/privacy',
  },
}

const LAST_UPDATED = 'July 14, 2026'
const CONTACT_EMAIL = 'railkarsoham@gmail.com'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-[24px] leading-tight text-[#2E1205] md:text-[28px]">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-[#4B4038]">{children}</div>
    </section>
  )
}

const linkClass = 'font-semibold text-[#C0582E] underline decoration-[#C0582E]/30 underline-offset-2 hover:decoration-[#C0582E]'

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-[#FAFAF7]">
      <div className="mx-auto max-w-[760px] px-5 py-16 md:px-6 md:py-24">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C0582E]">Legal</p>
        <h1 className="mt-2 font-display text-[38px] leading-[1.05] text-[#2E1205] md:text-[52px]">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-[#7B6658]">Last updated: {LAST_UPDATED}</p>

        <div className="mt-8 space-y-3 text-[15px] leading-7 text-[#4B4038]">
          <p>
            OurDahanu (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates the website
            <span className="whitespace-nowrap"> ourdahanu.in</span> and its subdomains (the
            &ldquo;Service&rdquo;) — a community platform and local directory for Dahanu, Bordi, Gholvad and the
            wider Palghar area. This Privacy Policy explains what information we collect, how we use it, and the
            choices you have.
          </p>
          <p>By using the Service, you agree to the collection and use of information in accordance with this policy.</p>
        </div>

        <Section title="Information we collect">
          <p><strong className="font-semibold text-[#2E1205]">Information you provide.</strong> When you create an
            account, list a business, submit a professional to the directory, post a job, leave a rating or review, or
            contact us, we collect the details you enter — such as your name, phone number, email address, business
            information, and any content you submit.</p>
          <p><strong className="font-semibold text-[#2E1205]">Information collected automatically.</strong> When you
            visit the Service, we and our service providers automatically collect certain information through cookies
            and similar technologies, including your IP address, device and browser type, pages viewed, referring
            pages, and general usage patterns.</p>
        </Section>

        <Section title="How we use your information">
          <p>We use the information we collect to operate and improve the Service, display listings and directory
            entries, enable ratings and community features, respond to your requests, maintain safety and prevent
            abuse, measure usage, and — where permitted — show advertising.</p>
        </Section>

        <Section title="Cookies and similar technologies">
          <p>Cookies are small files stored on your device. We and third parties use cookies and similar technologies
            for essential site functionality, to remember your preferences, to measure traffic and performance, and to
            deliver and personalize advertising. You can control cookies through your browser settings, and — for
            visitors in the EEA, the UK and Switzerland — through the consent choices described below.</p>
        </Section>

        <Section title="Advertising and Google AdSense">
          <p>We use <strong className="font-semibold text-[#2E1205]">Google AdSense</strong> to display advertising on
            the Service. In connection with this:</p>
          <ul className="ml-5 list-disc space-y-2">
            <li>Third-party vendors, including Google, use cookies to serve ads based on a user&rsquo;s prior visits to
              this website or other websites.</li>
            <li>Google&rsquo;s use of advertising cookies enables it and its partners to serve ads to you based on your
              visit to the Service and/or other sites on the Internet.</li>
            <li>You may opt out of personalized advertising by visiting{' '}
              <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className={linkClass}>Google Ads Settings</a>.</li>
            <li>You can opt out of some third-party vendors&rsquo; use of cookies for personalized advertising by
              visiting{' '}
              <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className={linkClass}>aboutads.info</a>.</li>
          </ul>
          <p>For more information on how Google uses data, see{' '}
            <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer" className={linkClass}>
              How Google uses information from sites that use its services</a>.</p>
        </Section>

        <Section title="Analytics">
          <p>We use <strong className="font-semibold text-[#2E1205]">Google Analytics</strong> and{' '}
            <strong className="font-semibold text-[#2E1205]">Vercel Analytics</strong> to understand how the Service is
            used so we can improve it. These tools collect usage and device information as described above. You can learn
            about Google Analytics&rsquo; practices in{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>Google&rsquo;s Privacy Policy</a>.</p>
        </Section>

        <Section title="Your consent choices (EEA, UK & Switzerland)">
          <p>If you visit from the European Economic Area, the United Kingdom, or Switzerland, we present a consent
            message (a Google-certified consent management platform) before serving personalized ads or non-essential
            cookies. You can grant, refuse, or manage your choices there, and you can change your choices at any time.
            We apply Google Consent Mode so that advertising and analytics respect your selection.</p>
        </Section>

        <Section title="How your information is stored and shared">
          <p>User accounts and content you submit are stored using{' '}
            <strong className="font-semibold text-[#2E1205]">Supabase</strong>, and the Service is hosted on{' '}
            <strong className="font-semibold text-[#2E1205]">Vercel</strong>. We do not sell your personal information.
            We share information only with service providers that help us operate the Service (such as hosting,
            database, analytics, and advertising partners described above), when required by law, or to protect the
            rights and safety of our users and community.</p>
        </Section>

        <Section title="Data retention">
          <p>We retain personal information for as long as your account or content is active, or as needed to provide
            the Service and comply with our legal obligations. You can ask us to remove content you submitted or to
            delete your account.</p>
        </Section>

        <Section title="Your rights and choices">
          <p>Depending on where you live, you may have the right to access, correct, or delete your personal
            information, and to object to or restrict certain processing. To make a request, contact us at the address
            below. You can also manage cookies via your browser and advertising preferences via the opt-out links above.</p>
        </Section>

        <Section title="Children&rsquo;s privacy">
          <p>The Service is not directed to children under 13, and we do not knowingly collect personal information from
            children under 13. If you believe a child has provided us personal information, please contact us so we can
            remove it.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>We may update this Privacy Policy from time to time. When we do, we will revise the &ldquo;Last
            updated&rdquo; date above. Significant changes may be highlighted on the Service.</p>
        </Section>

        <Section title="Contact us">
          <p>If you have questions about this Privacy Policy or your information, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>{CONTACT_EMAIL}</a>.</p>
        </Section>

        <div className="mt-14 border-t border-[#EFE5D8] pt-6">
          <Link href="/" className={linkClass}>← Back to OurDahanu</Link>
        </div>
      </div>
    </main>
  )
}
