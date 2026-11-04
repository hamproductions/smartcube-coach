import { join } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  build: {
    // cubing.js starts its search worker from a plain module URL, so Vite bundles it as an
    // ordinary chunk and wraps its dynamic imports in the preload helper, which touches
    // `document` and kills the worker. Without preload lists the helper never reaches it.
    modulePreload: false
  },
  resolve: {
    alias: {
      'styled-system': join(import.meta.dirname, './styled-system/')
    }
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3001'
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // A shared CI runner is several times slower than this machine, and the trainer waits on a
    // 164-case F2L catalogue build before its first control enables. The default per-test
    // budget failed there while passing locally, which is the least useful kind of red.
    testTimeout: 60_000,
    hookTimeout: 60_000
  }
})
