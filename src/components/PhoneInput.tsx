'use client'

import { useState } from 'react'

interface PhoneInputProps {
  name: string
  defaultValue?: string | null
  required?: boolean
  placeholder?: string
}

function extractDigits(val: string): string {
  const digits = val.replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length === 12) return digits.slice(2)
  return digits.slice(0, 10)
}

export default function PhoneInput({ name, defaultValue, required, placeholder }: PhoneInputProps) {
  const [digits, setDigits] = useState(defaultValue ? extractDigits(defaultValue) : '')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10)
    setDigits(val)
  }

  const invalid = digits.length > 0 && digits.length < 10

  return (
    <div>
      <div className={`flex items-center border rounded-xl overflow-hidden focus-within:border-brand transition-colors ${invalid ? 'border-red-300' : 'border-gray-200'}`}>
        <span className="px-3 text-sm font-semibold text-gray-500 bg-gray-50 border-r border-gray-200 py-3 select-none flex-shrink-0">
          +91
        </span>
        <input
          type="tel"
          value={digits}
          onChange={handleChange}
          placeholder={placeholder || '98765 43210'}
          maxLength={10}
          inputMode="numeric"
          className="flex-1 px-4 py-3 focus:outline-none text-sm bg-white"
        />
      </div>
      {/* Hidden input carries the full value (91 + 10 digits) */}
      <input
        type="hidden"
        name={name}
        value={digits.length === 10 ? `91${digits}` : ''}
        required={required}
      />
      {invalid && (
        <p className="text-xs text-red-500 mt-1">Enter full 10-digit mobile number</p>
      )}
    </div>
  )
}

