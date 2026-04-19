'use client'

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

type SafeAppLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  children: ReactNode
  forceDocumentOnHome?: boolean
  prefetch?: boolean | null
}

export default function SafeAppLink({
  href,
  children,
  forceDocumentOnHome = true,
  onClick,
  ...props
}: SafeAppLinkProps) {
  const router = useRouter()
  const { prefetch, ...anchorProps } = props
  void prefetch

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      anchorProps.target === '_blank' ||
      anchorProps.download
    ) {
      return
    }

    if (!forceDocumentOnHome || window.location.pathname !== '/') {
      event.preventDefault()
      router.push(href)
    }
  }

  return (
    <a href={href} onClick={handleClick} {...anchorProps}>
      {children}
    </a>
  )
}
