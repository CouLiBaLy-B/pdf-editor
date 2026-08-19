import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { deleteAccount, exportAccount } from '../services/api'
import { toast } from 'sonner'
import { AppLogo, ConfirmDialog } from '../components/ui/index.js'

export default function SettingsPage() {
  const { user, signout } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState('account')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDeleteAccount = async () => {
    await deleteAccount()
    signout()
    navigate('/')
  }

  const handleExport = async () => {
    try {
      const data = await exportAccount()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `pdfpro-donnees-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Export de vos données téléchargé')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Export impossible')
    }
  }

  const navItem = (id, label) => (
    <button key={id} onClick={() => setSection(id)}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${section === id ? 'bg-brand/10 text-brand font-semibold' : 'text-ink-muted hover:text-ink hover:bg-surface-base'}`}>
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="flex items-center gap-3 px-5 bg-white border-b border-border" style={{ height: '52px' }}>
        <AppLogo />
        <div className="w-px h-4 bg-border mx-1" />
        <Link to="/app" className="text-xs text-ink-muted hover:text-ink">← Retour à l'éditeur</Link>
      </header>

      <div className="max-w-3xl mx-auto p-8 flex gap-8">
        {/* Sidebar */}
        <nav className="w-44 shrink-0 flex flex-col gap-1">
          {navItem('account', 'Compte')}
          {navItem('plan', 'Plan & facturation')}
          {navItem('danger', 'Zone de danger')}
        </nav>

        {/* Content */}
        <div className="flex-1 bg-white rounded-2xl border border-border p-6">

          {section === 'account' && (
            <div>
              <h2 className="text-base font-semibold text-ink mb-4">Compte</h2>
              <div className="mb-4">
                <label className="text-xs text-ink-muted block mb-1">Email</label>
                <p className="text-sm text-ink font-medium">{user?.email}</p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Link to="/reset-password" className="text-sm text-brand hover:underline">
                  Changer le mot de passe →
                </Link>
                <button type="button" onClick={handleExport} className="text-sm text-brand hover:underline">
                  Exporter mes données →
                </button>
              </div>
            </div>
          )}

          {section === 'plan' && (
            <div>
              <h2 className="text-base font-semibold text-ink mb-4">Plan & facturation</h2>
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand/10 text-brand">
                  PAY-AS-YOU-GO
                </span>
                <span className="text-sm text-ink-muted">0,25€ / opération</span>
              </div>
              <p className="text-xs text-ink-muted mb-4">
                Solde actuel : <strong className="text-ink">{user?.credits ?? 0} crédit(s)</strong>
              </p>
              <button onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand/90">
                Recharger des crédits →
              </button>
            </div>
          )}

          {section === 'danger' && (
            <div>
              <h2 className="text-base font-semibold text-red-600 mb-4">Zone de danger</h2>
              <p className="text-xs text-ink-muted mb-4">La suppression de votre compte est irréversible. Tous vos fichiers seront définitivement effacés.</p>
              <button onClick={() => setConfirmDelete(true)}
                className="px-4 py-2 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50">
                Supprimer mon compte
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer votre compte ?"
        description="Cette action est irréversible. Tous vos fichiers seront supprimés."
        confirmLabel="Supprimer définitivement"
        onConfirm={handleDeleteAccount}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
