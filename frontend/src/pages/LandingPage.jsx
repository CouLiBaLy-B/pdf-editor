import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AppLogo } from '../components/ui/index.js'
import {
  Type, Highlighter, Image as ImageIcon, PenLine,
  Link2, Scissors, Minimize2, ScanText, ArrowRight,
  CheckCircle2, Zap, Shield, Globe,
} from 'lucide-react'

const FEATURES = [
  { Icon: Type,       title: 'Édition de texte',   desc: 'Modifiez le texte directement dans le PDF, inline.' },
  { Icon: PenLine,    title: 'Signature',           desc: 'Dessinez et apposez votre signature électronique.' },
  { Icon: ImageIcon,  title: 'Insertion d\'image',  desc: 'Insérez des images à l\'endroit de votre choix.' },
  { Icon: Highlighter,title: 'Surlignage',          desc: 'Annotez vos documents avec des surlignages colorés.' },
  { Icon: Link2,      title: 'Fusion de PDFs',      desc: 'Combinez plusieurs PDFs en un seul document.' },
  { Icon: Scissors,   title: 'Division',            desc: 'Découpez un PDF par plages de pages précises.' },
  { Icon: Minimize2,  title: 'Compression',         desc: 'Réduisez le poids de vos PDFs sans perte visible.' },
  { Icon: ScanText,   title: 'OCR',                 desc: 'Extrayez le texte de PDFs scannés automatiquement.' },
]

const PACKS = [
  { name: 'Starter', price: '5€', credits: 20, perOp: '0,25€', features: ['20 crédits', 'Tous les outils', 'Téléchargement illimité'] },
  { name: 'Pro',     price: '10€', credits: 44, perOp: '0,23€', popular: true, features: ['44 crédits', 'Tous les outils', 'Support prioritaire', '-8% vs Starter'] },
  { name: 'Max',     price: '20€', credits: 100, perOp: '0,20€', features: ['100 crédits', 'Tous les outils', 'Support prioritaire', '-20% vs Starter'] },
]

const TRUST = [
  { Icon: Zap,    label: 'Traitement instantané' },
  { Icon: Shield, label: 'Fichiers chiffrés' },
  { Icon: Globe,  label: '100% en ligne' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const goApp = () => navigate(user ? '/app' : '/login')

  return (
    <div className="min-h-screen bg-white text-ink">

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 h-14">
          <AppLogo />
          <div className="flex items-center gap-3">
            {user ? (
              <button onClick={goApp}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dim transition-colors">
                Ouvrir l'app <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <button onClick={() => navigate('/login')}
                  className="text-sm text-ink-muted hover:text-ink px-3 py-2 transition-colors">
                  Connexion
                </button>
                <button onClick={goApp}
                  className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dim transition-colors">
                  Essayer gratuitement
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-24 px-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand bg-brand-light px-3 py-1.5 rounded-full mb-6 border border-brand/20">
          <Zap size={11} /> Pay-as-you-go · 0,25€ par opération
        </div>
        <h1 className="text-5xl font-extrabold text-ink leading-[1.1] tracking-tight mb-5">
          Éditez vos PDFs<br />
          <span className="text-brand">en quelques secondes</span>
        </h1>
        <p className="text-lg text-ink-muted max-w-xl mx-auto mb-8 leading-relaxed">
          Texte, signature, images, fusion, OCR — tous les outils professionnels dont vous avez besoin, sans abonnement.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button onClick={goApp}
            className="flex items-center gap-2 px-6 py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand-dim transition-colors shadow-lg shadow-brand/20 text-sm">
            {user ? 'Ouvrir l\'éditeur' : 'Commencer gratuitement'} <ArrowRight size={15} />
          </button>
          <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-3 border border-border text-ink text-sm font-medium rounded-xl hover:bg-surface-raised transition-colors">
            Voir les fonctionnalités
          </button>
        </div>
        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 mt-10 flex-wrap">
          {TRUST.map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Icon size={13} className="text-brand" /> {label}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-surface-base border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-ink mb-3">Tout ce qu'il vous faut</h2>
            <p className="text-ink-muted text-sm max-w-md mx-auto">8 outils professionnels dans une interface unique, sans installation.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title}
                className="bg-white rounded-xl border border-border p-5 hover:border-brand/30 hover:shadow-card transition-all duration-200 group">
                <div className="w-9 h-9 rounded-lg bg-brand-light flex items-center justify-center mb-3 group-hover:bg-brand/15 transition-colors">
                  <Icon size={16} className="text-brand" />
                </div>
                <p className="text-sm font-semibold text-ink mb-1">{title}</p>
                <p className="text-xs text-ink-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-ink mb-3">Tarifs simples</h2>
            <p className="text-ink-muted text-sm">Achetez des crédits une fois, utilisez-les quand vous voulez. Pas d'abonnement.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PACKS.map(p => (
              <div key={p.name}
                className={[
                  'relative rounded-2xl border p-6 flex flex-col transition-all duration-200',
                  p.popular
                    ? 'border-brand shadow-lg shadow-brand/10 bg-white'
                    : 'border-border bg-white hover:border-border-strong',
                ].join(' ')}>
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xs font-bold text-white bg-brand px-3 py-1 rounded-full">
                    Populaire
                  </span>
                )}
                <p className="text-sm font-semibold text-ink-muted mb-1">{p.name}</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-ink">{p.price}</span>
                </div>
                <p className="text-xs text-ink-faint mb-5">{p.credits} crédits · {p.perOp}/opération</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-ink">
                      <CheckCircle2 size={13} className="text-brand shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button onClick={goApp}
                  className={[
                    'w-full py-2.5 text-sm font-semibold rounded-xl transition-colors',
                    p.popular
                      ? 'bg-brand text-white hover:bg-brand-dim'
                      : 'bg-surface-raised text-ink hover:bg-surface-overlay',
                  ].join(' ')}>
                  Acheter
                </button>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-ink-faint mt-6">
            Paiement sécurisé via Stripe · Les crédits n'expirent pas
          </p>
        </div>
      </section>

      {/* CTA bottom */}
      <section className="py-16 px-6 bg-ink text-white text-center">
        <h2 className="text-2xl font-bold mb-3">Prêt à éditer vos PDFs ?</h2>
        <p className="text-sm text-white/60 mb-6">5 crédits offerts à l'inscription. Aucune carte requise.</p>
        <button onClick={goApp}
          className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand-dim transition-colors text-sm">
          Commencer gratuitement <ArrowRight size={15} />
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <AppLogo />
          <div className="flex items-center gap-6 text-xs text-ink-muted">
            <a href="#features" className="hover:text-ink transition-colors">Fonctionnalités</a>
            <a href="#pricing" className="hover:text-ink transition-colors">Tarifs</a>
            <button onClick={() => navigate('/login')} className="hover:text-ink transition-colors">Connexion</button>
          </div>
          <p className="text-xs text-ink-faint">© 2026 PDFPro</p>
        </div>
      </footer>
    </div>
  )
}
