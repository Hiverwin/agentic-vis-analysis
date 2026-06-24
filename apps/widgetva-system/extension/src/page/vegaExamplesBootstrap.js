export const VEGA_EXAMPLES_BOOTSTRAP_KEY = '__widgetVAOfficialPageBootstrap'
export const VEGA_EXAMPLES_BOOTSTRAP_ENTRY = 'vegaLiteExamples'

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
    message: String(error || 'Unknown WidgetVA Vega examples bootstrap error.'),
  }
}

function readExampleSlug(root) {
  const pathname = root?.location?.pathname || ''
  const lastSegment = pathname.split('/').filter(Boolean).pop() || 'example'
  return lastSegment.endsWith('.html') ? lastSegment.slice(0, -5) : lastSegment
}

function ensureBootstrapState(root) {
  if (!root[VEGA_EXAMPLES_BOOTSTRAP_KEY] || typeof root[VEGA_EXAMPLES_BOOTSTRAP_KEY] !== 'object') {
    root[VEGA_EXAMPLES_BOOTSTRAP_KEY] = {}
  }

  const state = root[VEGA_EXAMPLES_BOOTSTRAP_KEY]
  if (!state[VEGA_EXAMPLES_BOOTSTRAP_ENTRY] || typeof state[VEGA_EXAMPLES_BOOTSTRAP_ENTRY] !== 'object') {
    state[VEGA_EXAMPLES_BOOTSTRAP_ENTRY] = {
      provider: 'vega-lite',
      pageType: 'official-example',
      status: 'idle',
      controller: null,
      pagePort: null,
      runAgentLoop: null,
      runNaturalLanguageAgentLoop: null,
      configureAgent: null,
      readAgentConfig: null,
      error: null,
      startedAt: null,
      completedAt: null,
      promise: null,
    }
  }

  return state[VEGA_EXAMPLES_BOOTSTRAP_ENTRY]
}

export function createOfficialVegaExamplesSessionId(root = globalThis.window) {
  return `official-vega-lite-${readExampleSlug(root)}`
}

export async function ensureVegaExamplesPageBootstrap({
  root = globalThis.window,
  isSupportedPage,
  installCapture,
  bootstrapPage,
  createSessionId = createOfficialVegaExamplesSessionId,
  timeoutMs = 5000,
} = {}) {
  if (!root || typeof root !== 'object') {
    throw new Error('ensureVegaExamplesPageBootstrap requires a page-like root object.')
  }
  if (typeof isSupportedPage !== 'function') {
    throw new Error('ensureVegaExamplesPageBootstrap requires isSupportedPage().')
  }
  if (typeof bootstrapPage !== 'function') {
    throw new Error('ensureVegaExamplesPageBootstrap requires bootstrapPage().')
  }

  const entry = ensureBootstrapState(root)
  const pageUrl = root?.location?.href || ''

  if (!isSupportedPage(pageUrl)) {
    entry.status = 'unsupported'
    entry.error = null
    entry.runAgentLoop = null
    entry.runNaturalLanguageAgentLoop = null
    entry.configureAgent = null
    entry.readAgentConfig = null
    root.__widgetVAOfficialPageRunAgentLoop = undefined
    root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop = undefined
    root.__widgetVAOfficialPageConfigureAgent = undefined
    root.__widgetVAOfficialPageReadAgentConfig = undefined
    entry.promise = null
    return entry
  }

  if (typeof installCapture === 'function') {
    installCapture(root)
  }

  if (entry.status === 'ready' && entry.controller) {
    entry.pagePort = root.__widgetVA || entry.controller.pagePort || null
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
  entry.startedAt = Date.now()
  entry.completedAt = null

  entry.promise = (async () => {
    try {
      const controller = await bootstrapPage({
        root,
        sessionId: createSessionId(root),
        enableExtensionBridge: true,
        timeoutMs,
      })
      entry.status = 'ready'
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
