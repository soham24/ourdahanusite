'use client'

import { useCallback, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import { createClient } from '@/lib/supabase/client'
import { storageObjectPath } from '@/lib/upload-path'
import { Camera, Check, Loader2, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react'
import {
  SERVICE_IMAGE_ASPECT_OPTIONS,
  getServiceImageAspectOption,
  type ServiceImageAspect,
} from '@/lib/service-image'

interface Props {
  value: string
  aspect: ServiceImageAspect
  onUpload: (url: string) => void
  onClear: () => void
  onAspectChange: (aspect: ServiceImageAspect) => void
  showAspect?: boolean
}

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

async function getCroppedBlob(
  src: string,
  pixelCrop: CropArea,
  rotation: number,
  outputWidth: number,
  outputHeight: number,
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')

  const rad = (rotation * Math.PI) / 180
  ctx.translate(outputWidth / 2, outputHeight / 2)
  ctx.rotate(rad)
  ctx.translate(-outputWidth / 2, -outputHeight / 2)
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  )

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.9,
    ),
  )
}

export default function CompactImageUpload({
  value,
  aspect,
  onUpload,
  onClear,
  onAspectChange,
  showAspect = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedArea, setCroppedArea] = useState<CropArea | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const aspectOption = getServiceImageAspectOption(aspect)

  const onCropComplete = useCallback((_: unknown, areaPixels: CropArea) => {
    setCroppedArea(areaPixels)
  }, [])

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Images only')
      return
    }

    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      setSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setRotation(0)
    }
    reader.readAsDataURL(file)
  }

  const handleConfirm = async () => {
    if (!src || !croppedArea) return

    setError('')

    try {
      const nextAspect = getServiceImageAspectOption(aspect)
      const blob = await getCroppedBlob(
        src,
        croppedArea,
        rotation,
        nextAspect.outputWidth,
        nextAspect.outputHeight,
      )

      setSrc(null)
      setUploading(true)

      const supabase = createClient()
      const { data: auth, error: authError } = await supabase.auth.getUser()
      // Order matters: getUser() reports a missing session as an error, so
      // testing authError first would tell a signed-out visitor that
      // something went wrong rather than that they need to sign in.
      const userId = auth.user?.id
      if (!userId) throw new Error('Please sign in again before uploading.')
      if (authError) throw new Error('Could not check your sign-in just now. Try again in a moment.')
      const path = storageObjectPath(userId, 'svc.jpg')
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('uploads').getPublicUrl(path)
      onUpload(data.publicUrl)
    } catch (err) {
      // Show what actually went wrong. A bare 'Upload failed' hid both the
      // sign-in message above and any storage policy rejection, which is
      // exactly what someone debugging a failed upload needs to see.
      setError(err instanceof Error && err.message ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const renderAspectSelector = (tone: 'light' | 'dark') => (
    <div className="grid grid-cols-3 gap-1.5">
      {SERVICE_IMAGE_ASPECT_OPTIONS.map((option) => {
        const active = option.value === aspect

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onAspectChange(option.value)}
            className={
              tone === 'dark'
                ? `rounded-lg border px-2 py-2 text-left transition-colors ${
                    active
                      ? 'border-border bg-brand/25 text-bg'
                      : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 hover:text-white'
                  }`
                : `rounded-lg border px-2 py-2 text-left transition-colors ${
                    active
                      ? 'border-border bg-surface-soft text-brand'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-border hover:text-gray-700'
                  }`
            }
          >
            <span className="block text-[11px] font-semibold leading-tight">{option.label}</span>
            <span className="block text-[10px] opacity-75">{option.shortLabel}</span>
          </button>
        )
      })}
    </div>
  )

  if (src) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-gray-900">
          <div className="relative" style={{ height: 300 }}>
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspectOption.aspectRatio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{ containerStyle: { borderRadius: 0 } }}
            />
          </div>

          <div className="space-y-3 bg-gray-800 px-4 py-3">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Photo Shape
              </p>
              {renderAspectSelector('dark')}
            </div>

            <div className="flex items-center gap-3">
              <ZoomOut size={14} className="shrink-0 text-gray-400" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="flex-1 accent-brand"
              />
              <ZoomIn size={14} className="shrink-0 text-gray-400" />
            </div>

            <div className="flex items-center gap-3">
              <RotateCw size={14} className="shrink-0 text-gray-400" />
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={rotation}
                onChange={(event) => setRotation(Number(event.target.value))}
                className="flex-1 accent-brand"
              />
              <span className="w-10 text-right text-xs text-gray-400">{rotation}°</span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setSrc(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:text-white"
              >
                <X size={14} /> Cancel
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {aspectOption.outputWidth}×{aspectOption.outputHeight}px
                </span>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-1.5 text-sm font-semibold text-bg transition-colors hover:bg-brand-strong"
                >
                  <Check size={14} /> Apply Crop
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const previewStyle = {
    width: `${aspectOption.thumbnailWidth}px`,
    height: `${aspectOption.thumbnailHeight}px`,
  }

  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      {value ? (
        <div
          className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
          style={previewStyle}
        >
          <img src={value} alt="" className="h-full w-full object-cover" />
          <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
            {aspectOption.label}
          </span>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 size={14} className="animate-spin text-white" />
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] text-white transition-colors hover:bg-red-600"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 transition-colors hover:border-border hover:bg-surface-soft disabled:opacity-50"
          style={previewStyle}
        >
          {uploading ? (
            <Loader2 size={16} className="animate-spin text-brand" />
          ) : (
            <Camera size={16} className="text-gray-400" />
          )}
          <span className="text-center text-[9px] leading-tight text-gray-400">Photo</span>
          <span className="text-center text-[9px] leading-tight text-gray-400">{aspectOption.shortLabel}</span>
        </button>
      )}

      {showAspect && renderAspectSelector('light')}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) handleFile(file)
          event.target.value = ''
        }}
      />

      {error && <p className="w-20 text-center text-[10px] text-red-500">{error}</p>}
    </div>
  )
}

