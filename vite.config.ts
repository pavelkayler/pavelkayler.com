import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    assetsDir: '_app',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
  },
})
