import type { Metadata } from 'next'
import Link from 'next/link'

import { getCachedPricingConfig } from '@/lib/data/pricing'
import { siteConfig } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    `The terms for using ${siteConfig.name} — listings, the marketplace, payments, refunds, and your responsibilities as a buyer, seller, or visitor.`,
  alternates: {
    canonical: 'https://ourdahanu.in/terms',
  },
}

const LAST_UPDATED = 'August 12, 2026'
const ENTITY_NAME = `${siteConfig.name}`
const CONTACT_EMAIL = siteConfig.contactEmail

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-[24px] leading-tight text-[#2E1205] md:text-[28px]">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-[#4B4038]">{children}</div>
    </section>
  )
}

const linkClass = 'font-semibold text-[#C0582E] underline decoration-[#C0582E]/30 underline-offset-2 hover:decoration-[#C0582E]'

export default async function TermsPage() {
  // Read the live listing fee rather than hardcoding it. This page is the
  // document someone points at in a dispute, and a hardcoded figure went
  // stale the moment the price changed — it said ₹210 for two months while
  // the real fee was ₹750.
  const pricing = await getCachedPricingConfig()

  return (
    <main className="bg-[#FAFAF7]">
      <div className="mx-auto max-w-[760px] px-5 py-16 md:px-6 md:py-24">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C0582E]">Legal</p>
        <h1 className="mt-2 font-display text-[38px] leading-[1.05] text-[#2E1205] md:text-[52px]">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-[#7B6658]">Last updated: {LAST_UPDATED}</p>

        <div className="mt-8 space-y-3 text-[15px] leading-7 text-[#4B4038]">
          <p>
            {ENTITY_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates the website
            <span className="whitespace-nowrap"> ourdahanu.in</span> and its subdomains (the
            &ldquo;Service&rdquo;) — a community platform, local directory, and marketplace for {siteConfig.town}, Bordi,
            Gholvad and the wider Palghar area. By using the Service, you agree to these Terms. If you don&rsquo;t
            agree, please don&rsquo;t use the Service.
          </p>
        </div>

        <Section title="Who can use the Service">
          <p>You must be at least 18 years old to create an account, list a business, buy or sell through the
            Service, or submit content. The directory and listings can be browsed by anyone.</p>
        </Section>

        <Section title="The marketplace — who you&rsquo;re dealing with">
          <p>When you buy from a shop or service listed on {ENTITY_NAME}, <strong className="font-semibold text-[#2E1205]">
            your contract is with the seller, not with us.</strong> Payment goes directly to the seller&rsquo;s own
            Razorpay account. {ENTITY_NAME} does not take a commission on marketplace sales and is not the merchant
            of record — we provide the platform that connects buyers and sellers, and we are not a party to the
            sale itself.</p>
        </Section>

        <Section title="Disputes, cancellations and refunds on purchases">
          <p>Issues with an order — a wrong item, late delivery, or wanting a refund — are between you and the
            seller, and are handled under that seller&rsquo;s own policy. {ENTITY_NAME} does not mediate marketplace
            disputes.</p>
          <p>To cancel an order or request a refund, contact the seller directly using the contact details on
            their listing. Whether a cancellation is accepted, and whether and how much is refunded, is up to the
            seller.</p>
          <p>Delivery and fulfilment times are not fixed platform-wide — they depend on the item and the individual
            seller. Check with the seller directly if you need a delivery estimate.</p>
        </Section>

        <Section title="Listing your business">
          <p>Listing a business currently costs ₹{pricing.current_price}/year (occasionally offered at a
            discount via coupon codes). This fee covers your listing being visible in the directory and
            marketplace for one year.</p>
          <p><strong className="font-semibold text-[#2E1205]">Refunds.</strong> If you change your mind after
            paying, you can request a refund of the listing fee by contacting us. If we remove your listing for
            breaking these Terms, the fee is not refunded.</p>
          <p><strong className="font-semibold text-[#2E1205]">Renewal.</strong> If a listing isn&rsquo;t renewed
            at the end of its year, it&rsquo;s hidden from the directory and marketplace — it is not deleted, and
            can be restored by renewing.</p>
        </Section>

        <Section title="Content you submit">
          <p>You keep ownership of the photos, descriptions, and other content you submit for your listing,
            products, or reviews. By submitting it, you grant {ENTITY_NAME} a licence to display, reproduce, and
            promote that content on the Service (and in promoting the Service) for as long as your listing or
            account is active.</p>
          <p>You&rsquo;re responsible for making sure you have the right to submit what you upload, and that it
            doesn&rsquo;t infringe anyone else&rsquo;s rights.</p>
        </Section>

        <Section title="What gets a listing or account removed">
          <p>We may remove a listing, review, or account — without a fee refund where a listing fee applies — for
            things like:</p>
          <ul className="ml-5 list-disc space-y-2">
            <li>Fake or fraudulent business information</li>
            <li>Abusive, harassing, or threatening behaviour toward other users</li>
            <li>Listing illegal goods or services</li>
            <li>Fake, incentivised, or spam reviews</li>
            <li>Repeated or serious violations of these Terms</li>
          </ul>
        </Section>

        <Section title="Ratings and reviews">
          <p>Ratings and reviews are checked by a moderator before they appear publicly. We can remove a review
            that violates these Terms, but we don&rsquo;t edit reviews on a business&rsquo;s behalf to change their
            substance.</p>
        </Section>

        <Section title="Deleting your listing or data">
          <p>You can ask us to delete your listing and associated data entirely, rather than just hiding it. Contact
            us and we&rsquo;ll process the request — see our{' '}
            <Link href="/privacy" className={linkClass}>Privacy Policy</Link> for how we handle personal data more
            generally.</p>
        </Section>

        <Section title="No warranty, limited liability">
          <p>The Service is provided &ldquo;as is&rdquo;. We do our best to keep listings accurate and the Service
            running, but we don&rsquo;t guarantee the accuracy of any listing, review, or third-party content, and
            we aren&rsquo;t liable for losses arising from your dealings with sellers, service providers, or other
            users found through the Service, to the fullest extent permitted by law.</p>
        </Section>

        <Section title="Changes to these Terms">
          <p>We may update these Terms from time to time. When we do, we&rsquo;ll revise the &ldquo;Last
            updated&rdquo; date above. Continuing to use the Service after a change means you accept the updated
            Terms.</p>
        </Section>

        <Section title="Governing law">
          <p>These Terms are governed by the laws of India, and any disputes are subject to the exclusive
            jurisdiction of the courts of Palghar, Maharashtra.</p>
        </Section>

        <Section title="Contact us">
          <p>Questions about these Terms? Contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>{CONTACT_EMAIL}</a>, or see our{' '}
            <Link href="/contact" className={linkClass}>Contact page</Link>.</p>
        </Section>

        <div className="mt-14 border-t border-[#EFE5D8] pt-6">
          <Link href="/" className={linkClass}>← Back to {siteConfig.name}</Link>
        </div>
      </div>
    </main>
  )
}
