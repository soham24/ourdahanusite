'use client'

import { sendGAEvent } from '@next/third-parties/google'

/**
 * Anchor that reports Call / WhatsApp taps to GA4 before the navigation —
 * the one event that proves the directory's value ("this professional got
 * N calls from OurDahanu"). No-ops silently when GA isn't loaded (local
 * dev / preview, where NEXT_PUBLIC_GA_ID is unset).
 */
export default function TrackedContactLink({
  href,
  method,
  professionalId,
  professionalName,
  className,
  children,
  ...rest
}: {
  href: string
  method: 'call' | 'whatsapp'
  professionalId: string
  professionalName: string
  className?: string
  children: React.ReactNode
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children'>) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        if (typeof window !== 'undefined' && Array.isArray((window as { dataLayer?: unknown[] }).dataLayer)) {
          sendGAEvent('event', 'find_contact', {
            method,
            professional_id: professionalId,
            professional_name: professionalName,
          })
        }
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
