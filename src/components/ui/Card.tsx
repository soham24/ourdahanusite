import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', hover = false, padding = 'md', children, ...props }, ref) => {
    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    }

    const classes = [
      'bg-white border border-[var(--od-border)] rounded-[var(--od-radius)] shadow-[var(--od-shadow-sm)] overflow-hidden',
      hover ? 'transition-all duration-200 hover:border-[rgba(192,88,46,0.35)] hover:shadow-[var(--od-shadow-md)] hover:-translate-y-[2px] active:scale-[0.98]' : '',
      paddings[padding],
      className
    ].filter(Boolean).join(' ')

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export default Card
