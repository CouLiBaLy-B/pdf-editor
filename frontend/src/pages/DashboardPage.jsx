import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getBalance, getBillingHistory, createTopup } from '../services/api'
import { toast } from 'sonner'
import { AppLogo } from '../components/ui/index.js'
import { ArrowLeft, Zap, CreditCard, Clock, CheckCircle2, Loader2 } from 'lucide-react'

const PACKS = [
  { id: 'starter', label: '20 crédits', price: '5€',  perOp: '0,25€/op' },
  { id: 'pro',     label: '44 crédits', price: '10€', perOp: '0,23€/op', popular: true },
  { id: 'max',     label: '100 crédits', price: '20€', perOp: '0,20€/op' },
]

function TxBadge({ delta }) {
  const positive = delta > 0
  return (
    <span className={[
      'inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full',
      positive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600',
    ].join(' ')}>
      {positive ? '+' : ''}{delta}
    </span>
  )
}

export default function DashboardPage() {
  const [balance, setBalance] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(null)
  const navigate = useNavigate()
  const [params] = useSearchParams()

  useEffect(() => {
    if (params.get('topup') === 'success') toast.success('Crédits ajoutés !')
    getBalance().then(d => setBalance(d.credits))
    getBillingHistory().then(setHistory)
  }, [])

  const handleBuy = async (pack) => {
    setLoading(pack)
    try {
      const { url } = await createTopup(pack)
      window.location.href = url
    } catch {
      toast.error('Erreur lors du paiement')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="bg-white border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <AppLogo />
          <button onClick={() => navigate('/app')}
            className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors">
            <ArrowLeft size={13} /> Retour à l'éditeur
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-ink mb-8">Mon compte</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left col — balance + packs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Balance card */}
            <div className="bg-white border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted mb-4">
                <Zap size={13} className="text-brand" /> Crédits disponibles
              </div>
              <div className="flex items-end gap-3">
                <span className="text-6xl font-extrabold text-ink tabular-nums">
                  {balance ?? '—'}
                </span>
                <span className="text-sm text-ink-muted mb-2">crédits</span>
              </div>
              <div className="mt-4 h-2 bg-surface-raised rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, ((balance ?? 0) / 100) * 100)}%` }}
                />
              </div>
              <p className="text-2xs text-ink-faint mt-2">1 crédit = 1 opération PDF (0,25€)</p>
            </div>

            {/* Packs */}
            <div className="bg-white border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted mb-4">
                <CreditCard size={13} className="text-brand" /> Recharger
              </div>
              <div className="grid grid-cols-3 gap-3">
                {PACKS.map(p => (
                  <button key={p.id} onClick={() => handleBuy(p.id)} disabled={!!loading}
                    className={[
                      'relative flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all duration-150 text-center',
                      p.popular
                        ? 'border-brand bg-brand-light shadow-sm'
                        : 'border-border hover:border-brand/40 hover:bg-surface-base',
                      'disabled:opacity-60',
                    ].join(' ')}>
                    {p.popular && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-2xs font-bold text-white bg-brand px-2 py-0.5 rounded-full">
                        Populaire
                      </span>
                    )}
                    <span className="text-2xl font-extrabold text-ink">{p.price}</span>
                    <span className="text-xs font-semibold text-ink">{p.label}</span>
                    <span className="text-2xs text-ink-muted">{p.perOp}</span>
                    {loading === p.id
                      ? <Loader2 size={13} className="animate-spin text-brand mt-1" />
                      : <CheckCircle2 size={13} className="text-brand/40 mt-1" />
                    }
                  </button>
                ))}
              </div>
              <p className="text-2xs text-ink-faint text-center mt-4">
                Paiement sécurisé via Stripe · Les crédits n'expirent pas
              </p>
            </div>
          </div>

          {/* Right col — history */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden h-fit">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Clock size={13} className="text-brand" />
              <span className="text-xs font-semibold text-ink-muted">Historique</span>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-ink-muted p-6 text-center">Aucune transaction</p>
            ) : (
              <div className="divide-y divide-border">
                {history.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-xs font-medium text-ink">
                        {t.type === 'topup' ? 'Recharge' : 'Opération'}
                      </p>
                      <p className="text-2xs text-ink-faint mt-0.5">
                        {new Date(t.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <TxBadge delta={t.credits_delta} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
