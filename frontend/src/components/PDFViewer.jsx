import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker with proper URL for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

// Scale presets for zoom controls
const SCALE_PRESETS = [
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1.0 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2.0 },
  { label: '250%', value: 2.5 },
  { label: '300%', value: 3.0 },
]

const DEFAULT_SCALE = 1.5
const MIN_SCALE = 0.5
const MAX_SCALE = 3.0
const SCALE_STEP = 0.25

export default function PDFViewer({
  fileUrl,
  currentPage,
  onTotalPages,
  onPageRendered,
  onTextItems,
  onError,
  scale: externalScale,
  onScaleChange,
}) {
  const canvasRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const docRef = useRef(null)
  const renderTaskRef = useRef(null)
  const [docLoaded, setDocLoaded] = useState(0)
  
  // Internal scale state (used if no external scale is provided)
  const [internalScale, setInternalScale] = useState(DEFAULT_SCALE)
  const scale = externalScale !== undefined ? externalScale : internalScale
  const setScale = onScaleChange || setInternalScale

  // Human-readable message for common pdf.js failures
  const describeError = (err) => {
    if (!err) return 'Erreur inconnue'
    if (err?.name === 'PasswordException') return 'Ce PDF est protégé par un mot de passe.'
    if (err?.name === 'InvalidPDFException') return 'Ce PDF semble corrompu ou non pris en charge.'
    if (err?.name === 'MissingPDFException') return 'Impossible de télécharger le PDF.'
    if (err?.name === 'UnexpectedResponseException') return 'Le serveur a renvoyé une réponse inattendue.'
    if (err?.message && /fetch|network|Failed to fetch/i.test(err.message)) {
      return 'Impossible de charger le document (problème réseau ou d\'autorisation).'
    }
    return err?.message || 'Erreur inconnue'
  }

  // Load the document when URL changes
  useEffect(() => {
    if (!fileUrl) return
    
    let cancelled = false
    setLoading(true)
    setError(null)
    setDocLoaded(0)

    const loadDoc = async () => {
      try {
        // Clean up previous document
        if (docRef.current) {
          docRef.current.destroy()
          docRef.current = null
        }
        
        const pdfDoc = await pdfjsLib.getDocument({
          url: fileUrl,
          withCredentials: false
        }).promise
        
        if (cancelled) {
          pdfDoc.destroy()
          return
        }
        
        docRef.current = pdfDoc
        onTotalPages?.(pdfDoc.numPages)
        setDocLoaded(d => d + 1)
      } catch (err) {
        console.error('Erreur chargement PDF:', err)
        const message = describeError(err)
        if (!cancelled) {
          setError(message)
          onError?.(err)
          setLoading(false)
        }
      }
    }
    
    loadDoc()
    
    return () => {
      cancelled = true
      if (docRef.current) {
        docRef.current.destroy()
        docRef.current = null
      }
    }
  }, [fileUrl, onTotalPages, onError, reloadKey])

  // Render the current page
  useEffect(() => {
    if (!docRef.current) return
    
    let cancelled = false

    const renderPage = async () => {
      setLoading(true)
      
      try {
        // Cancel any ongoing render
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel()
          } catch (_) {}
          renderTaskRef.current = null
        }
        
        const page = await docRef.current.getPage(currentPage)
        if (cancelled) return

        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        
        if (!canvas) return
        
        // Set canvas dimensions
        canvas.width = viewport.width
        canvas.height = viewport.height

        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        // Render the page
        const task = page.render({
          canvasContext: ctx,
          viewport,
        })
        
        renderTaskRef.current = task
        await task.promise
        
        if (cancelled) return
        
        // Notify parent of render completion
        if (onPageRendered) {
          onPageRendered({
            width: viewport.width,
            height: viewport.height,
            scale,
          })
        }
        
        // Extract text items for the editing layer
        if (onTextItems && !cancelled) {
          try {
            const textContent = await page.getTextContent()
            if (!cancelled && onTextItems) {
              onTextItems(textContent.items, viewport)
            }
          } catch (_) {
            // Text extraction may fail on some PDFs
          }
        }
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Erreur rendu page:', err)
          if (!cancelled) {
            setError(describeError(err))
            onError?.(err)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    renderPage()
    
    return () => {
      cancelled = true
    }
  }, [currentPage, docLoaded, scale, onPageRendered, onTextItems])

  // Zoom controls
  const zoomIn = useCallback(() => {
    setScale(s => Math.min(MAX_SCALE, s + SCALE_STEP))
  }, [setScale])

  const zoomOut = useCallback(() => {
    setScale(s => Math.max(MIN_SCALE, s - SCALE_STEP))
  }, [setScale])

  const zoomReset = useCallback(() => {
    setScale(DEFAULT_SCALE)
  }, [setScale])

  if (!fileUrl) {
    return (
      <div className="flex items-center justify-center h-full text-ink-muted text-sm">
        <p>Importez ou sélectionnez un PDF</p>
      </div>
    )
  }

  // Error state: show a clear message instead of a silent blank area
  if (error) {
    return (
      <div className="flex items-center justify-center min-w-[420px] min-h-[320px]">
        <div className="bg-white border border-border rounded-xl shadow-card p-6 max-w-sm text-center">
          <div className="w-10 h-10 mx-auto rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-ink">Impossible d'afficher ce PDF</p>
          <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">{error}</p>
          <button
            onClick={() => { setError(null); setReloadKey(k => k + 1) }}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-brand hover:bg-brand-dim transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Zoom controls */}
      <div
        className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-border p-1"
        style={{ opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto' }}
      >
        <button
          onClick={zoomOut}
          disabled={scale <= MIN_SCALE}
          className="w-7 h-7 flex items-center justify-center rounded text-sm font-medium text-ink hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Zoom arrière"
          aria-label="Zoom arrière"
        >
          −
        </button>
        
        <select
          value={scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
          className="h-7 px-1 text-xs font-medium text-ink bg-transparent border-none cursor-pointer outline-none"
          aria-label="Niveau de zoom"
        >
          {SCALE_PRESETS.map(preset => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
        
        <button
          onClick={zoomIn}
          disabled={scale >= MAX_SCALE}
          className="w-7 h-7 flex items-center justify-center rounded text-sm font-medium text-ink hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Zoom avant"
          aria-label="Zoom avant"
        >
          +
        </button>
        
        <div className="w-px h-4 bg-border mx-0.5" />
        
        <button
          onClick={zoomReset}
          className="h-7 px-2 text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-raised rounded transition-colors"
          title="Réinitialiser le zoom"
          aria-label="Réinitialiser le zoom"
        >
          Reset
        </button>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
          <div className="spinner" />
        </div>
      )}

      {/* PDF Canvas */}
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  )
}
