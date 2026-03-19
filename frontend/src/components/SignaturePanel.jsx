import React, { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { PenLine, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { signPdf } from '../services/api'
import { Panel, Button } from './ui/index.js'

export default function SignaturePanel({ fileId, currentPage, onSaved }) {
  const sigRef = useRef(null)
  const [page, setPage] = useState(currentPage)
  const [x0,   setX0]  = useState(50)
  const [y0,   setY0]  = useState(700)
  const [loading, setLoading] = useState(false)

  const handleSign = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.warning('Veuillez dessiner votre signature')
      return
    }
    const b64 = sigRef.current.toDataURL('image/png').split(',')[1]
    setLoading(true)
    try {
      await signPdf(fileId, {
        page: page - 1,
        x0: Number(x0), y0: Number(y0),
        x1: Number(x0) + 200, y1: Number(y0) + 60,
        signature_b64: b64,
      })
      toast.success('Signature ajoutée')
      onSaved?.()
    } catch (err) {
      toast.error('Erreur : ' + (err.response?.data?.detail || err.message))
    } finally { setLoading(false) }
  }

  return (
    <Panel title="Signature électronique" icon={PenLine} maxHeight="max-h-[300px]">
      {/* Canvas zone */}
      <div className="relative rounded-xl overflow-hidden border border-border bg-white shadow-card">
        {/* Baseline guide */}
        <div className="absolute bottom-8 left-4 right-4 h-px bg-gray-200 pointer-events-none" />
        <p className="absolute bottom-2 right-3 text-[9px] text-gray-300 pointer-events-none select-none font-medium tracking-wide">SIGNEZ ICI</p>
        <SignatureCanvas
          ref={sigRef}
          penColor="#1a1a2e"
          canvasProps={{ width: 460, height: 100, style: { display: 'block' } }}
        />
      </div>

      {/* Position controls */}
      <div className="flex flex-wrap items-center gap-4">
        {[{label:'Page', value:page, setter:setPage, min:1}, {label:'X', value:x0, setter:setX0}, {label:'Y', value:y0, setter:setY0}].map(({label, value, setter, min}) => (
          <label key={label} className="flex items-center gap-2 text-xs text-ink-muted">
            <span className="w-7 text-right font-medium">{label}</span>
            <input
              type="number" min={min} value={value}
              onChange={e => setter(+e.target.value)}
              className="w-16 bg-white text-ink rounded-lg px-2 py-1.5 text-xs border border-border focus:border-brand/60 focus:outline-none focus:ring-1 focus:ring-brand/20 transition-colors"
            />
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={handleSign} loading={loading}>
          Apposer la signature
        </Button>
        <Button variant="secondary" size="sm" onClick={() => sigRef.current?.clear()} className="gap-1.5">
          <RotateCcw size={12} />
          Effacer
        </Button>
      </div>
    </Panel>
  )
}
