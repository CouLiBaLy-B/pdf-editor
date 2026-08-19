import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const root = fileURLToPath(new URL('./dist/', import.meta.url))
const port = Number(process.env.PORT || 5173)
const backend = new URL(process.env.VITE_PROXY_TARGET || process.env.BACKEND_URL || 'http://localhost:8000')
const production = process.env.NODE_ENV === 'production'

const MIME = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
}

function securityHeaders(response, requestId) {
  response.setHeader('X-Request-ID', requestId)
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
  if (production) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
}

function proxy(request, response, requestId) {
  const target = new URL(request.url, backend)
  const transport = target.protocol === 'https:' ? httpsRequest : httpRequest
  const headers = { ...request.headers, host: target.host, 'x-request-id': requestId }
  const upstream = transport(target, { method: request.method, headers, timeout: 120_000 }, upstreamResponse => {
    response.writeHead(upstreamResponse.statusCode || 502, { ...upstreamResponse.headers, 'x-request-id': requestId })
    upstreamResponse.pipe(response)
  })
  upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')))
  upstream.on('error', error => {
    if (!response.headersSent) {
      securityHeaders(response, requestId)
      response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
    }
    response.end(JSON.stringify({ detail: 'Service API temporairement indisponible', request_id: requestId }))
    console.error(JSON.stringify({ level: 'error', event: 'proxy_error', request_id: requestId, message: error.message }))
  })
  request.pipe(upstream)
}

function staticFile(request, response, requestId) {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  } catch {
    securityHeaders(response, requestId)
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    return response.end('Requête invalide')
  }
  const requested = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '')
  let file = join(root, requested)
  const missing = !file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()
  if (missing && pathname.startsWith('/assets/')) {
    securityHeaders(response, requestId)
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
    return response.end('Fichier introuvable')
  }
  if (missing) file = join(root, 'index.html')

  securityHeaders(response, requestId)
  const extension = extname(file)
  const immutable = file.includes(`${join('dist', 'assets')}`)
  response.writeHead(200, {
    'Content-Type': MIME[extension] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  if (request.method === 'HEAD') return response.end()
  createReadStream(file).pipe(response)
}

function safeLogPath(url = '/') {
  const path = url.split('?')[0]
  return path.startsWith('/api/share/') ? '/api/share/[token]' : path
}

const server = createServer((request, response) => {
  const requestId = request.headers['x-request-id'] || randomUUID()
  const started = Date.now()
  response.on('finish', () => console.log(JSON.stringify({
    level: 'info', event: 'http_request', request_id: requestId,
    method: request.method, path: safeLogPath(request.url), status: response.statusCode,
    duration_ms: Date.now() - started,
  })))
  if (request.url?.startsWith('/api/') || request.url?.startsWith('/health') || request.url?.startsWith('/uploads/')) return proxy(request, response, requestId)
  return staticFile(request, response, requestId)
})

server.requestTimeout = 125_000
server.headersTimeout = 130_000
server.listen(port, '0.0.0.0', () => console.log(`PDFPro frontend listening on 0.0.0.0:${port}`))

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10_000).unref()
  })
}
