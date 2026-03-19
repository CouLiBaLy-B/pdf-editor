import React, { useState } from 'react'
import { Link2, Scissors, Check } from 'lucide-react'
import { toast } from 'sonner'
import { mergePdfs, splitPdf } from '../services/api'
import { Panel, Button } from './ui/index.js'

export default function MergeSplitPanel({ mode, file, allFiles, onRefresh }) {
  const [selectedIds, setSelectedIds] = useState([])
  const [splitRanges, setSplitRanges] = useState('0,2\n3,4')
  const [loading, setLoading] = useState(false)

  const toggleId = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleMerge = async () => {
    if (selectedIds.length < 2) { toast.error('Sélectionnez au moins 2 fichiers'); return }
    setLoading(true)
    try {
      const result = await mergePdfs(selectedIds)
      toast.success(`Fusionné → "${result.name}"`)
      setSelectedIds([])
      onRefresh?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    } finally { setLoading(false) }
  }

  const handleSplit = async () => {
    if (!file) { toast.error("Sélectionnez un fichier d'abord"); return }
    let ranges
    try {
      ranges = splitRanges.split('\n')
        .map(l => { const [a, b] = l.trim().split(',').map(Number); return [a, b] })
        .filter(r => r.length === 2 && !isNaN(r[0]) && !isNaN(r[1]))
    } catch { toast.error('Format invalide'); return }
    if (!ranges.length) { toast.error('Aucune plage valide'); return }
    setLoading(true)
    try {
      const results = await splitPdf(file.id, ranges)
      toast.success(`${results.length} partie(s) créée(s)`)
      onRefresh?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    } finally { setLoading(false) }
  }

  if (mode === 'merge') return (
    <Panel title="Combiner des PDFs" icon={Link2} maxHeight="max-h-[360px]">
      <div className="flex flex-col gap-1.5">
        <span className="text-2xs font-bold text-ink-muted uppercase tracking-wider">
          Fichiers à combiner
        </span>
        <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1">
          {allFiles.length === 0 && (
            <p className="text-xs text-ink-faint py-2">Aucun fichier disponible</p>
          )}
          {allFiles.map(f => {
            const checked = selectedIds.includes(f.id)
            return (
              <label
                key={f.id}
                className={[
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all duration-100 border',
                  checked
                    ? 'bg-brand/[0.07] border-brand/30'
                    : 'border-transparent hover:bg-surface-raised hover:border-border',
                ].join(' ')}
              >
                <div className={[
                  'flex items-center justify-center w-4 h-4 rounded border-[1.5px] transition-all shrink-0',
                  checked ? 'bg-brand border-brand' : 'border-border-strong',
                ].join(' ')}>
                  {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                <input type="checkbox" checked={checked} onChange={() => toggleId(f.id)} className="sr-only" />
                <span className="text-xs text-ink truncate flex-1">{f.name}</span>
              </label>
            )
          })}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <p className="text-2xs text-ink-muted">
          {selectedIds.length} fichier{selectedIds.length > 1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''}
          {' — '}combinés dans l\'ordre de sélection
        </p>
      )}

      <Button
        variant="primary" size="sm"
        onClick={handleMerge} loading={loading}
        disabled={selectedIds.length < 2}
      >
        Combiner{selectedIds.length >= 2 ? ` (${selectedIds.length})` : ''}
      </Button>
    </Panel>
  )

  if (mode === 'split') return (
    <Panel title={file?.name ? `Séparer : ${file.name}` : 'Séparer le PDF'} icon={Scissors} maxHeight="max-h-72">
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <label htmlFor="split-ranges" className="text-2xs font-bold text-ink-muted uppercase tracking-wider">
            Plages de pages (début,fin)
          </label>
          <textarea
            id="split-ranges"
            className="w-full bg-surface-raised text-ink border border-border rounded-lg p-2.5 text-xs font-mono resize-none h-20 focus:border-brand/50 focus:outline-none focus:ring-1 focus:ring-brand/20 transition-colors"
            value={splitRanges}
            onChange={e => setSplitRanges(e.target.value)}
            placeholder={'0,2\n3,5'}
          />
        </div>
        <div className="text-2xs text-ink-faint bg-surface-raised rounded-lg p-2.5 border border-border leading-relaxed shrink-0 self-end">
          <p className="font-semibold text-ink-muted mb-1.5">Exemples</p>
          <p className="font-mono">0,2 → pages 1–3</p>
          <p className="font-mono">3,5 → pages 4–6</p>
          <p className="mt-1 opacity-60">Indexé à 0</p>
        </div>
      </div>
      <Button variant="primary" size="sm" onClick={handleSplit} loading={loading}>
        Séparer le PDF
      </Button>
    </Panel>
  )

  return null
}
