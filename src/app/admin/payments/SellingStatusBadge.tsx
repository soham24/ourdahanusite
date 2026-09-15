import type { SellingStatus } from '@/lib/selling/shop-mode'

const STYLES: Record<SellingStatus, { label: string; className: string }> = {
  live: {
    label: 'Live',
    className: 'bg-[rgba(19,138,75,0.12)] text-[var(--color-success-strong)]',
  },
  test: {
    label: 'Test',
    className: 'bg-[rgba(200,136,30,0.14)] text-[var(--od-brand-strong)]',
  },
  suspended: {
    label: 'Suspended',
    className: 'bg-[rgba(180,35,24,0.1)] text-[var(--od-danger)]',
  },
  not_connected: {
    label: 'Not connected',
    className: 'bg-[var(--color-surface-soft)] text-[var(--od-muted)]',
  },
}

export default function SellingStatusBadge({ status }: { status: SellingStatus }) {
  const style = STYLES[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${style.className}`}>
      {style.label}
    </span>
  )
}
