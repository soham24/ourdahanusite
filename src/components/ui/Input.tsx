import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, icon, id, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const errorId = error ? `${inputId}-error` : undefined
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-bold text-[var(--od-ink-2)] ml-1">
            {label}
          </label>
        )}
        <div className="relative group">
          {icon && (
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[var(--od-muted)]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className={`
              w-full h-12 rounded-xl border border-[var(--od-border)] bg-white px-4 text-sm text-[var(--od-ink)] outline-none transition-all
              placeholder:text-[var(--od-muted)]
              focus:border-[var(--od-brand)] focus:ring-4 focus:ring-[rgba(192,88,46,0.11)]
              group-hover:border-[rgba(192,88,46,0.35)]
              ${icon ? 'pl-11' : ''}
              ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-50/50' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} className="text-[11px] font-medium text-red-600 ml-1">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
