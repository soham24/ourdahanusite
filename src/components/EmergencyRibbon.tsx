import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

import { getActiveEmergencyAlert } from '@/lib/data/emergency'
import { buildAbsoluteUrl } from '@/lib/site'
import { siteConfig } from '@/lib/site'

// Static (non-fixed) ribbon — sits above the sticky navbar and scrolls off the top.
const RIBBON_BASE_CLASS = 'w-full text-center text-xs font-semibold tracking-wide px-4 py-2'
const RIBBON_CONTENT_CLASS = 'mx-auto flex max-w-7xl items-center justify-center gap-2'

export function EmergencyRibbonFallback() {
  return (
    <div className={`${RIBBON_BASE_CLASS} bg-red-900 text-red-100`}>
      <div className={RIBBON_CONTENT_CLASS}>
        <span aria-hidden>🚨</span>
        <span>Emergency in {siteConfig.town}?</span>
        <Link
          href={buildAbsoluteUrl('/emergency')}
          className="text-red-300 border-b border-red-300/40 hover:text-red-100 hover:border-red-100/60 transition-colors"
        >
          View emergency contacts →
        </Link>
      </div>
    </div>
  )
}

export default async function EmergencyRibbon() {
  const topAlert = await getActiveEmergencyAlert()

  if (topAlert && (topAlert.severity === 'critical' || topAlert.severity === 'warning')) {
    const bgClass =
      topAlert.severity === 'critical' ? 'bg-red-900 text-red-100' : 'bg-amber-700 text-amber-50'
    const linkClass =
      topAlert.severity === 'critical'
        ? 'text-red-300 border-b border-red-300/40 hover:text-red-100 hover:border-red-100/60'
        : 'text-amber-100 border-b border-amber-100/40 hover:text-white hover:border-white/60'

    return (
      <div className={`${RIBBON_BASE_CLASS} ${bgClass}`}>
        <div className={RIBBON_CONTENT_CLASS}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          <ShieldAlert size={12} />
          <span className="truncate font-bold">{topAlert.title}</span>
          <Link href={buildAbsoluteUrl('/emergency')} className={`transition-colors ${linkClass}`}>
            View details →
          </Link>
        </div>
      </div>
    )
  }

  if (topAlert && topAlert.severity === 'info') {
    return (
      <div className={`${RIBBON_BASE_CLASS} bg-blue-700 text-blue-50`}>
        <div className={RIBBON_CONTENT_CLASS}>
          <ShieldAlert size={12} />
          <span className="truncate">{topAlert.title}</span>
          <Link
            href={buildAbsoluteUrl('/emergency')}
            className="text-blue-200 border-b border-blue-200/40 hover:text-white hover:border-white/60 transition-colors"
          >
            View details →
          </Link>
        </div>
      </div>
    )
  }

  return <EmergencyRibbonFallback />
}
