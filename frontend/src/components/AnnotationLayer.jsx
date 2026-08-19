import React, { useEffect, useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { addHighlight, addImage } from '../services/api'

const INTERACTIVE_TOOLS = new Set(['highlight', 'image'])

function pointFromEvent(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
    y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
  }
}

export default function AnnotationLayer({ fileId, currentPage, canvasSize, activeTool, onSaved }) {
  const inputRef = useRef(null)
  const imagePointRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => setDrag(null), [activeTool, currentPage, canvasSize])

  if (!canvasSize) return null
  const scale = canvasSize.scale || 1
  const interactive = INTERACTIVE_TOOLS.has(activeTool)

  const handlePointerDown = (event) => {
    if (saving) return
    const point = pointFromEvent(event)
    if (activeTool === 'highlight') {
      event.currentTarget.setPointerCapture(event.pointerId)
      setDrag({ start: point, end: point })
    } else if (activeTool === 'image') {
      imagePointRef.current = point
      inputRef.current?.click()
    }
  }

  const handlePointerMove = (event) => {
    if (!drag || activeTool !== 'highlight') return
    setDrag(current => ({ ...current, end: pointFromEvent(event) }))
  }

  const handlePointerUp = async (event) => {
    if (!drag || activeTool !== 'highlight') return
    const end = pointFromEvent(event)
    const left = Math.min(drag.start.x, end.x)
    const top = Math.min(drag.start.y, end.y)
    const width = Math.abs(end.x - drag.start.x)
    const height = Math.abs(end.y - drag.start.y)
    setDrag(null)
    if (width < 4 || height < 4) {
      toast.info('Tracez une zone plus grande à surligner')
      return
    }
    setSaving(true)
    try {
      await addHighlight(fileId, {
        page: currentPage - 1,
        quads: [[left / scale, top / scale, (left + width) / scale, (top + height) / scale]],
        color: [1, 0.84, 0.05],
      })
      toast.success('Surlignage appliqué')
      await onSaved?.()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Impossible d’appliquer le surlignage')
    } finally {
      setSaving(false)
    }
  }

  const handleImage = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    const point = imagePointRef.current
    if (!file || !point) return
    if (!file.type.startsWith('image/')) {
      toast.error('Sélectionnez une image valide')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('L’image ne doit pas dépasser 10 Mo')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const image = new Image()
      image.onload = async () => {
        const maxWidth = Math.min(240, canvasSize.width - point.x)
        const maxHeight = Math.min(180, canvasSize.height - point.y)
        const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
        const width = image.width * ratio
        const height = image.height * ratio
        if (width < 8 || height < 8) {
          toast.error('Cliquez plus loin du bord pour insérer cette image')
          return
        }
        setSaving(true)
        try {
          await addImage(fileId, {
            page: currentPage - 1,
            x0: point.x / scale,
            y0: point.y / scale,
            x1: (point.x + width) / scale,
            y1: (point.y + height) / scale,
            image_b64: dataUrl.split(',')[1],
          })
          toast.success('Image insérée')
          await onSaved?.()
        } catch (error) {
          toast.error(error.response?.data?.detail || 'Impossible d’insérer l’image')
        } finally {
          setSaving(false)
        }
      }
      image.onerror = () => toast.error('Cette image ne peut pas être lue')
      image.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  const preview = drag && {
    left: Math.min(drag.start.x, drag.end.x),
    top: Math.min(drag.start.y, drag.end.y),
    width: Math.abs(drag.end.x - drag.start.x),
    height: Math.abs(drag.end.y - drag.start.y),
  }

  return (
    <div
      className="absolute inset-0"
      style={{
        width: canvasSize.width,
        height: canvasSize.height,
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: saving ? 'wait' : activeTool === 'highlight' ? 'crosshair' : activeTool === 'image' ? 'copy' : 'default',
        zIndex: 8,
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      aria-label={activeTool === 'highlight' ? 'Tracez la zone à surligner' : 'Cliquez pour insérer une image'}
    >
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleImage} />
      {preview && <div className="absolute border border-amber-400 bg-yellow-300/40 pointer-events-none" style={preview} />}
      {activeTool === 'image' && !saving && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 flex items-center gap-2 rounded-lg bg-slate-900/90 px-3 py-2 text-xs font-medium text-white shadow-lg pointer-events-none">
          <ImagePlus size={14} /> Cliquez à l’endroit où placer l’image
        </div>
      )}
      {saving && <div className="absolute inset-0 bg-white/25" />}
    </div>
  )
}
