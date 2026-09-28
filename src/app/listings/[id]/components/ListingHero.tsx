"use client"

import React from 'react'
import Image from 'next/image'
import {
  Globe, ArrowLeft, Edit2, CheckCircle, CalendarDays, Zap, 
  ExternalLink, Phone, ThumbsUp, Star, AtSign 
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import FavouriteButton from '../FavouriteButton'
import { useListingViewer } from '../ListingViewerContext'
import type { ListingRecord } from '@/lib/data/listing-detail'
import { siteConfig } from '@/lib/site'

interface ListingHeroProps {
  listing: ListingRecord
  subdomain: string | null
  platformListingsUrl: string
  platformEditUrl: string
  rating: number
  reviewCount: number
  hasReviews: boolean
  recommendCount: number
  tags: string[]
  phoneHref: string | null
  enquiryLink: string | null
  statusShareLink: string | null
  listingId: string
}

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  )
}

export default function ListingHero({
  listing,
  subdomain,
  platformListingsUrl,
  platformEditUrl,
  rating,
  reviewCount,
  hasReviews,
  recommendCount,
  tags,
  phoneHref,
  enquiryLink,
  statusShareLink,
  listingId,
}: ListingHeroProps) {
  const viewer = useListingViewer()

  return (
    <>
      {/* ── Cover Image / Hero ──────────────────────────────────────────────── */}
      <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-[#2E1205] via-[#7A4520] to-[#C0582E] md:h-56">
        {listing.cover_image ? (
          <Image src={String(listing.cover_image)} alt="Cover" fill priority sizes="100vw" className="object-cover opacity-80" />
        ) : (
          <div className="absolute inset-0 opacity-10 text-8xl flex flex-wrap gap-8 p-8 select-none pointer-events-none">
            🏪🍽️🎨🌿🏗️💇✂️📸
          </div>
        )}

        {/* Subdomain pill */}
        {subdomain && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20">
              <Globe size={11} />
              {subdomain}.{siteConfig.domain}
            </span>
          </div>
        )}

        {/* Back + Edit */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" href={platformListingsUrl} className="bg-black/30 backdrop-blur-sm hover:bg-black/50 text-white/90 hover:text-white border-transparent">
             <ArrowLeft size={14} /> Listings
          </Button>
          {viewer.isOwner && (
            <Button variant="primary" size="sm" href={platformEditUrl}>
              <Edit2 size={13} /> Edit Profile
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* ── Pinned Announcement ─────────────────────────────────────────── */}
        {Boolean(listing.pinned_announcement) && (
          <div className="relative -mt-4 mb-4 z-10">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <span className="text-amber-500 text-lg flex-shrink-0">📢</span>
              <p className="text-sm text-amber-800 font-medium">{String(listing.pinned_announcement)}</p>
            </div>
          </div>
        )}

        {/* ── Profile Card ─────────────────────────────────────────────────── */}
        <div className="relative -mt-12 mb-6">
          <Card id="overview" className="scroll-mt-32 p-5 shadow-[0_18px_50px_rgba(46,18,5,0.12)] md:p-6" padding="none">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              {/* Avatar */}
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-[#F4EDE3] shadow">
                {listing.image_url ? (
                  <Image src={String(listing.image_url)} alt={String(listing.name)} width={80} height={80} className="object-cover w-full h-full" />
                ) : (
                  <span className="text-4xl">🏪</span>
                )}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl font-extrabold tracking-[-0.01em] text-ink md:text-3xl">{String(listing.name)}</h1>
                      {Boolean(listing.verified) && (
                        <Badge variant="brand" size="sm">
                          <CheckCircle size={11} /> Verified
                        </Badge>
                      )}
                    </div>
                    {Boolean(listing.tagline) && (
                      <p className="text-ink-2/60 mt-1 text-sm">{String(listing.tagline)}</p>
                    )}
                    {/* Established + Response Time */}
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      {Boolean(listing.established_year) && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <CalendarDays size={11} /> Est. {String(listing.established_year)}
                        </span>
                      )}
                      {Boolean(listing.response_time) && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <Zap size={11} /> {String(listing.response_time)}
                        </span>
                      )}
                    </div>
                  </div>
                  {subdomain && (
                    <a href={`https://${subdomain}.ourdahanu.in`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand border border-border bg-surface-soft px-2.5 py-1 rounded-full hover:bg-border transition-colors font-medium">
                      <Globe size={10} /> {subdomain}.{siteConfig.domain} <ExternalLink size={9} />
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <Badge variant="outline" size="sm">
                    {String(listing.category)}
                  </Badge>
                  {hasReviews ? (
                    <div className="flex items-center gap-1.5">
                      <StarDisplay rating={rating} />
                      <span className="font-semibold text-gray-900 text-sm">{rating.toFixed(1)}</span>
                      <span className="text-xs text-gray-400">({reviewCount} reviews)</span>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-gray-400">New listing</span>
                  )}
                  {recommendCount > 0 && (
                    <Badge variant="gold" size="sm">
                      <ThumbsUp size={10} /> {recommendCount} recommend{recommendCount === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {tags.map(t => (
                      <Badge key={t} variant="default" size="xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick contact buttons */}
            <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-100">
              {phoneHref && (
                <Button variant="primary" size="md" href={`tel:${phoneHref}`}>
                  <Phone size={14} /> Call Now
                </Button>
              )}
              {enquiryLink && (
                <Button variant="primary" size="md" href={enquiryLink || undefined} className="bg-green-600 hover:bg-green-700 shadow-[0_10px_24px_rgba(22,163,74,0.18)] border-transparent">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Send Enquiry
                </Button>
              )}
              {Boolean(listing.website) && (
                <Button variant="outline" size="md" href={String(listing.website)}>
                  <Globe size={14} /> Website
                </Button>
              )}
              {Boolean(listing.instagram) && (
                <Button variant="outline" size="md" href={`https://instagram.com/${String(listing.instagram).replace('@', '')}`} className="hover:border-pink-300 hover:bg-pink-50 hover:text-pink-600">
                  <AtSign size={14} className="text-pink-500" /> Instagram
                </Button>
              )}

              {/* Right side: Favourite + Share buttons */}
              <div className="flex items-center gap-2 ml-auto">
                <FavouriteButton
                  listingId={listingId}
                  subdomain={subdomain}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: String(listing.name), url: window.location.href }).catch(() => {
                        if (statusShareLink) window.open(statusShareLink, '_blank')
                      })
                    } else if (statusShareLink) {
                      window.open(statusShareLink, '_blank')
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--od-border)] px-3 py-2 text-sm font-semibold text-[var(--od-ink-2)] transition-all hover:bg-green-50 hover:border-green-200 hover:text-green-700 active:scale-[0.98]"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Share
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
