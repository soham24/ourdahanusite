import Link from 'next/link'
import { Search } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Find — Trusted Local Professionals in Dahanu',
  description:
    'Find rated local professionals in Dahanu — electricians, plumbers, doctors, tutors and more. Real ratings from real customers.',
}

export default function FindLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/find" className="flex items-center gap-2 font-bold text-lg">
            <Search size={20} className="text-[var(--od-brand,#c0582e)]" />
            <span>Find<span className="text-[var(--od-brand,#c0582e)]">Dahanu</span></span>
          </Link>
          <Link
            href="/find/submit"
            className="rounded-md bg-[var(--od-brand,#c0582e)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Add a professional
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <footer className="mt-12 border-t border-gray-200 py-6 text-center text-xs text-gray-500">
        FindDahanu · part of OurDahanu · ratings are moderated before they appear
      </footer>
    </div>
  )
}
