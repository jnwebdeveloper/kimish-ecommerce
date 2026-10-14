import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createApi } from './server/api.js'
import { createAuthHandler } from './server/auth.js'

// /admin and /admin/* load the separate back-office page (admin.html)
const adminPage=(req,_res,next)=>{if(/^\/admin(\/|\?|$)/.test(req.url))req.url='/admin.html'+(req.url.includes('?')?req.url.slice(req.url.indexOf('?')):'');next()}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  return {
    plugins: [react(), {
      name: 'kimish-phone-auth',
      configureServer(server) { server.middlewares.use(adminPage); const backend=createApi(env); server.middlewares.use(backend.api); server.middlewares.use(createAuthHandler({ env, pool:backend.pool })); server.httpServer?.on('close',()=>backend.pool.end()) },
      configurePreviewServer(server) { server.middlewares.use(adminPage); const backend=createApi(env); server.middlewares.use(backend.api); server.middlewares.use(createAuthHandler({ env, pool:backend.pool })); server.httpServer?.on('close',()=>backend.pool.end()) },
    }],
    // Allow Cloudflare quick tunnels (cloudflared tunnel --url) to reach the dev server, e.g. for Razorpay webhooks
    server: { allowedHosts: ['.trycloudflare.com'] },
    // Two pages: the storefront (index.html) and the back office (admin.html), each with its own bundle and CSS
    build: { rollupOptions: { input: { main: 'index.html', admin: 'admin.html' } } },
  }
})
