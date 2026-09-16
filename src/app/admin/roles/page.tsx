import Link from 'next/link'
import { CheckCircle, Search, Shield } from 'lucide-react'
import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin-client'
import { createClient } from '@/lib/supabase/server'
import { getUserRole, requireAdmin } from '@/app/actions/admin'

const USERS_PER_PAGE = 50

// The four values profiles.role can actually hold — both live DB check
// constraints (profiles_role_check, profiles_role_valid) only allow these.
// This is the single source of truth: the server action's whitelist and the
// role <select>'s options are both derived from it, so they can never drift
// out of sync with each other or with what the database will accept.
const ROLE_OPTIONS = [
  { value: 'user', label: 'User', color: 'bg-gray-100 text-gray-600', icon: '👤', desc: 'Standard community member' },
  { value: 'business_owner', label: 'Business Owner', color: 'bg-amber-100 text-amber-700', icon: '🏪', desc: 'Can manage own listings' },
  { value: 'moderator', label: 'Moderator', color: 'bg-blue-100 text-blue-700', icon: '🛡️', desc: 'Can approve/reject all content' },
  { value: 'admin', label: 'Admin', color: 'bg-red-100 text-red-700', icon: '⚡', desc: 'Full access including emergency & newsletter' },
]

const ROLE_VALUES = ROLE_OPTIONS.map((option) => option.value)

// "Verified" is not a role — it's the separate `profiles.verified` boolean
// that the verify toggle button sets. It is shown alongside the role tiles
// and permissions grid for context only: it must never be offered in the
// role <select> or accepted by updateUserRole's whitelist, since the
// database would reject it as a role value.
const VERIFIED_STAT = { value: 'verified', label: 'Verified', color: 'bg-green-100 text-green-700', icon: '✅', desc: 'Has the separate "verified" flag set — not a role' }

// Display-only list for the stat tiles and permissions grid, in the
// original on-screen order (User, Verified, Business Owner, Moderator, Admin).
const DISPLAY_TILES = [ROLE_OPTIONS[0], VERIFIED_STAT, ROLE_OPTIONS[1], ROLE_OPTIONS[2], ROLE_OPTIONS[3]]

type RolesSearchParams = {
  page?: string
  q?: string
}

type RoleCountKey = 'admin' | 'moderator' | 'business_owner' | 'user' | 'verified'

type MemberRow = {
  id: string
  email: string
  full_name: string | null
  role: string
  verified: boolean
}

async function updateUserRole(formData: FormData) {
  'use server'

  const supabase = await createClient()
  await requireAdmin(supabase)

  const userId = formData.get('user_id') as string
  const role = formData.get('role') as string
  const verified = formData.get('verified') === 'true'

  if (!ROLE_VALUES.includes(role)) throw new Error('Invalid role.')
  const admin = createAdminClient()
  if (!admin) throw new Error('Admin client unavailable.')
  const { error } = await admin.from('profiles').upsert({
    id: userId,
    role,
    verified,
  }, { onConflict: 'id' })

  if (error) throw new Error('Could not update this member.')
  revalidatePath('/admin/roles')
}

function parsePositiveInt(value?: string): number {
  const parsed = Number.parseInt(value ?? '1', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function sanitizeSearchQuery(value: string): string {
  return value.replace(/[,%]/g, ' ').trim()
}

async function getRoleCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  totalUsers: number,
): Promise<Record<RoleCountKey, number>> {
  const [
    adminResult,
    moderatorResult,
    businessOwnerResult,
    verifiedResult,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'moderator'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'business_owner'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('verified', true),
  ])

  const adminCount = adminResult.count ?? 0
  const moderatorCount = moderatorResult.count ?? 0
  const businessOwnerCount = businessOwnerResult.count ?? 0

  return {
    admin: adminCount,
    moderator: moderatorCount,
    business_owner: businessOwnerCount,
    user: Math.max(totalUsers - adminCount - moderatorCount - businessOwnerCount, 0),
    verified: verifiedResult.count ?? 0,
  }
}

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<RolesSearchParams>
}) {
  const supabase = await createClient()
  const { user: currentUser } = await getUserRole(supabase)
  await requireAdmin(supabase)

  const { q, page } = await searchParams
  const searchQuery = q?.trim() ?? ''
  let currentPage = parsePositiveInt(page)

  const adminClient = createAdminClient()
  if (!adminClient) throw new Error('Admin client unavailable.')

  let totalUsers = 0
  let filteredCount = 0
  let totalPages = 1
  let members: MemberRow[] = []

  if (searchQuery) {
    const sanitizedQuery = sanitizeSearchQuery(searchQuery)

    const fetchProfilesPage = async (pageNumber: number) => {
      const from = (pageNumber - 1) * USERS_PER_PAGE
      const to = from + USERS_PER_PAGE - 1

      return adminClient
        .from('profiles')
        .select('id, full_name, email, role, verified', { count: 'exact' })
        .or(`full_name.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%`)
        .order('created_at', { ascending: false })
        .range(from, to)
    }

    let profilePage = await fetchProfilesPage(currentPage)
    filteredCount = profilePage.count ?? 0
    totalPages = Math.max(1, Math.ceil(filteredCount / USERS_PER_PAGE))

    if (currentPage > totalPages) {
      currentPage = totalPages
      profilePage = await fetchProfilesPage(currentPage)
    }

    members = (profilePage.data ?? []).map((profile) => ({
      id: profile.id,
      email: profile.email ?? '',
      full_name: profile.full_name ?? null,
      role: profile.role || 'user',
      verified: Boolean(profile.verified),
    }))

    if (adminClient) {
      const authPage = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1 })
      if (!authPage.error) {
        totalUsers = authPage.data.total
      }
    }

    if (!totalUsers) {
      totalUsers = filteredCount
    }
  } else if (adminClient) {
    let authPage = await adminClient.auth.admin.listUsers({
      page: currentPage,
      perPage: USERS_PER_PAGE,
    })

    if (!authPage.error) {
      totalUsers = authPage.data.total
      totalPages = Math.max(authPage.data.lastPage, 1)
      filteredCount = totalUsers

      if (currentPage > totalPages) {
        currentPage = totalPages
        authPage = await adminClient.auth.admin.listUsers({
          page: currentPage,
          perPage: USERS_PER_PAGE,
        })
      }

      if (!authPage.error) {
        const users = authPage.data.users
        const userIds = users.map((user) => user.id)

        let profileMap: Record<string, { full_name: string | null; role: string | null; verified: boolean | null }> = {}

        if (userIds.length > 0) {
          const { data: profiles } = await adminClient
            .from('profiles')
            .select('id, full_name, role, verified')
            .in('id', userIds)

          profileMap = Object.fromEntries(
            (profiles ?? []).map((profile) => [
              profile.id,
              {
                full_name: profile.full_name ?? null,
                role: profile.role ?? null,
                verified: profile.verified ?? null,
              },
            ]),
          )
        }

        members = users.map((user) => {
          const profile = profileMap[user.id]
          const metadataName =
            typeof user.user_metadata?.full_name === 'string'
              ? user.user_metadata.full_name
              : typeof user.user_metadata?.name === 'string'
                ? user.user_metadata.name
                : null

          return {
            id: user.id,
            email: user.email ?? '',
            full_name: profile?.full_name ?? metadataName,
            role: profile?.role || 'user',
            verified: Boolean(profile?.verified),
          }
        })
      }
    }
  }

  const roleCounts = await getRoleCounts(adminClient, totalUsers)
  const showingFrom = filteredCount === 0 ? 0 : ((currentPage - 1) * USERS_PER_PAGE) + 1
  const showingTo = filteredCount === 0 ? 0 : Math.min(currentPage * USERS_PER_PAGE, filteredCount)

  const buildPageHref = (pageNumber: number) => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (pageNumber > 1) params.set('page', String(pageNumber))
    const queryString = params.toString()
    return queryString ? `/admin/roles?${queryString}` : '/admin/roles'
  }

  const membersHeading = searchQuery
    ? `Members (${filteredCount} match${filteredCount === 1 ? '' : 'es'})`
    : `Members (${totalUsers})`

  const membersSubheading = searchQuery
    ? `Showing ${showingFrom}-${showingTo} of ${filteredCount} matching members. ${totalUsers} total account${totalUsers === 1 ? '' : 's'}.`
    : `Showing ${showingFrom}-${showingTo} of ${totalUsers} total account${totalUsers === 1 ? '' : 's'}.`

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <Shield size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Roles</h1>
          <p className="text-sm text-gray-500">
            Manage permissions for community members
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {DISPLAY_TILES.map((roleOption) => (
          <div key={roleOption.value} className="bg-white border border-gray-100 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">{roleOption.icon}</div>
            <div className="text-xl font-bold text-gray-900">
              {roleOption.value === 'verified'
                ? roleCounts.verified
                : roleCounts[roleOption.value as keyof typeof roleCounts] ?? 0}
            </div>
            <div className="text-xs text-gray-500">{roleOption.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Role Permissions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DISPLAY_TILES.map((roleOption) => (
            <div key={roleOption.value} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
              <span className="text-lg mt-0.5">{roleOption.icon}</span>
              <div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${roleOption.color}`}>{roleOption.label}</span>
                <p className="text-xs text-gray-500 mt-1">{roleOption.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form method="GET" className="mb-4 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          name="q"
          defaultValue={searchQuery}
          placeholder="Search by name or email..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand"
        />
      </form>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-bold text-gray-900">{membersHeading}</h2>
          <p className="text-xs text-gray-400">{membersSubheading}</p>
        </div>

        <div className="divide-y divide-gray-50">
          {members.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No users found</div>
          ) : members.map((member) => (
            <div key={member.id} className="px-6 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-surface-soft flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-brand">
                  {(member.full_name || member.email || 'U')[0].toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {member.full_name || 'No name'}
                  </p>
                  {member.verified && (
                    <CheckCircle size={13} className="text-green-500 shrink-0" />
                  )}
                  {member.id === currentUser?.id && (
                    <span className="text-xs text-gray-400">(you)</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{member.email || member.id}</p>
              </div>

              <div className="hidden sm:block">
                {(() => {
                  const roleOption = ROLE_OPTIONS.find((option) => option.value === (member.role || 'user'))
                  return roleOption ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleOption.color}`}>
                      {roleOption.icon} {roleOption.label}
                    </span>
                  ) : null
                })()}
              </div>

              <form action={updateUserRole} className="flex items-center gap-2 shrink-0">
                <input type="hidden" name="user_id" value={member.id} />
                <input type="hidden" name="verified" value={String(member.verified ?? false)} />
                <select
                  name="role"
                  defaultValue={member.role || 'user'}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand bg-white"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.icon} {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-strong transition-colors font-medium"
                >
                  Save
                </button>
              </form>

              <form action={updateUserRole} className="shrink-0">
                <input type="hidden" name="user_id" value={member.id} />
                <input type="hidden" name="role" value={member.role || 'user'} />
                <input type="hidden" name="verified" value={String(!member.verified)} />
                <button
                  type="submit"
                  title={member.verified ? 'Remove verified' : 'Mark verified'}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    member.verified
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

        {filteredCount > 0 && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-400">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={buildPageHref(currentPage - 1)}
                aria-disabled={currentPage <= 1}
                className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  currentPage <= 1
                    ? 'pointer-events-none bg-gray-100 text-gray-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Previous
              </Link>
              <Link
                href={buildPageHref(currentPage + 1)}
                aria-disabled={currentPage >= totalPages}
                className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  currentPage >= totalPages
                    ? 'pointer-events-none bg-gray-100 text-gray-300'
                    : 'bg-brand text-white hover:bg-brand-strong'
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
