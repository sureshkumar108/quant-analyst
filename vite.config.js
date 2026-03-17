import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { quantApiPlugin } from './src/server/vite-api-plugin.js'

export default defineConfig({
  plugins: [react(), quantApiPlugin()],
})
