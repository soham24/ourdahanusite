'use client'

import { useState, useEffect, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import ImageUpload from '@/components/ImageUpload'
import { updateProfileFull } from '@/app/actions/profile'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, CheckCircle, Loader2, Camera } from 'lucide-react'
import { loginHref } from '@/lib/login-redirect'

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [profile, setProfile] = useState<Record<string, string> | null>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [profileLoading, setProfileLoading] = useState(true)

  const [state, formAction, pending] = useActionState(updateProfileFull, null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      // replace, not push: this page is only reachable signed in, so it has
      // no business sitting in history behind the sign-in screen.
      router.replace(loginHref('/profile'))
      return
    }

    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, bio, phone, address, avatar_url')
        .eq('id', user!.id)
        .single()

      if (data) {
        setProfile(data)
        setAvatarUrl(data.avatar_url || user!.user_metadata?.avatar_url || '')
      } else {
        setAvatarUrl(user!.user_metadata?.avatar_url || '')
      }

      setProfileLoading(false)
    }
    load()
  }, [user, authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const loading = authLoading || profileLoading

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand" size={32} />
      </div>
    )
  }

  if (!user) return null

  const displayAvatar =
    avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user.user_metadata?.full_name || user.email || 'U'
    )}&background=C4663A&color=FBF0DC&size=200`

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-brand mb-6 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink">My Profile</h1>
        <p className="text-ink-2 mt-1">Update your photo, name, and bio</p>
      </div>

      {state?.success && (
        <div className="bg-chikoo-leaf/10 border border-chikoo-leaf/30 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <CheckCircle size={18} className="text-chikoo-leaf flex-shrink-0" />
          <p className="text-sm font-medium text-ink">Profile saved successfully!</p>
        </div>
      )}

      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {/* Hidden avatar_url input — updated by ImageUpload below */}
        <input type="hidden" name="avatar_url" value={avatarUrl} />

        {/* Avatar */}
        <div className="bg-bg border border-border rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
            <Camera size={15} />
            Profile Photo
          </h2>
          <div className="flex items-center gap-5 mb-5">
            <Image
              src={displayAvatar}
              alt="Avatar"
              width={80}
              height={80}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-border flex-shrink-0"
            />
            <div>
              <p className="text-sm font-medium text-ink">
                {profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0]}
              </p>
              <p className="text-xs text-ink-2/70 mt-0.5">{user.email}</p>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="text-xs text-red-600 hover:text-red-700 mt-1 transition-colors"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
          <ImageUpload
            bucket="uploads"
            onUpload={(url) => setAvatarUrl(url)}
            label="Upload new photo"
          />
        </div>

        {/* Basic Info */}
        <div className="bg-bg border border-border rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-ink">Basic Information</h2>

          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-ink-2 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              id="full_name"
              name="full_name"
              autoComplete="name"
              defaultValue={profile?.full_name || user.user_metadata?.full_name || ''}
              placeholder="Your full name"
              className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-brand bg-white text-sm text-ink"
            />
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-ink-2 mb-1.5">
              Bio
              <span className="text-ink-2/50 font-normal ml-1">— a short note about yourself</span>
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={3}
              defaultValue={profile?.bio || ''}
              placeholder="e.g. Dahanu local, chikoo farmer, loves the beach…"
              className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-brand bg-white text-sm text-ink resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-ink-2 mb-1.5">
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                autoComplete="tel"
                defaultValue={profile?.phone || ''}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-brand bg-white text-sm text-ink"
              />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-ink-2 mb-1.5">
                Location
              </label>
              <input
                type="text"
                id="address"
                name="address"
                autoComplete="street-address"
                defaultValue={profile?.address || ''}
                placeholder="Dahanu, Palghar"
                className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-brand bg-white text-sm text-ink"
              />
            </div>
          </div>
        </div>

        {/* Account info (read-only) */}
        <div className="bg-border/30 border border-border rounded-2xl p-5 text-sm">
          <div className="flex justify-between py-1.5">
            <span className="text-ink-2/70">Email</span>
            <span className="text-ink font-medium">{user.email}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-ink-2/70">Member since</span>
            <span className="text-ink font-medium">
              {new Date(user.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-brand hover:bg-brand-strong disabled:opacity-60 text-bg font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {pending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Saving…
            </>
          ) : (
            'Save Profile'
          )}
        </button>
      </form>
    </div>
  )
}
