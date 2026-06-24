export const OBSERVABLE_D3_BOOTSTRAP_KEY = '__widgetVAOfficialPageBootstrap'
export const OBSERVABLE_D3_BOOTSTRAP_ENTRY = 'observableD3'

function summarizeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    }
  }

  return {
    name: 'Error',
    message: String(error || 'Unknown WidgetVA Observable D3 bootstrap error.'),
  }
}

function ensureBootstrapState(root) {
  if (!root[OBSERVABLE_D3_BOOTSTRAP_KEY] || typeof root[OBSERVABLE_D3_BOOTSTRAP_KEY] !== 'object') {
    root[OBSERVABLE_D3_BOOTSTRAP_KEY] = {}
  }

  const state = root[OBSERVABLE_D3_BOOTSTRAP_KEY]
  if (!state[OBSERVABLE_D3_BOOTSTRAP_ENTRY] || typeof state[OBSERVABLE_D3_BOOTSTRAP_ENTRY] !== 'object') {
    state[OBSERVABLE_D3_BOOTSTRAP_ENTRY] = {
      provider: 'd3',
      pageType: 'official-observable-notebook',
      status: 'idle',
      pageShape: null,
      workerFrame: null,
      surface: null,
      controller: null,
      pagePort: null,
      error: null,
      startedAt: null,
      completedAt: null,
      promise: null,
    }
  }

  return state[OBSERVABLE_D3_BOOTSTRAP_ENTRY]
}

export async function ensureObservableD3PageBootstrap({
  root = globalThis.window,
  isSupportedPage,
  describePage,
  waitForWorkerFrame,
  bootstrapPage,
  timeoutMs = 15000,
} = {}) {
  if (!root || typeof root !== 'object') {
    throw new Error('ensureObservableD3PageBootstrap requires a page-like root object.')
  }
  if (typeof isSupportedPage !== 'function') {
    throw new Error('ensureObservableD3PageBootstrap requires isSupportedPage().')
  }
  if (typeof describePage !== 'function') {
    throw new Error('ensureObservableD3PageBootstrap requires describePage().')
  }
  if (typeof waitForWorkerFrame !== 'function') {
    throw new Error('ensureObservableD3PageBootstrap requires waitForWorkerFrame().')
  }
  if (typeof bootstrapPage !== 'function') {
    throw new Error('ensureObservableD3PageBootstrap requires bootstrapPage().')
  }

  const entry = ensureBootstrapState(root)
  const pageUrl = root?.location?.href || ''

  if (!isSupportedPage(pageUrl)) {
    entry.status = 'unsupported'
    entry.error = null
    entry.promise = null
    return entry
  }

  if (entry.status === 'ready') {
    entry.pagePort = root.__widgetVA || entry.controller?.pagePort || null
    return entry
  }

  if (entry.promise) {
    return entry.promise
  }

  entry.status = 'booting'
  entry.error = null
  entry.startedAt = Date.now()
  entry.completedAt = null

  entry.promise = (async () => {
    try {
      const pageShape = describePage(root)
      const workerFrame = await waitForWorkerFrame({
        root,
        timeoutMs,
      })
      const controller = await bootstrapPage({
        root,
        sessionId: `official-observable-d3-${pageShape?.notebook?.slug || 'page'}`,
        enableExtensionBridge: true,
        timeoutMs,
      })

      entry.status = 'ready'
      entry.pageShape = pageShape
      entry.workerFrame = workerFrame
        ? {
            src: workerFrame.getAttribute?.('src') || workerFrame.src || null,
          }
        : null
      entry.surface = controller?.surface || null
      entry.controller = controller
      entry.pagePort = root.__widgetVA || controller?.pagePort || null
      root.__widgetVAObservableD3Debug = () => controller?.readDebugSnapshot?.()
      root.__widgetVAObservableD3PreviewBrush = () => controller?.previewVisibleBrush?.()
      root.__widgetVAObservableD3Probe = () => controller?.renderDebugProbe?.()
      entry.completedAt = Date.now()
      entry.promise = null
      return entry
    } catch (error) {
      entry.status = 'error'
      entry.error = summarizeError(error)
      entry.completedAt = Date.now()
      entry.promise = null
      throw error
    }
  })()

  return entry.promise
}
