import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: path => path,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            // Suppress ECONNREFUSED errors which happen when backend is starting up
            if (err.code === 'ECONNREFUSED') {
              return;
            }
            console.log('proxy error', err);
          });
        }
      }
    }
  }
})