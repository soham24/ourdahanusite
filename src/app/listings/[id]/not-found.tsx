import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { buildAbsoluteUrl } from '@/lib/site'

// Rendered by notFound() in page.tsx, so a missing listing answers 404. It
// used to render this same message with status 200 -- and since every
// subdomain's `/` is rewritten to a listing, anything.ourdahanu.in was an
// indexable page.
export default function ListingNotFound() {
  return (
    <div className="od-page min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          href={buildAbsoluteUrl('/listings')}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--od-muted)] hover:text-brand mb-6 transition-colors"
        >
          <ArrowLeft size={15} /> Back to Listings
        </Link>
        <EmptyState
          icon="🏪"
          title="Listing not found"
          description="This business listing may have been removed or the link is incorrect."
          action={
            <Button href={buildAbsoluteUrl('/listings')} variant="primary" size="md">
              Browse all listings
            </Button>
          }
        />
      </div>
    </div>
  )
}
