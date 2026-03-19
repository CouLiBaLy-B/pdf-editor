import React from 'react'

const variantClasses = {
  default: 'bg-surface-overlay text-ink-muted',
  success: 'bg-success/15 text-success',
  danger:  'bg-danger/15 text-danger',
  warning: 'bg-amber-500/15 text-amber-600',
}

export function Badge({ variant = 'default', children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}
