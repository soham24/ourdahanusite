'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Props {
  before: string
  after: string
}

export default function BeforeAfterToggle({ before, after }: Props) {
  const [showing, setShowing] = useState<'before' | 'after'>('after')

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setShowing('before')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
              showing === 'before' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Before
          </button>
          <button
            type="button"
            onClick={() => setShowing('after')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
              showing === 'after' ? 'bg-white text-warli-terra shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            After
          </button>
        </div>
      </div>
      <div className="relative w-full rounded-xl overflow-hidden bg-gray-100" style={{ aspectRatio: '16/9' }}>
        <Image
          src={showing === 'before' ? before : after}
          alt={showing === 'before' ? 'Before' : 'After'}
          fill
          className="object-cover transition-opacity duration-300"
        />
        <span className={`absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full ${
          showing === 'after' ? 'bg-green-500 text-white' : 'bg-gray-700 text-white'
        }`}>
          {showing === 'before' ? 'BEFORE' : 'AFTER'}
        </span>
      </div>
    </div>
  )
}
