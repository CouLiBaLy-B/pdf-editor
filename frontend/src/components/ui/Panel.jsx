import React from 'react'
import { X } from 'lucide-react'

export function Panel({ title, icon: Icon, children, maxHeight = 'max-h-80', className = '', onClose }) {
  return (
    <div className={`flex flex-col bg-white border-t border-border overflow-auto shadow-panel animate-fade-up ${maxHeight} ${className}`}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
        {Icon && (
          <div className="w-6 h-6 rounded-lg bg-brand-light flex items-center justify-center shrink-0">
            <Icon size={12} className="text-brand" />
          </div>
        )}
        <h2 className="text-sm font-semibold text-ink flex-1">{title}</h2>
        {onClose && (
          <button onClick={onClose}
            className="p-1 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-raised transition-colors"
            aria-label="Fermer">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="p-4 flex flex-col gap-3">{children}</div>
    </div>
  )
}
