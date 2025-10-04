import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,              // important inside docker
    strictPort: true,
    proxy: {
      '/api': 'http://backend:4000'
    }
  }
})
