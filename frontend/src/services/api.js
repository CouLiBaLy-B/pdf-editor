import axios from 'axios'

const BASE = '/api'
const api = axios.create({ baseURL: BASE, withCredentials: true })

// ── Gestion du token ──────────────────────────────────────────────────────────
// Le token est conservé dans localStorage avec un repli en mémoire (variable de
// module). Certains environnements (iframe de prévisualisation, navigation
// privée, blocage des cookies tiers) rendent le localStorage indisponible ou
// font échouer setItem silencieusement : sans ce repli, aucune requête
// authentifiée ne partirait et l'utilisateur serait renvoyé en boucle sur la
// page de connexion (401 sur /auth/me).
let memoryToken = null
try {
  memoryToken = localStorage.getItem('token') || null
} catch {
  memoryToken = null
}

export const getStoredToken = () => {
  if (memoryToken) return memoryToken
  try {
    return localStorage.getItem('token') || sessionStorage.getItem('token')
  } catch {
    return null
  }
}

const applyAuthHeader = (token) => {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`
  else delete api.defaults.headers.common.Authorization
}

export const storeToken = (token) => {
  memoryToken = token || null
  applyAuthHeader(memoryToken)
  try {
    if (token) {
      localStorage.setItem('token', token)
      sessionStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
      sessionStorage.removeItem('token')
    }
  } catch {
    // Stockage indisponible : le token reste en mémoire pour la session
  }
}

export const clearToken = () => {
  memoryToken = null
  applyAuthHeader(null)
  try {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('token')
  } catch {
    // Stockage indisponible : rien à nettoyer côté localStorage
  }
}

applyAuthHeader(getStoredToken())

// Inject token on every request
api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-logout on 401, PaywallModal on 402
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status
    const url = String(err.config?.url || '')
    const isAuthEndpoint = /\/auth\/(login|register|me|forgot-password|reset-password)$/.test(url)
    if (status === 401 && !isAuthEndpoint) {
      clearToken()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    if (status === 402) {
      window.dispatchEvent(new CustomEvent('paywall', { detail: err.response.data?.detail }))
    }
    return Promise.reject(err)
  }
)

export default api

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register = (email, password, acceptedTerms = false) =>
  api.post('/auth/register', { email, password, accepted_terms: acceptedTerms }).then(r => r.data)

export const login = (email, password) => {
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  return api.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }).then(r => r.data)
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
export const exportAccount = () => api.get('/auth/export').then(r => r.data)

// ── Billing ───────────────────────────────────────────────────────────────────
export const createTopup = (pack) => api.post('/billing/topup', { pack }).then(r => r.data)
export const getBalance = () => api.get('/billing/balance').then(r => r.data)
export const getBillingHistory = () => api.get('/billing/history').then(r => r.data)

// ── Partage ───────────────────────────────────────────────────────────────────
export const shareFile = (id) => api.post(`/files/${id}/share`).then(r => r.data)
export const revokeShare = (id) => api.delete(`/files/${id}/share`).then(r => r.data)

// ── Nouvelles features ────────────────────────────────────────────────────────
export const compressPdf = (id) => api.post(`/files/${id}/compress`).then(r => r.data)
export const exportImages = (id) => api.post(`/files/${id}/export-images`).then(r => r.data)
export const applyOcr = (id) => api.post(`/files/${id}/ocr`).then(r => r.data)

// ── Pages ─────────────────────────────────────────────────────────────────────
export const rotatePage = (id, page, degrees) => 
  api.post(`/files/${id}/rotate-page`, { page, degrees }).then(r => r.data)

export const rotateAllPages = (id, degrees) => 
  api.post(`/files/${id}/rotate-all`, { degrees }).then(r => r.data)

export const rotatePages = (id, pages, degrees) =>
  api.post(`/files/${id}/rotate-pages`, { pages, degrees }).then(r => r.data)

export const deletePages = (id, pages) => 
  api.post(`/files/${id}/delete-pages`, { pages }).then(r => r.data)

export const reorderPages = (id, newOrder) => 
  api.post(`/files/${id}/reorder-pages`, { new_order: newOrder }).then(r => r.data)
