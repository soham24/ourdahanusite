'use client'

import { useState } from 'react'
import { Check, Link2 } from 'lucide-react'

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (an old browser or an insecure page): the link is
      // printed above, so the owner can still select it.
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <button type="button" onClick={copy} className="od-button-secondary inline-flex min-h-10 items-center gap-1.5 px-4 text-sm">
      {copied ? <Check size={15} aria-hidden /> : <Link2 size={15} aria-hidden />}
      <span aria-live="polite">{copied ? 'Copied' : 'Copy link'}</span>
    </button>
  )
}
