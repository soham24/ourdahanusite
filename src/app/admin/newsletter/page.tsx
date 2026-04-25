'use client'

import { useActionState, useEffect, useState } from 'react'
import { sendNewsletter } from '@/app/actions/newsletter'
import { createClient } from '@/lib/supabase/client'
import { Mail, Users, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function AdminNewsletterPage() {
  const [state, formAction, pending] = useActionState(sendNewsletter, null)
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => setSubscriberCount(count ?? 0))
  }, [])

  // Reset form on successful send
  useEffect(() => {
    if (state?.sent !== undefined) {
      setSubject('')
      setBody('')
    }
  }, [state])

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-brand text-sm font-medium mb-1">
          <Mail size={16} />
          Newsletter
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Send Newsletter</h1>
        <p className="text-gray-500 mt-1 text-sm">Compose and send an email to all subscribers.</p>
      </div>

      {/* Subscriber count card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-8 flex items-center gap-4">
        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Users size={22} className="text-brand" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {subscriberCount === null ? '—' : subscriberCount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">total subscribers</div>
        </div>
      </div>

      {/* Result messages */}
      {state?.sent !== undefined && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-900">Newsletter sent!</p>
            <p className="text-sm text-green-700 mt-0.5">
              {state.sent} of {state.total} emails delivered
              {state.failed ? ` · ${state.failed} failed` : ''}
            </p>
          </div>
        </div>
      )}
      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      {/* Compose form */}
      <form action={formAction} className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
        <div>
          <label htmlFor="subject" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Dahanu Chikoo Festival is here! 🍂"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm"
          />
        </div>

        <div>
          <label htmlFor="body" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Message <span className="text-red-500">*</span>
            <span className="text-gray-400 font-normal ml-1.5">— plain text, line breaks preserved</span>
          </label>
          <textarea
            id="body"
            name="body"
            required
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Hello neighbours!\n\nWrite your newsletter here. Keep it friendly and relevant to the Dahanu community.\n\n- Local news\n- Upcoming events\n- Seasonal highlights\n\nThanks,\nThe OurDahanu Team 🌴`}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm resize-none font-mono"
          />
        </div>

        {/* Preview */}
        {body && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Preview</p>
            <p className="text-sm font-bold text-gray-900 mb-2">{subject || '(no subject)'}</p>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{body}</div>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
          ⚠️ This will send to <strong>{subscriberCount ?? '…'} subscribers</strong>. This action cannot be undone.
        </div>

        <button
          type="submit"
          disabled={pending || !subject || !body}
          className="w-full bg-brand hover:bg-brand-strong disabled:opacity-50 disabled:cursor-not-allowed text-bg font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {pending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Sending to {subscriberCount ?? '…'} subscribers…
            </>
          ) : (
            <>
              <Send size={16} />
              Send Newsletter
            </>
          )}
        </button>
      </form>
    </div>
  )
}
