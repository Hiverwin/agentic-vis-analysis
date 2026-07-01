export const OBSERVABLE_D3_BOOTSTRAP_KEY = '__widgetVAOfficialPageBootstrap'
export const OBSERVABLE_D3_BOOTSTRAP_ENTRY = 'observableD3'

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

  ensureOfficialPageRuntimeManager(state[OBSERVABLE_D3_BOOTSTRAP_ENTRY])
  return state[OBSERVABLE_D3_BOOTSTRAP_ENTRY]
}

async function clearEntryRuntime(entry, root) {
  await clearOfficialPageBootstrapRuntime({
    entry,
    root,
    capturePreviousState: false,
    preserveRecoverableState: false,
    clearWidgetVA: true,
    resetEntry(currentEntry) {
      currentEntry.workerFrame = null
      currentEntry.surface = null
    },
    clearExtraBindings() {
      root.__widgetVAObservableD3Debug = undefined
      root.__widgetVAObservableD3PreviewBrush = undefined
      root.__widgetVAObservableD3Probe = undefined
    },
  })
}

function resetEntryBindingsForRebootstrap(entry, root) {
  resetOfficialPageBootstrapBindings({
    entry,
    root,
    clearWidgetVA: true,
    resetEntry(currentEntry) {
      currentEntry.workerFrame = null
      currentEntry.surface = null
    },
    clearExtraBindings() {
      root.__widgetVAObservableD3Debug = undefined
      root.__widgetVAObservableD3PreviewBrush = undefined
      root.__widgetVAObservableD3Probe = undefined
    },
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
    extraBindings(activeController) {
      root.__widgetVAObservableD3Debug = () => activeController?.readDebugSnapshot?.()
      root.__widgetVAObservableD3PreviewBrush = () => activeController?.previewVisibleBrush?.()
      root.__widgetVAObservableD3Probe = () => activeController?.renderDebugProbe?.()
    },
  })
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
      await clearEntryRuntime(entry, root)
    }
    entry.status = 'unsupported'
    entry.error = null
    entry.pageUrl = pageUrl
    entry.promise = null
    return entry
  }

  if (entry.pageUrl && entry.pageUrl !== pageUrl) {
    resetEntryBindingsForRebootstrap(entry, root)
    entry.status = 'idle'
    entry.error = null
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
      await attachOfficialPageController(entry, controller)

      entry.status = 'ready'
      entry.pageShape = pageShape
      entry.workerFrame = workerFrame
        ? {
            src: workerFrame.getAttribute?.('src') || workerFrame.src || null,
          }
        : null
      entry.surface = readManagedController(entry)?.surface || controller?.surface || null
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
        resetEntry(currentEntry) {
          currentEntry.workerFrame = null
          currentEntry.surface = null
        },
        clearExtraBindings() {
          root.__widgetVAObservableD3Debug = undefined
          root.__widgetVAObservableD3PreviewBrush = undefined
          root.__widgetVAObservableD3Probe = undefined
        },
      })
      entry.completedAt = Date.now()
      entry.promise = null
      throw error
    }
  })()

  return entry.promise
}
