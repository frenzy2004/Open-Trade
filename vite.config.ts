import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/Open-Trade/',
  plugins: [react()],
  build: {
    sourcemap: true,
  },
})
