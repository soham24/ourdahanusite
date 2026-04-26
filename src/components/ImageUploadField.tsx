'use client'

import { useState } from 'react'
import ImageUpload from './ImageUpload'

interface ImageUploadFieldProps {
  name?: string
  thumbName?: string
  label?: string
  bucket?: string
}

/**
 * Thin wrapper around ImageUpload that stores the uploaded URL
 * in a hidden <input> so it gets included in the parent <form>'s FormData.
 * Also stores the thumbnail URL in a second hidden input so the server
 * can persist a small-resolution variant alongside the full image.
 * Works inside both server-component forms and client-component forms.
 */
export default function ImageUploadField({
  name = 'image_url',
  thumbName = 'image_thumb_url',
  label = 'Upload Image',
  bucket = 'uploads',
}: ImageUploadFieldProps) {
  const [url, setUrl] = useState('')
  const [thumbUrl, setThumbUrl] = useState('')

  return (
    <div>
      <ImageUpload
        bucket={bucket}
        onUpload={(fullUrl, fullThumbUrl) => {
          setUrl(fullUrl)
          setThumbUrl(fullThumbUrl ?? '')
        }}
        label={label}
      />
      <input type="hidden" name={name} value={url} />
      <input type="hidden" name={thumbName} value={thumbUrl} />
    </div>
  )
}
