import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Erreur React non gérée', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-base p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-danger">
            <AlertTriangle size={22} />
          </div>
          <h1 className="text-lg font-bold text-ink">L’application a rencontré un problème</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Vos documents restent enregistrés. Rechargez l’application pour reprendre votre travail.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dim"
          >
            <RefreshCw size={14} /> Recharger
          </button>
        </div>
      </main>
    )
  }
}
