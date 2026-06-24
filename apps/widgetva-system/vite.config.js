import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function openRouterProxyPlugin(apiKey) {
  return {
    name: 'widgetva-openrouter-proxy',
    configureServer(server) {
      server.middlewares.use('/api/openrouter/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'OPENROUTER_API_KEY is not configured on the dev server.' }))
          return
        }

        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })

        req.on('end', async () => {
          try {
            const payload = body ? JSON.parse(body) : {}
            const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://127.0.0.1:5174',
                'X-Title': 'widgetva-system',
              },
              body: JSON.stringify(payload),
            })
            const text = await upstream.text()
            res.statusCode = upstream.status
            res.setHeader('Content-Type', 'application/json')
            res.end(text)
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              error: error instanceof Error ? error.message : 'OpenRouter proxy request failed.',
            }))
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const openRouterApiKey = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || ''

  return {
    plugins: [react(), openRouterProxyPlugin(openRouterApiKey)],
    server: {
      fs: {
        allow: ['../..'],
      },
      port: 5174,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  }
})
