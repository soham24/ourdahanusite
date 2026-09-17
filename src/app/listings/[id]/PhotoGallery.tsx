'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export default function PhotoGallery({ photos }: { photos: string[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null)

  if (photos.length === 0) return null

  const prev = () => setLightbox(i => (i! > 0 ? i! - 1 : photos.length - 1))
  const next = () => setLightbox(i => (i! < photos.length - 1 ? i! + 1 : 0))

  return (
    <>
      <div className={`grid gap-2 ${
        photos.length === 1 ? 'grid-cols-1' :
        photos.length === 2 ? 'grid-cols-2' :
        photos.length === 3 ? 'grid-cols-3' :
        'grid-cols-2 sm:grid-cols-4'
      }`}>
        {photos.map((url, i) => (
          <button
            key={i}
            onClick={() => setLightbox(i)}
            className={`relative overflow-hidden rounded-xl bg-gray-100 ${
              photos.length > 3 && i === 0 ? 'col-span-2 row-span-2' : ''
            }`}
            style={{ aspectRatio: photos.length === 1 ? '16/9' : photos.length > 3 && i === 0 ? '1/1' : '1/1' }}
          >
            <Image
              src={url}
              alt={`Photo ${i + 1}`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 320px"
              className="object-cover hover:scale-105 transition-transform duration-300"
            />
            {photos.length > 4 && i === 3 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-bold text-lg">+{photos.length - 4}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button onClick={e => { e.stopPropagation(); prev() }}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="relative max-w-4xl max-h-[85vh] w-full h-full" onClick={e => e.stopPropagation()}>
            <Image src={photos[lightbox]} alt={`Photo ${lightbox + 1}`} fill sizes="100vw" className="object-contain" />
          </div>
          <button onClick={e => { e.stopPropagation(); next() }}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full transition-colors">
            <ChevronRight size={24} />
          </button>
          <button onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {lightbox + 1} / {photos.length}
          </div>
        </div>
      )}
    </>
  )
}
