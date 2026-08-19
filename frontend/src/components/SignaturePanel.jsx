import React, { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { PenLine, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { signPdf } from '../services/api'
import { Button, Panel } from './ui/index.js'

export default function SignaturePanel({ fileId, currentPage, canvasSize, onSaved, onClose }) {
  const sigRef = useRef(null)
  const [xPercent, setXPercent] = useState(60)
  const [yPercent, setYPercent] = useState(85)
  const [widthPercent, setWidthPercent] = useState(28)
  const [loading, setLoading] = useState(false)

  const pageWidth = canvasSize ? canvasSize.width / (canvasSize.scale || 1) : 595
  const pageHeight = canvasSize ? canvasSize.height / (canvasSize.scale || 1) : 842
  const signatureWidth = pageWidth * widthPercent / 100
  const signatureHeight = Math.min(signatureWidth * 0.3, pageHeight * 0.15)
  const x0 = Math.min(pageWidth - signatureWidth, pageWidth * xPercent / 100)
  const y0 = Math.min(pageHeight - signatureHeight, pageHeight * yPercent / 100)

  const handleSign = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.warning('Dessinez d’abord votre signature')
      return
    }
    setLoading(true)
    try {
      const trimmed = sigRef.current.getTrimmedCanvas().toDataURL('image/png').split(',')[1]
      await signPdf(fileId, {
        page: currentPage - 1,
        x0, y0,
        x1: x0 + signatureWidth,
        y1: y0 + signatureHeight,
        signature_b64: trimmed,
      })
      toast.success(`Signature apposée sur la page ${currentPage}`)
      await onSaved?.()
      onClose?.()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Impossible d’apposer la signature')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel title="Signer le document" icon={PenLine} maxHeight="max-h-[500px]" onClose={onClose}>
      <div className="relative h-28 overflow-hidden rounded-xl border border-border bg-white shadow-card">
        <div className="pointer-events-none absolute bottom-7 left-5 right-5 h-px bg-slate-200" />
        <SignatureCanvas
          ref={sigRef}
          penColor="#0f172a"
          minWidth={1.2}
          maxWidth={2.4}
          canvasProps={{ width: 420, height: 112, className: 'h-full w-full' }}
        />
      </div>

      <div className="grid grid-cols-[110px_1fr] gap-3">
        <div className="relative aspect-[0.707] rounded border border-slate-300 bg-white shadow-sm">
          <div
            className="absolute rounded-sm border-2 border-brand bg-brand/10"
            style={{ left: `${xPercent}%`, top: `${yPercent}%`, width: `${widthPercent}%`, height: `${Math.min(widthPercent * 0.42, 15)}%`, transform: xPercent + widthPercent > 100 ? `translateX(-${xPercent + widthPercent - 100}%)` : undefined }}
          />
          <span className="absolute bottom-1 left-0 right-0 text-center text-[8px] text-ink-faint">Page {currentPage}</span>
        </div>

        <div className="space-y-2.5">
          <p className="rounded-lg bg-surface-raised px-2 py-1.5 text-[10px] text-ink-muted">
            Placement sur la page affichée ({currentPage})
          </p>
          {[
            ['Position horizontale', xPercent, setXPercent, 0, 90],
            ['Position verticale', yPercent, setYPercent, 0, 92],
            ['Taille', widthPercent, setWidthPercent, 12, 55],
          ].map(([label, value, setter, min, max]) => (
            <label key={label} className="block text-[10px] font-medium text-ink-muted">
              <span className="flex justify-between"><span>{label}</span><span>{value}%</span></span>
              <input type="range" min={min} max={max} value={value} onChange={event => setter(Number(event.target.value))} className="mt-1 w-full accent-emerald-600" />
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={handleSign} loading={loading}>Apposer la signature</Button>
        <Button variant="secondary" size="sm" onClick={() => sigRef.current?.clear()} disabled={loading}>
          <RotateCcw size={12} /> Effacer
        </Button>
      </div>
    </Panel>
  )
}
