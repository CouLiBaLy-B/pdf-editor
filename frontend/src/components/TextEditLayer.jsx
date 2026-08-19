import React, { useState, useRef, useCallback } from "react"
import { replaceText } from "../services/api"
import { useDebouncedCallback } from "../hooks/useDebounce"

/**
 * Group text items into text blocks based on position and font size.
 * Items that are on the same line (within fontSize * 0.4 tolerance) are merged.
 */
function groupTextItems(items) {
  const blocks = []
  
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue
    
    const x = item.transform[4]
    const y = item.transform[5]
    const fontSize = Math.abs(item.transform[3]) || Math.abs(item.transform[0]) || 10
    const width = item.width || 0
    
    // Find a block on the same line
    const same = blocks.find(b =>
      Math.abs(b.y_pdf_baseline - y) < fontSize * 0.4 &&
      x >= b.x_pdf + b.width_pdf - fontSize * 0.5 &&
      x <= b.x_pdf + b.width_pdf + fontSize * 2
    )
    
    if (same) {
      // Extend the existing block
      same.str += item.str
      same.width_pdf = Math.max(same.width_pdf, (x + width) - same.x_pdf)
    } else {
      // Create a new block
      blocks.push({
        str: item.str,
        x_pdf: x,
        y_pdf_baseline: y,
        width_pdf: Math.max(width, 1),
        fontSize_pdf: fontSize
      })
    }
  }
  
  return blocks.filter(b => b.str.trim().length > 0)
}

/**
 * Individual text block that can be edited inline.
 */
function TextBlock({ block, viewport, fileId, currentPage, onSaved }) {
  const divRef = useRef(null)
  const originalStr = useRef(block.str)
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Calculate position in canvas coordinates
  const xCanvas = viewport.convertToViewportPoint(block.x_pdf, block.y_pdf_baseline)[0]
  const yBaselineCanvas = viewport.convertToViewportPoint(block.x_pdf, block.y_pdf_baseline)[1]
  const fontSizeCanvas = block.fontSize_pdf * viewport.scale
  const top = yBaselineCanvas - fontSizeCanvas * 0.85
  const left = xCanvas
  const width = Math.max(block.width_pdf * viewport.scale, 30)
  const height = fontSizeCanvas * 1.35

  // Debounced save function
  const debouncedSave = useDebouncedCallback(async (newVal) => {
    if (newVal === originalStr.current) return
    
    setSaving(true)
    try {
      await replaceText(fileId, {
        page: currentPage - 1,
        x_pdf: block.x_pdf,
        y_pdf_baseline: block.y_pdf_baseline,
        width_pdf: block.width_pdf,
        new_text: newVal,
        font_size: block.fontSize_pdf,
        color: [0, 0, 0],
      })
      originalStr.current = newVal
      onSaved && onSaved()
    } catch (err) {
      console.error("Erreur replace-text:", err)
      // Revert to original text on error
      if (divRef.current) {
        divRef.current.innerText = originalStr.current
      }
    } finally {
      setSaving(false)
    }
  }, 800) // 800ms debounce delay

  const handleFocus = () => {
    setEditing(true)
    setHovered(false)
    // Select all text on focus
    setTimeout(() => {
      if (divRef.current) {
        const range = document.createRange()
        range.selectNodeContents(divRef.current)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }, 0)
  }

  const handleBlur = () => {
    setEditing(false)
    const newVal = divRef.current?.innerText ?? ""
    debouncedSave(newVal)
  }

  const handleKeyDown = (e) => {
    // Enter saves and exits editing
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      divRef.current?.blur()
    }
    // Escape reverts changes
    if (e.key === "Escape") {
      if (divRef.current) {
        divRef.current.innerText = originalStr.current
      }
      divRef.current?.blur()
    }
  }

  return (
    <div
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      onMouseEnter={() => !editing && setHovered(true)}
      onMouseLeave={() => !editing && setHovered(false)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      title={editing ? "Entrée pour sauvegarder, Échap pour annuler" : "Cliquer pour modifier"}
      style={{
        position: "absolute",
        left,
        top,
        minWidth: width,
        height,
        fontSize: fontSizeCanvas,
        lineHeight: `${height}px`,
        fontFamily: "serif",
        color: editing ? "#000000" : "transparent",
        background: editing ? "rgba(255,255,255,0.97)" : "transparent",
        border: editing
          ? "2px solid #00b386"  // Brand color when editing
          : hovered
            ? "1px dashed rgba(0, 179, 134, 0.9)"
            : "1px solid transparent",
        padding: "0 2px",
        outline: "none",
        cursor: editing ? "text" : "pointer",
        whiteSpace: "pre",
        pointerEvents: "auto",
        zIndex: editing ? 20 : 5,
        borderRadius: "2px",
        boxSizing: "border-box",
        userSelect: editing ? "text" : "none",
        transition: "border 0.1s, box-shadow 0.1s",
        boxShadow: editing ? "0 2px 12px rgba(0,0,0,0.15)" : "none",
      }}
    >
      {/* Show text overlay when not editing */}
      {!editing && (
        <span style={{
          color: "#111827",
          userSelect: "none",
          pointerEvents: "none",
        }}>
          {block.str}
        </span>
      )}
      
      {/* Saving indicator */}
      {saving && (
        <span style={{
          position: "absolute",
          top: -20,
          right: 0,
          fontSize: 10,
          color: "#6b7280",
          fontFamily: "sans-serif",
        }}>
          Sauvegarde...
        </span>
      )}
    </div>
  )
}

/**
 * TextEditLayer - Overlay for editing text in PDF.
 * Groups text items into editable blocks with debounced saving.
 */
export default function TextEditLayer({ fileId, currentPage, textItems, viewport, canvasSize, onSaved }) {
  if (!textItems?.length || !viewport || !canvasSize) return null
  
  const blocks = groupTextItems(textItems)
  
  if (blocks.length === 0) return null
  
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: canvasSize.width,
        height: canvasSize.height,
        pointerEvents: "none",
      }}
    >
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
