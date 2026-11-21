import Link from 'next/link'
import { ArrowRight, Circle } from 'lucide-react'

import type { Completeness } from '@/lib/listing-completeness'

/** Missing steps shown at once; the rest follow as these are done. */
const SHOWN = 3

/** The "finish setting up" strip under each listing on My Business. */
export default function ListingSetupChecklist({ completeness }: { completeness: Completeness }) {
  if (completeness.missing.length === 0) return null

  const done = completeness.steps.length - completeness.missing.length
  return (
    <div className="rounded-xl border border-[var(--od-border)] bg-[var(--od-surface-soft)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-[var(--od-ink)]">
          Finish your listing · {done} of {completeness.steps.length} done
        </p>
        <span className="text-xs font-semibold text-[var(--od-muted)]">{completeness.percent}%</span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-white"
        role="progressbar"
        aria-label="Listing setup"
        aria-valuenow={completeness.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-[var(--od-brand)]" style={{ width: `${completeness.percent}%` }} />
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {completeness.missing.slice(0, SHOWN).map((step) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className="group flex items-start gap-2 rounded-lg px-1 py-1 text-xs hover:bg-white"
            >
              <Circle size={14} className="mt-px shrink-0 text-[var(--od-muted)]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-[var(--od-ink)]">{step.label}</span>
                <span className="text-[var(--od-muted)]"> · {step.why}</span>
              </span>
              <ArrowRight size={13} className="mt-px shrink-0 text-[var(--od-brand)]" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {completeness.missing.length > SHOWN && (
        <p className="mt-1.5 px-1 text-[11px] text-[var(--od-muted)]">
          +{completeness.missing.length - SHOWN} more after these
        </p>
      )}
    </div>
  )
}
