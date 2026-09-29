'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { adminCreateListing, adminSearchUsers } from '@/app/actions/admin-listings'
import { Search, Loader2, CheckCircle, UserCheck, X } from 'lucide-react'
import { normalizeOptionalUrl } from '@/lib/url'
import { LISTING_CATEGORY_GROUPS, LISTING_CATEGORY_EMOJIS } from '@/lib/listing-category'
import { siteConfig } from '@/lib/site'

interface User { id: string; email: string; name: string }

export default function AdminNewListingForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Owner search
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const [approved, setApproved] = useState(true)

  async function searchUsers() {
    if (!userQuery.trim()) return
    setSearching(true)
    const { users } = await adminSearchUsers(userQuery)
    setUserResults(users)
    setSearching(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const websiteInput = e.currentTarget.elements.namedItem('website')
    if (websiteInput instanceof HTMLInputElement) {
      websiteInput.value = normalizeOptionalUrl(websiteInput.value)
    }
    const fd = new FormData(e.currentTarget)
    fd.set('approved', approved ? 'true' : 'false')
    if (selectedUser) fd.set('owner_id', selectedUser.id)

    startTransition(async () => {
      const result = await adminCreateListing(fd)
      if (result.error) {
        setError(result.error)
      } else {
        router.push(`/admin/listings/${result.id}/edit`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Basic Info */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Business Info</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input name="name" required placeholder="e.g. Shree Ganesh Medical"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select name="category" required defaultValue=""
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm bg-white">
              <option value="" disabled>Select category…</option>
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
            <label className="block text-sm font-semibold text-gray-700 mb-1">Plan</label>
            <select name="plan" defaultValue="standard"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm bg-white">
              <option value="standard">Standard</option>
              <option value="featured">Featured</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tagline</label>
            <input name="tagline" placeholder="Short one-liner about the business"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm" />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
            <textarea name="description" rows={4} placeholder="Tell customers about this business…"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm resize-none" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Subdomain</label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-400">
              <input name="subdomain" placeholder="businessname"
                className="flex-1 px-4 py-3 focus:outline-none text-sm" />
              <span className="px-3 py-3 bg-gray-50 text-gray-400 text-xs border-l border-gray-200">.ourdahanu.in</span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-6">
            <button
              type="button"
              onClick={() => setApproved(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${approved ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${approved ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm font-medium text-gray-700">
              {approved ? 'Approved & Live' : 'Pending (not live)'}
            </span>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Contact & Location</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
            <input name="phone" type="tel" placeholder="+91 98765 43210"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">WhatsApp</label>
            <input name="whatsapp" type="tel" placeholder="+91 98765 43210"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
            <input name="address" placeholder={`e.g. Main Market, ${siteConfig.town} Road`}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Website</label>
            <input name="website" type="url" placeholder="https://..."
              onBlur={e => { e.target.value = normalizeOptionalUrl(e.target.value) }}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Google Maps URL</label>
            <input name="map_url" type="url" placeholder="https://maps.google.com/..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm" />
          </div>
        </div>
      </div>

      {/* Owner Assignment */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Assign Owner</h2>
        <p className="text-xs text-gray-400">Link this listing to an existing user account so they can edit it.</p>

        {selectedUser ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-green-600" />
              <div>
                <p className="text-sm font-semibold text-gray-800">{selectedUser.name}</p>
                <p className="text-xs text-gray-500">{selectedUser.email}</p>
              </div>
            </div>
            <button type="button" onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-red-500">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={userQuery}
                onChange={e => setUserQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchUsers())}
                placeholder="Search by name or email…"
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm"
              />
              <button type="button" onClick={searchUsers} disabled={searching}
                className="px-4 py-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors">
                {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </div>

            {userResults.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {userResults.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setSelectedUser(u); setUserResults([]) }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                      {(u.name || u.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="ml-auto">
          <button type="submit" disabled={isPending}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors disabled:opacity-60">
            {isPending
              ? <><Loader2 size={16} className="animate-spin" /> Creating…</>
              : <><CheckCircle size={16} /> Create Listing</>}
          </button>
        </div>
      </div>
    </form>
  )
}
