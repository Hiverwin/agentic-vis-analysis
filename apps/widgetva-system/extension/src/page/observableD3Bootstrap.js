export const OBSERVABLE_D3_BOOTSTRAP_KEY = '__widgetVAOfficialPageBootstrap'
export const OBSERVABLE_D3_BOOTSTRAP_ENTRY = 'observableD3'

import {
  DEFAULT_OPENROUTER_AGENT_MODEL,
  runNaturalLanguagePagePortAgentLoop,
} from '../../../../../widgetva-kit/src/pageIntegrations.js'

import {
  completeOfficialPageAgentChat,
  configureOfficialPageAgent,
  readOfficialPageAgentConfig,
} from './officialPageAgentClient.js'

function readOfficialPageChatTimeout(normalized) {
  if (!normalized || typeof normalized !== 'object') {
    return undefined
  }

  return normalized.chatTimeoutMs ?? normalized.timeoutMs
}

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
      runAgentLoop: null,
      runNaturalLanguageAgentLoop: null,
      configureAgent: null,
      readAgentConfig: null,
      error: null,
      pageUrl: null,
      startedAt: null,
      completedAt: null,
      promise: null,
    }
  }

  return state[OBSERVABLE_D3_BOOTSTRAP_ENTRY]
}

function disposeController(entry) {
  try {
    entry?.controller?.dispose?.()
  } catch {}
}

function clearEntryRuntime(entry, root) {
  disposeController(entry)
  entry.workerFrame = null
  entry.surface = null
  entry.controller = null
  entry.pagePort = null
  entry.runAgentLoop = null
  entry.runNaturalLanguageAgentLoop = null
  entry.configureAgent = null
  entry.readAgentConfig = null
  entry.promise = null
  root.__widgetVAOfficialPageRunAgentLoop = undefined
  root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop = undefined
  root.__widgetVAOfficialPageConfigureAgent = undefined
  root.__widgetVAOfficialPageReadAgentConfig = undefined
  if (root?.__widgetVA) {
    try {
      delete root.__widgetVA
    } catch {
      root.__widgetVA = undefined
    }
  }
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
    if (entry.pageUrl && entry.pageUrl !== pageUrl) {
      clearEntryRuntime(entry, root)
    }
    entry.status = 'unsupported'
    entry.error = null
    entry.pageUrl = pageUrl
    entry.promise = null
    return entry
  }

  if (entry.pageUrl && entry.pageUrl !== pageUrl) {
    clearEntryRuntime(entry, root)
    entry.status = 'idle'
    entry.error = null
  }

  if (entry.status === 'ready') {
    entry.pageUrl = pageUrl
    entry.pagePort = root.__widgetVA || entry.controller?.pagePort || null
    entry.runAgentLoop = (options = {}) => entry.controller?.runAgentLoop?.(options)
    entry.runNaturalLanguageAgentLoop = async (options = {}) => {
      const normalized = typeof options === 'string' ? { objective: options } : { ...(options || {}) }
      return runNaturalLanguagePagePortAgentLoop(root.__widgetVA, {
        objective: normalized.objective || normalized.prompt || null,
        model: normalized.model || DEFAULT_OPENROUTER_AGENT_MODEL,
        temperature: normalized.temperature,
        completeChat: (request) =>
          completeOfficialPageAgentChat(root, {
            ...request,
            timeoutMs: readOfficialPageChatTimeout(normalized),
          }),
      })
    }
    entry.configureAgent = (options = {}) => configureOfficialPageAgent(root, options)
    entry.readAgentConfig = () => readOfficialPageAgentConfig(root)
    root.__widgetVAOfficialPageRunAgentLoop = entry.runAgentLoop
    root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop = entry.runNaturalLanguageAgentLoop
    root.__widgetVAOfficialPageConfigureAgent = entry.configureAgent
    root.__widgetVAOfficialPageReadAgentConfig = entry.readAgentConfig
    return entry
  }

  if (entry.promise) {
    return entry.promise
  }

  entry.status = 'booting'
  entry.error = null
  entry.pageUrl = pageUrl
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
      entry.runAgentLoop = (options = {}) => entry.controller?.runAgentLoop?.(options)
      entry.runNaturalLanguageAgentLoop = async (options = {}) => {
        const normalized = typeof options === 'string' ? { objective: options } : { ...(options || {}) }
        return runNaturalLanguagePagePortAgentLoop(root.__widgetVA, {
          objective: normalized.objective || normalized.prompt || null,
          model: normalized.model || DEFAULT_OPENROUTER_AGENT_MODEL,
          temperature: normalized.temperature,
          completeChat: (request) =>
            completeOfficialPageAgentChat(root, {
              ...request,
              timeoutMs: readOfficialPageChatTimeout(normalized),
            }),
        })
      }
      entry.configureAgent = (options = {}) => configureOfficialPageAgent(root, options)
      entry.readAgentConfig = () => readOfficialPageAgentConfig(root)
      root.__widgetVAOfficialPageRunAgentLoop = entry.runAgentLoop
      root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop = entry.runNaturalLanguageAgentLoop
      root.__widgetVAOfficialPageConfigureAgent = entry.configureAgent
      root.__widgetVAOfficialPageReadAgentConfig = entry.readAgentConfig
      root.__widgetVAObservableD3Debug = () => entry.controller?.readDebugSnapshot?.()
      root.__widgetVAObservableD3PreviewBrush = () => entry.controller?.previewVisibleBrush?.()
      root.__widgetVAObservableD3Probe = () => entry.controller?.renderDebugProbe?.()
      entry.completedAt = Date.now()
      entry.promise = null
      return entry
    } catch (error) {
      entry.status = 'error'
      entry.error = summarizeError(error)
      entry.runAgentLoop = null
      entry.runNaturalLanguageAgentLoop = null
      entry.configureAgent = null
      entry.readAgentConfig = null
      root.__widgetVAOfficialPageRunAgentLoop = undefined
      root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop = undefined
      root.__widgetVAOfficialPageConfigureAgent = undefined
      root.__widgetVAOfficialPageReadAgentConfig = undefined
      entry.completedAt = Date.now()
      entry.promise = null
      throw error
    }
  })()

  return entry.promise
}
