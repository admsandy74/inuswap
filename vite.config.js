import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    allowedHosts: ['aelvoramarket.com', 'www.aelvoramarket.com'],

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/rpc': {
        target: 'https://rpc.mainnet.chain.robinhood.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc/, ''),
      },

      '/dexscreener': {
        target: 'https://api.dexscreener.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dexscreener/, ''),
      },
    },
  },
})
