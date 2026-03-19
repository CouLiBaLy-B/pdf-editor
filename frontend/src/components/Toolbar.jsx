import React from 'react'
import {
  MousePointer2, Type, Highlighter, Image as ImageIcon, PenLine,
  Link2, Scissors, ChevronLeft, ChevronRight,
} from 'lucide-react'

const GROUPS = [
  [
    { id: 'select',    Icon: MousePointer2, label: 'Curseur'   },
    { id: 'text',      Icon: Type,          label: 'Texte'     },
    { id: 'highlight', Icon: Highlighter,   label: 'Surligner' },
    { id: 'image',     Icon: ImageIcon,     label: 'Image'     },
  ],
  [
    { id: 'sign',  Icon: PenLine,  label: 'Signer'    },
  ],
  [
    { id: 'merge', Icon: Link2,    label: 'Combiner'  },
    { id: 'split', Icon: Scissors, label: 'Séparer'   },
  ],
]

export default function Toolbar({
  activeTool,
  onToolChange,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  hasFile,
}) {
  return (
    <div
      role="toolbar"
      aria-label="Outils d'édition PDF"
      className="flex items-center gap-0.5 px-4 py-1.5 bg-white border-b border-border shadow-sm shrink-0 overflow-x-auto"
    >
      {/* Tool groups */}
      {GROUPS.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && (
            <div className="w-px h-6 bg-border mx-2 shrink-0" aria-hidden="true" />
          )}
          {group.map(({ id, Icon, label }) => {
            const isActive  = activeTool === id
            const isDisabled = !hasFile && id !== 'merge'
            return (
              <button
                key={id}
                onClick={() => onToolChange(id)}
                disabled={isDisabled}
                aria-pressed={isActive}
                aria-label={label}
                title={label}
                className={[
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg shrink-0 min-w-[56px]',
                  'text-2xs font-semibold tracking-wide transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                  'disabled:opacity-30 disabled:cursor-not-allowed',
                  isActive
                    ? 'bg-brand text-white shadow-tool'
                    : 'text-ink-muted hover:text-ink hover:bg-surface-raised',
                ].join(' ')}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </button>
            )
          })}
        </React.Fragment>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Page navigation */}
      {totalPages > 0 && (
        <div
          className="flex items-center gap-1 bg-surface-raised border border-border rounded-lg px-2 py-1 shrink-0"
          role="group"
          aria-label="Navigation de page"
        >
          <button
            onClick={onPrevPage}
            disabled={currentPage <= 1}
            className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-white disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/40"
            aria-label="Page précédente"
          >
            <ChevronLeft size={13} />
          </button>
          <span
            className="text-xs font-medium text-ink tabular-nums min-w-[5ch] text-center select-none px-1"
            aria-live="polite"
            aria-atomic="true"
          >
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-white disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/40"
            aria-label="Page suivante"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
