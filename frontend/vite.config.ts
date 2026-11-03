import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8800',
      '/admin': 'http://localhost:8800',
      '/mcp': 'http://localhost:8800',
    },
  },
  build: {
    outDir: 'dist',
  },
})
