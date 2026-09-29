import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Clock } from 'lucide-react'

import StructuredData from '@/components/StructuredData'
import { getPublishedGuides } from '@/lib/guides'
import { SITE_URL } from '@/lib/site'
import { siteConfig } from '@/lib/site'

const TITLE = `${siteConfig.town} Guides — Travel, Food and Local Know-How`
const DESCRIPTION =
  `Practical guides to ${siteConfig.town} written by people who live here — getting from Mumbai, chikoo season, the beaches, where to stay and what a weekend actually costs.`

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/guides` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/guides`, type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

export default async function GuidesIndexPage() {
  const guides = await getPublishedGuides()

  const listSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${siteConfig.town} Guides`,
    numberOfItems: guides.length,
    itemListElement: guides.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/guides/${g.slug}`,
      name: g.title,
    })),
  }

  return (
    <div className="od-page min-h-screen px-4 py-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        {guides.length > 0 && <StructuredData data={listSchema} />}

        <header className="mb-8">
          <p className="od-eyebrow mb-2">Guides</p>
          <h1 className="text-balance font-display text-3xl leading-tight sm:text-4xl">
            {siteConfig.town}, explained by people who live here
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--od-muted)]">
            Getting here from Mumbai, when the chikoo is best, which beach to pick, and what a
            weekend really costs — written locally and kept honest about what we don&apos;t know.
          </p>
        </header>

        {guides.length === 0 ? (
          <div className="od-card flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)]">
              <BookOpen size={26} aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-2xl">Guides are on the way</h2>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--od-muted)]">
              We&apos;re fact-checking the first set with local sources before publishing them.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/guides/${g.slug}`}
                  className="od-card od-card-hover flex h-full flex-col overflow-hidden"
                >
                  {g.hero && (
                    // Decorative here — the card's heading already names the
                    // article, so an alt would just repeat it to a screen reader.
                    // Full credit is rendered on the article page itself.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.hero.src}
                      alt=""
                      aria-hidden
                      className="aspect-[16/9] w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="flex flex-1 flex-col p-5">
                  <p className="od-eyebrow mb-2 text-[10px]">{g.category}</p>
                  <h2 className="font-display text-xl leading-snug text-[var(--od-ink)]">
                    {g.title}
                  </h2>
                  {g.description && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--od-muted)]">
                      {g.description}
                    </p>
                  )}
                  <p className="mt-auto flex items-center gap-1.5 pt-4 text-xs font-semibold text-[var(--od-muted)]">
                    <Clock size={12} aria-hidden />
                    {g.readingMinutes} min read
                  </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
