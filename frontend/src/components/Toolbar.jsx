import React, { useState } from 'react'
import {
  MousePointer2, Type, Highlighter, Image as ImageIcon, PenLine,
  Link2, Scissors, FileText, Minimize2, ImageDown, ScanText,
  ChevronLeft, ChevronRight,
} from 'lucide-react'

const GROUPS = [
  [
    { id: 'select',    Icon: MousePointer2, label: 'Curseur'   },
    { id: 'text',      Icon: Type,          label: 'Texte'     },
    { id: 'highlight', Icon: Highlighter,   label: 'Surligner' },
    { id: 'image',     Icon: ImageIcon,     label: 'Image'     },
  ],
  [
    { id: 'sign',     Icon: PenLine,  label: 'Signer'      },
    { id: 'metadata', Icon: FileText, label: 'Métadonnées' },
  ],
  [
    { id: 'merge', Icon: Link2,    label: 'Combiner' },
    { id: 'split', Icon: Scissors, label: 'Séparer'  },
  ],
  [
    { id: 'compress', Icon: Minimize2, label: 'Compresser' },
    { id: 'export',   Icon: ImageDown, label: 'Exporter'   },
    { id: 'ocr',      Icon: ScanText,  label: 'OCR'        },
  ],
]

function ToolBtn({ id, Icon, label, isActive, isDisabled, collapsed, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="relative flex justify-center">
      <button
        onClick={onClick}
        disabled={isDisabled}
        aria-pressed={isActive}
        aria-label={label}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={[
          'relative flex flex-col items-center gap-1 rounded-xl transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
          'disabled:opacity-30 disabled:cursor-not-allowed',
          collapsed ? 'w-10 h-10 justify-center' : 'w-12 py-2',
          isActive
            ? 'bg-brand text-white shadow-tool'
            : 'text-ink-muted hover:text-ink hover:bg-surface-raised',
        ].join(' ')}
      >
        <Icon size={16} aria-hidden="true" />
        {!collapsed && <span className="text-[10px] font-medium leading-none">{label}</span>}
      </button>
      {/* Tooltip when collapsed */}
      {collapsed && hovered && !isDisabled && (
        <div className="tool-tooltip" style={{ opacity: 1 }}>{label}</div>
      )}
    </div>
  )
}

export default function Toolbar({
  activeTool, onToolChange,
  currentPage, totalPages, onPrevPage, onNextPage,
  hasFile, collapsed,
}) {
  return (
    <nav
      aria-label="Outils d'édition"
      className="flex flex-col items-center py-3 gap-1 bg-white border-r border-border overflow-y-auto overflow-x-visible shrink-0"
      style={{ width: collapsed ? 52 : 64 }}
    >
      {GROUPS.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <hr className="w-8 border-border my-1" />}
          {group.map(({ id, Icon, label }) => (
            <ToolBtn
              key={id}
              id={id} Icon={Icon} label={label}
              isActive={activeTool === id}
              isDisabled={!hasFile && id !== 'merge'}
              collapsed={collapsed}
              onClick={() => onToolChange(id)}
            />
          ))}
        </React.Fragment>
      ))}

      {/* Page nav pinned to bottom */}
      {totalPages > 0 && (
        <div className="mt-auto flex flex-col items-center gap-1 pb-1">
          <hr className="w-8 border-border mb-1" />
          <button
            onClick={onPrevPage} disabled={currentPage <= 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-raised disabled:opacity-30 transition-colors"
            aria-label="Page précédente"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[10px] font-semibold text-ink tabular-nums text-center leading-tight">
            {currentPage}<br /><span className="text-ink-faint font-normal">/{totalPages}</span>
          </span>
          <button
            onClick={onNextPage} disabled={currentPage >= totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-raised disabled:opacity-30 transition-colors"
            aria-label="Page suivante"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </nav>
  )
}
