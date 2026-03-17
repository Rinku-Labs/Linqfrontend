import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // To add only specific polyfills, add them here. If no option is passed, adds all polyfills
      protocolImports: false, // Changed to false to try avoiding the virtual module issue
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      // buffer is handled by nodePolyfills
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      // Define global to window for some libraries
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    rollupOptions: {
      external: [],
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://confidential-brianna-uselinq-52e2b233.koyeb.app',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            proxyReq.setHeader('Origin', 'https://linq.pxxl.click');
          });
        },
      },
    },
  },
})


