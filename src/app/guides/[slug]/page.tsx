import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock } from 'lucide-react'

import StructuredData from '@/components/StructuredData'
import { getGuideBySlug, getRelatedGuides } from '@/lib/guides'
import { SITE_URL } from '@/lib/site'
import GuideHero from '../GuideHero'

// No `generateStaticParams` here on purpose. Under Cache Components it must
// return at least one entry, and this route legitimately has zero published
// guides until an article's facts have been checked — an empty array fails
// the build outright (EmptyGenerateStaticParamsError). Rendering on demand
// also matches every other dynamic route in this app (listings/[id],
// find/p/[id], checkout/[productId]), none of which prerender their params.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const guide = await getGuideBySlug(slug)
  if (!guide) return {}

  const url = `${SITE_URL}/guides/${guide.slug}`
  const images = guide.hero ? [`${SITE_URL}${guide.hero.src}`] : undefined
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: url },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url,
      type: 'article',
      publishedTime: guide.date || undefined,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: guide.title,
      description: guide.description,
      ...(images ? { images } : {}),
    },
  }
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const guide = await getGuideBySlug(slug)
  if (!guide) notFound()

  const related = await getRelatedGuides(slug)
  const url = `${SITE_URL}/guides/${guide.slug}`

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    url,
    mainEntityOfPage: url,
    datePublished: guide.date || undefined,
    dateModified: guide.date || undefined,
    ...(guide.hero ? { image: `${SITE_URL}${guide.hero.src}` } : {}),
    author: { '@type': 'Organization', name: 'OurDahanu', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'OurDahanu', url: SITE_URL },
    about: 'Dahanu, Maharashtra',
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'OurDahanu', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE_URL}/guides` },
      { '@type': 'ListItem', position: 3, name: guide.title, item: url },
    ],
  }

  return (
    <div className="od-page min-h-screen px-4 py-8 md:py-12">
      <article className="mx-auto max-w-2xl">
        <StructuredData data={[articleSchema, breadcrumbSchema]} />

        <nav aria-label="Breadcrumb" className="mb-5">
          <Link
            href="/guides"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--od-border)] bg-white/70 px-3 py-1.5 text-[13px] font-semibold text-[var(--od-ink-2)] transition-colors hover:border-[rgba(192,88,46,0.4)] hover:text-[var(--od-brand-strong)]"
          >
            <ArrowLeft size={13} aria-hidden /> All guides
          </Link>
        </nav>

        <header className="mb-7">
          <p className="od-eyebrow mb-2">{guide.category}</p>
          <h1 className="text-balance font-display text-3xl leading-tight sm:text-4xl">
            {guide.title}
          </h1>
          {guide.description && (
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--od-muted)]">
              {guide.description}
            </p>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[var(--od-muted)]">
            <Clock size={12} aria-hidden />
            {guide.readingMinutes} min read
          </p>
        </header>

        {guide.hero && <GuideHero image={guide.hero} />}

        {/* Content is authored in-repo, not user-submitted — see src/lib/guides.ts */}
        <div className="od-guide-prose" dangerouslySetInnerHTML={{ __html: guide.html }} />

        {related.length > 0 && (
          <section className="mt-12 border-t border-[var(--od-border)] pt-8">
            <h2 className="mb-4 font-display text-2xl">More Dahanu guides</h2>
            <ul className="grid gap-3">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/guides/${r.slug}`}
                    className="od-card od-card-hover block p-4 transition-colors"
                  >
                    <p className="od-eyebrow mb-1 text-[10px]">{r.category}</p>
                    <p className="font-bold text-[var(--od-ink)]">{r.title}</p>
                    {r.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--od-muted)]">
                        {r.description}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  )
}
