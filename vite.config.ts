import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/Open-Trade/',
  plugins: [react()],
  build: {
    manifest: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return /[\\/]node_modules[\\/]phaser[\\/]/.test(id)
            ? 'phaser-runtime'
            : undefined
        },
      },
    },
  },
})
