import {
  readManagedController,
  readManagedRuntime,
} from './officialPageRuntimeManager.js'

function readControllerWorkspace(controller = null) {
  if (typeof controller?.describeAgentContract === 'function') {
    const contract = controller.describeAgentContract()
    if (contract?.workspace && typeof contract.workspace === 'object') {
      return contract.workspace
    }
    if (contract?.widget && typeof contract.widget === 'object') {
      return {
        widgets: [contract.widget],
      }
    }
  }
  return null
}

async function readControllerWorkspaceAsync(controller = null) {
  const syncWorkspace = readControllerWorkspace(controller)
  if (syncWorkspace) return syncWorkspace

  if (typeof controller?.pagePort?.describeWorkspace === 'function') {
    return controller.pagePort.describeWorkspace()
  }

  return null
}

function readControllerPrimaryWidget(controller = null) {
  const workspace = readControllerWorkspace(controller)
  if (Array.isArray(workspace?.widgets) && workspace.widgets.length > 0) {
    return workspace.widgets[0] || null
  }
  return null
}

async function readControllerPrimaryWidgetAsync(controller = null) {
  const syncWidget = readControllerPrimaryWidget(controller)
  if (syncWidget) return syncWidget

  const workspace = await readControllerWorkspaceAsync(controller)
  if (Array.isArray(workspace?.widgets) && workspace.widgets.length > 0) {
    return workspace.widgets[0] || null
  }
  return null
}

async function readOfficialPageObservation(controller = null) {
  if (typeof controller?.pagePort?.readObservation === 'function') {
    return controller.pagePort.readObservation()
  }
  if (typeof controller?.widget?.readObservation === 'function') {
    return controller.widget.readObservation()
  }
  return null
}

function extractSharedSelectionsFromObservation(observation = null) {
  return (
    observation?.sharedAnalyticalState?.selections
    || observation?.sharedAnalyticalState?.activeSelections
    || observation?.state?.shared?.activeSelections
    || observation?.state?.sharedAnalyticalState?.selections
    || null
  )
}

async function resolveOfficialPageActionScope(controller = null, explicitQueryScope = null) {
  const normalizedQueryScope = explicitQueryScope && typeof explicitQueryScope === 'object' && !Array.isArray(explicitQueryScope)
    ? { ...explicitQueryScope }
    : {}
  if (!normalizedQueryScope.widgetRef && !normalizedQueryScope.widget_ref) {
    const widget = await readControllerPrimaryWidgetAsync(controller)
    if (widget?.ref) {
      normalizedQueryScope.widgetRef = widget.ref
    }
  }
  return normalizedQueryScope
}

function normalizeOfficialPageActionCall(actionNameOrCall = null, params = null, options = {}) {
  if (actionNameOrCall && typeof actionNameOrCall === 'object' && !Array.isArray(actionNameOrCall)) {
    return { ...actionNameOrCall }
  }

  if (typeof actionNameOrCall !== 'string' || actionNameOrCall.length === 0) {
    throw new Error('WidgetVA official page action helpers require an action name or action-call object.')
  }

  const normalized = {
    name: actionNameOrCall,
  }

  if (params && typeof params === 'object' && !Array.isArray(params)) {
    normalized.params = { ...params }
  }

  if (options?.callId) normalized.callId = options.callId
  if (options?.actor) normalized.actor = options.actor
  if (options?.queryScope && typeof options.queryScope === 'object' && !Array.isArray(options.queryScope)) {
    normalized.queryScope = { ...options.queryScope }
  }

  return normalized
}

function normalizeOfficialPageObjectiveCall(objectiveOrOptions = null, options = {}) {
  if (objectiveOrOptions && typeof objectiveOrOptions === 'object' && !Array.isArray(objectiveOrOptions)) {
    return { ...objectiveOrOptions }
  }

  if (typeof objectiveOrOptions !== 'string' || objectiveOrOptions.length === 0) {
    throw new Error('WidgetVA official page natural-language helpers require an objective string or options object.')
  }

  return {
    objective: objectiveOrOptions,
    ...(options && typeof options === 'object' && !Array.isArray(options) ? { ...options } : {}),
  }
}

function normalizeOfficialPageQueryCall(queryNameOrCall = null, params = null, options = {}) {
  if (queryNameOrCall && typeof queryNameOrCall === 'object' && !Array.isArray(queryNameOrCall)) {
    return { ...queryNameOrCall }
  }

  if (typeof queryNameOrCall !== 'string' || queryNameOrCall.length === 0) {
    throw new Error('WidgetVA official page query helpers require a query name or query-call object.')
  }

  const normalized = {
    name: queryNameOrCall,
  }

  if (params && typeof params === 'object' && !Array.isArray(params)) {
    normalized.params = { ...params }
  }

  if (options?.callId) normalized.callId = options.callId
  if (options?.actor) normalized.actor = options.actor
  if (options?.queryScope && typeof options.queryScope === 'object' && !Array.isArray(options.queryScope)) {
    normalized.queryScope = { ...options.queryScope }
  }

  return normalized
}

function buildPointParamCall({
  paramName,
  field,
  values,
  record,
  ...options
} = {}) {
  if (typeof paramName !== 'string' || paramName.length === 0) {
    throw new Error('WidgetVA official page point-param helper requires paramName.')
  }
  return normalizeOfficialPageActionCall('vegaLite.setPointParam', {
    paramName,
    ...(typeof field === 'string' && field.length > 0 ? { field } : {}),
    ...(Array.isArray(values) ? { values } : {}),
    ...(record && typeof record === 'object' && !Array.isArray(record) ? { record } : {}),
  }, options)
}

function buildIntervalParamCall({
  paramName,
  xField,
  xRange,
  yField,
  yRange,
  ...options
} = {}) {
  if (typeof paramName !== 'string' || paramName.length === 0) {
    throw new Error('WidgetVA official page interval-param helper requires paramName.')
  }
  return normalizeOfficialPageActionCall('vegaLite.setIntervalParam', {
    paramName,
    ...(typeof xField === 'string' && Array.isArray(xRange) ? { xField, xRange } : {}),
    ...(typeof yField === 'string' && Array.isArray(yRange) ? { yField, yRange } : {}),
  }, options)
}

function buildClearParamCall({
  paramName,
  ...options
} = {}) {
  if (typeof paramName !== 'string' || paramName.length === 0) {
    throw new Error('WidgetVA official page clear-param helper requires paramName.')
  }
  return normalizeOfficialPageActionCall('vegaLite.clearParam', {
    paramName,
  }, options)
}

const LEGACY_OFFICIAL_PAGE_GLOBAL_HELPERS = {
  readEntry: '__widgetVAOfficialPageReadEntry',
  readController: '__widgetVAOfficialPageReadController',
  readWorkspace: '__widgetVAOfficialPageReadWorkspace',
  readWidget: '__widgetVAOfficialPageReadWidget',
  readWidgetRef: '__widgetVAOfficialPageReadWidgetRef',
  readObservation: '__widgetVAOfficialPageReadObservation',
  readSelections: '__widgetVAOfficialPageReadSelections',
  executeAction: '__widgetVAOfficialPageExecuteAction',
  executeVerifiedAction: '__widgetVAOfficialPageExecuteVerifiedAction',
  queryPerception: '__widgetVAOfficialPageQueryPerception',
  runDataQuery: '__widgetVAOfficialPageRunDataQuery',
  readLatestCoordinationResult: '__widgetVAOfficialPageReadLatestCoordinationResult',
  runAction: '__widgetVAOfficialPageRunAction',
  runVerifiedAction: '__widgetVAOfficialPageRunVerifiedAction',
  runObjective: '__widgetVAOfficialPageRunObjective',
  runObjectiveLoop: '__widgetVAOfficialPageRunObjectiveLoop',
  setPointParam: '__widgetVAOfficialPageSetPointParam',
  setIntervalParam: '__widgetVAOfficialPageSetIntervalParam',
  clearParam: '__widgetVAOfficialPageClearParam',
  clearSelection: '__widgetVAOfficialPageClearSelection',
  inspectVisibleRows: '__widgetVAOfficialPageInspectVisibleRows',
  summarizeVisible: '__widgetVAOfficialPageSummarizeVisible',
  inspectSelection: '__widgetVAOfficialPageInspectSelection',
  summarizeSelection: '__widgetVAOfficialPageSummarizeSelection',
  request: '__widgetVAOfficialPageRequest',
  runAgentLoop: '__widgetVAOfficialPageRunAgentLoop',
  runNaturalLanguageAgentTurn: '__widgetVAOfficialPageRunNaturalLanguageAgentTurn',
  runNaturalLanguageAgentLoop: '__widgetVAOfficialPageRunNaturalLanguageAgentLoop',
  configureAgent: '__widgetVAOfficialPageConfigureAgent',
  readAgentConfig: '__widgetVAOfficialPageReadAgentConfig',
}

const LEGACY_OFFICIAL_PAGE_GLOBAL_METHODS = Object.fromEntries(
  Object.entries(LEGACY_OFFICIAL_PAGE_GLOBAL_HELPERS).map(([methodName, globalName]) => [globalName, methodName]),
)

function installOfficialPageHelperGlobals(root, stableBindings, names = []) {
  for (const globalName of names) {
    const methodName = LEGACY_OFFICIAL_PAGE_GLOBAL_METHODS[globalName]
    if (!methodName) continue
    root[globalName] = stableBindings[methodName]
  }
}

function clearOfficialPageHelperGlobals(root, names = []) {
  for (const globalName of names) {
    root[globalName] = undefined
  }
}

export function bindOfficialPageAgentRuntime({
  entry,
  root,
  controller,
  request,
  runAgentLoop,
  runNaturalLanguageAgentTurn,
  runNaturalLanguageAgentLoop,
  configureAgent,
  readAgentConfig,
  extraBindings,
  stableSurfaceName = null,
  exposeLegacyWindowEntry = true,
  exposeLegacyWindowController = true,
  exposeLegacyWindowHelpers = true,
} = {}) {
  const activeController = readManagedController(entry) || controller || null

  entry.controller = activeController
  entry.runtime = readManagedRuntime(entry) || activeController?.runtime || activeController?.widget?.runtime || null
  entry.pagePort = activeController?.pagePort || root?.__widgetVA || null
  entry.request = typeof request === 'function' ? request : null
  entry.runAgentLoop = typeof runAgentLoop === 'function' ? runAgentLoop : null
  entry.runNaturalLanguageAgentTurn = typeof runNaturalLanguageAgentTurn === 'function'
    ? runNaturalLanguageAgentTurn
    : null
  entry.runNaturalLanguageAgentLoop = typeof runNaturalLanguageAgentLoop === 'function'
    ? runNaturalLanguageAgentLoop
    : null

  entry.configureAgent = configureAgent || null
  entry.readAgentConfig = readAgentConfig || null
  const stableBindings = {
    readEntry: () => entry,
    readController: () => readManagedController(entry) || activeController || null,
    readWorkspace: async () => readControllerWorkspaceAsync(readManagedController(entry) || activeController || null),
    readWidget: async () => readControllerPrimaryWidgetAsync(readManagedController(entry) || activeController || null),
    readWidgetRef: async () => {
      const widget = await readControllerPrimaryWidgetAsync(readManagedController(entry) || activeController || null)
      return widget?.ref || null
    },
    readObservation: async () => readOfficialPageObservation(readManagedController(entry) || activeController || null),
    readSelections: async () => {
      const observation = await readOfficialPageObservation(readManagedController(entry) || activeController || null)
      return extractSharedSelectionsFromObservation(observation)
    },
    executeAction: async (call = {}) => {
      const currentController = readManagedController(entry) || activeController || null
      const pagePort = currentController?.pagePort || entry.pagePort || root.__widgetVA || null
      if (typeof pagePort?.executeAction !== 'function') {
        throw new Error('WidgetVA official page runtime does not expose executeAction().')
      }
      const queryScope = await resolveOfficialPageActionScope(currentController, call?.queryScope)
      return pagePort.executeAction({
        ...(call || {}),
        ...(Object.keys(queryScope).length > 0 ? { queryScope } : {}),
      })
    },
    executeVerifiedAction: async (call = {}) => {
      const currentController = readManagedController(entry) || activeController || null
      const pagePort = currentController?.pagePort || entry.pagePort || root.__widgetVA || null
      if (typeof pagePort?.executeVerifiedAction !== 'function') {
        throw new Error('WidgetVA official page runtime does not expose executeVerifiedAction().')
      }
      const queryScope = await resolveOfficialPageActionScope(currentController, call?.queryScope)
      return pagePort.executeVerifiedAction({
        ...(call || {}),
        ...(Object.keys(queryScope).length > 0 ? { queryScope } : {}),
      })
    },
    queryPerception: async (queryNameOrCall, params = null, options = {}) => {
      const currentController = readManagedController(entry) || activeController || null
      const pagePort = currentController?.pagePort || entry.pagePort || root.__widgetVA || null
      if (typeof pagePort?.queryPerception !== 'function') {
        throw new Error('WidgetVA official page runtime does not expose queryPerception().')
      }
      const call = normalizeOfficialPageQueryCall(queryNameOrCall, params, options)
      const queryScope = await resolveOfficialPageActionScope(currentController, call?.queryScope)
      return pagePort.queryPerception({
        ...call,
        ...(Object.keys(queryScope).length > 0 ? { queryScope } : {}),
      })
    },
    runDataQuery: async (queryNameOrCall, params = null, options = {}) => {
      const currentController = readManagedController(entry) || activeController || null
      const pagePort = currentController?.pagePort || entry.pagePort || root.__widgetVA || null
      if (typeof pagePort?.runDataQuery !== 'function') {
        throw new Error('WidgetVA official page runtime does not expose runDataQuery().')
      }
      const call = normalizeOfficialPageQueryCall(queryNameOrCall, params, options)
      const queryScope = await resolveOfficialPageActionScope(currentController, call?.queryScope)
      return pagePort.runDataQuery({
        ...call,
        ...(Object.keys(queryScope).length > 0 ? { queryScope } : {}),
      })
    },
    readLatestCoordinationResult: async () => {
      const currentController = readManagedController(entry) || activeController || null
      const pagePort = currentController?.pagePort || entry.pagePort || root.__widgetVA || null
      if (typeof pagePort?.readLatestCoordinationResult !== 'function') {
        throw new Error('WidgetVA official page runtime does not expose readLatestCoordinationResult().')
      }
      return pagePort.readLatestCoordinationResult()
    },
  }
  stableBindings.restoreRecoverableState = async (state = {}) => {
    const currentController = readManagedController(entry) || activeController || null
    if (typeof currentController?.restoreRecoverableState === 'function') {
      return currentController.restoreRecoverableState(state)
    }
    const pagePort = currentController?.pagePort || entry.pagePort || root.__widgetVA || null
    if (typeof pagePort?.jumpToState === 'function') {
      return pagePort.jumpToState({ stateId: state?.stateId })
    }
    throw new Error('WidgetVA official page runtime does not expose restoreRecoverableState().')
  }
  stableBindings.jumpToState = async (options = {}) => stableBindings.restoreRecoverableState(options)
  stableBindings.runAction = async (actionNameOrCall, params = null, options = {}) => {
    const call = normalizeOfficialPageActionCall(actionNameOrCall, params, options)
    return stableBindings.executeAction(call)
  }
  stableBindings.runVerifiedAction = async (actionNameOrCall, params = null, options = {}) => {
    const call = normalizeOfficialPageActionCall(actionNameOrCall, params, options)
    return stableBindings.executeVerifiedAction(call)
  }
  stableBindings.runObjective = async (objectiveOrOptions, options = {}) => {
    const normalized = normalizeOfficialPageObjectiveCall(objectiveOrOptions, options)
    if (typeof entry.runNaturalLanguageAgentTurn !== 'function') {
      throw new Error('WidgetVA official page runtime does not expose runNaturalLanguageAgentTurn().')
    }
    return entry.runNaturalLanguageAgentTurn(normalized)
  }
  stableBindings.runObjectiveLoop = async (objectiveOrOptions, options = {}) => {
    const normalized = normalizeOfficialPageObjectiveCall(objectiveOrOptions, options)
    if (typeof entry.runNaturalLanguageAgentLoop !== 'function') {
      throw new Error('WidgetVA official page runtime does not expose runNaturalLanguageAgentLoop().')
    }
    return entry.runNaturalLanguageAgentLoop(normalized)
  }
  stableBindings.setPointParam = async (options = {}) => {
    const call = buildPointParamCall(options)
    return stableBindings.executeVerifiedAction(call)
  }
  stableBindings.setIntervalParam = async (options = {}) => {
    const call = buildIntervalParamCall(options)
    return stableBindings.executeVerifiedAction(call)
  }
  stableBindings.clearParam = async (options = {}) => {
    const call = buildClearParamCall(options)
    return stableBindings.executeVerifiedAction(call)
  }
  stableBindings.clearSelection = async (options = {}) => {
    const call = normalizeOfficialPageActionCall('widget.clearSelection', null, options)
    return stableBindings.executeVerifiedAction(call)
  }
  stableBindings.inspectVisibleRows = async (params = {}, options = {}) => (
    stableBindings.queryPerception('perception.inspectVisibleRows', params, options)
  )
  stableBindings.summarizeVisible = async (params = {}, options = {}) => (
    stableBindings.queryPerception('perception.summarizeVisible', params, options)
  )
  stableBindings.inspectSelection = async (params = {}, options = {}) => (
    stableBindings.queryPerception('perception.inspectSelection', params, options)
  )
  stableBindings.summarizeSelection = async (params = {}, options = {}) => (
    stableBindings.queryPerception('perception.summarizeSelection', params, options)
  )
  stableBindings.request = entry.request
  stableBindings.runAgentLoop = entry.runAgentLoop
  stableBindings.runNaturalLanguageAgentTurn = entry.runNaturalLanguageAgentTurn
  stableBindings.runNaturalLanguageAgentLoop = entry.runNaturalLanguageAgentLoop
  stableBindings.configureAgent = entry.configureAgent
  stableBindings.readAgentConfig = entry.readAgentConfig

  entry.api = stableBindings
  entry.publicBindingConfig = {
    stableSurfaceName: typeof stableSurfaceName === 'string' && stableSurfaceName.length > 0
      ? stableSurfaceName
      : null,
    exposeLegacyWindowEntry: exposeLegacyWindowEntry !== false,
    exposeLegacyWindowController: exposeLegacyWindowController !== false,
    helperNames: exposeLegacyWindowHelpers === false
      ? []
      : Object.values(LEGACY_OFFICIAL_PAGE_GLOBAL_HELPERS),
  }

  if (entry.publicBindingConfig.exposeLegacyWindowEntry) {
    root.__widgetVAOfficialPage = entry
    root.__widgetVAOfficialPageEntry = entry
  }
  if (entry.publicBindingConfig.exposeLegacyWindowController) {
    root.__widgetVAOfficialPageController = activeController
  }
  if (entry.publicBindingConfig.stableSurfaceName) {
    root[entry.publicBindingConfig.stableSurfaceName] = stableBindings
  }
  installOfficialPageHelperGlobals(root, stableBindings, entry.publicBindingConfig.helperNames)

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
  entry.runtime = null
  entry.pagePort = null
  entry.request = null
  entry.runAgentLoop = null
  entry.runNaturalLanguageAgentTurn = null
  entry.runNaturalLanguageAgentLoop = null
  entry.configureAgent = null
  entry.readAgentConfig = null
  entry.api = null
  const publicBindingConfig = entry.publicBindingConfig || null
  entry.publicBindingConfig = null
  entry.promise = null

  if (publicBindingConfig?.exposeLegacyWindowEntry) {
    root.__widgetVAOfficialPage = undefined
    root.__widgetVAOfficialPageEntry = undefined
  }
  if (publicBindingConfig?.exposeLegacyWindowController) {
    root.__widgetVAOfficialPageController = undefined
  }
  if (publicBindingConfig?.stableSurfaceName) {
    root[publicBindingConfig.stableSurfaceName] = undefined
  }
  clearOfficialPageHelperGlobals(root, publicBindingConfig?.helperNames || [])

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
