import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

import { getActiveEmergencyAlert } from '@/lib/data/emergency'
import { buildAbsoluteUrl } from '@/lib/site'

const RIBBON_BASE_CLASS =
  'fixed top-0 left-0 right-0 z-[60] h-8 px-3 text-white text-xs font-medium'
const RIBBON_CONTENT_CLASS = 'mx-auto flex h-full max-w-7xl items-center justify-center gap-2 text-center'

export function EmergencyRibbonFallback() {
  return (
    <div className={`${RIBBON_BASE_CLASS} bg-warli-terra text-warli-cream`}>
      <div className={RIBBON_CONTENT_CLASS}>
        <ShieldAlert size={12} />
        <span>Emergency?</span>
        <Link
          href={buildAbsoluteUrl('/emergency')}
          className="underline font-bold hover:text-warli-sand transition-colors"
        >
          View Emergency Contacts
        </Link>
      </div>
    </div>
  )
}

export default async function EmergencyRibbon() {
  const topAlert = await getActiveEmergencyAlert()

  if (topAlert && (topAlert.severity === 'critical' || topAlert.severity === 'warning')) {
    const bgClass = topAlert.severity === 'critical' ? 'bg-red-700' : 'bg-amber-600'

    return (
      <div className={`${RIBBON_BASE_CLASS} ${bgClass}`}>
        <div className={RIBBON_CONTENT_CLASS}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          <ShieldAlert size={12} />
          <span className="truncate font-bold">{topAlert.title}</span>
          <Link href={buildAbsoluteUrl('/emergency')} className="underline hover:opacity-80 transition-opacity">
            View Details
          </Link>
        </div>
      </div>
    )
  }

  if (topAlert && topAlert.severity === 'info') {
    return (
      <div className={`${RIBBON_BASE_CLASS} bg-blue-600`}>
        <div className={RIBBON_CONTENT_CLASS}>
          <ShieldAlert size={12} />
          <span className="truncate">{topAlert.title}</span>
          <Link href={buildAbsoluteUrl('/emergency')} className="underline hover:opacity-80 transition-opacity">
            View Details
          </Link>
        </div>
      </div>
    )
  }

  return <EmergencyRibbonFallback />
}
