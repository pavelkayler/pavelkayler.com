import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Each Pages run gets readable filenames in a new cache-safe release directory.
const release = process.env.GITHUB_RUN_NUMBER
const assetDirectory = release
  ? `_app/release-${release}-${process.env.GITHUB_RUN_ATTEMPT || '1'}`
  : '_app/local'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    assetsDir: assetDirectory,
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        entryFileNames: `${assetDirectory}/site.js`,
        chunkFileNames: `${assetDirectory}/[name].js`,
        assetFileNames: `${assetDirectory}/[name][extname]`,
      },
    },
  },
})
