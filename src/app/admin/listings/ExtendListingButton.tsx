'use client'

import { useState } from 'react'
import { CalendarPlus, Loader2, CheckCircle } from 'lucide-react'
import { adminExtendListing } from '@/app/actions/admin-listings'

export default function ExtendListingButton({ id, name }: { id: string; name: string }) {
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const [error,   setError]   = useState('')

  const handleExtend = async () => {
    if (!confirm(`Extend "${name}" by 1 year and re-activate it?`)) return
    setLoading(true)
    setError('')
    const result = await adminExtendListing(id)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-3 py-2 rounded-lg">
        <CheckCircle size={13} /> Extended
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={handleExtend}
        disabled={loading}
        title="Extend listing by 1 year and re-activate"
        className="inline-flex items-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors border border-purple-100 disabled:opacity-60"
      >
        {loading
          ? <Loader2 size={13} className="animate-spin" />
          : <CalendarPlus size={13} />}
        Extend 1yr
      </button>
      {error && (
        <span className="text-red-500 text-[10px] max-w-[120px] text-right">{error}</span>
      )}
    </div>
  )
}
