import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Calendar, MapPin, Newspaper, MessageCircle, Package, Megaphone, Shield, Mail, Briefcase, Users, BadgePercent, ShoppingBag, Sparkles } from 'lucide-react'
import { getUserRole } from '@/app/actions/admin'

export const unstable_instant = false

// Links visible to both admin and moderator
const MOD_LINKS = [
  { href: '/admin', label: 'Overview', icon: <LayoutDashboard size={16} /> },
  { href: '/admin/jobs', label: 'Jobs', icon: <Briefcase size={16} /> },
  { href: '/admin/news', label: 'News', icon: <Newspaper size={16} /> },
  { href: '/admin/events', label: 'Events', icon: <Calendar size={16} /> },
  { href: '/admin/listings', label: 'Listings', icon: <MapPin size={16} /> },
  { href: '/admin/classifieds', label: 'Classifieds', icon: <Package size={16} /> },
  { href: '/admin/forum', label: 'Forum', icon: <MessageCircle size={16} /> },
]

// Extra links visible to admin only
const ADMIN_ONLY_LINKS = [
  { href: '/admin/featured', label: 'Featured', icon: <Sparkles size={16} /> },
  { href: '/admin/orders', label: 'Orders', icon: <ShoppingBag size={16} /> },
  { href: '/admin/emergency', label: 'Emergency', icon: <Megaphone size={16} /> },
  { href: '/admin/newsletter', label: 'Newsletter', icon: <Mail size={16} /> },
  { href: '/admin/roles', label: 'Roles', icon: <Users size={16} /> },
  { href: '/admin/pricing', label: 'Pricing & Coupons', icon: <BadgePercent size={16} /> },
]

// Links visible to job_reviewer only
const JOB_REVIEWER_LINKS = [
  { href: '/admin/jobs', label: 'Jobs', icon: <Briefcase size={16} /> },
]

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  admin:         { label: 'Admin', color: 'bg-red-100 text-red-700' },
  moderator:     { label: 'Moderator', color: 'bg-blue-100 text-blue-700' },
  job_reviewer:  { label: 'Job Reviewer', color: 'bg-purple-100 text-purple-700' },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { user, role } = await getUserRole(supabase)

  if (!user || (role !== 'admin' && role !== 'moderator' && role !== 'job_reviewer')) {
    redirect('/')
  }

  const badge = ROLE_BADGE[role]
  const navLinks =
    role === 'admin' ? [...MOD_LINKS, ...ADMIN_ONLY_LINKS] :
    role === 'job_reviewer' ? JOB_REVIEWER_LINKS :
    MOD_LINKS

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-warli-terra font-bold">
                <Shield size={18} />
                <span>OurDahanu Admin</span>
              </div>
              {badge && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
                  {badge.label}
                </span>
              )}
              <span className="text-gray-200 hidden sm:inline">|</span>
              <span className="text-xs text-gray-400 hidden sm:inline">{user.email}</span>
            </div>
            <Link href="/" className="text-xs text-gray-500 hover:text-warli-terra transition-colors">
              View Site &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto py-2">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-warli-light hover:text-warli-terra transition-colors whitespace-nowrap"
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
