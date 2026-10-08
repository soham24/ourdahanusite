'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Link2, MessageCircle, Package, ShoppingBag, Wrench } from 'lucide-react'

import { catalogPriceLine, type CatalogAction } from '@/lib/catalog/catalog'
import type { CatalogItem } from '@/lib/catalog/types'
import { getServiceImageAspectOption } from '@/lib/service-image'
import ExpandableDescription from './ExpandableDescription'

function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy a link to this item"
      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--od-border)] bg-white px-3 text-xs font-semibold text-[var(--od-muted)] transition-colors hover:border-[var(--od-brand)] hover:text-[var(--od-brand)]"
    >
      {copied ? <Check size={13} aria-hidden /> : <Link2 size={13} aria-hidden />}
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}

export function CatalogActionButton({
  action,
  whatsappHref,
  size = 'sm',
}: {
  action: CatalogAction
  whatsappHref: string | null
  size?: 'sm' | 'lg'
}) {
  const sizing = size === 'lg' ? 'w-full min-h-12 px-4 text-sm' : 'min-h-10 px-4 text-sm'

  if (action.kind === 'buy') {
    return (
      <Link href={action.href} className={`od-button-primary ${sizing}`}>
        <ShoppingBag size={15} aria-hidden />
        {action.label}
      </Link>
    )
  }
  if (action.kind === 'sold_out') {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex cursor-not-allowed items-center justify-center rounded-xl border border-[var(--od-border)] bg-[var(--od-surface-soft)] font-semibold text-[var(--od-muted)] ${sizing}`}
      >
        {action.label}
      </button>
    )
  }
  if (action.kind === 'whatsapp' && whatsappHref) {
    return (
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1FA855] font-bold text-white transition-colors hover:bg-[#188F47] ${sizing}`}
      >
        <MessageCircle size={15} aria-hidden />
        {action.label}
      </a>
    )
  }
  return null
}

export default function CatalogItemCard({
  item,
  action,
  whatsappHref,
  shareUrl,
}: {
  item: CatalogItem
  action: CatalogAction
  whatsappHref: string | null
  shareUrl: string | null
}) {
  const aspect = getServiceImageAspectOption(item.image_aspect, 'square')
  const imageUrl = item.image_url || item.image_thumb_url
  const isService = item.type === 'service'

  return (
    <article id={`item-${item.id}`} className="od-card flex scroll-mt-28 flex-col overflow-hidden">
      {imageUrl && (
        <div className="bg-[var(--od-surface-soft)]">
          <div
            className={`relative overflow-hidden ${aspect.value === 'portrait' ? 'mx-auto w-3/4' : 'w-full'}`}
            style={{ aspectRatio: aspect.cssAspectRatio }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--od-surface-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--od-brand-strong)]">
          {isService ? <Wrench size={11} aria-hidden /> : <Package size={11} aria-hidden />}
          {isService ? 'Service' : 'Product'}
        </span>
        <h3 className="text-base font-extrabold leading-snug text-[var(--od-ink)]">{item.name}</h3>
        {item.description && (
          <ExpandableDescription
            text={item.description}
            label={item.name}
            className="text-sm leading-relaxed text-[var(--od-muted)]"
          />
        )}
        <p className="mt-auto pt-1 text-lg font-extrabold text-[var(--od-ink)]">{catalogPriceLine(item)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <CatalogActionButton action={action} whatsappHref={whatsappHref} />
          {shareUrl && <ShareButton url={shareUrl} />}
        </div>
      </div>
    </article>
  )
}
