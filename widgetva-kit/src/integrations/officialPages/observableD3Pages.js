function tryParseUrl(value) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function normalizeRoot(root) {
  if (!root || typeof root !== 'object') {
    throw new Error('A browser-like root object is required.')
  }
  return root
}

function readDocument(root) {
  return root?.document || null
}

function readIframes(root) {
  const doc = readDocument(root)
  if (!doc?.querySelectorAll) return []
  return [...doc.querySelectorAll('iframe')]
}

function readFrameRect(frame) {
  try {
    if (typeof frame?.getBoundingClientRect === 'function') {
      const rect = frame.getBoundingClientRect()
      return {
        width: Number(rect?.width) || 0,
        height: Number(rect?.height) || 0,
      }
    }
  } catch {}

  return {
    width: 0,
    height: 0,
  }
}

function computeFrameArea(frame) {
  const rect = readFrameRect(frame)
  return rect.width * rect.height
}

export function isObservableD3NotebookPage(pageUrl) {
  const parsedUrl = tryParseUrl(pageUrl)
  if (!parsedUrl) return false
  return (
    parsedUrl.hostname === 'observablehq.com'
    && parsedUrl.pathname.startsWith('/@d3/')
  )
}

export function isObservableWorkerFrameUrl(frameUrl) {
  const parsedUrl = tryParseUrl(frameUrl)
  if (!parsedUrl) return false
  return (
    parsedUrl.hostname.endsWith('.observableusercontent.com')
    && /\/worker-[^/]+\.html$/.test(parsedUrl.pathname)
  )
}

export function parseObservableNotebookIdentity(pageUrl) {
  const parsedUrl = tryParseUrl(pageUrl)
  if (!parsedUrl || parsedUrl.hostname !== 'observablehq.com') {
    return null
  }

  const segments = parsedUrl.pathname.split('/').filter(Boolean)
  if (segments.length < 2 || segments[0] !== '@d3') {
    return null
  }

  return {
    owner: segments[0],
    slug: segments[1],
    version: segments[2] || null,
    path: parsedUrl.pathname,
    url: parsedUrl.href,
  }
}

export function findObservableWorkerFrame(root = globalThis.window) {
  const normalizedRoot = normalizeRoot(root)
  const iframes = readIframes(normalizedRoot)
  const candidates = []

  for (const iframe of iframes) {
    const src = iframe?.getAttribute?.('src') || iframe?.src || null
    if (isObservableWorkerFrameUrl(src)) {
      candidates.push(iframe)
    }
  }

  if (candidates.length === 0) return null

  return candidates.reduce((best, frame) => {
    if (!best) return frame
    return computeFrameArea(frame) > computeFrameArea(best) ? frame : best
  }, null)
}

export async function waitForObservableWorkerFrame({
  root = globalThis.window,
  timeoutMs = 5000,
  pollMs = 25,
} = {}) {
  const normalizedRoot = normalizeRoot(root)
  const startedAt = Date.now()

  while ((Date.now() - startedAt) <= timeoutMs) {
    const frame = findObservableWorkerFrame(normalizedRoot)
    if (frame) return frame
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  throw new Error(`Timed out waiting for an Observable worker iframe after ${timeoutMs}ms.`)
}

export function describeObservableD3PageShape(root = globalThis.window) {
  const normalizedRoot = normalizeRoot(root)
  const pageUrl = normalizedRoot?.location?.href || null
  const notebook = parseObservableNotebookIdentity(pageUrl)
  const iframes = readIframes(normalizedRoot)
  const workerFrame = findObservableWorkerFrame(normalizedRoot)
  const bodyText = normalizedRoot?.document?.body?.innerText || ''

  return {
    provider: 'd3',
    source: 'observablehq',
    pageUrl,
    notebook,
    iframeCount: iframes.length,
    workerFrame: workerFrame
      ? {
          src: workerFrame.getAttribute?.('src') || workerFrame.src || null,
        }
      : null,
    bodyTextPreview: bodyText.slice(0, 400),
  }
}
