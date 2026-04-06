'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin, getUserRole } from '@/app/actions/admin'
import { revalidatePath } from 'next/cache'
import { Shield, User, Briefcase, CheckCircle, Search } from 'lucide-react'

async function updateUserRole(formData: FormData) {
  'use server'
  const supabase = await createClient()
  await requireAdmin(supabase)

  const userId = formData.get('user_id') as string
  const role = formData.get('role') as string
  const verified = formData.get('verified') === 'true'

  await supabase.from('profiles').upsert({
    id: userId,
    role,
    verified,
  }, { onConflict: 'id' })

  revalidatePath('/admin/roles')
}

const ROLE_OPTIONS = [
  { value: 'user', label: 'User', color: 'bg-gray-100 text-gray-600', icon: '👤', desc: 'Standard community member' },
  { value: 'verified', label: 'Verified', color: 'bg-green-100 text-green-700', icon: '✅', desc: 'Trusted verified member' },
  { value: 'business_owner', label: 'Business Owner', color: 'bg-amber-100 text-amber-700', icon: '🏪', desc: 'Can manage own listings' },
  { value: 'job_reviewer', label: 'Job Reviewer', color: 'bg-purple-100 text-purple-700', icon: '💼', desc: 'Can approve/reject job postings only' },
  { value: 'moderator', label: 'Moderator', color: 'bg-blue-100 text-blue-700', icon: '🛡️', desc: 'Can approve/reject all content' },
  { value: 'admin', label: 'Admin', color: 'bg-red-100 text-red-700', icon: '⚡', desc: 'Full access including emergency & newsletter' },
]

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const { user: currentUser } = await getUserRole(supabase)
  await requireAdmin(supabase)

  const { q } = await searchParams

  // Fetch all profiles with auth email via join
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, verified, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  // Fetch emails from auth.users via admin client
  const { createAdminClient } = await import('@/lib/supabase/admin-client')
  const adminClient = createAdminClient()
  let emailMap: Record<string, string> = {}
  if (adminClient) {
    const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 200 })
    emailMap = Object.fromEntries(users.map(u => [u.id, u.email || '']))
  }

  const allUsers = (profiles || []).map(p => ({
    ...p,
    email: emailMap[p.id] || '',
    role: p.role || 'user',
  }))

  const filtered = q
    ? allUsers.filter(u =>
        u.email.toLowerCase().includes(q.toLowerCase()) ||
        (u.full_name || '').toLowerCase().includes(q.toLowerCase())
      )
    : allUsers

  const roleCounts = {
    admin: allUsers.filter(u => u.role === 'admin').length,
    moderator: allUsers.filter(u => u.role === 'moderator').length,
    business_owner: allUsers.filter(u => u.role === 'business_owner').length,
    job_reviewer: allUsers.filter(u => u.role === 'job_reviewer').length,
    user: allUsers.filter(u => u.role === 'user' || !u.role).length,
    verified: allUsers.filter(u => u.verified).length,
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <Shield size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Roles</h1>
          <p className="text-sm text-gray-500">Manage permissions for community members</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {ROLE_OPTIONS.map(r => (
          <div key={r.value} className="bg-white border border-gray-100 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">{r.icon}</div>
            <div className="text-xl font-bold text-gray-900">
              {r.value === 'verified' ? roleCounts.verified : roleCounts[r.value as keyof typeof roleCounts] ?? 0}
            </div>
            <div className="text-xs text-gray-500">{r.label}</div>
          </div>
        ))}
      </div>

      {/* Role descriptions */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Role Permissions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ROLE_OPTIONS.map(r => (
            <div key={r.value} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
              <span className="text-lg mt-0.5">{r.icon}</span>
              <div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.color}`}>{r.label}</span>
                <p className="text-xs text-gray-500 mt-1">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <form method="GET" className="mb-4 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name or email…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-warli-terra"
        />
      </form>

      {/* Users table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Members ({filtered.length})</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No users found</div>
          ) : filtered.map(u => (
            <div key={u.id} className="px-6 py-4 flex items-center gap-4">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-warli-light flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-warli-terra">
                  {(u.full_name || u.email || 'U')[0].toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {u.full_name || 'No name'}
                  </p>
                  {u.verified && (
                    <CheckCircle size={13} className="text-green-500 shrink-0" />
                  )}
                  {u.id === currentUser?.id && (
                    <span className="text-xs text-gray-400">(you)</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{u.email || u.id}</p>
              </div>

              {/* Current role badge */}
              <div className="hidden sm:block">
                {(() => {
                  const ro = ROLE_OPTIONS.find(r => r.value === (u.role || 'user'))
                  return ro ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ro.color}`}>
                      {ro.icon} {ro.label}
                    </span>
                  ) : null
                })()}
              </div>

              {/* Change role form */}
              <form action={updateUserRole} className="flex items-center gap-2 shrink-0">
                <input type="hidden" name="user_id" value={u.id} />
                <input type="hidden" name="verified" value={String(u.verified ?? false)} />
                <select
                  name="role"
                  defaultValue={u.role || 'user'}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-warli-terra bg-white"
                >
                  <option value="user">👤 User</option>
                  <option value="business_owner">🏪 Business Owner</option>
                  <option value="job_reviewer">💼 Job Reviewer</option>
                  <option value="moderator">🛡️ Moderator</option>
                  <option value="admin">⚡ Admin</option>
                </select>
                <button
                  type="submit"
                  className="text-xs bg-warli-terra text-white px-3 py-1.5 rounded-lg hover:bg-warli-deep transition-colors font-medium"
                >
                  Save
                </button>
              </form>

              {/* Toggle verified */}
              <form action={updateUserRole} className="shrink-0">
                <input type="hidden" name="user_id" value={u.id} />
                <input type="hidden" name="role" value={u.role || 'user'} />
                <input type="hidden" name="verified" value={String(!u.verified)} />
                <button
                  type="submit"
                  title={u.verified ? 'Remove verified' : 'Mark verified'}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    u.verified
                      ? 'bg-green-100 text-green-600 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <CheckCircle size={15} />
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
