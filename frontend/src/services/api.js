import axios from 'axios'

const BASE = '/api'

const api = axios.create({ baseURL: BASE })

// ── Fichiers ─────────────────────────────────────────────────────────────────
export const listFiles = () => api.get('/files/').then(r => r.data)

export const uploadFile = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/files/upload', form).then(r => r.data)
}

export const downloadFile = (id, name) => {
  return api.get(`/files/${id}/download`, { responseType: 'blob' }).then(r => {
    const url = URL.createObjectURL(r.data)
    const a = document.createElement('a')
    a.href = url
    a.download = name || `${id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  })
}

export const deleteFile = (id) => api.delete(`/files/${id}`).then(r => r.data)

// ── Edition ──────────────────────────────────────────────────────────────────
export const addText = (id, payload) =>
  api.post(`/files/${id}/add-text`, payload).then(r => r.data)

export const addImage = (id, payload) =>
  api.post(`/files/${id}/add-image`, payload).then(r => r.data)

// ── Annotation ───────────────────────────────────────────────────────────────
export const addHighlight = (id, payload) =>
  api.post(`/files/${id}/highlight`, payload).then(r => r.data)

// ── Fusion / Split ───────────────────────────────────────────────────────────
export const mergePdfs = (fileIds) =>
  api.post('/merge', { file_ids: fileIds }).then(r => r.data)

export const splitPdf = (id, pageRanges) =>
  api.post(`/files/${id}/split`, { page_ranges: pageRanges }).then(r => r.data)

// ── Remplacement de texte existant ──────────────────────────────────────────
export const replaceText = (id, payload) =>
  api.post(`/files/${id}/replace-text`, payload).then(r => r.data)

// ── Signature ─────────────────────────────────────────────────────────────────
export const signPdf = (id, payload) =>
  api.post(`/files/${id}/sign`, payload).then(r => r.data)
