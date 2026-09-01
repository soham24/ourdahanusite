'use client'

import { useState, useTransition } from 'react'
import { updatePricing, createCoupon, toggleCoupon, deleteCoupon, setCouponAssignedTo } from '@/app/actions/pricing'
import type { Coupon, PricingConfig } from '@/app/actions/pricing'
import { Save, Plus, Trash2, Loader2, CheckCircle, ToggleLeft, ToggleRight, Tag, IndianRupee, X, Pencil } from 'lucide-react'

interface Props {
  pricing: PricingConfig
  coupons: Coupon[]
}

export default function PricingManager({ pricing, coupons: initialCoupons }: Props) {
  // Listing Pricing
  const [basePrice, setBasePrice] = useState(String(pricing.base_price))
  const [currentPrice, setCurrentPrice] = useState(String(pricing.current_price))
  const [pricingSaved, setPricingSaved] = useState(false)
  const [pricingError, setPricingError] = useState('')
  const [savingPricing, startSavePricing] = useTransition()

  // Coupons list
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons)

  // New coupon form
  const [showNew, setShowNew] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newAssignedTo, setNewAssignedTo] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newEnabled, setNewEnabled] = useState(true)
  const [newError, setNewError] = useState('')
  const [creatingCoupon, startCreate] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Inline "assigned to" editor
  const [editingAssignedId, setEditingAssignedId] = useState<string | null>(null)
  const [assignedDraft, setAssignedDraft] = useState('')
  const [savingAssignedId, setSavingAssignedId] = useState<string | null>(null)
  // Keyed by coupon id (not a single shared scalar) so a failed save for one
  // row can never be misattributed to whichever row the admin has since
  // switched to editing — see Fix round 2.
  const [assignedErrors, setAssignedErrors] = useState<Record<string, string>>({})

  function handleSavePricing(e: React.FormEvent) {
    e.preventDefault()
    setPricingError('')
    setPricingSaved(false)
    const fd = new FormData()
    fd.set('base_price', basePrice)
    fd.set('current_price', currentPrice)
    startSavePricing(async () => {
      const res = await updatePricing(fd)
      if (res.error) setPricingError(res.error)
      else setPricingSaved(true)
    })
  }

  function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault()
    setNewError('')
    const fd = new FormData()
    fd.set('code', newCode)
    fd.set('label', newLabel)
    fd.set('final_price', newPrice)
    fd.set('enabled', newEnabled ? 'true' : 'false')
    fd.set('assigned_to', newAssignedTo)
    startCreate(async () => {
      const res = await createCoupon(fd)
      if (res.error) {
        setNewError(res.error)
      } else {
        setNewCode(''); setNewLabel(''); setNewPrice(''); setNewEnabled(true); setNewAssignedTo('')
        setShowNew(false)
        // Optimistic update — reload will bring real data
        window.location.reload()
      }
    })
  }

  async function handleToggle(coupon: Coupon) {
    setTogglingId(coupon.id)
    const res = await toggleCoupon(coupon.id, !coupon.enabled)
    if (!res.error) {
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, enabled: !c.enabled } : c))
    }
    setTogglingId(null)
  }

  async function handleDelete(coupon: Coupon) {
    if (!confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return
    setDeletingId(coupon.id)
    const res = await deleteCoupon(coupon.id)
    if (!res.error) {
      setCoupons(prev => prev.filter(c => c.id !== coupon.id))
    }
    setDeletingId(null)
  }

  function clearAssignedRowError(id: string) {
    setAssignedErrors(prev => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function startEditAssigned(coupon: Coupon) {
    clearAssignedRowError(coupon.id)
    setEditingAssignedId(coupon.id)
    setAssignedDraft(coupon.assigned_to ?? '')
  }

  function cancelEditAssigned(coupon: Coupon) {
    // Functional updater: only close this row's editor if it's still the one
    // open. If the admin already switched to another row, leave it alone.
    setEditingAssignedId(prev => prev === coupon.id ? null : prev)
    setAssignedDraft('')
    clearAssignedRowError(coupon.id)
  }

  async function handleSaveAssigned(coupon: Coupon) {
    clearAssignedRowError(coupon.id)
    setSavingAssignedId(coupon.id)
    const draft = assignedDraft
    const res = await setCouponAssignedTo(coupon.id, draft)
    if (res.error) {
      const message = res.error
      // Keyed by coupon.id, so this can never land on a different row's
      // editor even if the admin has since switched away from this one.
      setAssignedErrors(prev => ({ ...prev, [coupon.id]: message }))
    } else {
      const value = draft.trim() || null
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, assigned_to: value } : c))
      // Functional updater: only clear editingAssignedId if this row is still
      // the one being edited. If the admin has since opened a different row's
      // editor, editingAssignedId no longer equals coupon.id and this is a
      // no-op — the other row's in-progress edit survives.
      setEditingAssignedId(prev => prev === coupon.id ? null : prev)
    }
    // Same ownership check for the in-flight indicator: don't clear another
    // row's spinner just because this row's request resolved.
    setSavingAssignedId(prev => prev === coupon.id ? null : prev)
  }

  const discount = Math.max(0, parseInt(basePrice || '0') - parseInt(currentPrice || '0'))
  const discountPct = parseInt(basePrice || '0') > 0
    ? Math.round((discount / parseInt(basePrice)) * 100)
    : 0

  return (
    <div className="space-y-8">

      {/* ── Pricing Config ─────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <h2 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
          <IndianRupee size={16} className="text-green-600" />
          Listing Prices
        </h2>
        <p className="text-xs text-gray-400 mb-5">Controls the price shown on the submit listing page.</p>

        <form onSubmit={handleSavePricing} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Original Price (₹) <span className="text-xs font-normal text-gray-400">— shown as strikethrough</span>
              </label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-green-400">
                <span className="px-3 py-3 bg-gray-50 text-gray-400 text-sm border-r border-gray-200">₹</span>
                <input
                  type="number" min="0" value={basePrice}
                  onChange={e => { setBasePrice(e.target.value); setPricingSaved(false) }}
                  className="flex-1 px-3 py-3 focus:outline-none text-sm font-semibold"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Current Offer Price (₹) <span className="text-xs font-normal text-gray-400">— actual charge</span>
              </label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-green-400">
                <span className="px-3 py-3 bg-gray-50 text-gray-400 text-sm border-r border-gray-200">₹</span>
                <input
                  type="number" min="0" value={currentPrice}
                  onChange={e => { setCurrentPrice(e.target.value); setPricingSaved(false) }}
                  className="flex-1 px-3 py-3 focus:outline-none text-sm font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">Customer sees</p>
              <p className="text-sm text-gray-400 line-through">₹{basePrice || '–'}</p>
              <p className="text-2xl font-bold text-gray-900">₹{currentPrice || '–'}</p>
            </div>
            <div className="h-10 w-px bg-gray-200" />
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">Discount shown</p>
              <p className="text-xl font-bold text-green-600">₹{discount} off</p>
              <p className="text-xs text-gray-400">{discountPct}% savings</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={savingPricing}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60">
              {savingPricing ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save Pricing</>}
            </button>
            {pricingSaved && (
              <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <CheckCircle size={14} /> Saved!
              </span>
            )}
            {pricingError && <span className="text-red-500 text-sm">{pricingError}</span>}
          </div>
        </form>
      </div>

      {/* ── Coupons ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Tag size={16} className="text-purple-500" />
              Coupon Codes
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{coupons.filter(c => c.enabled).length} active · {coupons.length} total</p>
          </div>
          <button
            onClick={() => setShowNew(v => !v)}
            className="inline-flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            {showNew ? <X size={14} /> : <Plus size={14} />}
            {showNew ? 'Cancel' : 'New Coupon'}
          </button>
        </div>

        {/* New coupon form */}
        {showNew && (
          <form onSubmit={handleCreateCoupon} className="mb-5 bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-purple-800">Create New Coupon</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Code <span className="text-red-500">*</span></label>
                <input value={newCode} onChange={e => setNewCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  placeholder="e.g. dahanu50" required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 text-sm font-mono" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Label <span className="text-red-500">*</span></label>
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  placeholder="e.g. Launch offer — ₹50 off!" required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Assigned to</label>
                <input value={newAssignedTo} onChange={e => setNewAssignedTo(e.target.value)}
                  placeholder="e.g. Ajay Bari"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Final Price (₹) <span className="text-red-500">*</span></label>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-purple-400 bg-white">
                  <span className="px-2.5 py-2.5 bg-gray-50 text-gray-400 text-xs border-r border-gray-200">₹</span>
                  <input type="number" min="0" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                    placeholder="150" required
                    className="flex-1 px-2.5 py-2.5 focus:outline-none text-sm" />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Use 0 for free</p>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <button type="button" onClick={() => setNewEnabled(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${newEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${newEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-gray-600">{newEnabled ? 'Active' : 'Disabled'}</span>
              </div>
            </div>
            {newError && <p className="text-red-500 text-xs">{newError}</p>}
            <button type="submit" disabled={creatingCoupon}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-60">
              {creatingCoupon ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : <><Plus size={13} /> Create Coupon</>}
            </button>
          </form>
        )}

        {/* Coupon list */}
        {coupons.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No coupons yet.</p>
        ) : (
          <div className="space-y-2">
            {coupons.map(coupon => (
              <div key={coupon.id}
                className={`flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl border transition-colors ${
                  coupon.enabled ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${coupon.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-gray-900 uppercase tracking-wide">{coupon.code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        coupon.final_price === 0
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {coupon.final_price === 0 ? 'FREE' : `₹${coupon.final_price}`}
                      </span>
                      <a href={`/admin/coupons/${coupon.code}`} className="text-xs text-[#C0582E] hover:underline">
                        view usage
                      </a>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{coupon.label}</p>
                    {editingAssignedId === coupon.id ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          value={assignedDraft}
                          onChange={e => setAssignedDraft(e.target.value)}
                          placeholder="Assigned to"
                          autoFocus
                          className="px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 text-xs w-40"
                        />
                        <button
                          onClick={() => handleSaveAssigned(coupon)}
                          disabled={savingAssignedId === coupon.id}
                          title="Save"
                          className="text-gray-400 hover:text-green-600 transition-colors p-1"
                        >
                          {savingAssignedId === coupon.id
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Save size={13} />
                          }
                        </button>
                        <button
                          onClick={() => cancelEditAssigned(coupon)}
                          disabled={savingAssignedId === coupon.id}
                          title="Cancel"
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditAssigned(coupon)}
                        className="flex items-center gap-1 mt-0.5 text-xs text-gray-500 hover:text-purple-600 transition-colors"
                      >
                        <Pencil size={11} />
                        {coupon.assigned_to || 'Assign to…'}
                      </button>
                    )}
                    {editingAssignedId === coupon.id && assignedErrors[coupon.id] && (
                      <p className="text-red-500 text-[10px] mt-0.5">{assignedErrors[coupon.id]}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(coupon)}
                    disabled={togglingId === coupon.id}
                    title={coupon.enabled ? 'Disable' : 'Enable'}
                    className="text-gray-400 hover:text-green-600 transition-colors p-1"
                  >
                    {togglingId === coupon.id
                      ? <Loader2 size={18} className="animate-spin" />
                      : coupon.enabled
                        ? <ToggleRight size={22} className="text-green-500" />
                        : <ToggleLeft size={22} />
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(coupon)}
                    disabled={deletingId === coupon.id}
                    title="Delete coupon"
                    className="text-gray-300 hover:text-red-500 transition-colors p-1"
                  >
                    {deletingId === coupon.id
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Trash2 size={15} />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
