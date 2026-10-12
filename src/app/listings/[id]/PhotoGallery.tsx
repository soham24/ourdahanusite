'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export default function PhotoGallery({ photos }: { photos: string[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null)
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
  const openerRef = useRef(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const isOpen = lightbox !== null
  const count = photos.length

  useEffect(() => {
    if (!isOpen) return
    const thumbs = thumbRefs.current
    const opener = openerRef.current
    closeRef.current?.focus()

    // Listening on document, not the dialog: clicking the photo itself moves
    // focus to <body>, and the keys must keep working after that.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setLightbox(null)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setLightbox(i => (i! > 0 ? i! - 1 : count - 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setLightbox(i => (i! < count - 1 ? i! + 1 : 0))
      } else if (e.key === 'Tab') {
        const buttons = Array.from(dialogRef.current?.querySelectorAll('button') ?? [])
        if (buttons.length === 0) return
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        const active = document.activeElement
        const inside = buttons.includes(active as HTMLButtonElement)
        if (e.shiftKey && (active === first || !inside)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (active === last || !inside)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      thumbs[opener]?.focus()
    }
  }, [isOpen, count])

  if (photos.length === 0) return null

  const open = (i: number) => {
    openerRef.current = i
    setLightbox(i)
  }
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
            ref={el => { thumbRefs.current[i] = el }}
            onClick={() => open(i)}
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
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${lightbox + 1} of ${photos.length}`}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button onClick={e => { e.stopPropagation(); prev() }}
            aria-label="Previous photo"
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="relative max-w-4xl max-h-[85vh] w-full h-full" onClick={e => e.stopPropagation()}>
            <Image src={photos[lightbox]} alt={`Photo ${lightbox + 1}`} fill sizes="100vw" className="object-contain" />
          </div>
          <button onClick={e => { e.stopPropagation(); next() }}
            aria-label="Next photo"
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full transition-colors">
            <ChevronRight size={24} />
          </button>
          <button ref={closeRef} onClick={() => setLightbox(null)}
            aria-label="Close photo viewer"
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full transition-colors">
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
