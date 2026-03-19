import React from 'react'

const variantClasses = {
  primary:   'bg-brand hover:bg-brand-dim text-white shadow-tool',
  secondary: 'bg-white hover:bg-surface-raised text-ink border border-border hover:border-border-strong',
  ghost:     'bg-transparent hover:bg-surface-raised text-ink-muted hover:text-ink',
  danger:    'bg-transparent hover:bg-red-50 text-danger border border-red-200 hover:border-red-400',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-5 py-2.5 text-sm rounded-xl gap-2 font-semibold',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  children,
  className = '',
  type = 'button',
  'aria-label': ariaLabel,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      className={[
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : children}
    </button>
  )
}
