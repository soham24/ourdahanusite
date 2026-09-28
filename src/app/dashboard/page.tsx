import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { UserCircle, User, CheckCircle, Shield, Store, Edit2, LogOut, Calendar } from 'lucide-react'
import { updateProfile } from '@/app/actions/profile'
import { getUserRole } from '@/app/actions/admin'
import { siteConfig } from '@/lib/site'

export const unstable_instant = false

function ComingSoonBadge() {
  return (
    <span className="ml-1.5 text-[10px] font-semibold bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full align-middle">
      Soon
    </span>
  )
}

function ComingSoonSection({ title, icon, color }: { title: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-6 mb-6 opacity-60">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-400 flex items-center gap-2">
          <span className={color}>{icon}</span>
          {title}
        </h2>
        <span className="text-xs font-semibold bg-gray-100 text-gray-400 px-2.5 py-1 rounded-full">Coming Soon</span>
      </div>
      <p className="text-gray-300 text-sm text-center py-4">This feature is coming soon. Stay tuned!</p>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const avatar = user.user_metadata?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || user.email || 'U')}&background=16a34a&color=fff&size=100`
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Member'

  const { role, verified } = await getUserRole(supabase)

  let profileData: Record<string, unknown> | null = null

  try {
    const { data } = await supabase.from('profiles').select('full_name, phone, address').eq('id', user.id).single()
    profileData = data
  } catch {
    // DB not ready — use defaults
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Profile Card */}
      <div className="bg-gradient-to-br from-ink to-brand rounded-3xl p-5 sm:p-8 text-white mb-8">
        <div className="flex items-center gap-5">
          <Image src={avatar} alt={name} width={80} height={80} className="w-20 h-20 rounded-2xl border-4 border-white/30 object-cover" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">Welcome, {name.split(' ')[0]}!</h1>
            <p className="text-green-200 mt-0.5 text-sm truncate">{user.email}</p>
            {profileData?.phone ? (
              <p className="text-green-300 text-xs mt-0.5">{String(profileData.phone)}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {role === 'admin' && (
                <span className="inline-flex items-center gap-1 bg-red-500/30 text-red-100 rounded-full px-3 py-1 text-xs font-semibold">
                  <Shield size={11} /> Admin
                </span>
              )}
              {role === 'moderator' && (
                <span className="inline-flex items-center gap-1 bg-blue-500/30 text-blue-100 rounded-full px-3 py-1 text-xs font-semibold">
                  <Shield size={11} /> Moderator
                </span>
              )}
              {role === 'business_owner' && (
                <span className="inline-flex items-center gap-1 bg-amber-500/30 text-amber-100 rounded-full px-3 py-1 text-xs font-semibold">
                  🏪 Business Owner
                </span>
              )}
              {verified && (
                <span className="inline-flex items-center gap-1 bg-green-500/30 text-green-100 rounded-full px-3 py-1 text-xs font-semibold">
                  <CheckCircle size={11} /> Verified Member
                </span>
              )}
              {role === 'user' && !verified && (
                <span className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-sm">
                  <span className="w-2 h-2 bg-green-300 rounded-full" />
                  ${siteConfig.name} Member
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* My Business — live */}
        <Link href="/my-business"
          className="bg-white border border-gray-100 hover:border-border hover:shadow-md rounded-2xl p-4 text-center transition-all group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 bg-surface-soft text-brand">
            <Store size={18} />
          </div>
          <div className="text-2xl font-bold text-gray-900 group-hover:text-brand transition-colors">🏪</div>
          <div className="text-xs text-gray-500">My Listings</div>
        </Link>

        <Link href="/dashboard/appointments"
          className="bg-white border border-gray-100 hover:border-border hover:shadow-md rounded-2xl p-4 text-center transition-all group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 bg-surface-soft text-brand">
            <Calendar size={18} />
          </div>
          <div className="text-2xl font-bold text-gray-900 group-hover:text-brand transition-colors">↗</div>
          <div className="text-xs text-gray-500">Appointments</div>
        </Link>
      </div>

      {/* Quick Actions */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
        {/* Live actions */}
        <Link href="/profile"
          className="bg-white border border-gray-100 hover:border-border hover:shadow-md rounded-2xl p-4 text-center transition-all group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 bg-surface-soft text-brand">
            <UserCircle size={18} />
          </div>
          <div className="text-xs font-semibold text-gray-700 group-hover:text-brand transition-colors">Edit Profile</div>
        </Link>

        {/* Add Listing — live */}
        <Link href="/listings/submit"
          className="bg-white border border-gray-100 hover:border-border hover:shadow-md rounded-2xl p-4 text-center transition-all group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 bg-surface-soft text-brand">
            <Store size={18} />
          </div>
          <div className="text-xs font-semibold text-gray-700 group-hover:text-brand transition-colors">Add Listing</div>
        </Link>

        <Link href="/dashboard/appointments"
          className="bg-white border border-gray-100 hover:border-border hover:shadow-md rounded-2xl p-4 text-center transition-all group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 bg-surface-soft text-brand">
            <Calendar size={18} />
          </div>
          <div className="text-xs font-semibold text-gray-700 group-hover:text-brand transition-colors">My Appointments</div>
        </Link>

        {/* Coming soon quick actions */}
        {[
          { label: 'Post Event', emoji: '📅' },
        ].map(a => (
          <div key={a.label} className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-4 text-center opacity-50 cursor-not-allowed">
            <div className="text-2xl mb-2">{a.emoji}</div>
            <div className="text-xs font-semibold text-gray-300">{a.label}<ComingSoonBadge /></div>
          </div>
        ))}
      </div>

      {/* Coming Soon sections */}
      <ComingSoonSection title="My Events" icon={<span className="text-xl">📅</span>} color="text-[var(--od-brand)]" />
      <ComingSoonSection title="My Business Listings" icon={<span className="text-xl">📍</span>} color="text-[var(--od-gold)]" />

      {/* Edit Profile */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Edit2 size={18} className="text-brand" />
          Edit Profile
        </h2>
        <form action={updateProfile} className="space-y-4">
          <div>
            <label htmlFor="full_name" className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
            <input
              type="text" id="full_name" name="full_name"
              defaultValue={(profileData?.full_name as string) || user.user_metadata?.full_name || ''}
              placeholder="Your full name"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1.5">Phone</label>
              <input
                type="tel" id="phone" name="phone"
                defaultValue={(profileData?.phone as string) || ''}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm"
              />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-1.5">Address</label>
              <input
                type="text" id="address" name="address"
                defaultValue={(profileData?.address as string) || ''}
                placeholder={`${siteConfig.town}, Palghar`}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm"
              />
            </div>
          </div>
          <button type="submit"
            className="bg-brand hover:bg-brand-strong text-bg font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm">
            Save Changes
          </button>
        </form>
      </div>

      {/* Account info */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <User size={18} className="text-brand" />
          Your Account
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Email</span>
            <span className="font-medium text-gray-900">{user.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Sign-in Method</span>
            <span className="font-medium text-gray-900">Google</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Member Since</span>
            <span className="font-medium text-gray-900">
              {new Date(user.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}
            </span>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <form action="/auth/signout" method="post">
        <button type="submit" className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium text-sm">
          <LogOut size={16} />
          Sign Out
        </button>
      </form>
    </div>
  )
}
