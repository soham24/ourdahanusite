import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Calendar, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'
import { approveContent, rejectContent } from '@/app/actions/admin'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function AdminEventsPage() {
  let events: Record<string, unknown>[] = []

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('approved', false)
      .order('created_at', { ascending: false })
    events = data || []
  } catch {
    // DB error
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-warli-terra transition-colors">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={22} className="text-orange-500" />
            Pending Events
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{events.length} event{events.length !== 1 ? 's' : ''} awaiting review</p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">All caught up!</h2>
          <p className="text-gray-500 text-sm">No events are pending approval at the moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(event => (
            <div key={event.id as string} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full">
                      Pending Review
                    </span>
                    {event.category ? (
                      <span className="text-xs text-gray-500">{String(event.category)}</span>
                    ) : null}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">{String(event.title)}</h3>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {event.date ? <span>Date: {String(event.date)}</span> : null}
                    {event.location ? <span>Location: {String(event.location)}</span> : null}
                    {event.is_free !== undefined ? (
                      <span>{event.is_free ? 'Free' : `₹${event.price}`}</span>
                    ) : null}
                    <span>Submitted: {formatDate(String(event.created_at))}</span>
                  </div>
                  {event.description ? (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{String(event.description)}</p>
                  ) : null}
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <form action={approveContent}>
                    <input type="hidden" name="table" value="events" />
                    <input type="hidden" name="id" value={event.id as string} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 bg-warli-terra hover:bg-warli-deep text-warli-cream font-semibold px-4 py-2 rounded-xl transition-colors text-sm"
                    >
                      <CheckCircle size={14} />
                      Approve
                    </button>
                  </form>

                  <form action={rejectContent}>
                    <input type="hidden" name="table" value="events" />
                    <input type="hidden" name="id" value={event.id as string} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-semibold px-4 py-2 rounded-xl transition-colors text-sm border border-red-200"
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
