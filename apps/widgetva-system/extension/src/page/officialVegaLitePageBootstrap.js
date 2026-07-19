export const OFFICIAL_PAGE_BOOTSTRAP_KEY = '__widgetVAOfficialPageBootstrap'
export const OFFICIAL_VEGA_LITE_PAGE_BOOTSTRAP_ENTRY = 'officialVegaLitePage'

import {
  createOfficialPageManagedRequestRunner,
  createOfficialPageNaturalLanguageLoopRunner,
  createOfficialPageNaturalLanguageTurnRunner,
} from './officialPageAgentRunners.js'
import {
  configureOfficialPageAgent,
  readOfficialPageAgentConfig,
} from './officialPageAgentClient.js'
import {
  attachOfficialPageController,
  createManagedPagePort,
  ensureOfficialPageRuntimeManager,
  readManagedController,
  summarizeManagedRuntimeError,
} from './officialPageRuntimeManager.js'
import {
  bindOfficialVegaLitePageAgentRuntime,
} from './officialVegaLitePageBindings.js'
import {
  clearOfficialVegaLitePageBootstrapRuntime,
  resetOfficialVegaLitePageBootstrapBindings,
} from './officialVegaLitePageLifecycle.js'

function readPageSlug(root) {
  const pathname = root?.location?.pathname || ''
  const lastSegment = pathname.split('/').filter(Boolean).pop() || 'page'
  return lastSegment.endsWith('.html') ? lastSegment.slice(0, -5) : lastSegment
}

function ensureBootstrapState(root) {
  if (!root[OFFICIAL_PAGE_BOOTSTRAP_KEY] || typeof root[OFFICIAL_PAGE_BOOTSTRAP_KEY] !== 'object') {
    root[OFFICIAL_PAGE_BOOTSTRAP_KEY] = {}
  }

  const state = root[OFFICIAL_PAGE_BOOTSTRAP_KEY]
  if (!state[OFFICIAL_VEGA_LITE_PAGE_BOOTSTRAP_ENTRY] || typeof state[OFFICIAL_VEGA_LITE_PAGE_BOOTSTRAP_ENTRY] !== 'object') {
    state[OFFICIAL_VEGA_LITE_PAGE_BOOTSTRAP_ENTRY] = {
      provider: 'vega-lite',
      pageType: 'official-vega-lite-page',
      status: 'idle',
      controller: null,
      pagePort: null,
      request: null,
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
      bootstrapConfig: null,
    }
  }

  ensureOfficialPageRuntimeManager(state[OFFICIAL_VEGA_LITE_PAGE_BOOTSTRAP_ENTRY])
  return state[OFFICIAL_VEGA_LITE_PAGE_BOOTSTRAP_ENTRY]
}

async function clearManagedEntryRuntime(entry, root, {
  capturePreviousState = false,
  preserveRecoverableState = false,
} = {}) {
  await clearOfficialVegaLitePageBootstrapRuntime({
    entry,
    root,
    capturePreviousState,
    preserveRecoverableState,
    clearWidgetVA: true,
  })
}

function resetEntryBindingsForRebootstrap(entry, root) {
  resetOfficialVegaLitePageBootstrapBindings({
    entry,
    root,
    clearWidgetVA: true,
  })
}

function bindReadyEntry(root, entry, controller) {
  const runTurn = createOfficialPageNaturalLanguageTurnRunner(root)
  const runLoop = createOfficialPageNaturalLanguageLoopRunner(root)
  const pagePort = createManagedPagePort(entry)
  const rebootstrap = ({ forceReattach = false } = {}) =>
    ensureOfficialVegaLitePageBootstrap({
      ...(entry.bootstrapConfig || {}),
      ...(forceReattach ? { forceReattach: true } : {}),
    })
  const request = createOfficialPageManagedRequestRunner({
    entry,
    root,
    pagePort,
    runAgentLoop: (currentController, options = {}) => currentController.runAgentLoop(options),
    runNaturalLanguageTurn: runTurn,
    runNaturalLanguageLoop: runLoop,
    rebootstrap,
    configureAgent: configureOfficialPageAgent,
    readAgentConfig: readOfficialPageAgentConfig,
  })

  bindOfficialVegaLitePageAgentRuntime({
    entry,
    root,
    controller,
    request,
    runAgentLoop: (options = {}) => request({ mode: 'runAgentLoop', options }),
    runNaturalLanguageAgentTurn: (options = {}) => request(
      typeof options === 'string'
        ? { mode: 'runNaturalLanguageTurn', options }
        : { mode: 'runNaturalLanguageTurn', options: options || {} },
    ),
    runNaturalLanguageAgentLoop: (options = {}) => request(
      typeof options === 'string'
        ? { mode: 'runNaturalLanguageLoop', options }
        : { mode: 'runNaturalLanguageLoop', options: options || {} },
    ),
    configureAgent: (options = {}) => request({ mode: 'configureAgent', options: options || {} }),
    readAgentConfig: () => request({ mode: 'readAgentConfig' }),
  })
}

export function createOfficialVegaLitePageSessionId(root = globalThis.window) {
  return `official-vega-lite-${readPageSlug(root)}`
}

export async function ensureOfficialVegaLitePageBootstrap({
  root = globalThis.window,
  isSupportedPage,
  installCapture,
  bootstrapPage,
  createSessionId = createOfficialVegaLitePageSessionId,
  timeoutMs = 5000,
  pollMs = 25,
  forceReattach = false,
} = {}) {
  if (!root || typeof root !== 'object') {
    throw new Error('ensureOfficialVegaLitePageBootstrap requires a page-like root object.')
  }
  if (typeof isSupportedPage !== 'function') {
    throw new Error('ensureOfficialVegaLitePageBootstrap requires isSupportedPage().')
  }
  if (typeof bootstrapPage !== 'function') {
    throw new Error('ensureOfficialVegaLitePageBootstrap requires bootstrapPage().')
  }

  const entry = ensureBootstrapState(root)
  const pageUrl = root?.location?.href || ''
  entry.bootstrapConfig = {
    root,
    isSupportedPage,
    installCapture,
    bootstrapPage,
    createSessionId,
    timeoutMs,
    pollMs,
  }

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

  if (forceReattach && readManagedController(entry)) {
    await clearManagedEntryRuntime(entry, root, {
      capturePreviousState: true,
      preserveRecoverableState: true,
    })
    entry.status = 'idle'
    entry.error = null
  }

  const activeController = readManagedController(entry)

  if (entry.status === 'ready' && activeController) {
    entry.pageUrl = pageUrl
    bindReadyEntry(root, entry, activeController)
    return entry
  }

  if (typeof installCapture === 'function') {
    installCapture(root)
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
        pollMs,
        forceReattach,
      })
      await attachOfficialPageController(entry, controller, {
        binding: root.__widgetVA || controller?.pagePort || null,
        metadata: {
          provider: 'vega-lite',
          pageType: 'official-vega-lite-page',
          pageUrl,
        },
      })
      entry.status = 'ready'
      bindReadyEntry(root, entry, readManagedController(entry))
      entry.completedAt = Date.now()
      entry.promise = null
      return entry
    } catch (error) {
      entry.status = 'error'
      entry.error = summarizeManagedRuntimeError(error)
      await clearOfficialVegaLitePageBootstrapRuntime({
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
