import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { quantApiPlugin } from './src/server/vite-api-plugin.js'

export default defineConfig({
  plugins: [react(), quantApiPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve('index.html'),
        tokenSetup: path.resolve('api-token-setup.html'),
      },
    },
  },
})
