import { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { forgotPassword, resetPassword } from '../services/api'
import { AppLogo } from '../components/ui/index.js'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleForgot = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await forgotPassword(email)
      setMsg('Si cet email existe, un lien de réinitialisation a été envoyé.')
    } catch {
      setError('Une erreur est survenue')
    } finally { setLoading(false) }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return }
    setLoading(true); setError('')
    try {
      await resetPassword(token, password)
      setMsg('Mot de passe mis à jour !')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Token invalide ou expiré')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><AppLogo /></div>
        <div className="bg-white rounded-2xl border border-border shadow-card p-8">
          <h1 className="text-lg font-semibold text-ink mb-1">
            {token ? 'Nouveau mot de passe' : 'Mot de passe oublié'}
          </h1>
          <p className="text-xs text-ink-muted mb-6">
            {token ? 'Choisissez un nouveau mot de passe (min 8 caractères)' : 'Entrez votre email pour recevoir un lien de réinitialisation'}
          </p>

          {msg ? (
            <div className="text-sm text-brand bg-brand/10 px-4 py-3 rounded-lg mb-4">{msg}</div>
          ) : token ? (
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <input type="password" required minLength={8} placeholder="Nouveau mot de passe"
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-brand" />
              <input type="password" required minLength={8} placeholder="Confirmer le mot de passe"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-brand" />
              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand/90 disabled:opacity-60">
                {loading ? '...' : 'Mettre à jour'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgot} className="flex flex-col gap-4">
              <input type="email" required placeholder="vous@exemple.com"
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-brand" />
              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand/90 disabled:opacity-60">
                {loading ? '...' : 'Envoyer le lien'}
              </button>
            </form>
          )}

          <p className="text-xs text-center text-ink-muted mt-5">
            <Link to="/login" className="text-brand hover:underline">← Retour à la connexion</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
