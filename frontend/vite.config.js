import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function proxyConfig(backend) {
  return {
    target: backend,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq, req) => {
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization)
        }
        const proto = req.headers['x-forwarded-proto'] || (req.headers['x-forwarded-ssl'] === 'on' ? 'https' : undefined)
        if (proto) proxyReq.setHeader('X-Forwarded-Proto', proto)
        if (req.headers.host) proxyReq.setHeader('X-Forwarded-Host', req.headers.host)
      })
    },
  }
}

export default defineConfig(() => {
  const backend = process.env.VITE_PROXY_TARGET || 'http://localhost:8000'
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
      proxy: {
        '/api': proxyConfig(backend),
        '/uploads': proxyConfig(backend),
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
      proxy: {
        '/api': proxyConfig(backend),
        '/uploads': proxyConfig(backend),
      },
    },
  }
})
