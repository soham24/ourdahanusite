'use client'

import { useState } from 'react'
import ImageUpload from './ImageUpload'

interface ImageUploadFieldProps {
  name?: string
  label?: string
  bucket?: string
}

/**
 * Thin wrapper around ImageUpload that stores the uploaded URL
 * in a hidden <input> so it gets included in the parent <form>'s FormData.
 * Works inside both server-component forms and client-component forms.
 */
export default function ImageUploadField({
  name = 'image_url',
  label = 'Upload Image',
  bucket = 'uploads',
}: ImageUploadFieldProps) {
  const [url, setUrl] = useState('')

  return (
    <div>
      <ImageUpload bucket={bucket} onUpload={setUrl} label={label} />
      <input type="hidden" name={name} value={url} />
    </div>
  )
}
