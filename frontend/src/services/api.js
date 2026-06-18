import axios from 'axios'

const BASE = '/api'
const api = axios.create({ baseURL: BASE })

// Inject token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401, PaywallModal on 402
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    if (err.response?.status === 402) {
      window.dispatchEvent(new CustomEvent('paywall', { detail: err.response.data?.detail }))
    }
    return Promise.reject(err)
  }
)

export default api

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register = (email, password) =>
  api.post('/auth/register', { email, password }).then(r => r.data)

export const login = (email, password) => {
  const form = new FormData()
  form.append('username', email)
  form.append('password', password)
  return api.post('/auth/login', form).then(r => r.data)
}

export const getMe = () => api.get('/auth/me').then(r => r.data)

// ── Fichiers ──────────────────────────────────────────────────────────────────
export const listFiles = () => api.get('/files/').then(r => r.data)

export const uploadFile = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/files/upload', form).then(r => r.data)
}

export const downloadFile = (id, name) =>
  api.get(`/files/${id}/download`, { responseType: 'blob' }).then(r => {
    const url = URL.createObjectURL(r.data)
    const a = document.createElement('a')
    a.href = url; a.download = name || `${id}.pdf`; a.click()
    URL.revokeObjectURL(url)
  })

export const fetchPdfBlob = (id) =>
  api.get(`/files/${id}/download`, { responseType: 'blob' }).then(r => URL.createObjectURL(r.data))

export const deleteFile = (id) => api.delete(`/files/${id}`).then(r => r.data)

// ── Edition ───────────────────────────────────────────────────────────────────
export const addText = (id, payload) => api.post(`/files/${id}/add-text`, payload).then(r => r.data)
export const addImage = (id, payload) => api.post(`/files/${id}/add-image`, payload).then(r => r.data)
export const addHighlight = (id, payload) => api.post(`/files/${id}/highlight`, payload).then(r => r.data)
export const mergePdfs = (fileIds) => api.post('/merge', { file_ids: fileIds }).then(r => r.data)
export const splitPdf = (id, pageRanges) => api.post(`/files/${id}/split`, { page_ranges: pageRanges }).then(r => r.data)
export const replaceText = (id, payload) => api.post(`/files/${id}/replace-text`, payload).then(r => r.data)
export const signPdf = (id, payload) => api.post(`/files/${id}/sign`, payload).then(r => r.data)
export const getMetadata = (id) => api.get(`/files/${id}/metadata`).then(r => r.data)
export const updateMetadata = (id, payload) => api.post(`/files/${id}/metadata`, payload).then(r => r.data)

// ── Auth avancé ───────────────────────────────────────────────────────────────
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email }).then(r => r.data)
export const resetPassword = (token, new_password) => api.post('/auth/reset-password', { token, new_password }).then(r => r.data)
export const deleteAccount = () => api.delete('/auth/me').then(r => r.data)

// ── Billing ───────────────────────────────────────────────────────────────────
export const createTopup = (pack) => api.post('/billing/topup', { pack }).then(r => r.data)
export const getBalance = () => api.get('/billing/balance').then(r => r.data)
export const getBillingHistory = () => api.get('/billing/history').then(r => r.data)

// ── Partage ───────────────────────────────────────────────────────────────────
export const shareFile = (id) => api.post(`/files/${id}/share`).then(r => r.data)

// ── Nouvelles features ────────────────────────────────────────────────────────
export const compressPdf = (id) => api.post(`/files/${id}/compress`).then(r => r.data)
export const exportImages = (id) => api.post(`/files/${id}/export-images`).then(r => r.data)
export const applyOcr = (id) => api.post(`/files/${id}/ocr`).then(r => r.data)
