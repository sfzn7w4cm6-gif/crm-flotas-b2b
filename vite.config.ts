import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 3000, strictPort: true },
  // El hosting de Power Apps Code Apps no sirve de forma fiable los
  // archivos binarios sueltos de dist/assets (el logo cargaba bien en local
  // pero daba imagen rota una vez publicado). Se incrusta como base64
  // dentro del JS/CSS para no depender de una peticion de red aparte.
  build: { assetsInlineLimit: 100000 },
})
