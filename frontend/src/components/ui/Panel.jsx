import React from 'react'
import { X } from 'lucide-react'

export function Panel({ title, icon: Icon, children, maxHeight = 'max-h-80', className = '', onClose }) {
  return (
    <div className={`flex flex-col bg-white border-t border-border overflow-auto shadow-panel animate-fade-up ${maxHeight} ${className}`}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0 bg-surface-raised">
        {Icon && (
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-brand/10 shrink-0">
            <Icon size={12} className="text-brand" aria-hidden="true" />
          </div>
        )}
        <h2 className="text-sm font-semibold text-ink flex-1">{title}</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white text-ink-muted hover:text-ink transition-colors"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="p-4 flex flex-col gap-3">
        {children}
      </div>
    </div>
  )
}
