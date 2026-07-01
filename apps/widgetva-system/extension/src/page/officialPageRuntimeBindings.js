import {
  canContinueOfficialPageRequest,
  readManagedController,
  runOfficialPageWithManager,
} from './officialPageRuntimeManager.js'

function resolveOfficialPagePort(root, controller, pagePort) {
  return root?.__widgetVA || controller?.pagePort || pagePort || null
}

export function bindOfficialPageAgentRuntime({
  entry,
  root,
  pagePort,
  controller,
  createRunAgentLoop,
  createRunNaturalLanguageAgentTurn,
  createRunNaturalLanguageAgentLoop,
  configureAgent,
  readAgentConfig,
  extraBindings,
} = {}) {
  const activeController = readManagedController(entry) || controller || null
  const resolvedPagePort = resolveOfficialPagePort(root, activeController, pagePort)

  entry.controller = activeController
  entry.pagePort = resolvedPagePort

  entry.runAgentLoop = async (options = {}) => {
    if (!canContinueOfficialPageRequest(entry)) {
      throw new Error('WidgetVA official page runtime is not ready.')
    }

    return runOfficialPageWithManager(entry, (currentController) => {
      const runner = createRunAgentLoop?.(currentController)
      if (typeof runner !== 'function') {
        throw new Error('WidgetVA official page agent loop is unavailable.')
      }
      return runner(options)
    })
  }

  entry.runNaturalLanguageAgentTurn = async (options = {}) => {
    if (!canContinueOfficialPageRequest(entry)) {
      throw new Error('WidgetVA official page runtime is not ready.')
    }

    return runOfficialPageWithManager(entry, (currentController) => {
      const runner = createRunNaturalLanguageAgentTurn?.(
        resolveOfficialPagePort(root, currentController, pagePort),
      )
      if (typeof runner !== 'function') {
        throw new Error('WidgetVA official page natural language turn runner is unavailable.')
      }
      return runner(options)
    })
  }

  entry.runNaturalLanguageAgentLoop = async (options = {}) => {
    if (!canContinueOfficialPageRequest(entry)) {
      throw new Error('WidgetVA official page runtime is not ready.')
    }

    return runOfficialPageWithManager(entry, (currentController) => {
      const runner = createRunNaturalLanguageAgentLoop?.(
        resolveOfficialPagePort(root, currentController, pagePort),
      )
      if (typeof runner !== 'function') {
        throw new Error('WidgetVA official page natural language loop runner is unavailable.')
      }
      return runner(options)
    })
  }

  entry.configureAgent = configureAgent || null
  entry.readAgentConfig = readAgentConfig || null

  root.__widgetVAOfficialPageRunAgentLoop = entry.runAgentLoop
  root.__widgetVAOfficialPageRunNaturalLanguageAgentTurn = entry.runNaturalLanguageAgentTurn
  root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop = entry.runNaturalLanguageAgentLoop
  root.__widgetVAOfficialPageConfigureAgent = entry.configureAgent
  root.__widgetVAOfficialPageReadAgentConfig = entry.readAgentConfig

  if (typeof extraBindings === 'function') {
    extraBindings(activeController)
  }
}

export function clearOfficialPageAgentRuntime({
  entry,
  root,
  clearWidgetVA = false,
  clearExtraBindings,
} = {}) {
  entry.controller = null
  entry.pagePort = null
  entry.runAgentLoop = null
  entry.runNaturalLanguageAgentTurn = null
  entry.runNaturalLanguageAgentLoop = null
  entry.configureAgent = null
  entry.readAgentConfig = null
  entry.promise = null

  root.__widgetVAOfficialPageRunAgentLoop = undefined
  root.__widgetVAOfficialPageRunNaturalLanguageAgentTurn = undefined
  root.__widgetVAOfficialPageRunNaturalLanguageAgentLoop = undefined
  root.__widgetVAOfficialPageConfigureAgent = undefined
  root.__widgetVAOfficialPageReadAgentConfig = undefined

  if (typeof clearExtraBindings === 'function') {
    clearExtraBindings()
  }

  if (clearWidgetVA && root?.__widgetVA) {
    try {
      delete root.__widgetVA
    } catch {
      root.__widgetVA = undefined
    }
  }
}
