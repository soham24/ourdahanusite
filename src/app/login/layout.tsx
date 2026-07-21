import type { Metadata } from 'next'

// Login is a pure auth gateway with no unique content — the `?next=` param
// varies per referring page but never changes what's on the page itself,
// which was showing up in Search Console as duplicate-without-canonical
// URLs. Mirrors the same noindex treatment already used for /search.
export const metadata: Metadata = {
  title: 'Log in',
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
