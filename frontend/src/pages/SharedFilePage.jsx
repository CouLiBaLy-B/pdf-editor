import { useCallback, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AppLogo } from '../components/ui/index.js'
import PDFViewer from '../components/PDFViewer'

export default function SharedFilePage() {
  const { token } = useParams()
  const [error, setError] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)

  const fileUrl = `/api/share/${token}`
  const handleError = useCallback(() => setError(true), [])
  const noop = useCallback(() => {}, [])

  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      <header className="flex items-center justify-between px-5 bg-white border-b border-border shrink-0" style={{ height: '52px' }}>
        <AppLogo />
        <Link to="/login"
          className="px-4 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand/90">
          Créer un compte gratuit →
        </Link>
      </header>

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-sm font-semibold text-ink">Ce lien a expiré ou est invalide</p>
          <Link to="/" className="text-xs text-brand hover:underline">Retour à l'accueil</Link>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-8 flex flex-col items-center gap-4">
          {totalPages > 1 && (
            <div className="flex items-center gap-3 text-xs text-ink-muted">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-2 py-1 border border-border rounded disabled:opacity-40">←</button>
              <span>{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="px-2 py-1 border border-border rounded disabled:opacity-40">→</button>
            </div>
          )}
          <div className="shadow-pdf">
            <PDFViewer
              fileUrl={fileUrl}
              currentPage={currentPage}
              onTotalPages={setTotalPages}
              onPageRendered={noop}
              onTextItems={noop}
              onError={handleError}
            />
          </div>
        </div>
      )}
    </div>
  )
}
