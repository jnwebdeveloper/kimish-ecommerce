import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createApi } from './server/api.js'
import { createAuthHandler } from './server/auth.js'

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  return {
    plugins: [react(), {
      name: 'kimish-phone-auth',
      configureServer(server) { const backend=createApi(env); server.middlewares.use(backend.api); server.middlewares.use(createAuthHandler({ env, pool:backend.pool })); server.httpServer?.on('close',()=>backend.pool.end()) },
      configurePreviewServer(server) { const backend=createApi(env); server.middlewares.use(backend.api); server.middlewares.use(createAuthHandler({ env, pool:backend.pool })); server.httpServer?.on('close',()=>backend.pool.end()) },
    }],
  }
})
