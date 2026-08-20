import { useState, useEffect } from 'react'

const STEPS = [
  { title: 'Importez votre PDF', desc: 'Cliquez sur "+ Importer PDF" ou glissez-déposez un fichier.', pos: 'top-16 right-4' },
  { title: 'Choisissez un outil', desc: 'Texte, surlignage, signature… sélectionnez l\'outil dans la barre.', pos: 'top-28 left-64' },
  { title: 'C\'est tout !', desc: 'Vos modifications sont sauvegardées automatiquement. Téléchargez quand vous voulez.', pos: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
]

export default function OnboardingTooltip() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem('onboarding_done') !== 'true') setVisible(true)
    } catch {
      // Stockage indisponible (iframe, navigation privée) : on affiche le guide
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem('onboarding_done', 'true')
    } catch {
      // Stockage indisponible : rien à persister
    }
    setVisible(false)
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 pointer-events-none" />
      <div className={`fixed z-50 w-64 bg-white border border-border rounded-xl shadow-xl p-4 ${current.pos}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-2xs text-ink-muted">{step + 1} / {STEPS.length}</span>
          <button onClick={dismiss} className="text-2xs text-ink-faint hover:text-ink-muted">Passer</button>
        </div>
        <p className="text-sm font-semibold text-ink mb-1">{current.title}</p>
        <p className="text-xs text-ink-muted mb-4">{current.desc}</p>
        <button
          onClick={isLast ? dismiss : () => setStep(s => s + 1)}
          className="w-full py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand/90">
          {isLast ? 'Commencer →' : 'Suivant →'}
        </button>
      </div>
    </>
  )
}
