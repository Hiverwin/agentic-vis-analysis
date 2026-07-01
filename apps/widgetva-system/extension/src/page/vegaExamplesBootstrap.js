export const VEGA_EXAMPLES_BOOTSTRAP_KEY = '__widgetVAOfficialPageBootstrap'
export const VEGA_EXAMPLES_BOOTSTRAP_ENTRY = 'vegaLiteExamples'

import {
  createOfficialPageNaturalLanguageLoopRunner,
  createOfficialPageNaturalLanguageTurnRunner,
} from './officialPageAgentRunners.js'
import {
  configureOfficialPageAgent,
  readOfficialPageAgentConfig,
} from './officialPageAgentClient.js'
import {
  attachOfficialPageController,
  ensureOfficialPageRuntimeManager,
  readManagedController,
  summarizeManagedRuntimeError,
} from './officialPageRuntimeManager.js'
import {
  bindOfficialPageAgentRuntime,
} from './officialPageRuntimeBindings.js'
import {
  clearOfficialPageBootstrapRuntime,
  resetOfficialPageBootstrapBindings,
} from './officialPageBootstrapLifecycle.js'

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
      runNaturalLanguageAgentTurn: null,
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

  ensureOfficialPageRuntimeManager(state[VEGA_EXAMPLES_BOOTSTRAP_ENTRY])
  return state[VEGA_EXAMPLES_BOOTSTRAP_ENTRY]
}

async function clearManagedEntryRuntime(entry, root) {
  await clearOfficialPageBootstrapRuntime({
    entry,
    root,
    capturePreviousState: false,
    preserveRecoverableState: false,
    clearWidgetVA: true,
  })
}

function resetEntryBindingsForRebootstrap(entry, root) {
  resetOfficialPageBootstrapBindings({
    entry,
    root,
    clearWidgetVA: true,
  })
}

function bindReadyEntry(root, entry, controller) {
  const pagePort = root.__widgetVA || controller?.pagePort || null
  const runTurn = createOfficialPageNaturalLanguageTurnRunner(root)
  const runLoop = createOfficialPageNaturalLanguageLoopRunner(root)

  bindOfficialPageAgentRuntime({
    entry,
    root,
    pagePort,
    controller,
    createRunAgentLoop: (currentController) => (options = {}) => currentController?.runAgentLoop?.(options),
    createRunNaturalLanguageAgentTurn: (currentPagePort) => (options = {}) => runTurn(currentPagePort, options),
    createRunNaturalLanguageAgentLoop: (currentPagePort) => (options = {}) => runLoop(currentPagePort, options),
    configureAgent: (options = {}) => configureOfficialPageAgent(root, options),
    readAgentConfig: () => readOfficialPageAgentConfig(root),
  })
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
    await clearManagedEntryRuntime(entry, root)
    entry.status = 'unsupported'
    entry.error = null
    entry.pageUrl = pageUrl
    return entry
  }

  if (entry.pageUrl && entry.pageUrl !== pageUrl) {
    resetEntryBindingsForRebootstrap(entry, root)
    entry.status = 'idle'
    entry.error = null
  }

  if (typeof installCapture === 'function') {
    installCapture(root)
  }

  const activeController = readManagedController(entry)

  if (entry.status === 'ready' && activeController) {
    entry.pageUrl = pageUrl
    bindReadyEntry(root, entry, activeController)
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
      const controller = await bootstrapPage({
        root,
        sessionId: createSessionId(root),
        enableExtensionBridge: true,
        timeoutMs,
      })
      await attachOfficialPageController(entry, controller)
      entry.status = 'ready'
      bindReadyEntry(root, entry, readManagedController(entry))
      entry.completedAt = Date.now()
      entry.promise = null
      return entry
    } catch (error) {
      entry.status = 'error'
      entry.error = summarizeManagedRuntimeError(error)
      await clearOfficialPageBootstrapRuntime({
        entry,
        root,
        capturePreviousState: false,
        preserveRecoverableState: false,
        clearWidgetVA: true,
      })
      entry.completedAt = Date.now()
      entry.promise = null
      throw error
    }
  })()

  return entry.promise
}
