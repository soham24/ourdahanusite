"use client"

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { MessageCircleQuestion, Star } from 'lucide-react'
import Card from '@/components/ui/Card'
import QASection from '../QASection'
import { getListingHref } from '@/lib/listing-url'

interface ListingQASectionProps {
  questions: any[]
  listingId: string
  subdomain: string | null
  isOwner: boolean
  isLoggedIn: boolean
  similarListings: any[]
  listingCategory: string
}

export default function ListingQASection({
  questions,
  listingId,
  subdomain,
  isOwner,
  isLoggedIn,
  similarListings,
  listingCategory,
}: ListingQASectionProps) {
  return (
    <div className="space-y-5">
      {/* Q&A Section */}
      <Card id="qa" className="scroll-mt-32 p-6">
        <h2 className="text-base font-bold text-ink mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-brand rounded-full inline-block" />
          <MessageCircleQuestion size={15} className="text-brand" />
          Questions & Answers
          {questions.length > 0 && (
            <span className="text-sm font-normal text-ink-2/40">({questions.length})</span>
          )}
        </h2>
        <QASection
          listingId={listingId}
          subdomain={subdomain}
          questions={questions}
          isOwner={isOwner}
          isLoggedIn={isLoggedIn}
        />
      </Card>

      {/* Similar Businesses */}
      {similarListings.length > 0 && (
        <Card id="similar" className="scroll-mt-32 p-6">
          <h2 className="text-base font-bold text-ink mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-brand rounded-full inline-block" />
            Similar in {listingCategory}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {similarListings.map(s => (
              <Link key={s.id} href={getListingHref(s.id, s.subdomain)}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-brand/30 hover:bg-surface-soft/40 transition-all">
                <div className="w-10 h-10 rounded-lg bg-surface-soft flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {s.image_url ? (
                    <Image src={s.image_url} alt={s.name} width={40} height={40} className="object-cover w-full h-full" />
                  ) : (
                    <span className="text-lg">🏪</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{s.name}</p>
                  {s.rating > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star size={10} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-xs text-ink-2/40">{s.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
