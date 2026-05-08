import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink, Shield } from 'lucide-react'
import { getUserRole } from '@/app/actions/admin'
import AdminNav from './AdminNav'

export const unstable_instant = false

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'border-red-200 bg-red-50 text-red-700' },
  moderator: { label: 'Moderator', color: 'border-blue-200 bg-blue-50 text-blue-700' },
  job_reviewer: { label: 'Job Reviewer', color: 'border-purple-200 bg-purple-50 text-purple-700' },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { user, role } = await getUserRole(supabase)

  if (!user || (role !== 'admin' && role !== 'moderator' && role !== 'job_reviewer')) {
    redirect('/')
  }

  const badge = ROLE_BADGE[role]

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 font-bold text-[var(--od-ink)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--od-ink)] text-white">
                  <Shield size={17} />
                </span>
                <span>OurDahanu Admin</span>
              </div>
              {badge && (
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.color}`}>
                  {badge.label}
                </span>
              )}
              <span className="hidden min-w-0 truncate text-xs text-gray-500 sm:inline">
                {user.email ?? 'Signed in'}
              </span>
            </div>
            <Link
              href="/"
              className="inline-flex h-9 w-fit items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition-colors hover:border-[rgba(192,88,46,0.35)] hover:text-[var(--od-brand)]"
            >
              View site
              <ExternalLink size={14} />
            </Link>
          </div>
          <AdminNav role={role} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
