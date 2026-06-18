import { useState } from 'react'
import { createTopup } from '../services/api'
import { X, Zap, Loader2, CheckCircle2 } from 'lucide-react'

const PACKS = [
  { id: 'starter', label: '20 crédits', price: '5€',  desc: '0,25€/op' },
  { id: 'pro',     label: '44 crédits', price: '10€', desc: '0,23€/op', popular: true },
  { id: 'max',     label: '100 crédits', price: '20€', desc: '0,20€/op' },
]

export default function PaywallModal({ isOpen, onClose, message }) {
  const [loading, setLoading] = useState(null)

  if (!isOpen) return null

  const handleBuy = async (pack) => {
    setLoading(pack)
    try {
      const { url } = await createTopup(pack)
      window.location.href = url
    } catch { setLoading(null) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl border border-border shadow-dropdown w-full max-w-sm p-6 animate-fade-up">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center">
              <Zap size={16} className="text-brand" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Crédits insuffisants</h2>
              <p className="text-2xs text-ink-muted mt-0.5">{message || 'Rechargez pour continuer.'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-raised transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {PACKS.map(p => (
            <button key={p.id} onClick={() => handleBuy(p.id)} disabled={!!loading}
              className={[
                'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm',
                p.popular ? 'border-brand bg-brand-light' : 'border-border hover:border-brand/30 hover:bg-surface-base',
                'disabled:opacity-60',
              ].join(' ')}>
              <div className="flex items-center gap-2">
                {loading === p.id
                  ? <Loader2 size={13} className="animate-spin text-brand" />
                  : <CheckCircle2 size={13} className={p.popular ? 'text-brand' : 'text-ink-faint'} />
                }
                <span className="font-medium text-ink">{p.label}</span>
                <span className="text-xs text-ink-muted">— {p.desc}</span>
              </div>
              <span className={`font-bold text-sm ${p.popular ? 'text-brand' : 'text-ink'}`}>{p.price}</span>
            </button>
          ))}
        </div>

        <button onClick={onClose} className="w-full py-2 text-xs text-ink-muted hover:text-ink transition-colors">
          Plus tard
        </button>
      </div>
    </div>
  )
}
