'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Save, Plus, Trash2, Loader2, CheckCircle,
  AtSign, Share2, Phone, Globe, MapPin, Clock,
  Tag, Image as ImageIcon, Briefcase, Info,
  Video, Sparkles, Award, Truck, CreditCard, Megaphone, Gift,
} from 'lucide-react'
import { updateListing } from '@/app/actions/listings'
import ImageUpload from '@/components/ImageUpload'
import ImageCropUpload from '@/components/ImageCropUpload'
import PhoneInput from '@/components/PhoneInput'
import LocationPicker from '@/components/LocationPicker'
import { normalizeOptionalUrl } from '@/lib/url'
import { getListingHref } from '@/lib/listing-url'
import { LISTING_CATEGORY_GROUPS, LISTING_CATEGORY_EMOJIS } from '@/lib/listing-category'
import { siteConfig } from '@/lib/site'

const SUGGESTED_TAGS: Record<string, string[]> = {
  'Restaurants': ['delivery', 'dine-in', 'veg', 'non-veg', 'seafood', 'open-sunday', 'AC', 'outdoor'],
  'Homemade Food': ['tiffin', 'delivery', 'veg', 'order-ahead', 'homemade', 'daily-fresh'],
  'Hotels & Stay': ['AC rooms', 'wifi', 'parking', 'family', 'beach-view', 'restaurant'],
  'Healthcare & Clinics': ['24/7', 'emergency', 'appointments', 'home-visits', 'pathology'],
  'Salons & Beauty': ['unisex', 'bridal', 'hair', 'skin', 'waxing', 'prior-appointment'],
  'Transport & Taxi': ['24/7', 'AC', 'airport', 'outstation', 'local', 'bike-taxi'],
  'Education & Coaching': ['SSC', 'HSC', 'NEET', 'JEE', 'home-tuition', 'online'],
  'Farms & Organic': ['chikoo', 'organic', 'farm-fresh', 'delivery', 'wholesale'],
  'Content Creators': ['reels', 'youtube', 'instagram', 'photography', 'video'],
  'Freelancers & Digital': ['remote', 'web-design', 'SEO', 'social-media', 'logo'],
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listing: Record<string, any>
  catalogItemCount: number
  /** Where "Manage items" links: owners go to their own item manager, admins to the admin one (owner-only route would bounce them). */
  manageHref: string
}

type TabId = 'basic' | 'contact' | 'services' | 'branding' | 'media' | 'extras'

const PAYMENT_OPTIONS = ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Net Banking', 'Cheque', 'Online Transfer']
const RESPONSE_TIME_OPTIONS = ['Usually replies within 1 hour', 'Within a few hours', 'Within 24 hours', 'Within 2–3 days']

interface Highlight { label: string; value: string }

export default function EditListingForm({ listing, catalogItemCount, manageHref }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [activeTab, setActiveTab] = useState<TabId>('basic')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [newProfileUrl, setNewProfileUrl] = useState('')
  const [newProfileThumbUrl, setNewProfileThumbUrl] = useState('')
  const [newCoverUrl, setNewCoverUrl] = useState('')
  const [newCoverThumbUrl, setNewCoverThumbUrl] = useState('')

  // Category state
  const [category, setCategory] = useState<string>(String(listing.category || ''))

  // Tags state
  const initialTags: string[] = (() => {
    try {
      const raw = listing.tags
      if (Array.isArray(raw)) return raw
      if (typeof raw === 'string' && raw.startsWith('[')) return JSON.parse(raw)
      if (typeof raw === 'string') return raw.split(',').map((t: string) => t.trim()).filter(Boolean)
    } catch { /* ignore */ }
    return []
  })()
  const [tags, setTags] = useState<string[]>(initialTags)
  const [tagInput, setTagInput] = useState('')

  // Media state
  const initialPhotos: string[] = (() => {
    try {
      const raw = listing.photos
      if (Array.isArray(raw)) return raw
      if (typeof raw === 'string') return JSON.parse(raw)
    } catch { /* ignore */ }
    return []
  })()
  const [photos, setPhotos] = useState<string[]>(initialPhotos)

  const initialBeforeAfter: { before: string; after: string } | null = (() => {
    try {
      const raw = listing.before_after
      if (raw && typeof raw === 'object') return raw as { before: string; after: string }
      if (typeof raw === 'string') return JSON.parse(raw)
    } catch { /* ignore */ }
    return null
  })()
  const [beforeAfter, setBeforeAfter] = useState<{ before: string; after: string }>({
    before: initialBeforeAfter?.before || '',
    after: initialBeforeAfter?.after || '',
  })

  // Extras state
  const initialHighlights: Highlight[] = (() => {
    try {
      const raw = listing.highlights
      if (Array.isArray(raw)) return raw
      if (typeof raw === 'string') return JSON.parse(raw)
    } catch { /* ignore */ }
    return []
  })()
  const [highlights, setHighlights] = useState<Highlight[]>(initialHighlights)

  const initialCertifications: string[] = (() => {
    try {
      const raw = listing.certifications
      if (Array.isArray(raw)) return raw
      if (typeof raw === 'string') return JSON.parse(raw)
    } catch { /* ignore */ }
    return []
  })()
  const [certifications, setCertifications] = useState<string[]>(initialCertifications)
  const [certInput, setCertInput] = useState('')

  const initialPaymentMethods: string[] = (() => {
    try {
      const raw = listing.payment_methods
      if (Array.isArray(raw)) return raw
      if (typeof raw === 'string') return JSON.parse(raw)
    } catch { /* ignore */ }
    return []
  })()
  const [paymentMethods, setPaymentMethods] = useState<string[]>(initialPaymentMethods)

  const initialDeliveryInfo = (() => {
    try {
      const raw = listing.delivery_info
      if (raw && typeof raw === 'object') return raw as { areas: string; note: string }
      if (typeof raw === 'string') return JSON.parse(raw)
    } catch { /* ignore */ }
    return { areas: '', note: '' }
  })()
  const [deliveryInfo, setDeliveryInfo] = useState<{ areas: string; note: string }>(initialDeliveryInfo)

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) { setTags(tgs => [...tgs, t]); setTagInput('') }
  }
  const removeTag = (t: string) => setTags(tgs => tgs.filter(x => x !== t))

  const normalizeWebsiteField = () => {
    const form = formRef.current
    if (!form) return
    const websiteInput = form.elements.namedItem('website')
    if (websiteInput instanceof HTMLInputElement) {
      websiteInput.value = normalizeOptionalUrl(websiteInput.value)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    normalizeWebsiteField()
    const fd = new FormData(formRef.current!)
    fd.set('tags', JSON.stringify(tags))
    if (newProfileUrl) fd.set('image_url', newProfileUrl)
    if (newProfileThumbUrl) fd.set('image_thumb_url', newProfileThumbUrl)
    if (newCoverUrl) fd.set('cover_image', newCoverUrl)
    if (newCoverThumbUrl) fd.set('cover_image_thumb_url', newCoverThumbUrl)
    fd.set('photos', JSON.stringify(photos))
    fd.set('highlights', JSON.stringify(highlights))
    fd.set('certifications', JSON.stringify(certifications))
    fd.set('payment_methods', JSON.stringify(paymentMethods))
    fd.set('delivery_info', JSON.stringify(deliveryInfo.areas || deliveryInfo.note ? deliveryInfo : null))
    fd.set('before_after', JSON.stringify(beforeAfter.before && beforeAfter.after ? beforeAfter : null))
    const result = await updateListing(listing.id as string, fd)
    setSaving(false)
    if (result?.error) {
      setError(result.error)
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setSaved(true)
    }
  }

  const subdomain = listing.subdomain as string | null
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'basic',    label: 'Basic',    icon: <Info size={15} /> },
    { id: 'contact',  label: 'Contact',  icon: <Phone size={15} /> },
    { id: 'services', label: 'Items', icon: <Briefcase size={15} /> },
    { id: 'branding', label: 'Brand',    icon: <ImageIcon size={15} /> },
    { id: 'media',    label: 'Media',    icon: <Video size={15} /> },
    { id: 'extras',   label: 'Extras',   icon: <Sparkles size={15} /> },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link href="/my-business" aria-label="Back to my business" className="text-gray-400 hover:text-brand transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Listing</h1>
            <p className="text-sm text-gray-500">{String(listing.name)}</p>
          </div>
        </div>
        {subdomain && (
          <a
            href={getListingHref(listing.id as string, subdomain)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-surface-soft border border-border text-brand px-3 py-1.5 rounded-full hover:bg-border transition-colors"
          >
            <Globe size={12} />
            {subdomain}.{siteConfig.domain} ↗
          </a>
        )}
      </div>

      {/* Success banner */}
      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center justify-between text-green-700 text-sm font-medium mb-6">
          <span className="flex items-center gap-2"><CheckCircle size={16} />Changes saved successfully!</span>
          <button type="button" onClick={() => setSaved(false)} aria-label="Dismiss" className="text-green-400 hover:text-green-600 ml-4">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            // The visible label is display:none below sm, which leaves the
            // button nameless on phones without this.
            aria-label={tab.label}
            aria-pressed={activeTab === tab.id}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-white text-brand shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">

        {/* ── BASIC INFO ─────────────────────────────────────────────────── */}
        <div className={activeTab === 'basic' ? 'bg-white border border-gray-100 rounded-2xl p-6 space-y-5' : 'hidden'}>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input type="text" name="name" required defaultValue={String(listing.name || '')}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Tagline <span className="text-gray-400 font-normal text-xs">— shown under your name</span>
              </label>
              <input type="text" name="tagline" defaultValue={String(listing.tagline || '')}
                placeholder={`e.g. ${siteConfig.town}'s freshest homemade food, delivered daily`}
                maxLength={100}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
              <select name="category" required defaultValue={String(listing.category || '')}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm bg-white">
                {LISTING_CATEGORY_GROUPS.map((group) => (
                  <optgroup key={group.label} label={`${group.icon}  ${group.label}`}>
                    {group.categories.map((c) => (
                      <option key={c} value={c}>
                        {(LISTING_CATEGORY_EMOJIS[c] ?? '🏪') + '  ' + c}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">About / Description</label>
              <textarea name="description" rows={5} defaultValue={String(listing.description || '')}
                placeholder="Tell customers about your business, what makes you special, your story..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm resize-none" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="flex items-center gap-1.5"><Tag size={14} className="text-brand" /> Keywords / Tags</span>
                <span className="text-xs text-gray-400 font-normal ml-6">Help customers find you (e.g. vegan, delivery, 24h)</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 bg-surface-soft border border-border text-brand text-xs px-2.5 py-1 rounded-full">
                    {t}
                    <button type="button" onClick={() => removeTag(t)} aria-label={`Remove tag ${t}`} className="hover:text-red-500 ml-0.5">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag..."
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm"
                />
                <button type="button" onClick={addTag}
                  className="px-4 py-2.5 bg-surface-soft border border-border text-brand text-sm font-semibold rounded-xl hover:bg-border transition-colors">
                  Add
                </button>
              </div>
              {SUGGESTED_TAGS[category] && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-xs text-gray-400 mr-1">Suggestions:</span>
                  {SUGGESTED_TAGS[category].filter(s => !tags.includes(s)).map(s => (
                    <button key={s} type="button" onClick={() => setTags(tgs => [...tgs, s])}
                      className="text-xs bg-gray-50 border border-gray-200 text-gray-500 hover:bg-surface-soft hover:border-border hover:text-brand px-2 py-0.5 rounded-full transition-colors">
                      + {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5"><Clock size={14} className="text-brand" /> Opening Hours</span>
              </label>
              <textarea name="hours" rows={3} defaultValue={String(listing.hours || '')}
                placeholder={'Mon–Sat: 9am – 8pm\nSun: 10am – 6pm\nHolidays: Closed'}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm resize-none font-mono text-xs" />
              <p className="text-xs text-gray-400 mt-1">Format: Day: Open – Close. One line per day/group.</p>
            </div>
        </div>

        {/* ── CONTACT ────────────────────────────────────────────────────── */}
        <div className={activeTab === 'contact' ? 'bg-white border border-gray-100 rounded-2xl p-6 space-y-5' : 'hidden'}>
            <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
              💡 Filling in contact details makes it easier for customers to reach you directly from your profile.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5"><Phone size={13} className="text-brand" /> Phone / Call</span>
                </label>
                <PhoneInput name="phone" defaultValue={String(listing.phone || '')} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-green-600" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </span>
                </label>
                <PhoneInput name="whatsapp" defaultValue={String(listing.whatsapp || '')} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5"><MapPin size={13} className="text-brand" /> Address</span>
              </label>
              <input type="text" name="address" defaultValue={String(listing.address || '')}
                placeholder={`e.g. Main Market, ${siteConfig.town} Road, Palghar - 401602`}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm mb-3" />
              <LocationPicker
                defaultMapUrl={listing.map_url ? String(listing.map_url) : null}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5"><Globe size={13} className="text-brand" /> Website</span>
              </label>
              <input type="url" name="website" defaultValue={String(listing.website || '')}
                onBlur={e => { e.target.value = normalizeOptionalUrl(e.target.value) }}
                placeholder="https://yourbusiness.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5"><AtSign size={13} className="text-pink-500" /> Instagram</span>
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-brand">
                  <span className="px-3 text-gray-400 text-sm border-r border-gray-200 bg-gray-50 py-3">@</span>
                  <input type="text" name="instagram" defaultValue={String(listing.instagram || '')}
                    placeholder="yourbusiness"
                    className="flex-1 px-3 py-3 focus:outline-none text-sm bg-white" />
                </div>
                <p className="mt-1 text-xs text-gray-400">Only enter your username, not the full URL.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5"><Share2 size={13} className="text-blue-600" /> Facebook</span>
                </label>
                <input type="url" name="facebook" defaultValue={String(listing.facebook || '')}
                  placeholder="https://facebook.com/yourbusiness"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">UPI ID</label>
              <input type="text" name="upi_id" defaultValue={String(listing.upi_id || '')}
                placeholder="yourname@upi"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
              <p className="text-xs text-gray-400 mt-1">Shown as a payment option on your profile page</p>
            </div>
        </div>

        {/* ── PRODUCTS & SERVICES ─────────────────────────────────────────── */}
        <div className={activeTab === 'services' ? 'bg-white border border-gray-100 rounded-2xl p-6' : 'hidden'}>
          <h3 className="font-semibold text-gray-800">Products &amp; Services</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            Your products and services now live in the item manager, where you can set prices, options and stock.
          </p>
          <p className="mt-3 text-sm font-semibold text-gray-700">
            {catalogItemCount} {catalogItemCount === 1 ? 'item' : 'items'}
          </p>
          <Link
            href={manageHref}
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-bg transition-colors hover:bg-brand-strong"
          >
            Manage items
          </Link>
        </div>

        {/* ── BRANDING ───────────────────────────────────────────────────── */}
        <div className={activeTab === 'branding' ? 'bg-white border border-gray-100 rounded-2xl p-6 space-y-5' : 'hidden'}>
            <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
              💡 A profile photo and cover image make your listing stand out. Use a clear logo and a wide banner photo.
            </p>

            <div>
              <div className="flex items-start gap-4 mb-4">
                {(newProfileUrl || listing.image_url) && (
                  <img
                    src={newProfileUrl || String(listing.image_url)}
                    alt="Profile"
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-border flex-shrink-0"
                  />
                )}
                <div className="flex-1">
                  <ImageCropUpload
                    bucket="uploads"
                    label="Profile Photo"
                    size={240}
                    aspect={1}
                    onUpload={(url, thumbUrl) => {
                      setNewProfileUrl(url)
                      setNewProfileThumbUrl(thumbUrl ?? '')
                    }}
                  />
                  {listing.image_url && !newProfileUrl && (
                    <p className="text-xs text-gray-400 mt-1">Upload to replace current photo · Cropped to 240×240px</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Cover / Banner Image</label>
              {listing.cover_image && (
                <img src={String(listing.cover_image)} alt="Current cover" className="w-full h-24 rounded-xl object-cover mb-2 border border-gray-200" />
              )}
              <ImageUpload
                bucket="uploads"
                label="Upload banner (wide, 16:9)"
                onUpload={(url, thumbUrl) => {
                  setNewCoverUrl(url)
                  setNewCoverThumbUrl(thumbUrl ?? '')
                }}
              />
              {!listing.cover_image && (
                <p className="text-xs text-gray-400 mt-1">Wide banner shown at the top of your profile.</p>
              )}
            </div>

            {listing.subdomain && (
              <div className="bg-surface-soft border border-border rounded-xl p-4">
                <p className="text-xs text-ink-2 font-medium mb-1">Your personal link</p>
                <a
                  href={`https://${listing.subdomain}.ourdahanu.in`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand font-bold text-sm hover:underline"
                >
                  {listing.subdomain}.{siteConfig.domain} ↗
                </a>
                <p className="text-xs text-gray-400 mt-1">Share this link on WhatsApp, Instagram bio, visiting cards, etc.</p>
              </div>
            )}
        </div>

        {/* ── MEDIA ──────────────────────────────────────────────────────────── */}
        <div className={activeTab === 'media' ? 'bg-white border border-gray-100 rounded-2xl p-6 space-y-6' : 'hidden'}>
          {/* Photo Gallery */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-800 flex items-center gap-1.5"><ImageIcon size={15} className="text-brand" /> Photo Gallery</h3>
                <p className="text-xs text-gray-400 mt-0.5">Add up to 10 photos of your business, products, or work</p>
              </div>
              <span className="text-xs text-gray-400">{photos.length}/10</span>
            </div>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                {photos.map((url, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden bg-gray-100" style={{ aspectRatio: '1/1' }}>
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button type="button"
                      onClick={() => setPhotos(ps => ps.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photos.length < 10 && (
              <ImageUpload bucket="uploads" label="Add photo" onUpload={url => setPhotos(ps => [...ps, url])} />
            )}
          </div>

          {/* Video */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Video size={14} className="text-brand" /> YouTube Video
            </label>
            <input type="url" name="video_url" defaultValue={String(listing.video_url || '')}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
            <p className="text-xs text-gray-400 mt-1">Paste a YouTube video link — shown as an embedded video on your profile</p>
          </div>

          {/* Before/After */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-1.5">Before & After</h3>
            <p className="text-xs text-gray-400 mb-3">Great for salons, contractors, cleaning services — show your work!</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">BEFORE</p>
                {beforeAfter.before && (
                  <div className="relative mb-2 rounded-lg overflow-hidden bg-gray-100" style={{ aspectRatio: '4/3' }}>
                    <img src={beforeAfter.before} alt="Before" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setBeforeAfter(b => ({ ...b, before: '' }))} aria-label="Remove before photo"
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                  </div>
                )}
                <ImageUpload bucket="uploads" label="Upload before" onUpload={url => setBeforeAfter(b => ({ ...b, before: url }))} />
              </div>
              <div>
                <p className="text-xs font-semibold text-green-600 mb-2">AFTER</p>
                {beforeAfter.after && (
                  <div className="relative mb-2 rounded-lg overflow-hidden bg-gray-100" style={{ aspectRatio: '4/3' }}>
                    <img src={beforeAfter.after} alt="After" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setBeforeAfter(b => ({ ...b, after: '' }))} aria-label="Remove after photo"
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                  </div>
                )}
                <ImageUpload bucket="uploads" label="Upload after" onUpload={url => setBeforeAfter(b => ({ ...b, after: url }))} />
              </div>
            </div>
          </div>
        </div>

        {/* ── EXTRAS ─────────────────────────────────────────────────────────── */}
        <div className={activeTab === 'extras' ? 'bg-white border border-gray-100 rounded-2xl p-6 space-y-6' : 'hidden'}>
          {/* Pinned Announcement */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Megaphone size={14} className="text-brand" /> Pinned Announcement
            </label>
            <textarea name="pinned_announcement" rows={2} defaultValue={String(listing.pinned_announcement || '')}
              placeholder="e.g. We are shifting to a new location next week! Stay tuned."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm resize-none" />
            <p className="text-xs text-gray-400 mt-1">Shown as a highlighted notice at the top of your profile</p>
          </div>

          {/* Offer Banner */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Gift size={14} className="text-brand" /> Current Offer / Deal
            </label>
            <input type="text" name="offer_text" defaultValue={String(listing.offer_text || '')}
              placeholder="e.g. 20% off on all services this month!"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm mb-2" />
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Offer expires on (optional)</label>
              <input type="date" name="offer_expires_at"
                defaultValue={listing.offer_expires_at ? String(listing.offer_expires_at).slice(0, 10) : ''}
                className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
            </div>
          </div>

          {/* Established Year */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Established Since (Year)</label>
            <input type="number" name="established_year" defaultValue={listing.established_year || ''}
              placeholder="e.g. 2015"
              min="1900" max={new Date().getFullYear()}
              className="w-40 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
          </div>

          {/* Response Time */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <span className="flex items-center gap-1.5"><Clock size={14} className="text-brand" /> Response Time</span>
            </label>
            <select name="response_time" defaultValue={String(listing.response_time || '')}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm bg-white">
              <option value="">Not specified</option>
              {RESPONSE_TIME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Payment Methods */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <CreditCard size={14} className="text-brand" /> Payment Methods Accepted
            </label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_OPTIONS.map(opt => (
                <button key={opt} type="button"
                  onClick={() => setPaymentMethods(ms => ms.includes(opt) ? ms.filter(m => m !== opt) : [...ms, opt])}
                  className={`text-sm px-3 py-1.5 rounded-xl border font-medium transition-all ${
                    paymentMethods.includes(opt)
                      ? 'bg-brand text-bg border-brand'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-border'
                  }`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Highlights / Key Stats */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-brand" /> Highlights / Key Stats
                </label>
                <p className="text-xs text-gray-400">e.g. &ldquo;500+ Happy Customers&rdquo;, &ldquo;10 Years Experience&rdquo;</p>
              </div>
              <button type="button" onClick={() => setHighlights(h => [...h, { label: '', value: '' }])}
                className="text-sm text-brand border border-brand px-3 py-1.5 rounded-xl hover:bg-surface-soft transition-colors flex items-center gap-1">
                <Plus size={13} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {highlights.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={h.label}
                    onChange={e => setHighlights(hs => hs.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                    placeholder="Label (e.g. Happy Customers)"
                    aria-label={`Highlight ${i + 1} label`}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand" />
                  <input type="text" value={h.value}
                    onChange={e => setHighlights(hs => hs.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))}
                    placeholder="Value (e.g. 500+)"
                    aria-label={`Highlight ${i + 1} value`}
                    className="w-28 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand" />
                  <button type="button" onClick={() => setHighlights(hs => hs.filter((_, idx) => idx !== i))}
                    aria-label={`Remove highlight ${i + 1}`}
                    className="text-gray-300 hover:text-red-500 transition-colors px-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Certifications */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Award size={14} className="text-brand" /> Certifications & Awards
                </label>
                <p className="text-xs text-gray-400">e.g. FSSAI Licensed, ISO Certified, Best of {siteConfig.town} 2023</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {certifications.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-2.5 py-1 rounded-full">
                  {c}
                  <button type="button" onClick={() => setCertifications(cs => cs.filter((_, idx) => idx !== i))} aria-label={`Remove certification ${c}`} className="hover:text-red-500 ml-0.5">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={certInput} onChange={e => setCertInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (certInput.trim()) { setCertifications(cs => [...cs, certInput.trim()]); setCertInput('') } } }}
                placeholder="Add certification or award..."
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand" />
              <button type="button"
                onClick={() => { if (certInput.trim()) { setCertifications(cs => [...cs, certInput.trim()]); setCertInput('') } }}
                className="px-4 py-2.5 bg-surface-soft border border-border text-brand text-sm font-semibold rounded-xl hover:bg-border transition-colors">
                Add
              </button>
            </div>
          </div>

          {/* Delivery / Service Area */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <Truck size={14} className="text-brand" /> Delivery / Service Area
            </label>
            <input type="text" value={deliveryInfo.areas}
              onChange={e => setDeliveryInfo(d => ({ ...d, areas: e.target.value }))}
              placeholder={`e.g. ${siteConfig.town}, Palghar, Boisar (within 20km)`}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm mb-2" />
            <input type="text" value={deliveryInfo.note}
              onChange={e => setDeliveryInfo(d => ({ ...d, note: e.target.value }))}
              placeholder="Additional note (e.g. Free delivery above ₹500)"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/my-business"
            className="px-5 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-semibold transition-colors text-sm">
            Cancel
          </Link>
          <div className="flex items-center gap-3">
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-strong text-bg font-semibold px-6 py-3 rounded-xl transition-colors disabled:opacity-60">
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
                : <><Save size={16} /> Save Changes</>
              }
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
