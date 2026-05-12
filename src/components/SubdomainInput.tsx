'use client'

import { useState, useRef } from 'react'
import { CheckCircle, XCircle, Loader2, Globe } from 'lucide-react'

type Status = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved'

export default function SubdomainInput() {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resultCacheRef = useRef(new Map<string, Status>())

  const validate = (v: string) => /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(v)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setValue(raw)
    setStatus('idle')

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!raw) return

    if (!validate(raw)) {
      setStatus('invalid')
      return
    }

    const cached = resultCacheRef.current.get(raw)
    if (cached) {
      setStatus(cached)
      return
    }

    debounceRef.current = setTimeout(() => check(raw), 900)
  }

  const check = async (slug: string) => {
    if (!slug || !validate(slug)) return
    setStatus('checking')
    try {
      const res = await fetch(`/api/check-subdomain?s=${encodeURIComponent(slug)}`)
      const data = await res.json()
      const nextStatus =
        data.reason === 'invalid'
          ? 'invalid'
          : data.reason === 'reserved'
            ? 'reserved'
            : data.available
              ? 'available'
              : 'taken'
      resultCacheRef.current.set(slug, nextStatus)
      setStatus(nextStatus)
    } catch {
      setStatus('idle')
    }
  }

  const statusUI: Record<Status, { icon: React.ReactNode; text: string; color: string } | null> = {
    idle: null,
    checking: { icon: <Loader2 size={13} className="animate-spin" />, text: 'Checking...', color: 'text-gray-400' },
    available: { icon: <CheckCircle size={13} />, text: `${value}.ourdahanu.in is available!`, color: 'text-green-600' },
    taken: { icon: <XCircle size={13} />, text: 'Already taken. Try another.', color: 'text-red-500' },
    invalid: { icon: <XCircle size={13} />, text: 'Use 3-30 lowercase letters, numbers, or hyphens.', color: 'text-red-500' },
    reserved: { icon: <XCircle size={13} />, text: 'This name is reserved.', color: 'text-red-500' },
  }

  const borderColor =
    status === 'available' ? 'border-green-400 focus-within:border-green-500' :
    status === 'taken' || status === 'invalid' || status === 'reserved' ? 'border-red-400 focus-within:border-red-500' :
    'border-gray-200 focus-within:border-brand'

  const info = statusUI[status]

  return (
    <div>
      <label htmlFor="subdomain" className="block text-sm font-semibold text-gray-700 mb-1.5">
        Claim Your Subdomain <span className="text-red-500">*</span>
      </label>

      <div className={`flex items-center border rounded-xl overflow-hidden transition-colors ${borderColor}`}>
        <div className="px-3 py-3 bg-gray-50 border-r border-gray-200 flex-shrink-0">
          <Globe size={15} className="text-gray-400" />
        </div>
        <input
          type="text"
          id="subdomain"
          name="subdomain"
          required
          value={value}
          onChange={handleChange}
          placeholder="yourname"
          minLength={3}
          maxLength={30}
          pattern="[a-z0-9][a-z0-9-]{1,28}[a-z0-9]"
          title="Use 3-30 lowercase letters, numbers, or hyphens."
          autoComplete="off"
          className="flex-1 px-3 py-3 focus:outline-none text-sm bg-white"
        />
        <span className="px-3 py-3 bg-gray-50 text-gray-400 text-sm border-l border-gray-200 whitespace-nowrap flex-shrink-0">
          .ourdahanu.in
        </span>
        <button
          type="button"
          onClick={() => value && validate(value) && check(value)}
          disabled={!value || status === 'checking'}
          className="px-3 py-3 bg-brand text-bg text-xs font-semibold hover:bg-brand-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
        >
          Check
        </button>
      </div>

      {info ? (
        <p className={`flex items-center gap-1.5 text-xs mt-1.5 ${info.color}`}>
          {info.icon}
          {info.text}
        </p>
      ) : (
        <p className="text-xs text-gray-400 mt-1.5">
          Required. Lowercase letters, numbers, and hyphens only. 3-30 characters.
        </p>
      )}
    </div>
  )
}

