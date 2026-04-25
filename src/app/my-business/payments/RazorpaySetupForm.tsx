'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, Eye, EyeOff, Loader2, Save, Trash2 } from 'lucide-react'

import { deleteRazorpayConfig, saveRazorpayConfig } from '@/app/actions/listing-payments'

type Existing = {
  keyId: string
  keyLast4: string
  testMode: boolean
  verifiedAt: string | null
}

export function RazorpaySetupForm({
  listingId,
  existing,
}: {
  listingId: string
  existing: Existing | null
}) {
  const [keyId, setKeyId] = useState(existing?.keyId ?? '')
  const [keySecret, setKeySecret] = useState('')
  const [testMode, setTestMode] = useState(existing?.testMode ?? true)
  const [showSecret, setShowSecret] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, startSubmit] = useTransition()
  const [isDeleting, startDelete] = useTransition()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!keyId.trim()) {
      setError('Key ID is required.')
      return
    }
    if (!keySecret.trim()) {
      setError('Key Secret is required. Enter it again even if you have saved it before.')
      return
    }

    const formData = new FormData()
    formData.set('listing_id', listingId)
    formData.set('razorpay_key_id', keyId.trim())
    formData.set('razorpay_key_secret', keySecret.trim())
    if (testMode) formData.set('test_mode', 'on')

    startSubmit(async () => {
      const result = await saveRazorpayConfig(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccessMessage('Saved and verified with Razorpay. You can now list products and services.')
      setKeySecret('')
    })
  }

  const handleDelete = () => {
    if (!confirm('Remove Razorpay keys for this listing? Customers will stop being able to pay.')) {
      return
    }
    setError(null)
    setSuccessMessage(null)
    startDelete(async () => {
      const result = await deleteRazorpayConfig(listingId)
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccessMessage('Razorpay keys removed.')
      setKeyId('')
      setKeySecret('')
    })
  }

  const isPending = isSubmitting || isDeleting

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">
            Razorpay Key ID
          </span>
          <input
            type="text"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder="rzp_test_XXXXXXXX"
            autoComplete="off"
            spellCheck={false}
            disabled={isPending}
            className="w-full rounded-xl border border-[#dfcdbd] bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-brand focus:outline-none disabled:bg-gray-50"
          />
          {existing?.keyLast4 && !keyId && (
            <p className="mt-1 text-xs text-gray-500">
              Previously saved key ends in …{existing.keyLast4}
            </p>
          )}
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9b7c69]">
            Razorpay Key Secret
          </span>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={keySecret}
              onChange={(e) => setKeySecret(e.target.value)}
              placeholder={existing ? 'Re-enter to update' : 'Paste key secret'}
              autoComplete="off"
              spellCheck={false}
              disabled={isPending}
              className="w-full rounded-xl border border-[#dfcdbd] bg-white px-4 py-2.5 pr-10 text-sm text-gray-800 focus:border-brand focus:outline-none disabled:bg-gray-50"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-brand"
              tabIndex={-1}
              aria-label={showSecret ? 'Hide secret' : 'Show secret'}
            >
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Stored encrypted (AES-256-GCM). Never shown again after save.
          </p>
        </label>
      </div>

      <label className="inline-flex items-center gap-2 rounded-xl border border-[#e9d7c8] bg-white px-3 py-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          checked={testMode}
          onChange={(e) => setTestMode(e.target.checked)}
          disabled={isPending}
          className="rounded border-gray-300 text-brand focus:ring-brand"
        />
        Using Razorpay test-mode keys (recommended while you set things up)
      </label>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle size={14} />
          {successMessage}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-brand-strong disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {existing ? 'Update keys' : 'Save & verify'}
        </button>

        {existing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-red-200 hover:text-red-600 disabled:opacity-60"
          >
            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Remove keys
          </button>
        )}
      </div>
    </form>
  )
}
