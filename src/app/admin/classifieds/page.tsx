import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Package, Trash2, ArrowLeft } from 'lucide-react'
import { rejectContent } from '@/app/actions/admin'

function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const hours = Math.floor((now.getTime() - date.getTime()) / 3600000)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default async function AdminClassifiedsPage() {
  let classifieds: Record<string, unknown>[] = []

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('classifieds')
      .select('id, title, type, urgent, seller_name, location, price, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(30)
    classifieds = data || []
  } catch {
    // DB error
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-brand transition-colors">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package size={22} className="text-purple-600" />
            Classifieds Moderation
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Active classifieds — remove spam or inappropriate listings</p>
        </div>
      </div>

      {classifieds.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-3">📦</div>
          <p className="text-gray-500 text-sm">No active classifieds found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {classifieds.map(ad => (
            <div key={ad.id as string} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{String(ad.type)}</span>
                  {ad.urgent ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Urgent</span> : null}
                  <span className="text-xs text-gray-400">{timeAgo(String(ad.created_at))}</span>
                </div>
                <Link href={`/classifieds/${String(ad.id)}`} className="font-semibold text-gray-900 hover:text-brand text-sm transition-colors">
                  {String(ad.title)}
                </Link>
                <p className="text-xs text-gray-400 mt-0.5">
                  by {String(ad.seller_name)}
                  {ad.location ? ` · ${ad.location as string}` : ''}
                  {ad.price !== null && ad.price !== undefined ? ` · ₹${(ad.price as number).toLocaleString()}` : ''}
                </p>
              </div>
              <form action={rejectContent}>
                <input type="hidden" name="table" value="classifieds" />
                <input type="hidden" name="id" value={ad.id as string} />
                <button type="submit" className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-xs font-medium px-3 py-2 rounded-xl hover:bg-red-50 transition-colors border border-red-100">
                  <Trash2 size={13} /> Remove
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
