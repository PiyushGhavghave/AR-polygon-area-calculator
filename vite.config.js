import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // This is still useful for local network access
    hmr: {
        host: 'localhost',
        protocol: 'ws',
    },
    // Add this to allow requests from any ngrok free-tier URL
    allowedHosts: [
        '.ngrok-free.app'
    ]
  }
})
