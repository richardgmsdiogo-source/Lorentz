import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/Lorentz/',        // importante pro GitHub Pages
  plugins: [react()],
  build: {
    outDir: 'docs',         // manda o build pra pasta docs
  },
})
