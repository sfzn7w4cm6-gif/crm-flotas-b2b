import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Modo demo para grabar el vídeo manual: la misma app, pero con un usuario y datos ficticios
// en memoria en lugar de Power Apps y Dataverse. Solo se usa con "npm run demo".
export default defineConfig({
  plugins: [react()],
  server: { port: 3100, strictPort: true },
  resolve: {
    alias: [
      { find: /^@microsoft\/power-apps\/app$/, replacement: fileURLToPath(new URL('./demo/powerAppsApp.ts', import.meta.url)) },
      { find: /^@microsoft\/power-apps\/data$/, replacement: fileURLToPath(new URL('./demo/powerAppsData.ts', import.meta.url)) },
    ],
  },
})
