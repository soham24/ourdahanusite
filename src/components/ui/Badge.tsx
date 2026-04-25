import React from 'react'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'brand' | 'success' | 'danger' | 'gold' | 'outline'
  size?: 'xs' | 'sm' | 'md'
}

export default function Badge({
  children,
  className = '',
  variant = 'default',
  size = 'sm',
  ...props
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center gap-1.5 font-bold rounded-full border transition-colors'
  
  const variants = {
    default: 'bg-gray-100 text-gray-700 border-gray-200',
    brand: 'bg-[rgba(192,88,46,0.08)] text-[var(--od-brand)] border-[rgba(192,88,46,0.15)]',
    success: 'bg-green-50 text-green-700 border-green-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    gold: 'bg-[var(--od-gold)] text-[var(--od-ink)] border-transparent',
    outline: 'bg-transparent border-[var(--od-border)] text-[var(--od-ink-2)]',
  }

  const sizes = {
    xs: 'px-2 py-0.5 text-[10px] uppercase tracking-wide',
    sm: 'px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em]',
    md: 'px-3 py-1.5 text-xs',
  }

  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </span>
  )
}
