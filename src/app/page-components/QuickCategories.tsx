import SafeAppLink from '@/components/SafeAppLink'
import { getCategoryPath } from '@/lib/listing-category'

export default function QuickCategories() {
  const categories = [
    {
      icon: '🍽️',
      label: 'Dining',
      href: getCategoryPath('Homemade Food'),
      bg: 'bg-[#FFE6CC]',
      fg: 'text-[#7A3D14]',
    },
    {
      icon: '🛏️',
      label: 'Stays',
      href: '/listings',
      bg: 'bg-[#E8E0F4]',
      fg: 'text-[#3D2A6E]',
    },
    {
      icon: '🛍️',
      label: 'Shops',
      href: '/listings',
      bg: 'bg-[#FBF0DC]',
      fg: 'text-[#7A4520]',
    },
    {
      icon: '🩺',
      label: 'Health',
      href: getCategoryPath('Healthcare & Clinics'),
      bg: 'bg-[#FFE0E0]',
      fg: 'text-[#7A1A1A]',
    },
    {
      icon: '🌿',
      label: 'Nature',
      href: '/listings',
      bg: 'bg-[#DDEFE0]',
      fg: 'text-[#1F4A28]',
    },
    {
      icon: '💼',
      label: 'Jobs',
      href: '/jobs',
      bg: 'bg-[#E0EAF8]',
      fg: 'text-[#1A3D7A]',
    },
    {
      icon: '🆘',
      label: 'Emergency',
      href: '/emergency',
      bg: 'bg-[#FFE0E0]',
      fg: 'text-[#7A1A1A]',
    },
  ]

  return (
    <section className="bg-white border-b border-[var(--color-border)]">
      <div className="max-w-[1160px] mx-auto px-5 md:px-6 py-7">
        <div className="flex items-center justify-between sm:justify-around gap-4 overflow-x-auto scrollbar-hide -mx-2 px-2">
          {categories.map((item) => (
            <SafeAppLink
              key={item.label}
              href={item.href}
              prefetch={false}
              className="group flex flex-col items-center gap-2 min-w-[72px] flex-shrink-0"
            >
              <span
                className={`w-16 h-16 rounded-full ${item.bg} ${item.fg} flex items-center justify-center text-[26px] shadow-[0_2px_10px_rgba(46,18,5,0.06)] transition-transform duration-200 group-active:scale-95 group-hover:-translate-y-[2px] group-hover:shadow-[0_8px_20px_rgba(192,88,46,0.18)]`}
                aria-hidden
              >
                {item.icon}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#7A4520] whitespace-nowrap">
                {item.label}
              </span>
            </SafeAppLink>
          ))}
        </div>
      </div>
    </section>
  )
}
