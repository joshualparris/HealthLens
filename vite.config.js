import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Keep health-data pages cross-origin isolated, but permit publisher-hosted
// audio and video only in the standalone educational listening route.
const mediaRouteHeaders = {
  name: 'healthlens-listen-media-headers',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const route = (req.url || '').split('?')[0]
      res.setHeader('Cross-Origin-Embedder-Policy', route === '/listen.html' ? 'unsafe-none' : 'require-corp')
      next()
    })
  }
}

export default defineConfig({
  plugins: [react(), mediaRouteHeaders],
  optimizeDeps: {
    exclude: []
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  }
})
