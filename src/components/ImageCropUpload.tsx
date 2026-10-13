'use client'

import { useState, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { createClient } from '@/lib/supabase/client'
import { storageObjectPath } from '@/lib/upload-path'
import { Camera, Upload, X, Loader2, ZoomIn, ZoomOut, RotateCw, Check } from 'lucide-react'

interface Props {
  bucket?: string
  onUpload: (url: string, thumbUrl: string | null) => void
  label?: string
  size?: number   // output square size in px, default 240
  aspect?: number // default 1 (square)
}

interface CropArea { x: number; y: number; width: number; height: number }

async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: CropArea,
  rotation: number,
  outputSize: number,
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = imageSrc
  })

  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')!

  // Apply rotation around center
  const rad = (rotation * Math.PI) / 180
  ctx.translate(outputSize / 2, outputSize / 2)
  ctx.rotate(rad)
  ctx.translate(-outputSize / 2, -outputSize / 2)

  // Scale source crop area → output canvas
  const scaleX = outputSize / pixelCrop.width
  const scaleY = outputSize / pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
  )

  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/jpeg', 0.9)
  )
}

export default function ImageCropUpload({
  bucket = 'uploads',
  onUpload,
  label = 'Upload Image',
  size = 240,
  aspect = 1,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Step 1: raw source for cropper
  const [src, setSrc] = useState<string | null>(null)

  // Step 2: cropper state
  const [crop, setCrop]       = useState({ x: 0, y: 0 })
  const [zoom, setZoom]       = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedArea, setCroppedArea] = useState<CropArea | null>(null)

  // Step 3: preview after crop confirmed
  const [preview, setPreview] = useState<string | null>(null)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')

  const onCropComplete = useCallback((_: unknown, areaPixels: CropArea) => {
    setCroppedArea(areaPixels)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Images only'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = () => { setSrc(reader.result as string); setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0) }
    reader.readAsDataURL(file)
    // reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleConfirmCrop = async () => {
    if (!src || !croppedArea) return
    setError('')
    try {
      const blob = await getCroppedBlob(src, croppedArea, rotation, size)
      const objectUrl = URL.createObjectURL(blob)
      setPreview(objectUrl)
      setSrc(null)

      // Upload
      setUploading(true)
      const supabase = createClient()
      const { data: auth, error: authError } = await supabase.auth.getUser()
      // A lookup that failed is not the same as being signed out; telling
      // someone mid-edit to sign in again costs them the form.
      if (authError) throw new Error('Could not check your sign-in just now. Try again in a moment.')
      const userId = auth.user?.id
      if (!userId) throw new Error('Please sign in again before uploading.')
      const path = storageObjectPath(userId, 'cropped.jpg')
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      // Cropped output is already at thumb-friendly size (default 240×240),
      // so the same URL serves as both the full image and the thumb.
      onUpload(data.publicUrl, data.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    setSrc(null)
    setPreview(null)
    setError('')
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
  }

  // ── Render: crop modal ───────────────────────────────────────────────────
  if (src) {
    return (
      <div className="w-full">
        {label && <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>}

        <div className="border border-gray-200 rounded-2xl overflow-hidden bg-gray-900">
          {/* Cropper area */}
          <div className="relative w-full" style={{ height: 300 }}>
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{ containerStyle: { borderRadius: 0 } }}
            />
          </div>

          {/* Controls */}
          <div className="bg-gray-800 px-4 py-3 space-y-3">
            {/* Zoom */}
            <div className="flex items-center gap-3">
              <ZoomOut size={14} className="text-gray-400 flex-shrink-0" />
              <input
                type="range" min={1} max={3} step={0.05}
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                aria-label="Zoom"
                className="flex-1 accent-brand"
              />
              <ZoomIn size={14} className="text-gray-400 flex-shrink-0" />
            </div>

            {/* Rotation */}
            <div className="flex items-center gap-3">
              <RotateCw size={14} className="text-gray-400 flex-shrink-0" />
              <input
                type="range" min={-180} max={180} step={1}
                value={rotation}
                onChange={e => setRotation(Number(e.target.value))}
                aria-label="Rotation"
                className="flex-1 accent-brand"
              />
              <span className="text-xs text-gray-400 w-10 text-right">{rotation}°</span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button type="button" onClick={reset}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5">
                <X size={14} /> Cancel
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{size}×{size}px</span>
                <button type="button" onClick={handleConfirmCrop}
                  className="flex items-center gap-1.5 bg-brand hover:bg-brand-strong text-bg text-sm font-semibold px-4 py-1.5 rounded-xl transition-colors">
                  <Check size={14} /> Apply Crop
                </button>
              </div>
            </div>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  // ── Render: preview (after crop) ─────────────────────────────────────────
  if (preview) {
    return (
      <div className="w-full">
        {label && <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>}
        <div className="relative rounded-2xl overflow-hidden border-2 border-green-300 bg-gray-50 inline-block">
          <img src={preview} alt="Preview" className="w-40 h-40 object-cover rounded-2xl" />
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
              <div className="bg-white rounded-xl px-4 py-2 flex items-center gap-2 shadow">
                <Loader2 size={16} className="animate-spin text-green-600" />
                <span className="text-xs font-medium text-gray-700">Uploading…</span>
              </div>
            </div>
          )}
          {!uploading && (
            <button type="button" onClick={reset} aria-label="Remove image"
              className="absolute top-1.5 right-1.5 bg-white/90 hover:bg-white text-red-600 rounded-full p-1 shadow transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  // ── Render: upload prompt ─────────────────────────────────────────────────
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>}

      {/* The file input is hidden, so this drop zone is the only way in and
          has to be reachable and operable from the keyboard. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        className="border-2 border-dashed border-gray-300 hover:border-brand rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-gray-50 hover:bg-surface-soft"
      >
        <div className="w-14 h-14 bg-surface-soft rounded-2xl flex items-center justify-center">
          <Camera size={24} className="text-brand" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700 flex items-center justify-center gap-1.5">
            <Upload size={14} className="text-brand" />
            Click to upload & crop
          </p>
          <p className="text-xs text-gray-400 mt-1">You can crop and adjust after selecting · Output: {size}×{size}px</p>
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}

