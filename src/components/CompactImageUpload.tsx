'use client'

import { useRef, useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { createClient } from '@/lib/supabase/client'
import { Camera, Loader2, X, ZoomIn, ZoomOut, RotateCw, Check } from 'lucide-react'

interface Props {
  value: string
  onUpload: (url: string) => void
  onClear: () => void
  size?: number
}

interface CropArea { x: number; y: number; width: number; height: number }

async function getCroppedBlob(src: string, pixelCrop: CropArea, rotation: number, outputSize: number): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')!
  const rad = (rotation * Math.PI) / 180
  ctx.translate(outputSize / 2, outputSize / 2)
  ctx.rotate(rad)
  ctx.translate(-outputSize / 2, -outputSize / 2)
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, outputSize, outputSize)
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/jpeg', 0.9)
  )
}

export default function CompactImageUpload({ value, onUpload, onClear, size = 480 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedArea, setCroppedArea] = useState<CropArea | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const onCropComplete = useCallback((_: unknown, areaPixels: CropArea) => {
    setCroppedArea(areaPixels)
  }, [])

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Images only'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = () => { setSrc(reader.result as string); setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0) }
    reader.readAsDataURL(file)
  }

  const handleConfirm = async () => {
    if (!src || !croppedArea) return
    setError('')
    try {
      const blob = await getCroppedBlob(src, croppedArea, rotation, size)
      setSrc(null)
      setUploading(true)
      const supabase = createClient()
      const path = `public/${Date.now()}-svc.jpg`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('uploads').getPublicUrl(path)
      onUpload(data.publicUrl)
    } catch { setError('Upload failed') } finally { setUploading(false) }
  }

  // ── Crop modal overlay ────────────────────────────────────────────────────
  if (src) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl overflow-hidden w-full max-w-md">
          <div className="relative" style={{ height: 300 }}>
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{ containerStyle: { borderRadius: 0 } }}
            />
          </div>
          <div className="bg-gray-800 px-4 py-3 space-y-3">
            <div className="flex items-center gap-3">
              <ZoomOut size={14} className="text-gray-400 flex-shrink-0" />
              <input type="range" min={1} max={3} step={0.05} value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="flex-1 accent-warli-terra" />
              <ZoomIn size={14} className="text-gray-400 flex-shrink-0" />
            </div>
            <div className="flex items-center gap-3">
              <RotateCw size={14} className="text-gray-400 flex-shrink-0" />
              <input type="range" min={-180} max={180} step={1} value={rotation}
                onChange={e => setRotation(Number(e.target.value))}
                className="flex-1 accent-warli-terra" />
              <span className="text-xs text-gray-400 w-10 text-right">{rotation}°</span>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <button type="button" onClick={() => setSrc(null)}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5">
                <X size={14} /> Cancel
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{size}×{size}px</span>
                <button type="button" onClick={handleConfirm}
                  className="flex items-center gap-1.5 bg-warli-terra hover:bg-warli-deep text-warli-cream text-sm font-semibold px-4 py-1.5 rounded-xl transition-colors">
                  <Check size={14} /> Apply Crop
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Existing photo ────────────────────────────────────────────────────────
  if (value) {
    return (
      <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200 bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="" className="w-full h-full object-cover" />
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 size={14} className="animate-spin text-white" />
          </div>
        )}
        {!uploading && (
          <button type="button" onClick={onClear}
            className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] hover:bg-red-600 transition-colors">
            ×
          </button>
        )}
        {error && <p className="text-[10px] text-red-500 mt-0.5 w-16 text-center absolute bottom-0 left-0 bg-white/80">{error}</p>}
      </div>
    )
  }

  // ── Upload button ─────────────────────────────────────────────────────────
  return (
    <div className="flex-shrink-0">
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
        className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 hover:border-warli-sand bg-gray-50 hover:bg-warli-light flex flex-col items-center justify-center gap-0.5 transition-colors disabled:opacity-50">
        {uploading
          ? <Loader2 size={16} className="animate-spin text-warli-terra" />
          : <Camera size={16} className="text-gray-400" />}
        <span className="text-[9px] text-gray-400 leading-tight text-center">Photo</span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      {error && <p className="text-[10px] text-red-500 mt-0.5 w-16 text-center">{error}</p>}
    </div>
  )
}
