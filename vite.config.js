import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Publicado em: https://richardgmsdiogo-source.github.io/Lorentz/
export default defineConfig({
  base: '/Lorentz/',     // nome EXATO do repo, com barra antes e depois
  build: {
    outDir: 'docs',      // Vite vai gerar a pasta docs pro GitHub Pages
  },
  plugins: [react()],
})
