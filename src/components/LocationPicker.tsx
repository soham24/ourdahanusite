'use client'

import { useState } from 'react'
import { MapPin, X, CheckCircle } from 'lucide-react'

interface LocationPickerProps {
  defaultMapUrl?: string | null
  // legacy props — ignored now
  defaultLat?: number | null
  defaultLng?: number | null
}

export default function LocationPicker({ defaultMapUrl }: LocationPickerProps) {
  const [url, setUrl] = useState(defaultMapUrl || '')

  const clear = () => setUrl('')
  const isSet = url.trim().length > 0

  return (
    <div className="space-y-2">
      {isSet ? (
        <div className="border border-green-200 bg-green-50 rounded-xl p-3 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <CheckCircle size={15} className="text-green-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-green-700">Location set</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-medium mt-0.5 truncate max-w-xs block"
              >
                <MapPin size={10} className="flex-shrink-0" /> Preview on Google Maps ↗
              </a>
            </div>
          </div>
          <button type="button" onClick={clear} aria-label="Clear location" className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
            <X size={15} />
          </button>
        </div>
      ) : (
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="Paste Google Maps link (place, share link, etc.)…"
          aria-label="Google Maps link"
          className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-white focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 placeholder-gray-400"
          autoComplete="off"
        />
      )}

      <p className="text-xs text-gray-400">
        Google Maps → find your location → Share → Copy link → paste above.
      </p>

      <input type="hidden" name="map_url" value={url} />
    </div>
  )
}

