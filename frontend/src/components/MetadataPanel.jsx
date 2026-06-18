import React, { useState, useEffect } from 'react'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'
import { getMetadata, updateMetadata } from '../services/api'
import { Panel, Button } from './ui/index.js'

const FIELDS = [
  { key: 'title',    label: 'Titre',       type: 'text' },
  { key: 'author',   label: 'Auteur',      type: 'text' },
  { key: 'subject',  label: 'Sujet',       type: 'text' },
  { key: 'keywords', label: 'Mots-clés',   type: 'text' },
]

const DATE_FIELDS = [
  { key: 'creation_date', label: 'Date de création'     },
  { key: 'mod_date',      label: 'Date de modification' },
]

export default function MetadataPanel({ fileId, onSaved, onClose }) {
  const [form, setForm] = useState({
    title: '', author: '', subject: '', keywords: '',
    creation_date: '', mod_date: '',
  })
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!fileId) return
    setFetching(true)
    getMetadata(fileId)
      .then(data => setForm({
        title:         data.title         || '',
        author:        data.author        || '',
        subject:       data.subject       || '',
        keywords:      data.keywords      || '',
        creation_date: data.creation_date || '',
        mod_date:      data.mod_date      || '',
      }))
      .catch(() => toast.error('Impossible de charger les métadonnées'))
      .finally(() => setFetching(false))
  }, [fileId])

  const handleChange = (key, value) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setLoading(true)
    try {
      await updateMetadata(fileId, form)
      toast.success('Métadonnées enregistrées')
      onSaved?.()
    } catch (err) {
      toast.error('Erreur : ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel title="Métadonnées du document" icon={FileText} maxHeight="max-h-[420px]" onClose={onClose}>
      {fetching ? (
        <p className="text-xs text-ink-muted text-center py-4">Chargement…</p>
      ) : (
        <>
          {/* Champs texte */}
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(({ key, label }) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-muted">{label}</span>
                <input
                  type="text"
                  value={form[key]}
                  onChange={e => handleChange(key, e.target.value)}
                  className="bg-white text-ink text-xs rounded-lg px-2.5 py-1.5 border border-border focus:border-brand/60 focus:outline-none focus:ring-1 focus:ring-brand/20 transition-colors"
                  placeholder={`Saisir ${label.toLowerCase()}…`}
                />
              </label>
            ))}
          </div>

          {/* Champs dates */}
          <div className="grid grid-cols-2 gap-3">
            {DATE_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-muted">{label}</span>
                <input
                  type="datetime-local"
                  value={form[key]}
                  onChange={e => handleChange(key, e.target.value)}
                  className="bg-white text-ink text-xs rounded-lg px-2.5 py-1.5 border border-border focus:border-brand/60 focus:outline-none focus:ring-1 focus:ring-brand/20 transition-colors"
                />
              </label>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="primary" size="sm" onClick={handleSave} loading={loading}>
              Enregistrer les métadonnées
            </Button>
          </div>
        </>
      )}
    </Panel>
  )
}
