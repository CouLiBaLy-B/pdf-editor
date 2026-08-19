import React, { useState, useCallback } from 'react'
import { RotateCw, Trash2, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { rotatePage, rotateAllPages, deletePages, reorderPages } from '../services/api'
import { Panel, Button } from './ui/index.js'

/**
 * Panel for page operations: rotate, delete, reorder
 */
export default function PagesPanel({ fileId, totalPages, currentPage, onSaved, onClose }) {
  const [selectedPages, setSelectedPages] = useState([])
  const [loading, setLoading] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)

  const togglePage = (pageIndex) => {
    setSelectedPages(prev =>
      prev.includes(pageIndex)
        ? prev.filter(p => p !== pageIndex)
        : [...prev, pageIndex]
    )
  }

  const selectAll = () => {
    if (selectedPages.length === totalPages) {
      setSelectedPages([])
    } else {
      setSelectedPages(Array.from({ length: totalPages }, (_, i) => i))
    }
  }

  const handleRotateSingle = async (pageIndex, degrees) => {
    setLoading(true)
    try {
      await rotatePage(fileId, pageIndex, degrees)
      toast.success(`Page ${pageIndex + 1} pivotée de ${degrees}°`)
      onSaved?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur rotation')
    } finally {
      setLoading(false)
    }
  }

  const handleRotateAll = async (degrees) => {
    setLoading(true)
    try {
      await rotateAllPages(fileId, degrees)
      toast.success(`Toutes les pages pivotées de ${degrees}°`)
      onSaved?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur rotation')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedPages.length === 0) {
      toast.warning('Sélectionnez des pages à supprimer')
      return
    }
    
    if (selectedPages.length >= totalPages) {
      toast.error('Impossible de supprimer toutes les pages')
      return
    }

    setLoading(true)
    try {
      const result = await deletePages(fileId, selectedPages)
      toast.success(`${selectedPages.length} page(s) supprimée(s)`)
      setSelectedPages([])
      onSaved?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur suppression')
    } finally {
      setLoading(false)
    }
  }

  // Drag and drop handlers for reordering
  const handleDragStart = (e, index) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    
    const newOrder = [...selectedPages]
    const draggedItem = newOrder[dragIndex]
    newOrder.splice(dragIndex, 1)
    newOrder.splice(index, 0, draggedItem)
    setSelectedPages(newOrder)
    setDragIndex(index)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
  }

  const handleReorder = async () => {
    if (selectedPages.length < 2) {
      toast.warning('Sélectionnez au moins 2 pages pour réorganiser')
      return
    }

    setLoading(true)
    try {
      await reorderPages(fileId, selectedPages)
      toast.success('Pages réordonnées')
      onSaved?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur réorganisation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel
      title="Gestion des pages"
      icon={RotateCw}
      maxHeight="max-h-[480px]"
      onClose={onClose}
    >
      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <span className="text-2xs font-semibold text-ink-muted w-full mb-1">Rotation rapide</span>
        {[90, 180, 270].map(deg => (
          <Button
            key={deg}
            variant="secondary"
            size="sm"
            onClick={() => handleRotateAll(deg)}
            disabled={loading}
          >
            <RotateCw size={12} className={deg === 90 ? '' : deg === 180 ? 'rotate-90' : ''} />
            {deg}°
          </Button>
        ))}
      </div>

      {/* Page selection */}
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold text-ink-muted">
          Pages ({selectedPages.length}/{totalPages} sélectionnées)
        </span>
        <button
          onClick={selectAll}
          className="text-2xs text-brand hover:underline"
        >
          {selectedPages.length === totalPages ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
      </div>

      {/* Page list */}
      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
        {Array.from({ length: totalPages }).map((_, i) => {
          const isSelected = selectedPages.includes(i)
          const isCurrent = i === currentPage - 1
          
          return (
            <div
              key={i}
              draggable={isSelected}
              onDragStart={(e) => handleDragStart(e, selectedPages.indexOf(i))}
              onDragOver={(e) => isSelected && handleDragOver(e, selectedPages.indexOf(i))}
              onDragEnd={handleDragEnd}
              onClick={() => togglePage(i)}
              className={[
                'relative flex flex-col items-center justify-center w-10 h-12 rounded-lg border cursor-pointer transition-all',
                isCurrent ? 'ring-2 ring-brand ring-offset-1' : '',
                isSelected
                  ? 'bg-brand-light border-brand'
                  : 'bg-white border-border hover:border-brand/40',
                dragIndex === selectedPages.indexOf(i) ? 'opacity-50' : '',
              ].join(' ')}
            >
              {isSelected && (
                <GripVertical size={10} className="absolute top-0.5 right-0.5 text-brand" />
              )}
              <span className="text-xs font-semibold">{i + 1}</span>
            </div>
          )
        })}
      </div>

      {/* Actions on selected pages */}
      {selectedPages.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <span className="text-2xs font-semibold text-ink-muted">
            Actions sur {selectedPages.length} page(s) sélectionnée(s)
          </span>
          
          <div className="flex flex-wrap gap-2">
            {[90, 180, 270].map(deg => (
              <Button
                key={deg}
                variant="secondary"
                size="sm"
                onClick={() => selectedPages.forEach(p => handleRotateSingle(p, deg))}
                disabled={loading}
              >
                Rotation {deg}°
              </Button>
            ))}
          </div>

          {selectedPages.length >= 2 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReorder}
              disabled={loading}
            >
              <GripVertical size={12} />
              Réorganiser dans cet ordre
            </Button>
          )}

          {selectedPages.length < totalPages && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={loading}
            >
              <Trash2 size={12} />
              Supprimer {selectedPages.length} page(s)
            </Button>
          )}
        </div>
      )}
    </Panel>
  )
}
