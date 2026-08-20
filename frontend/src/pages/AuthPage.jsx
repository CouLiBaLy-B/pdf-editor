import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { register, login, getMe, storeToken } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { AppLogo } from '../components/ui/index.js'
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState(import.meta.env.DEV ? 'demo@pdfpro.app' : '')
  const [password, setPassword] = useState(import.meta.env.DEV ? 'demo1234' : '')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { user, loading: authLoading, signin } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && user) navigate('/app', { replace: true })
  }, [authLoading, user, navigate])

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { access_token } = mode === 'login'
        ? await login(email, password)
        : await register(email, password, acceptedTerms)
      if (!access_token) throw new Error('Réponse de connexion invalide')
      storeToken(access_token)
      const userData = await getMe()
      signin(access_token, userData)
      navigate('/app')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : (detail?.[0]?.msg || 'Une erreur est survenue'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><AppLogo /></div>

        <div className="bg-white rounded-2xl border border-border shadow-card p-8">
          <h1 className="text-xl font-bold text-ink mb-1">
            {mode === 'login' ? 'Bon retour 👋' : 'Créer un compte'}
          </h1>
          <p className="text-xs text-ink-muted mb-6">
            {mode === 'login' ? 'Connectez-vous pour accéder à vos documents' : '10 crédits offerts à l\'inscription'}
          </p>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-lg outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all"
              />
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" minLength={8}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-lg outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all"
              />
            </div>

            {mode === 'login' && (
              <div className="text-right -mt-2">
                <button type="button" onClick={() => navigate('/forgot-password')}
                  className="text-2xs text-ink-muted hover:text-brand transition-colors">
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            {mode === 'register' && (
              <label className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
                <input
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={event => setAcceptedTerms(event.target.checked)}
                  className="mt-0.5 accent-emerald-600"
                />
                <span>J’accepte les <a href="/terms" target="_blank" className="font-medium text-brand hover:underline">CGU</a> et la <a href="/privacy" target="_blank" className="font-medium text-brand hover:underline">politique de confidentialité</a>.</span>
              </label>
            )}

            {error && (
              <div className="flex items-start gap-2 text-xs text-danger bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dim disabled:opacity-60 transition-colors">
              {loading
                ? <Loader2 size={15} className="animate-spin" />
                : <>{mode === 'login' ? 'Se connecter' : "S'inscrire"} <ArrowRight size={14} /></>
              }
            </button>
          </form>

          <p className="text-xs text-center text-ink-muted mt-5">
            {mode === 'login' ? "Pas encore de compte ? " : "Déjà un compte ? "}
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
              className="text-brand font-semibold hover:underline">
              {mode === 'login' ? "S'inscrire" : 'Se connecter'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
