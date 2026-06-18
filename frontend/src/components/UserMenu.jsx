import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, Settings, LogOut, Zap } from 'lucide-react'

export default function UserMenu() {
  const { user, signout } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  if (!user) return null

  const credits = user.credits ?? 0
  const maxCredits = 100
  const pct = Math.min(100, (credits / maxCredits) * 100)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-raised transition-colors"
      >
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold bg-brand shrink-0">
          {user.email[0].toUpperCase()}
        </span>
        <div className="hidden sm:flex flex-col items-start leading-none">
          <span className="text-xs font-medium text-ink max-w-[120px] truncate">{user.email}</span>
          <span className="text-2xs text-ink-muted mt-0.5">{credits} crédits</span>
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-border rounded-xl shadow-dropdown z-20 py-1.5 animate-fade-up">
            {/* User info */}
            <div className="px-3 py-2.5 border-b border-border mb-1">
              <p className="text-xs font-semibold text-ink truncate">{user.email}</p>
              <div className="mt-2">
                <div className="flex justify-between text-2xs text-ink-muted mb-1">
                  <span>Crédits</span>
                  <span className="font-semibold text-brand">{credits}</span>
                </div>
                <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <button
                onClick={() => { setOpen(false); navigate('/dashboard') }}
                className="mt-2 flex items-center gap-1.5 text-2xs font-semibold text-brand hover:underline"
              >
                <Zap size={10} /> Recharger les crédits
              </button>
            </div>

            {/* Nav items */}
            {[
              { Icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
              { Icon: Settings,        label: 'Paramètres', path: '/settings' },
            ].map(({ Icon, label, path }) => (
              <button key={path}
                onClick={() => { setOpen(false); navigate(path) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors"
              >
                <Icon size={13} /> {label}
              </button>
            ))}

            <div className="border-t border-border mt-1 pt-1">
              <button
                onClick={() => { signout(); navigate('/') }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-danger hover:bg-red-50 transition-colors"
              >
                <LogOut size={13} /> Se déconnecter
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
