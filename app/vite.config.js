import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const appRoot = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  root: appRoot,
  plugins: [react()],
  server : {
    open: true,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
