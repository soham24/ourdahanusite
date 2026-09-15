import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, Circle, Lock, PauseCircle, ShoppingBag, SkipForward } from 'lucide-react'

import type {
  ChecklistStep,
  ChecklistStepId,
  ChecklistStepState,
  SellingChecklist,
} from '@/lib/selling/checklist'
import { sellingPausedMessage } from '@/lib/selling/shop-mode'

export interface SellOnlineRow {
  listingId: string
  listingName: string
  shopHref: string
  suspendedReason: string | null
  checklist: SellingChecklist
  /** Real (non-test) orders still waiting at "confirmed". */
  newOrderCount: number
}

const STEP_COPY: Record<ChecklistStepId, { title: string; hint: string }> = {
  listing: { title: 'Listing is live', hint: 'Your listing must be approved before customers can buy.' },
  connect: { title: 'Connect Razorpay', hint: 'Payments go straight to your own Razorpay account.' },
  item: { title: 'Add your first item', hint: 'Products or services customers can buy.' },
  practice: {
    title: 'Try a practice purchase',
    hint: 'Optional. Buy from your own shop while on test keys — no real money moves.',
  },
  live: { title: 'Go live', hint: 'Connect Live keys once Razorpay activates your account.' },
}

const STATE_LABEL: Record<ChecklistStepState, string> = {
  done: 'Done',
  skipped: 'Skipped',
  blocked: 'Waiting on an earlier step',
  todo: 'To do',
}

function stepAction(step: ChecklistStep, row: SellOnlineRow): { label: string; href: string } | null {
  if (step.state !== 'todo') return null
  const paymentsHref = `/my-business/payments?listing=${row.listingId}`
  switch (step.id) {
    case 'listing':
      return { label: 'View listing', href: row.shopHref }
    case 'connect':
      return { label: 'Connect', href: paymentsHref }
    case 'item':
      return { label: 'Add item', href: `/my-business/products/${row.listingId}` }
    case 'practice':
      return { label: 'View my shop', href: row.shopHref }
    case 'live':
      return { label: 'How to go live', href: paymentsHref }
  }
}

function StepIcon({ state }: { state: ChecklistStepState }) {
  if (state === 'done') return <CheckCircle2 size={18} className="text-[var(--od-success)]" aria-hidden />
  if (state === 'skipped') return <SkipForward size={16} className="text-[var(--od-muted)]" aria-hidden />
  if (state === 'blocked') return <Lock size={15} className="text-[var(--od-muted)]" aria-hidden />
  return <Circle size={18} className="text-[var(--od-brand)]" aria-hidden />
}

function ListingSelling({ row, showName }: { row: SellOnlineRow; showName: boolean }) {
  const { checklist } = row
  const paymentsHref = `/my-business/payments?listing=${row.listingId}`

  return (
    <div className="rounded-2xl border border-[var(--od-border)] bg-white/70 p-4">
      {showName && <p className="mb-3 font-bold text-[var(--od-ink)]">{row.listingName}</p>}

      {checklist.status === 'suspended' ? (
        <div className="flex items-start gap-2">
          <PauseCircle size={18} className="mt-0.5 shrink-0 text-[var(--od-danger)]" aria-hidden />
          <p className="text-sm leading-relaxed text-[var(--od-ink-2)]">{sellingPausedMessage(row.suspendedReason)}</p>
        </div>
      ) : checklist.status === 'complete' ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--od-ink)]">
            <CheckCircle2 size={18} className="text-[var(--od-success)]" aria-hidden />
            Selling online · Live
          </p>
          <nav aria-label={`Selling links for ${row.listingName}`} className="flex flex-wrap gap-2">
            <Link href="/my-business/orders" className="od-button-secondary px-3 py-1.5 text-sm">
              Orders
              {row.newOrderCount > 0 && (
                <span className="rounded-full bg-[var(--od-brand)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
                  {row.newOrderCount}
                </span>
              )}
            </Link>
            <Link href={`/my-business/products/${row.listingId}`} className="od-button-secondary px-3 py-1.5 text-sm">
              Items
            </Link>
            <Link href={paymentsHref} className="od-button-secondary px-3 py-1.5 text-sm">
              Payments
            </Link>
            <Link href={row.shopHref} className="od-button-secondary px-3 py-1.5 text-sm">
              View your shop
              <ArrowUpRight size={13} aria-hidden />
            </Link>
          </nav>
        </div>
      ) : (
        <>
          {checklist.status === 'keys_rejected' && (
            <div className="mb-3 flex flex-col gap-2 rounded-xl border border-[rgba(180,35,24,0.25)] bg-[rgba(180,35,24,0.05)] p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-[var(--od-danger)]">
                Razorpay stopped accepting your keys. Reconnect to keep selling.
              </p>
              <Link href={paymentsHref} className="od-button-primary shrink-0 px-3 py-1.5 text-sm">
                Reconnect
              </Link>
            </div>
          )}
          <ol className="space-y-3">
            {checklist.steps.map((step) => {
              const action = stepAction(step, row)
              const muted = step.state === 'done' || step.state === 'skipped'
              return (
                <li key={step.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    <StepIcon state={step.state} />
                    <span className="sr-only">{STATE_LABEL[step.state]}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold ${muted ? 'text-[var(--od-muted)]' : 'text-[var(--od-ink)]'}`}>
                      {STEP_COPY[step.id].title}
                    </p>
                    <p className="text-xs leading-relaxed text-[var(--od-muted)]">{STEP_COPY[step.id].hint}</p>
                  </div>
                  {action && (
                    <Link href={action.href} className="od-button-primary shrink-0 px-3 py-1.5 text-xs">
                      {action.label}
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}

export default function SellOnlineCard({ rows }: { rows: SellOnlineRow[] }) {
  if (rows.length === 0) return null

  return (
    <section className="od-card mb-4 p-5 sm:p-6" aria-labelledby="sell-online-heading">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-soft)]">
          <ShoppingBag size={18} className="text-[var(--od-brand)]" aria-hidden />
        </span>
        <div>
          <h2 id="sell-online-heading" className="text-lg font-bold text-[var(--od-ink)]">
            Sell online
          </h2>
          <p className="text-xs text-[var(--od-muted)]">Take payments straight into your own Razorpay account.</p>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <ListingSelling key={row.listingId} row={row} showName={rows.length > 1} />
        ))}
      </div>
    </section>
  )
}
