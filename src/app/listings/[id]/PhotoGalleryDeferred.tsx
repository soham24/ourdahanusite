'use client'

import dynamic from 'next/dynamic'

const PhotoGallery = dynamic(() => import('./PhotoGallery'))

export default function PhotoGalleryDeferred({ photos }: { photos: string[] }) {
  return <PhotoGallery photos={photos} />
}
