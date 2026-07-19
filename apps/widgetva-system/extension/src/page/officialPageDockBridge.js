import {
  WIDGETVA_DOCK_BRIDGE_REQUEST,
  WIDGETVA_DOCK_BRIDGE_RESPONSE,
  WIDGETVA_DOCK_BRIDGE_SOURCE_CONTENT,
  WIDGETVA_DOCK_BRIDGE_SOURCE_PAGE,
} from '../shared/officialPageDockBridge.js'
import {
  configureOfficialPageAgent,
  readOfficialPageAgentConfig,
} from './officialPageAgentClient.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function summarizeDockError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error || 'WidgetVA Dock bridge failed.'),
  }
}

function compactNames(items = []) {
  return Array.from(new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => (typeof item === 'string' ? item : item?.name))
      .filter((name) => typeof name === 'string' && name.length > 0),
  ))
}

function labelLink(link = null) {
  if (!link || typeof link !== 'object') return 'link'
  const source = link.sourceAction
    || link.sourceStep
    || link.sourceStateRef
    || link.sourceWidgetId
    || link.sourceRef
    || link.source
    || 'source'
  const target = link.targetAction
    || link.targetStep
    || link.targetStateRef
    || link.targetWidgetId
    || link.targetRef
    || link.target
    || 'target'
  return `${source} -> ${target}`
}

function readRoute(root, explicitRoute = null) {
  if (explicitRoute && typeof explicitRoute === 'object') return clone(explicitRoute)
  const href = root?.location?.href || ''
  if (href.includes('vega.github.io/vega-lite/examples/')) {
    return {
      provider: 'vega-lite',
      pageType: 'official-vega-lite-page',
    }
  }
  if (/https:\/\/observablehq\.com\/@[^/]+\/[^/?#]+/.test(href)) {
    return {
      provider: 'd3',
      pageType: 'official-observable-notebook',
    }
  }
  return {
    provider: 'unknown',
    pageType: 'unknown-page',
  }
}

function readStableSurface(root) {
  return root?.__widgetVAOfficialVegaLitePage
    || root?.__widgetVAOfficialPageApi
    || root?.__widgetVAOfficialPage?.api
    || null
}

function readEntry(root, handlers = {}, explicitEntry = null) {
  if (explicitEntry && typeof explicitEntry === 'object') return explicitEntry
  if (typeof handlers.readEntry === 'function') return handlers.readEntry()
  const stableSurface = readStableSurface(root)
  if (typeof stableSurface?.readEntry === 'function') {
    return stableSurface.readEntry()
  }
  return root?.__widgetVAOfficialPage || root?.__widgetVAOfficialPageEntry || null
}

function readRuntimeSurface(root, entry = null) {
  return readStableSurface(root) || entry?.api || null
}

async function readWorkspace(root, entry = null) {
  const surface = readRuntimeSurface(root, entry)
  if (typeof surface?.readWorkspace === 'function') return surface.readWorkspace()
  return null
}

async function readObservation(root, entry = null) {
  const surface = readRuntimeSurface(root, entry)
  if (typeof surface?.readObservation === 'function') return surface.readObservation()
  return null
}

async function readStateHistory(root, entry = null) {
  const surface = readRuntimeSurface(root, entry)
  if (typeof surface?.listStateHistory === 'function') return surface.listStateHistory({ limit: 24 })
  return []
}

async function readTrace(root, entry = null) {
  const surface = readRuntimeSurface(root, entry)
  if (typeof surface?.readTrace === 'function') return surface.readTrace({ limit: 24 })
  return []
}

async function readRecoverableState(root, entry = null) {
  const surface = readRuntimeSurface(root, entry)
  if (typeof surface?.readRecoverableState === 'function') return surface.readRecoverableState()
  if (typeof entry?.readRecoverableState === 'function') return entry.readRecoverableState()
  if (typeof entry?.manager?.readRecoverableState === 'function') return entry.manager.readRecoverableState()
  return null
}

function readControllerFromSurface(surface = null, entry = null) {
  if (entry?.controller) return entry.controller
  if (typeof surface?.readController !== 'function') return null
  return surface.readController()
}

async function restoreOfficialPageState(root, handlers = {}, recoverableState = {}) {
  const entry = readEntry(root, handlers)
  const surface = readRuntimeSurface(root, entry)
  const controller = readControllerFromSurface(surface, entry)
  const state = recoverableState && typeof recoverableState === 'object' && !Array.isArray(recoverableState)
    ? clone(recoverableState)
    : {}
  const stateId = state.stateId || null
  const candidates = [
    ['surface.restoreRecoverableState', surface?.restoreRecoverableState, surface, state],
    ['entry.restoreRecoverableState', entry?.restoreRecoverableState, entry, state],
    ['controller.restoreRecoverableState', controller?.restoreRecoverableState, controller, state],
    ['surface.jumpToState', surface?.jumpToState, surface, { stateId }],
    ['entry.pagePort.jumpToState', entry?.pagePort?.jumpToState, entry?.pagePort, { stateId }],
    ['controller.pagePort.jumpToState', controller?.pagePort?.jumpToState, controller?.pagePort, { stateId }],
    ['root.__widgetVA.jumpToState', root?.__widgetVA?.jumpToState, root?.__widgetVA, { stateId }],
  ]

  for (const [method, restore, owner, payload] of candidates) {
    if (typeof restore !== 'function') continue
    const result = await restore.call(owner, payload)
    return {
      restore: clone(result || { ok: true, stateId, method }),
      snapshot: await buildDockSnapshot(root, handlers, entry),
    }
  }

  throw new Error('WidgetVA official page does not expose a restorable state surface.')
}

function summarizeWorkspace(workspace = null) {
  const safeWorkspace = workspace && typeof workspace === 'object' ? workspace : {}
  const widget = Array.isArray(safeWorkspace.widgets) ? safeWorkspace.widgets[0] || null : null
  return {
    widget: widget
      ? {
          ref: widget.ref || widget.widgetRef || null,
          kind: widget.kind || widget.family || widget.type || null,
          label: widget.title || widget.name || widget.ref || widget.widgetId || widget.kind || 'Widget',
        }
      : {
          ref: null,
          kind: null,
          label: 'Widget',
        },
    links: (Array.isArray(safeWorkspace.links) ? safeWorkspace.links : []).map((link) => ({
      label: labelLink(link),
      kind: link?.kind || link?.relation || null,
      source: link?.sourceAction || link?.sourceWidgetId || link?.sourceRef || link?.source || null,
      target: link?.targetAction || link?.targetWidgetId || link?.targetRef || link?.target || null,
    })),
    tools: {
      actions: compactNames(safeWorkspace.actions),
      perceptions: compactNames(
        safeWorkspace.perceptionQueries || safeWorkspace.perceptions || safeWorkspace.queries,
      ),
    },
  }
}

async function buildDockSnapshot(root, handlers = {}, explicitEntry = null) {
  const route = readRoute(root, handlers.route)
  const entry = readEntry(root, handlers, explicitEntry)
  const workspace = await readWorkspace(root, entry)
  const observation = await readObservation(root, entry)
  const recoverableState = await readRecoverableState(root, entry)
  const history = await readStateHistory(root, entry)
  const trace = await readTrace(root, entry)
  const summary = summarizeWorkspace(workspace)

  return {
    route,
    status: entry?.status || 'idle',
    workspace: clone(workspace || { widgets: [], links: [], actions: [], perceptionQueries: [] }),
    observation: clone(observation),
    state: clone(observation?.state || null),
    recoverableState: clone(recoverableState),
    history: clone(history),
    trace: clone(trace),
    ...summary,
  }
}

function postResponse(root, payload) {
  root.postMessage({
    source: WIDGETVA_DOCK_BRIDGE_SOURCE_PAGE,
    type: WIDGETVA_DOCK_BRIDGE_RESPONSE,
    ...payload,
  }, '*')
}

async function runDockMethod(root, handlers, method, params = {}, {
  requestId = null,
} = {}) {
  if (method === 'probe' || method === 'read') {
    return buildDockSnapshot(root, handlers)
  }

  if (method === 'bind') {
    if (typeof handlers.bind !== 'function') {
      throw new Error('WidgetVA Dock bridge does not have a page bind handler.')
    }
    const entry = await handlers.bind(params || {})
    return buildDockSnapshot(root, handlers, entry)
  }

  if (method === 'readAgentConfig') {
    return readOfficialPageAgentConfig(root)
  }

  if (method === 'configureAgent') {
    return configureOfficialPageAgent(root, params || {})
  }

  if (method === 'runSession') {
    const entry = readEntry(root, handlers)
    const surface = readRuntimeSurface(root, entry)
    const objective = params?.objective || params?.prompt || ''
    if (typeof objective !== 'string' || objective.trim().length === 0) {
      throw new Error('WidgetVA Dock runSession requires an objective.')
    }
    if (typeof surface?.runObjectiveLoop !== 'function') {
      throw new Error('WidgetVA page is not bound to a natural-language agent loop.')
    }
    const session = await surface.runObjectiveLoop({
      objective,
      maxTurns: params?.maxTurns,
      model: params?.model,
      temperature: params?.temperature,
      timeoutMs: params?.timeoutMs,
      chatTimeoutMs: params?.chatTimeoutMs,
      onTurn: requestId
        ? async (progress) => {
          postResponse(root, {
            id: requestId,
            ok: true,
            event: 'turn',
            result: {
              progress: clone(progress),
              snapshot: await buildDockSnapshot(root, handlers),
            },
          })
        }
        : undefined,
    })
    return {
      session: clone(session),
      snapshot: await buildDockSnapshot(root, handlers),
    }
  }

  if (method === 'restore') {
    const state = params?.state && typeof params.state === 'object' && !Array.isArray(params.state)
      ? params.state
      : { stateId: params?.stateId }
    const stateId = state?.stateId || params?.stateId
    if (typeof stateId !== 'string' || stateId.length === 0) {
      throw new Error('WidgetVA Dock restore requires stateId.')
    }
    return restoreOfficialPageState(root, handlers, {
      ...clone(state),
      stateId,
    })
  }

  throw new Error(`Unsupported WidgetVA Dock bridge method: ${String(method)}.`)
}

export function createOfficialPageDockBridgeMessageHandler(root, handlers = {}) {
  return async (event) => {
    if (event.source !== root) return
    const message = event.data
    if (
      !message
      || message.source !== WIDGETVA_DOCK_BRIDGE_SOURCE_CONTENT
      || message.type !== WIDGETVA_DOCK_BRIDGE_REQUEST
    ) {
      return
    }

    try {
      const currentHandlers = typeof handlers.readCurrentHandlers === 'function'
        ? handlers.readCurrentHandlers()
        : handlers
      const result = await runDockMethod(root, currentHandlers, message.method, message.params || {}, {
        requestId: message.id,
      })
      postResponse(root, {
        id: message.id,
        ok: true,
        result,
      })
    } catch (error) {
      postResponse(root, {
        id: message.id,
        ok: false,
        error: summarizeDockError(error),
      })
    }
  }
}

export function installOfficialPageDockBridge(root = window, handlers = {}) {
  if (!root) return null
  const installKey = '__widgetVADockBridgeInstalled'
  if (root[installKey]) {
    root[installKey].updateHandlers?.(handlers)
    return root[installKey]
  }

  const bridgeState = {
    handlers,
  }
  const handler = createOfficialPageDockBridgeMessageHandler(root, {
    readCurrentHandlers: () => bridgeState.handlers,
  })
  root.addEventListener('message', handler)
  root[installKey] = {
    updateHandlers(nextHandlers = {}) {
      bridgeState.handlers = nextHandlers && typeof nextHandlers === 'object'
        ? nextHandlers
        : {}
    },
    dispose() {
      root.removeEventListener('message', handler)
      if (root[installKey]) root[installKey] = null
    },
  }
  return root[installKey]
}
