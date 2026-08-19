import React, { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { replaceText } from '../services/api'

function groupTextItems(items) {
  const blocks = []
  for (const item of items) {
    if (!item.str?.trim()) continue
    const x = item.transform[4]
    const y = item.transform[5]
    const fontSize = Math.abs(item.transform[3]) || Math.abs(item.transform[0]) || item.height || 10
    const width = Math.max(item.width || 0, 1)
    const previous = blocks.at(-1)
    const gap = previous ? x - (previous.x_pdf + previous.width_pdf) : Infinity
    const sameLine = previous && Math.abs(previous.y_pdf_baseline - y) < fontSize * 0.35 && gap > -fontSize && gap < fontSize * 1.5

    if (sameLine && !previous.hasEOL) {
      const needsSpace = gap > fontSize * 0.2 && !previous.str.endsWith(' ') && !item.str.startsWith(' ')
      previous.str += `${needsSpace ? ' ' : ''}${item.str}`
      previous.width_pdf = Math.max(previous.width_pdf, x + width - previous.x_pdf)
      previous.hasEOL = Boolean(item.hasEOL)
    } else {
      blocks.push({
        str: item.str,
        x_pdf: x,
        y_pdf_baseline: y,
        width_pdf: width,
        fontSize_pdf: fontSize,
        hasEOL: Boolean(item.hasEOL),
      })
    }
  }
  return blocks
}

function TextBlock({ block, viewport, fileId, currentPage, onSaved }) {
  const cancelledRef = useRef(false)
  const savingRef = useRef(false)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(block.str)
  const [saving, setSaving] = useState(false)

  const [left, baseline] = viewport.convertToViewportPoint(block.x_pdf, block.y_pdf_baseline)
  const fontSize = Math.max(8, block.fontSize_pdf * viewport.scale)
  const width = Math.max(block.width_pdf * viewport.scale, 36)
  const height = fontSize * 1.45
  const top = baseline - fontSize * 0.92

  const save = async () => {
    if (cancelledRef.current) {
      cancelledRef.current = false
      setValue(block.str)
      return
    }
    const cleanValue = value.replace(/\n/g, ' ')
    if (cleanValue === block.str || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      await replaceText(fileId, {
        page: currentPage - 1,
        x_pdf: block.x_pdf,
        y_pdf_baseline: block.y_pdf_baseline,
        width_pdf: block.width_pdf,
        new_text: cleanValue,
        font_size: block.fontSize_pdf,
        color: [0, 0, 0],
      })
      toast.success(cleanValue ? 'Texte mis à jour' : 'Texte supprimé')
      await onSaved?.()
    } catch (error) {
      setValue(block.str)
      toast.error(error.response?.data?.detail || 'La modification du texte a échoué')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        disabled={saving}
        onChange={event => setValue(event.target.value)}
        onBlur={() => { setEditing(false); save() }}
        onKeyDown={event => {
          event.stopPropagation()
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            cancelledRef.current = true
            event.currentTarget.blur()
          }
        }}
        aria-label={`Modifier le texte : ${block.str}`}
        className="absolute rounded border-2 border-brand bg-white px-1 text-slate-950 shadow-xl outline-none ring-2 ring-brand/10 disabled:cursor-wait"
        style={{ left, top, width: Math.max(width + 24, 100), height, fontSize, lineHeight: `${height}px`, zIndex: 20 }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={`Modifier « ${block.str} »`}
      aria-label={`Modifier le texte : ${block.str}`}
      className="absolute rounded-sm border border-transparent bg-transparent hover:border-dashed hover:border-brand focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      style={{ left, top, width, height, pointerEvents: 'auto', cursor: 'text' }}
    >
      {saving && <span className="absolute -top-5 right-0 rounded bg-slate-900 px-1.5 py-0.5 text-[9px] text-white">Sauvegarde…</span>}
    </button>
  )
}

export default function TextEditLayer({ fileId, currentPage, textItems, viewport, canvasSize, onSaved }) {
  const blocks = useMemo(() => groupTextItems(textItems || []), [textItems])
  if (!blocks.length || !viewport || !canvasSize) return null

  return (
    <div className="absolute inset-0" style={{ width: canvasSize.width, height: canvasSize.height, pointerEvents: 'none', zIndex: 10 }}>
      <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-slate-900/90 px-3 py-2 text-xs font-medium text-white shadow-lg">
        Cliquez sur un texte pour le modifier
      </div>
      {blocks.map((block, index) => (
        <TextBlock
          key={`${currentPage}-${block.x_pdf.toFixed(2)}-${block.y_pdf_baseline.toFixed(2)}-${index}`}
          block={block}
          viewport={viewport}
          fileId={fileId}
          currentPage={currentPage}
          onSaved={onSaved}
        />
      ))}
    </div>
  )
}
