import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Utiliser new URL() pour que Vite résout correctement le worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

const SCALE = 1.5

export default function PDFViewer({ fileUrl, currentPage, onTotalPages, onPageRendered, onTextItems }) {
  const canvasRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const docRef = useRef(null)
  const renderTaskRef = useRef(null)
  // docLoaded déclenche l'effet de rendu APRÈS que le document soit prêt
  const [docLoaded, setDocLoaded] = useState(0)

  // Charger le document quand l'URL change
  useEffect(() => {
    if (!fileUrl) return
    let cancelled = false
    setLoading(true)
    setDocLoaded(0)

    const loadDoc = async () => {
      try {
        if (docRef.current) {
          docRef.current.destroy()
          docRef.current = null
        }
        const pdfDoc = await pdfjsLib.getDocument({ url: fileUrl, withCredentials: false }).promise
        if (cancelled) { pdfDoc.destroy(); return }
        docRef.current = pdfDoc
        onTotalPages(pdfDoc.numPages)
        setDocLoaded(d => d + 1)
      } catch (err) {
        console.error('Erreur chargement PDF:', err)
        setLoading(false)
      }
    }
    loadDoc()
    return () => { cancelled = true }
  }, [fileUrl])

  // Rendre la page courante — se déclenche APRÈS docLoaded ou changement de page
  useEffect(() => {
    if (!docRef.current) return
    let cancelled = false

    const renderPage = async () => {
      setLoading(true)
      try {
        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel() } catch (_) {}
          renderTaskRef.current = null
        }
        const page = await docRef.current.getPage(currentPage)
        if (cancelled) return

        const viewport = page.getViewport({ scale: SCALE })
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = viewport.width
        canvas.height = viewport.height

        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const task = page.render({ canvasContext: ctx, viewport })
        renderTaskRef.current = task
        await task.promise
        if (!cancelled && onPageRendered) {
          onPageRendered({ width: viewport.width, height: viewport.height })
        }
        // Extraire les items texte pour la couche d'édition
        if (!cancelled && onTextItems) {
          try {
            const textContent = await page.getTextContent()
            if (!cancelled) onTextItems(textContent.items, viewport)
          } catch (_) {}
        }
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Erreur rendu page:', err)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    renderPage()
    return () => { cancelled = true }
  }, [currentPage, docLoaded])

  if (!fileUrl) {
    return (
      <div className="flex items-center justify-center h-full text-ink-muted text-sm">
        <p>Importez ou sélectionnez un PDF</p>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {loading && (
        <div className="absolute inset-0 bg-surface-raised/70 flex items-center justify-center z-10">
          <div className="spinner" />
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  )
}
