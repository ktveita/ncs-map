import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/ncs-map/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
})
