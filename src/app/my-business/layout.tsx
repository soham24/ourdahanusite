import type { Metadata } from 'next'

export const unstable_instant = false

// Signed-in workspace: never in search results, even if a URL leaks.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function MyBusinessLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
