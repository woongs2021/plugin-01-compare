import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/ui.html'),
      output: {
        entryFileNames: 'ui.js',
        chunkFileNames: 'ui-[name].js',
        assetFileNames: 'ui-[name][extname]',
      },
    },
  },
})
