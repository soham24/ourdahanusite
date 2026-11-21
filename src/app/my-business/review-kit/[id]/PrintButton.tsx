'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="od-button-primary inline-flex min-h-10 items-center gap-1.5 px-4 text-sm"
    >
      <Printer size={15} aria-hidden /> Print card
    </button>
  )
}
