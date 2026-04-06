import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { MessageCircle, Trash2, ArrowLeft } from 'lucide-react'
import { rejectContent } from '@/app/actions/admin'

function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const hours = Math.floor((now.getTime() - date.getTime()) / 3600000)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default async function AdminForumPage() {
  let threads: Record<string, unknown>[] = []

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('forum_threads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)
    threads = data || []
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
            <MessageCircle size={22} className="text-teal-600" />
            Forum Moderation
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Recent threads — remove spam or inappropriate content</p>
        </div>
      </div>

      {threads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-3">💬</div>
          <p className="text-gray-500 text-sm">No forum threads found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map(thread => (
            <div key={thread.id as string} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">{thread.category as string}</span>
                  <span className="text-xs text-gray-400">{timeAgo(thread.created_at as string)}</span>
                </div>
                <Link href={`/forum/${thread.id as string}`} className="font-semibold text-gray-900 hover:text-warli-terra text-sm transition-colors">
                  {thread.title as string}
                </Link>
                <p className="text-xs text-gray-400 mt-0.5">
                  by {thread.author_name as string} · {(thread.reply_count as number) || 0} replies
                </p>
              </div>
              <form action={rejectContent}>
                <input type="hidden" name="table" value="forum_threads" />
                <input type="hidden" name="id" value={thread.id as string} />
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
