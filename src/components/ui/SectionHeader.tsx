import React from 'react'
import { ArrowRight } from 'lucide-react'
import SafeAppLink from '@/components/SafeAppLink'

interface SectionHeaderProps {
  label: string
  title: string
  sub?: string
  viewAllHref?: string
}

export default function SectionHeader({
  label,
  title,
  sub,
  viewAllHref,
}: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--od-brand)] mb-1.5">
          {label}
        </p>
        <h2 className="font-display text-[30px] md:text-[34px] leading-[1.15] text-[var(--od-ink)] tracking-[-0.01em]">
          {title}
        </h2>
        {sub && <p className="text-sm text-[var(--od-muted)] mt-1">{sub}</p>}
      </div>
      {viewAllHref && (
        <SafeAppLink
          href={viewAllHref}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--od-brand)] border border-[var(--od-border)] hover:border-[rgba(192,88,46,0.35)] hover:bg-[var(--od-surface-soft)] px-[14px] py-1.5 rounded-lg transition-all"
        >
          View all
          <ArrowRight size={13} />
        </SafeAppLink>
      )}
    </div>
  )
}
