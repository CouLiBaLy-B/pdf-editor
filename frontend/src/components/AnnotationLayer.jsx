/**
 * AnnotationLayer — canvas Fabric.js transparent superposé sur le rendu PDF.
 * Gère les outils : surlignage, insertion d'image, sélection.
 */
import React, { useEffect, useRef } from 'react'
import { fabric } from 'fabric'
import { toast } from 'sonner'
import { addHighlight, addImage } from '../services/api'

export default function AnnotationLayer({
  fileId,
  currentPage,
  canvasSize,   // { width, height }
  activeTool,
  onSaved,
}) {
  const fabricRef = useRef(null)
  const containerRef = useRef(null)

  // Initialiser / redimensionner Fabric
  useEffect(() => {
    if (!canvasSize || !containerRef.current) return

    if (fabricRef.current) {
      fabricRef.current.dispose()
    }

    const fc = new fabric.Canvas('annotation-canvas', {
      width: canvasSize.width,
      height: canvasSize.height,
      selection: activeTool === 'select',
      isDrawingMode: false,
    })
    fabricRef.current = fc

    return () => {
      fc.dispose()
      fabricRef.current = null
    }
  }, [canvasSize])

  // Réagir aux changements d'outil
  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return

    fc.isDrawingMode = false
    fc.selection = activeTool === 'select'
    fc.off('mouse:down')
    fc.off('mouse:up')

    if (activeTool === 'highlight') {
      let startPoint = null
      fc.on('mouse:down', (opt) => {
        startPoint = fc.getPointer(opt.e)
      })
      fc.on('mouse:up', async (opt) => {
        if (!startPoint) return
        const endPoint = fc.getPointer(opt.e)
        const rect = new fabric.Rect({
          left: Math.min(startPoint.x, endPoint.x),
          top: Math.min(startPoint.y, endPoint.y),
          width: Math.abs(endPoint.x - startPoint.x),
          height: Math.abs(endPoint.y - startPoint.y),
          fill: 'rgba(255, 255, 0, 0.4)',
          stroke: 'rgba(255, 200, 0, 0.6)',
          strokeWidth: 1,
          selectable: true,
        })
        fc.add(rect)
        startPoint = null

        // Coordonnées PDF (dé-scaler)
        const s = 1.5
        const x0 = rect.left / s, y0 = rect.top / s
        const x1 = (rect.left + rect.width) / s
        const y1 = (rect.top + rect.height) / s

        try {
          await addHighlight(fileId, {
            page: currentPage - 1,
            quads: [[x0, y0, x1, y1]],
            color: [1, 1, 0],
          })
          onSaved && onSaved()
        } catch (err) {
          toast.error('Erreur surlignage : ' + (err.response?.data?.detail || err.message))
        }
      })
    }

    if (activeTool === 'image') {
      fc.on('mouse:down', async (opt) => {
        const p = fc.getPointer(opt.e)
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = async (e) => {
          const file = e.target.files[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = async (ev) => {
            const b64 = ev.target.result.split(',')[1]
            fabric.Image.fromURL(ev.target.result, (img) => {
              img.set({ left: p.x, top: p.y, scaleX: 0.5, scaleY: 0.5 })
              fc.add(img)
            })
            const s = 1.5
            try {
              await addImage(fileId, {
                page: currentPage - 1,
                x0: p.x / s,
                y0: p.y / s,
                x1: (p.x + 150) / s,
                y1: (p.y + 100) / s,
                image_b64: b64,
              })
              onSaved && onSaved()
            } catch (err) {
              toast.error("Erreur insertion image : " + (err.response?.data?.detail || err.message))
            }
          }
          reader.readAsDataURL(file)
        }
        input.click()
      })
    }
  }, [activeTool, fileId, currentPage])

  if (!canvasSize) return null

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasSize.width,
        height: canvasSize.height,
        pointerEvents: activeTool === 'select' || activeTool === 'highlight' || activeTool === 'image' ? 'auto' : 'none',
      }}
    >
      <canvas id="annotation-canvas" />
    </div>
  )
}
