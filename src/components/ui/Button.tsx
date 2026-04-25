import React from 'react'
import Link from 'next/link'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  href?: string
  loading?: boolean
  icon?: React.ReactNode
  iconRight?: boolean
}

const Button = React.forwardRef<HTMLButtonElement & HTMLAnchorElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', href, loading, icon, iconRight, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none'
    
    const variants = {
      primary: 'bg-[var(--od-brand)] text-white shadow-[0_10px_24px_rgba(192,88,46,0.18)] hover:bg-[var(--od-brand-strong)] hover:shadow-[0_14px_30px_rgba(192,88,46,0.22)] hover:-translate-y-[1px]',
      secondary: 'bg-[var(--od-surface-soft)] text-[var(--od-ink-2)] border border-[var(--od-border)] hover:bg-[var(--od-border)] hover:text-[var(--od-brand-strong)] hover:border-[rgba(192,88,46,0.35)]',
      outline: 'bg-transparent border border-[var(--od-border)] text-[var(--od-ink-2)] hover:border-[var(--od-brand)] hover:text-[var(--od-brand)]',
      ghost: 'bg-transparent text-[var(--od-muted)] hover:bg-[var(--od-surface-soft)] hover:text-[var(--od-ink)]',
      danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    }

    const sizes = {
      sm: 'px-3.5 py-1.5 text-xs rounded-lg',
      md: 'px-5 py-2.5 text-sm rounded-xl',
      lg: 'px-7 py-3.5 text-base rounded-2xl',
    }

    const combinedClasses = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`

    const content = (
      <>
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {!loading && icon && !iconRight && icon}
        {children}
        {!loading && icon && iconRight && icon}
      </>
    )

    if (href) {
      return (
        <Link href={href} className={combinedClasses}>
          {content}
        </Link>
      )
    }

    return (
      <button ref={ref} className={combinedClasses} disabled={loading} {...props}>
        {content}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
