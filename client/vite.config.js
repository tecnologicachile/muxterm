import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3003,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3002',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    // Optimizaciones para build más rápido
    minify: 'esbuild',
    target: 'es2015',
    sourcemap: false,
    // Reducir el tamaño de chunks
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material'],
          'xterm-vendor': ['xterm', 'xterm-addon-fit', 'xterm-addon-web-links'],
          'socket-vendor': ['socket.io-client']
        }
      }
    }
  }
})