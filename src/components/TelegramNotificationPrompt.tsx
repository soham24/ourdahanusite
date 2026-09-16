'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import { createTelegramLinkToken } from '@/app/actions/notifications'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { floatingPanelBottomClasses } from '@/lib/mobile-layout'

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

export default function TelegramNotificationPrompt() {
  const { user, loading } = useAuth()
  if (loading || !user) return null
  return <AccountPrompt key={user.id} userId={user.id} />
}

function AccountPrompt({ userId }: { userId: string }) {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const dismissed = useRef(false)
  const mounted = useRef(true)
  const storageKey = `ourdahanu:telegram-prompt:${userId}`

  useEffect(() => {
    mounted.current = true
    let active = true
    let checking = false
    const check = async () => {
      if (checking || dismissed.current || document.visibilityState === 'hidden') return
      try {
        const until = Number(window.localStorage.getItem(storageKey))
        if (Number.isFinite(until) && until > Date.now()) {
          if (active) setVisible(false)
          return
        }
      } catch {
        // Dismissal still works for this visit when browser storage is unavailable.
      }
      checking = true
      try {
        const { data, error: queryError } = await createClient()
          .from('notification_preferences')
          .select('telegram_chat_id')
          .eq('user_id', userId)
          .maybeSingle()
        // A failed lookup is not evidence that the account is disconnected.
        if (active && !dismissed.current && !queryError) setVisible(!data?.telegram_chat_id)
      } catch {
        // Leave the prompt unchanged on temporary network failures.
      } finally {
        checking = false
      }
    }
    const initial = window.setTimeout(() => void check(), 3000)
    const interval = window.setInterval(() => void check(), 15000)
    const refresh = () => void check()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      active = false
      mounted.current = false
      window.clearTimeout(initial)
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [storageKey, userId])

  const dismiss = () => {
    dismissed.current = true
    setVisible(false)
    try {
      window.localStorage.setItem(storageKey, String(Date.now() + SNOOZE_MS))
    } catch {
      // Keep the in-memory dismissal even if storage is blocked.
    }
  }

  const connect = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await createTelegramLinkToken()
      if (!mounted.current || dismissed.current) return
      if (result.error || !result.deeplink) {
        setError(result.error ?? 'Could not connect. Please try again.')
        return
      }
      setLink(result.deeplink)
      // Same-tab navigation avoids popup blockers after the asynchronous action.
      window.location.assign(result.deeplink)
    } catch {
      if (mounted.current) setError('Could not connect. Please try again.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  if (!visible) return null

  return (
    <aside
      aria-labelledby="telegram-prompt-title"
      className={`fixed left-4 right-4 z-50 rounded-2xl border border-border bg-white p-5 shadow-xl sm:left-auto sm:right-6 sm:w-96 ${floatingPanelBottomClasses()}`}
    >
      <button type="button" aria-label="Dismiss Telegram reminder for seven days" onClick={dismiss} className="absolute right-2 top-2 rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand">
        <X size={18} />
      </button>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Send size={21} aria-hidden="true" /></div>
      <h2 id="telegram-prompt-title" className="pr-5 text-lg font-semibold text-gray-900">Get updates instantly on Telegram</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">Receive alerts about business reviews, owner replies, payments, and orders, right in Telegram.</p>
      <p className="mt-2 text-xs text-gray-500">Tap Connect Telegram, then press Start. No details to enter.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {link && <a href={link} className="mt-3 block text-sm font-semibold text-sky-700 underline">Open Telegram and press Start</a>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void connect()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          {busy ? 'Connecting…' : 'Connect Telegram'}
        </button>
        <button type="button" onClick={dismiss} className="rounded-lg px-2 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Maybe later</button>
      </div>
    </aside>
  )
}
