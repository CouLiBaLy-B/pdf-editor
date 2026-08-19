import React, { useEffect, useMemo, useState } from 'react'
import { GripVertical, RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deletePages, reorderPages, rotateAllPages, rotatePages } from '../services/api'
import { Button, ConfirmDialog, Panel } from './ui/index.js'

export default function PagesPanel({ fileId, totalPages, currentPage, onSaved, onClose }) {
  const [selected, setSelected] = useState([])
  const [order, setOrder] = useState([])
  const [dragged, setDragged] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setOrder(Array.from({ length: totalPages }, (_, index) => index))
    setSelected([])
  }, [fileId, totalPages])

  const orderChanged = useMemo(() => order.some((page, index) => page !== index), [order])
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const run = async (operation, success) => {
    setLoading(true)
    try {
      await operation()
      toast.success(success)
      await onSaved?.()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'L’opération sur les pages a échoué')
    } finally {
      setLoading(false)
    }
  }

  const toggle = page => setSelected(current =>
    current.includes(page) ? current.filter(item => item !== page) : [...current, page]
  )

  const rotateSelection = degrees => {
    if (!selected.length) return
    run(() => rotatePages(fileId, selected, degrees), `${selected.length} page(s) pivotée(s)`)
  }

  const moveDraggedBefore = targetPage => {
    if (dragged === null || dragged === targetPage) return
    setOrder(current => {
      const next = current.filter(page => page !== dragged)
      next.splice(next.indexOf(targetPage), 0, dragged)
      return next
    })
  }

  const applyOrder = () => run(
    () => reorderPages(fileId, order),
    'Nouvel ordre des pages enregistré',
  )

  const removeSelected = async () => {
    setConfirmDelete(false)
    await run(() => deletePages(fileId, selected), `${selected.length} page(s) supprimée(s)`)
    setSelected([])
  }

  return (
    <>
      <Panel title="Organiser les pages" icon={RotateCw} maxHeight="max-h-[540px]" onClose={onClose}>
        <div className="rounded-lg border border-border bg-surface-raised/60 p-2.5 text-[11px] leading-relaxed text-ink-muted">
          Sélectionnez des pages pour les pivoter ou les supprimer. Faites glisser les vignettes pour modifier l’ordre complet du document.
        </div>

        <div className="flex items-center justify-between">
          <span className="text-2xs font-semibold text-ink-muted">{selected.length} sur {totalPages} sélectionnée(s)</span>
          <button
            type="button"
            onClick={() => setSelected(selected.length === totalPages ? [] : [...order])}
            className="text-2xs font-medium text-brand hover:underline"
          >
            {selected.length === totalPages ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
        </div>

        <div className="grid max-h-44 grid-cols-6 gap-1.5 overflow-y-auto pr-1">
          {order.map(page => {
            const isSelected = selectedSet.has(page)
            const isCurrent = page === currentPage - 1
            return (
              <div
                key={page}
                draggable={!loading}
                onDragStart={() => setDragged(page)}
                onDragOver={event => { event.preventDefault(); moveDraggedBefore(page) }}
                onDragEnd={() => setDragged(null)}
                className={[
                  'group relative flex h-14 cursor-grab flex-col items-center justify-center rounded-lg border bg-white transition-all active:cursor-grabbing',
                  isSelected ? 'border-brand bg-brand-light' : 'border-border hover:border-brand/50',
                  isCurrent ? 'ring-2 ring-brand ring-offset-1' : '',
                  dragged === page ? 'opacity-40' : '',
                ].join(' ')}
              >
                <button type="button" onClick={() => toggle(page)} className="absolute inset-0" aria-label={`Sélectionner la page ${page + 1}`} />
                <GripVertical size={11} className="absolute right-0.5 top-1 text-ink-faint opacity-0 group-hover:opacity-100" />
                <span className="text-xs font-semibold text-ink">{page + 1}</span>
                <span className="text-[8px] text-ink-faint">PAGE</span>
              </div>
            )
          })}
        </div>

        {orderChanged && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-brand/20 bg-brand-light p-2">
            <span className="text-[10px] font-medium text-brand">Ordre modifié</span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setOrder(Array.from({ length: totalPages }, (_, i) => i))}>Annuler</Button>
              <Button size="sm" onClick={applyOrder} loading={loading}>Enregistrer l’ordre</Button>
            </div>
          </div>
        )}

        <div className="border-t border-border pt-3">
          <p className="mb-2 text-2xs font-semibold text-ink-muted">Rotation</p>
          <div className="flex flex-wrap gap-2">
            {[90, 180, 270].map(degrees => (
              <Button
                key={degrees}
                variant="secondary"
                size="sm"
                disabled={loading || !selected.length}
                onClick={() => rotateSelection(degrees)}
              >
                <RotateCw size={12} /> {degrees}°
              </Button>
            ))}
            <Button variant="ghost" size="sm" disabled={loading} onClick={() => run(() => rotateAllPages(fileId, 90), 'Toutes les pages pivotées')}>
              Tout pivoter 90°
            </Button>
          </div>
        </div>

        <Button
          variant="danger"
          size="sm"
          disabled={loading || !selected.length || selected.length >= totalPages}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={12} /> Supprimer {selected.length || ''} page{selected.length > 1 ? 's' : ''}
        </Button>
      </Panel>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer définitivement ces pages ?"
        description={`${selected.length} page(s) seront retirées du document. Cette action ne peut pas être annulée.`}
        confirmLabel="Supprimer les pages"
        onConfirm={removeSelected}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
