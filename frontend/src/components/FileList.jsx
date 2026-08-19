import React, { useState } from 'react'
import { Download, Trash2, FileText, Share2, Unlink, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { downloadFile, deleteFile, revokeShare, shareFile } from '../services/api'
import { ConfirmDialog } from './ui/index.js'

function Skeleton() {
  return (
    <div className="px-3 py-2 space-y-3 mt-2">
      {[1,2,3].map(i => (
        <div key={i} className="flex items-center gap-2.5 animate-pulse">
          <div className="w-7 h-7 rounded-lg bg-surface-overlay shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 bg-surface-overlay rounded w-3/4" />
            <div className="h-2 bg-surface-overlay rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Deterministic color from filename
const COLORS = ['#6366f1','#f59e0b','#ec4899','#3b82f6','#8b5cf6','#14b8a6','#f97316']
function fileColor(name) { return COLORS[name.charCodeAt(0) % COLORS.length] }

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(0)} KB`
  return `${(bytes/1024/1024).toFixed(1)} MB`
}

export default function FileList({ files, activeId, onSelect, onRefresh, onDeleted, onUpload, loading }) {
  const [pendingDelete, setPendingDelete] = useState(null)

  const handleShare = async (e, f) => {
    e.stopPropagation()
    try {
      const { share_url } = await shareFile(f.id)
      await navigator.clipboard.writeText(window.location.origin + share_url)
      toast.success('Lien copié !')
    } catch { toast.error('Erreur partage') }
  }

  const handleRevokeShare = async (event, file) => {
    event.stopPropagation()
    try {
      const { revoked } = await revokeShare(file.id)
      toast.success(revoked ? `${revoked} lien(s) révoqué(s)` : 'Aucun lien actif')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Révocation impossible')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return
    try {
      await deleteFile(pendingDelete.id)
      toast.success(`"${pendingDelete.name}" supprimé`)
      onDeleted?.(pendingDelete)
      await onRefresh()
    } catch { toast.error('Erreur suppression') }
    finally { setPendingDelete(null) }
  }

  return (
    <aside className="flex flex-col bg-white border-r border-border overflow-hidden shrink-0" style={{ width: 232 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-ink">Documents</span>
        <div className="flex items-center gap-1.5">
          {files.length > 0 && (
            <span className="text-2xs font-semibold text-ink-faint bg-surface-raised px-1.5 py-0.5 rounded-full">
              {files.length}
            </span>
          )}
          <button
            onClick={onUpload}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-semibold text-brand hover:bg-brand-light transition-colors"
            title="Importer un PDF"
          >
            <UploadCloud size={12} />
            Importer
          </button>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 py-1.5 px-1.5">
        {loading ? <Skeleton /> : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 px-3 text-center">
            <div className="w-10 h-10 rounded-2xl bg-surface-raised flex items-center justify-center">
              <FileText size={18} className="text-ink-faint" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink">Aucun document</p>
              <p className="text-2xs text-ink-muted mt-1 leading-relaxed">Importez un PDF<br />pour commencer</p>
            </div>
          </div>
        ) : files.map(f => {
          const isActive = f.id === activeId
          const color = fileColor(f.name)
          return (
            <div
              key={f.id}
              onClick={() => onSelect(f)}
              title={f.name}
              className={[
                'group relative flex items-start gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-150 border mb-0.5',
                isActive
                  ? 'bg-brand-light border-brand/20'
                  : 'border-transparent hover:bg-surface-raised hover:border-border',
              ].join(' ')}
            >
              {/* Active strip */}
              {isActive && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-brand" />}

              {/* Icon */}
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${color}18` }}>
                <FileText size={13} style={{ color }} />
              </div>

              {/* Name + size */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-ink truncate leading-tight">{f.name}</p>
                {f.size && <p className="text-2xs text-ink-faint mt-0.5">{formatSize(f.size)}</p>}
              </div>

              {/* Hover actions */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-white border border-border rounded-lg shadow-card px-1 py-0.5">
                <button onClick={e => { e.stopPropagation(); downloadFile(f.id, f.name) }}
                  className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors"
                  title="Télécharger"><Download size={11} /></button>
                <button onClick={e => handleShare(e, f)}
                  className="p-1 rounded-md text-ink-muted hover:text-brand hover:bg-brand-light transition-colors"
                  title="Partager"><Share2 size={11} /></button>
                <button onClick={e => handleRevokeShare(e, f)}
                  className="p-1 rounded-md text-ink-muted hover:text-amber-600 hover:bg-amber-50 transition-colors"
                  title="Révoquer les liens"><Unlink size={11} /></button>
                <button onClick={e => { e.stopPropagation(); setPendingDelete(f) }}
                  className="p-1 rounded-md text-ink-muted hover:text-danger hover:bg-red-50 transition-colors"
                  title="Supprimer"><Trash2 size={11} /></button>
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Supprimer le fichier ?"
        description={pendingDelete ? `"${pendingDelete.name}" sera définitivement supprimé.` : ''}
        confirmLabel="Supprimer"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
    </aside>
  )
}
