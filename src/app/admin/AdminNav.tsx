'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  BadgePercent,
  BarChart3,
  Briefcase,
  Calendar,
  CreditCard,
  LayoutDashboard,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Newspaper,
  Package,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Users,
} from 'lucide-react'

type AdminRole = 'admin' | 'moderator' | 'job_reviewer'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  roles: AdminRole[]
}

const MOD_ROLES: AdminRole[] = ['admin', 'moderator']
const ADMIN_ONLY: AdminRole[] = ['admin']

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, roles: ['admin', 'moderator', 'job_reviewer'] },
  { href: '/admin/jobs', label: 'Jobs', icon: Briefcase, roles: ['admin', 'moderator', 'job_reviewer'] },
  { href: '/admin/news', label: 'News', icon: Newspaper, roles: MOD_ROLES },
  { href: '/admin/events', label: 'Events', icon: Calendar, roles: MOD_ROLES },
  { href: '/admin/listings', label: 'Listings', icon: MapPin, roles: MOD_ROLES },
  { href: '/admin/classifieds', label: 'Classifieds', icon: Package, roles: MOD_ROLES },
  { href: '/admin/forum', label: 'Forum', icon: MessageCircle, roles: MOD_ROLES },
  { href: '/admin/featured', label: 'Featured', icon: Sparkles, roles: ADMIN_ONLY },
  { href: '/admin/polls', label: 'Polls', icon: BarChart3, roles: ADMIN_ONLY },
  { href: '/admin/appointments', label: 'Appointments', icon: Calendar, roles: ADMIN_ONLY },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard, roles: ADMIN_ONLY },
  { href: '/admin/payment-intents', label: 'Payment Intents', icon: ShieldAlert, roles: ADMIN_ONLY },
  { href: '/admin/products', label: 'Products', icon: Package, roles: ADMIN_ONLY },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag, roles: ADMIN_ONLY },
  { href: '/admin/emergency', label: 'Emergency', icon: Megaphone, roles: ADMIN_ONLY },
  { href: '/admin/newsletter', label: 'Newsletter', icon: Mail, roles: ADMIN_ONLY },
  { href: '/admin/roles', label: 'Roles', icon: Users, roles: ADMIN_ONLY },
  { href: '/admin/pricing', label: 'Pricing', icon: BadgePercent, roles: ADMIN_ONLY },
]

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname()
  const links = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <nav aria-label="Admin navigation" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 py-2">
        {links.map((item) => {
          const Icon = item.icon
          const active = isActive(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors ${
                active
                  ? 'border-[rgba(192,88,46,0.28)] bg-[rgba(192,88,46,0.09)] text-[var(--od-brand-strong)]'
                  : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={15} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
