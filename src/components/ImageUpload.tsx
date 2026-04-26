'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Upload, X, Loader2 } from 'lucide-react'

interface ImageUploadProps {
  bucket: string
  onUpload: (url: string, thumbUrl: string | null) => void
  label?: string
  thumbMaxEdge?: number
}

const FULL_MAX_EDGE = 1920
const FULL_QUALITY = 0.85
const THUMB_QUALITY = 0.78

function loadHTMLImage(file: File): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => resolve({ img, revoke: () => URL.revokeObjectURL(objectUrl) })
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not load image'))
    }
    img.src = objectUrl
  })
}

function fitWithinEdge(width: number, height: number, maxEdge: number) {
  if (width <= maxEdge && height <= maxEdge) return { width, height }
  if (width >= height) {
    return { width: maxEdge, height: Math.round((height * maxEdge) / width) }
  }
  return { width: Math.round((width * maxEdge) / height), height: maxEdge }
}

function drawToBlob(
  img: HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Canvas not available'))
      return
    }
    ctx.drawImage(img, 0, 0, width, height)
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
      'image/jpeg',
      quality,
    )
  })
}

export default function ImageUpload({
  bucket,
  onUpload,
  label = 'Upload Image',
  thumbMaxEdge = 240,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setUploading(true)

    try {
      const { img, revoke } = await loadHTMLImage(file)
      try {
        const fullSize = fitWithinEdge(img.naturalWidth, img.naturalHeight, FULL_MAX_EDGE)
        const thumbSize = fitWithinEdge(img.naturalWidth, img.naturalHeight, thumbMaxEdge)

        const [fullBlob, thumbBlob] = await Promise.all([
          drawToBlob(img, fullSize.width, fullSize.height, FULL_QUALITY),
          drawToBlob(img, thumbSize.width, thumbSize.height, THUMB_QUALITY),
        ])

        const supabase = createClient()
        const baseName = file.name.replace(/\.[^.]+$/, '')
        const stamp = Date.now()
        const fullPath = `public/${stamp}-${baseName}.jpg`
        const thumbPath = `public/${stamp}-${baseName}-thumb.jpg`

        const [fullRes, thumbRes] = await Promise.all([
          supabase.storage
            .from(bucket)
            .upload(fullPath, fullBlob, { upsert: true, contentType: 'image/jpeg' }),
          supabase.storage
            .from(bucket)
            .upload(thumbPath, thumbBlob, { upsert: true, contentType: 'image/jpeg' }),
        ])

        if (fullRes.error) throw fullRes.error

        const { data: fullData } = supabase.storage.from(bucket).getPublicUrl(fullPath)
        const thumbUrl = thumbRes.error
          ? null
          : supabase.storage.from(bucket).getPublicUrl(thumbPath).data.publicUrl

        onUpload(fullData.publicUrl, thumbUrl)
      } finally {
        revoke()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const clearPreview = () => {
    setPreview(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      )}

      {preview ? (
        <div className="relative rounded-2xl overflow-hidden border-2 border-green-300 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview"
            className="w-full max-h-64 object-cover"
          />
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="bg-white rounded-2xl px-5 py-3 flex items-center gap-3 shadow-lg">
                <Loader2 size={18} className="animate-spin text-green-600" />
                <span className="text-sm font-medium text-gray-700">Uploading…</span>
              </div>
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              onClick={clearPreview}
              className="absolute top-2 right-2 bg-white/90 hover:bg-white text-red-600 rounded-full p-1.5 shadow transition-colors"
              aria-label="Remove image"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 hover:border-green-400 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-gray-50 hover:bg-green-50"
        >
          <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
            {uploading ? (
              <Loader2 size={24} className="animate-spin text-green-600" />
            ) : (
              <Camera size={24} className="text-green-600" />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700 flex items-center justify-center gap-1.5">
              <Upload size={14} className="text-green-600" />
              Click or drag &amp; drop to upload
            </p>
            <p className="text-xs text-gray-400 mt-1">Images only · Auto-compressed on upload</p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />

      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
          <X size={14} />
          {error}
        </p>
      )}
    </div>
  )
}
