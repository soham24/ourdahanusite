import type { GuideImage } from '@/lib/guides'

/**
 * Hero image plus its licence credit. The credit is not decoration — CC BY
 * and CC BY-SA require the author, the licence, and links to both the source
 * and the licence text. Rendering the image without it would breach the
 * licence, so the two are deliberately one component and cannot drift apart.
 */
export default function GuideHero({ image }: { image: GuideImage }) {
  return (
    <figure className="mb-7">
      <div className="overflow-hidden rounded-[var(--od-radius)] border border-[var(--od-border)] bg-[var(--color-surface-soft)]">
        {/* Project sets images.unoptimized — plain <img> avoids next/image's
            optimizer round-trip for what are already pre-sized files. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.alt}
          className="block h-auto w-full"
          loading="eager"
        />
      </div>
      <figcaption className="mt-2 text-[11px] leading-relaxed text-[var(--od-muted)]">
        {image.note && <span className="block text-[var(--od-ink-2)]">{image.note}</span>}
        Photo:{' '}
        <a
          href={image.sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="underline underline-offset-2 hover:text-[var(--od-brand-strong)]"
        >
          {image.author}
        </a>{' '}
        via Wikimedia Commons ·{' '}
        <a
          href={image.licenceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="underline underline-offset-2 hover:text-[var(--od-brand-strong)]"
        >
          {image.licence}
        </a>
      </figcaption>
    </figure>
  )
}
