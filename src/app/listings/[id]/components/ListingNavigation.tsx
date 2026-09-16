"use client"

import React from 'react'
import Badge from '@/components/ui/Badge'

interface ListingNavigationProps {
  hasCatalog: boolean
  photos: string[]
}

export default function ListingNavigation({ hasCatalog, photos }: ListingNavigationProps) {
  const hasPhotos = photos && photos.length > 0

  return (
    <nav className="sticky top-[62px] z-30 mb-5 -mx-4 overflow-x-auto border-y border-border bg-[rgba(250,250,247,0.9)] px-4 py-2 backdrop-blur-xl md:static md:mx-0 md:rounded-2xl md:border">
      <div className="flex min-w-max gap-2">
        <a href="#overview">
          <Badge variant="outline" size="md" className="cursor-pointer hover:border-brand hover:text-brand font-medium">Overview</Badge>
        </a>
        {hasCatalog && (
          <a href="#services">
            <Badge variant="outline" size="md" className="cursor-pointer hover:border-brand hover:text-brand font-medium">Products &amp; Services</Badge>
          </a>
        )}
        {hasPhotos && (
          <a href="#photos">
            <Badge variant="outline" size="md" className="cursor-pointer hover:border-brand hover:text-brand font-medium">Photos</Badge>
          </a>
        )}
        <a href="#reviews">
          <Badge variant="outline" size="md" className="cursor-pointer hover:border-brand hover:text-brand font-medium">Reviews</Badge>
        </a>
        <a href="#contact">
          <Badge variant="outline" size="md" className="cursor-pointer hover:border-brand hover:text-brand font-medium">Contact</Badge>
        </a>
      </div>
    </nav>
  )
}
