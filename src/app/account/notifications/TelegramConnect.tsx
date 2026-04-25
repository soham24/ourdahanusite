'use client'

import { useState, useTransition } from 'react'
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Send,
  Unplug,
} from 'lucide-react'

import {
  createTelegramLinkToken,
  disconnectTelegram,
} from '@/app/actions/notifications'

interface TelegramConnectProps {
  connected: boolean
  verifiedAt: string | null
}

interface ActiveLink {
  deeplink: string
  botUsername: string
  expiresAt: string
}

function formatExpiry(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  const minutes = Math.max(1, Math.round(ms / 60000))
  return `in ${minutes} minute${minutes === 1 ? '' : 's'}`
}

function formatConnectedAt(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return null
  }
}

export default function TelegramConnect({
  connected,
  verifiedAt,
}: TelegramConnectProps) {
  const [link, setLink] = useState<ActiveLink | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [creating, startCreate] = useTransition()
  const [disconnecting, startDisconnect] = useTransition()

  const verifiedLabel = formatConnectedAt(verifiedAt)

  const handleCreateLink = () => {
    setError(null)
    setSuccessMessage(null)
    setLink(null)
    startCreate(async () => {
      const result = await createTelegramLinkToken()
      if (result.error || !result.deeplink || !result.botUsername || !result.expiresAt) {
        setError(result.error ?? 'Could not create a link token. Try again.')
        return
      }
      setLink({
        deeplink: result.deeplink,
        botUsername: result.botUsername,
        expiresAt: result.expiresAt,
      })
      try {
        window.open(result.deeplink, '_blank', 'noopener,noreferrer')
      } catch {
        // popup blocker — the user can still use the copy/open button below
      }
    })
  }

  const handleCopy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.deeplink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('Could not copy. Select and copy the link manually.')
    }
  }

  const handleDisconnect = () => {
    if (!confirm('Disconnect Telegram? You will stop receiving Telegram pings.')) return
    setError(null)
    setSuccessMessage(null)
    startDisconnect(async () => {
      const result = await disconnectTelegram()
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccessMessage('Telegram disconnected. Refresh to update the status.')
      setLink(null)
    })
  }

  if (connected) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-800">Telegram connected</p>
            {verifiedLabel && (
              <p className="text-xs text-emerald-700/80 mt-0.5">Linked on {verifiedLabel}</p>
            )}
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {successMessage && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {successMessage}
          </p>
        )}

        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="inline-flex items-center gap-2 border border-red-200 text-red-700 bg-white hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
        >
          {disconnecting ? <Loader2 size={14} className="animate-spin" /> : <Unplug size={14} />}
          Disconnect Telegram
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ol className="text-sm text-gray-600 space-y-1 list-decimal pl-5">
        <li>Click the button below to open Telegram with a one-time link.</li>
        <li>
          In Telegram, press <span className="font-semibold">Start</span> to let our bot know which
          account to send pings to.
        </li>
        <li>Come back here and refresh once you see the welcome message.</li>
      </ol>

      <button
        type="button"
        onClick={handleCreateLink}
        disabled={creating}
        className="inline-flex items-center gap-2 bg-[#229ED9] hover:bg-[#1b84b5] text-white px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
      >
        {creating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        Connect Telegram
      </button>

      {link && (
        <div className="rounded-xl border border-border/60 bg-surface-soft/40 p-4 space-y-3">
          <p className="text-sm text-gray-700">
            Link valid {formatExpiry(link.expiresAt)}. If Telegram did not open automatically, use
            the link below.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={link.deeplink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white border border-border text-ink-2 hover:border-brand hover:text-brand px-3 py-2 rounded-lg text-sm font-semibold"
            >
              <ExternalLink size={14} />
              Open t.me/{link.botUsername}
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-2 bg-white border border-border text-ink-2 hover:border-brand hover:text-brand px-3 py-2 rounded-lg text-sm font-semibold"
            >
              <Copy size={14} />
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
          <p className="text-[11px] text-gray-500 break-all">{link.deeplink}</p>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {successMessage && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </p>
      )}
    </div>
  )
}

