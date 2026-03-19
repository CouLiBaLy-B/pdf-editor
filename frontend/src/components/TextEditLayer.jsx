import React, { useState, useRef } from "react"
import { replaceText } from "../services/api"

function groupTextItems(items) {
  const blocks = []
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue
    const x = item.transform[4]
    const y = item.transform[5]
    const fontSize = Math.abs(item.transform[3]) || Math.abs(item.transform[0]) || 10
    const width = item.width || 0
    const same = blocks.find(b =>
      Math.abs(b.y_pdf_baseline - y) < fontSize * 0.4 &&
      x >= b.x_pdf + b.width_pdf - fontSize * 0.5 &&
      x <= b.x_pdf + b.width_pdf + fontSize * 2
    )
    if (same) {
      same.str += item.str
      same.width_pdf = Math.max(same.width_pdf, (x + width) - same.x_pdf)
    } else {
      blocks.push({ str: item.str, x_pdf: x, y_pdf_baseline: y, width_pdf: Math.max(width, 1), fontSize_pdf: fontSize })
    }
  }
  return blocks.filter(b => b.str.trim().length > 0)
}
function TextBlock({ block, viewport, fileId, currentPage, onSaved }) {
  const divRef = useRef(null)
  const originalStr = useRef(block.str)
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [xCanvas, yBaselineCanvas] = viewport.convertToViewportPoint(block.x_pdf, block.y_pdf_baseline)
  const fontSizeCanvas = block.fontSize_pdf * viewport.scale
  const top = yBaselineCanvas - fontSizeCanvas * 0.85
  const left = xCanvas
  const width = Math.max(block.width_pdf * viewport.scale, 30)
  const height = fontSizeCanvas * 1.35

  const handleFocus = () => {
    setEditing(true)
    setHovered(false)
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

  const handleBlur = async () => {
    setEditing(false)
    const newVal = divRef.current?.innerText ?? ""
    if (newVal === originalStr.current) return
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
      if (divRef.current) divRef.current.innerText = originalStr.current
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); divRef.current?.blur() }
    if (e.key === "Escape") {
      if (divRef.current) divRef.current.innerText = originalStr.current
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
      title="Cliquer pour modifier"
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
          ? "2px solid #e94560"
          : hovered
            ? "1px dashed rgba(74, 158, 245, 0.9)"
            : "1px solid transparent",
        padding: "0 2px",
        outline: "none",
        cursor: "text",
        whiteSpace: "pre",
        pointerEvents: "auto",
        zIndex: editing ? 20 : 5,
        borderRadius: "2px",
        boxSizing: "border-box",
        userSelect: editing ? "text" : "none",
        transition: "border 0.1s",
        boxShadow: editing ? "0 2px 12px rgba(0,0,0,0.2)" : "none",
      }}
    >
      {block.str}
    </div>
  )
}

export default function TextEditLayer({ fileId, currentPage, textItems, viewport, canvasSize, onSaved }) {
  if (!textItems?.length || !viewport || !canvasSize) return null
  const blocks = groupTextItems(textItems)
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
      {blocks.map((block) => (
        <TextBlock
          key={`${currentPage}-${block.x_pdf.toFixed(2)}-${block.y_pdf_baseline.toFixed(2)}-${block.str.slice(0, 8)}`}
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
