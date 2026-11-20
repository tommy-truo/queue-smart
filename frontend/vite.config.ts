import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3939,
    // Fail if the port is taken instead of moving to the next one, which could be the API's port.
    strictPort: true,
    proxy: { '/api': 'http://localhost:3940' },
  },
})
