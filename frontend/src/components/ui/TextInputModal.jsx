import React, { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button.jsx'

export function TextInputModal({ open, title, placeholder = '', initialValue = '', onConfirm, onCancel }) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setValue(initialValue)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, initialValue])

  const handleConfirm = () => {
    if (value.trim()) onConfirm(value.trim())
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') onCancel()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-white border border-border rounded-xl shadow-dropdown w-full max-w-sm p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <button
            onClick={onCancel}
            className="p-1 rounded text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-surface-raised text-ink placeholder-ink-faint rounded-lg px-3 py-2 text-sm border border-border focus:border-brand/60 focus:outline-none focus:ring-1 focus:ring-brand/20"
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
          <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!value.trim()}>
            Confirmer
          </Button>
        </div>
      </div>
    </div>
  )
}
