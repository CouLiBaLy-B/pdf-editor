import React from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './Button.jsx'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Supprimer',
  cancelLabel = 'Annuler',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-white border border-border rounded-xl shadow-dropdown w-full max-w-sm p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-danger/10 shrink-0">
              <AlertTriangle size={15} className="text-danger" />
            </div>
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand shrink-0"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>
        {description && (
          <p className="text-xs text-ink-muted leading-relaxed">{description}</p>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={variant} size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
