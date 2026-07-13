import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Same-origin API via proxy so phone/ngrok only need one URL.
    proxy: {
      '/auth': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/users': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/placements': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/join-requests': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/hour-logs': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/memberships': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/admin': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/students': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/student': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/form-options': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/admin/summary': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:4000', changeOrigin: true },
    },
  },
})
