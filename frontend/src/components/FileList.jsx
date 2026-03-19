import React, { useState } from 'react'
import { Download, Trash2, FileText, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { downloadFile, deleteFile } from '../services/api'
import { ConfirmDialog, Badge } from './ui/index.js'

export default function FileList({ files, activeId, onSelect, onRefresh }) {
  const [pendingDelete, setPendingDelete] = useState(null)
  const [hovered, setHovered] = useState(null)

  const handleDownload = (e, f) => {
    e.stopPropagation()
    downloadFile(f.id, f.name)
  }

  const handleDeleteRequest = (e, f) => {
    e.stopPropagation()
    setPendingDelete(f)
  }

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return
    try {
      await deleteFile(pendingDelete.id)
      toast.success(`"${pendingDelete.name}" supprimé`)
      onRefresh()
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <aside className="w-60 bg-white flex flex-col border-r border-border overflow-hidden shrink-0">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-surface-raised">
        <span className="text-2xs font-bold text-ink-muted uppercase tracking-widest">Documents</span>
        {files.length > 0 && (
          <Badge variant="default">{files.length}</Badge>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 py-2 px-2">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-2 text-center">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-brand/10">
              <Upload size={18} className="text-brand" />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink">Aucun document</p>
              <p className="text-2xs text-ink-muted mt-1 leading-relaxed">
                Importez un PDF<br />pour commencer
              </p>
            </div>
          </div>
        ) : (
          files.map(f => {
            const isActive  = f.id === activeId
            const isHovered = hovered === f.id
            return (
              <div
                key={f.id}
                onClick={() => onSelect(f)}
                onMouseEnter={() => setHovered(f.id)}
                onMouseLeave={() => setHovered(null)}
                title={f.name}
                className={[
                  'relative group mx-0.5 my-0.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 border',
                  isActive
                    ? 'bg-brand/[0.07] border-brand/30'
                    : 'border-transparent hover:bg-surface-raised hover:border-border',
                ].join(' ')}
              >
                {/* Active indicator strip */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-brand" />
                )}

                <div className="flex items-center gap-2.5">
                  <div className={[
                    'flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-colors',
                    isActive ? 'bg-brand/15' : 'bg-surface-overlay group-hover:bg-surface-overlay',
                  ].join(' ')}>
                    <FileText size={13} className={isActive ? 'text-brand' : 'text-ink-muted'} aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium text-ink truncate flex-1 leading-tight">
                    {f.name}
                  </span>
                </div>

                {/* Actions — visible on hover/active */}
                <div className={[
                  'flex items-center gap-0.5 mt-1.5 pl-9 transition-all duration-100',
                  (isActive || isHovered) ? 'opacity-100 h-5' : 'opacity-0 h-0 overflow-hidden',
                ].join(' ')}>
                  <button
                    onClick={e => handleDownload(e, f)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-2xs text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors"
                    title="Télécharger"
                  >
                    <Download size={10} />Télécharger
                  </button>
                  <span className="text-ink-faint text-2xs select-none">·</span>
                  <button
                    onClick={e => handleDeleteRequest(e, f)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-2xs text-ink-muted hover:text-danger transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={10} />Supprimer
                  </button>
                </div>
              </div>
            )
          })
        )}
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
