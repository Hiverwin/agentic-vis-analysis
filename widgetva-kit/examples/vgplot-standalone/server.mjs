import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, stat } from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../../..')
const port = Number.parseInt(process.env.PORT || '4177', 10)
const apiKey = process.env.OPENROUTER_API_KEY || ''

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
])

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function isPathInside(parent, child) {
  const normalizedParent = `${path.resolve(parent)}${path.sep}`
  const normalizedChild = path.resolve(child)
  return normalizedChild === path.resolve(parent) || normalizedChild.startsWith(normalizedParent)
}

async function handleOpenRouterProxy(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' })
    return
  }

  if (!apiKey) {
    sendJson(res, 500, { error: 'OPENROUTER_API_KEY is not configured for the standalone sample server.' })
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
          'HTTP-Referer': `http://127.0.0.1:${port}`,
          'X-Title': 'widgetva-vgplot-standalone',
        },
        body: JSON.stringify(payload),
      })
      const text = await upstream.text()
      res.statusCode = upstream.status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(text)
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'OpenRouter proxy request failed.',
      })
    }
  })
}

async function handleStatic(req, res) {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
  let requestPath = decodeURIComponent(url.pathname)
  if (requestPath === '/') {
    requestPath = '/widgetva-kit/examples/vgplot-standalone/'
  }
  const candidatePath = requestPath.endsWith('/')
    ? path.join(repoRoot, requestPath, 'index.html')
    : path.join(repoRoot, requestPath)

  if (!isPathInside(repoRoot, candidatePath)) {
    sendJson(res, 403, { error: 'Forbidden path.' })
    return
  }

  try {
    const fileStats = await stat(candidatePath)
    if (!fileStats.isFile()) {
      sendJson(res, 404, { error: 'File not found.' })
      return
    }
    const contents = await readFile(candidatePath)
    const contentType = mimeTypes.get(path.extname(candidatePath)) || 'application/octet-stream'
    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    res.end(contents)
  } catch {
    sendJson(res, 404, { error: 'File not found.' })
  }
}

const server = http.createServer(async (req, res) => {
  if ((req.url || '').startsWith('/api/openrouter/chat')) {
    await handleOpenRouterProxy(req, res)
    return
  }
  await handleStatic(req, res)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`WidgetVA vgplot standalone server running at http://127.0.0.1:${port}/widgetva-kit/examples/vgplot-standalone/`)
})
