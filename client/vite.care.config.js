// Dedicated E2E ports prevent reuse of a developer's frontend/backend.
import { defineConfig, mergeConfig } from 'vite'
import config from './vite.config.js'

export default mergeConfig(
  config,
  defineConfig({
    server: {
      host: '127.0.0.1',
      port: 5178,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8008',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }),
)
