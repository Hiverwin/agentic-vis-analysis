import { makeWidgetRef } from '../../contracts/refs-contracts.js'
import { readObservation as readObservationFromContext } from '../../core/agent/context/observation.js'
import { runAgentLoopOnTarget } from '../../core/agent/adapters/agentTargetPort.js'

const REGISTRY_KEY = '__widgetVARegisteredWorkspaceContract'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function readNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeIdToken(value, fallback = 'widget') {
  const token = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return token || fallback
}

function listActionEntries(actions = null) {
  if (Array.isArray(actions)) {
    return actions
      .map((action) => {
        if (typeof action === 'string') return { name: action }
        if (action && typeof action === 'object' && typeof action.name === 'string') {
          return action
        }
        return null
      })
      .filter(Boolean)
  }

  if (actions && typeof actions === 'object') {
    return Object.entries(actions)
      .filter(([name]) => typeof name === 'string' && name.length > 0)
      .map(([name, value]) => ({
        ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}),
        name,
      }))
  }

  return []
}

function listPerceptionEntries(perceptions = null) {
  return listActionEntries(perceptions)
}

function normalizeFields(fields = null) {
  if (Array.isArray(fields)) {
    return fields
      .map((field) => {
        if (typeof field === 'string') return { name: field }
        if (field && typeof field === 'object' && typeof field.name === 'string') {
          return {
            name: field.name,
            ...(field.type ? { type: field.type } : {}),
          }
        }
        return null
      })
      .filter(Boolean)
  }

  if (fields && typeof fields === 'object') {
    const result = []
    const seen = new Set()
    for (const value of Object.values(fields)) {
      const name = typeof value === 'string'
        ? value
        : typeof value?.field === 'string'
          ? value.field
          : typeof value?.name === 'string'
            ? value.name
            : null
      if (!name || seen.has(name)) continue
      seen.add(name)
      result.push({
        name,
        ...(value && typeof value === 'object' && value.type ? { type: value.type } : {}),
      })
    }
    return result
  }

  return []
}

function normalizeEncodings(fields = null) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {}
  const encodings = {}
  for (const [channel, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      encodings[channel] = { field: value }
    } else if (value && typeof value === 'object') {
      const field = value.field || value.name || null
      if (field) {
        encodings[channel] = {
          field,
          ...(value.type ? { type: value.type } : {}),
        }
      }
    }
  }
  return encodings
}

function readWidgetActionHandler(widget = {}, actionName = null) {
  const actions = widget?.actions
  if (!actionName || !actions || typeof actions !== 'object' || Array.isArray(actions)) return null
  const action = actions[actionName]
  if (typeof action === 'function') return action
  if (typeof action?.apply === 'function') return action.apply.bind(action)
  if (typeof action?.handler === 'function') return action.handler.bind(action)
  return null
}

function readWorkspaceActionHandler(contract = {}, actionName = null) {
  const action = contract?.actions?.[actionName]
  if (typeof action === 'function') return action
  if (typeof action?.apply === 'function') return action.apply.bind(action)
  if (typeof action?.handler === 'function') return action.handler.bind(action)
  if (typeof contract?.applyAction === 'function') {
    return (params, ctx) => contract.applyAction({
      name: actionName,
      params,
      target: ctx?.target || null,
      queryScope: ctx?.queryScope || null,
    }, ctx)
  }
  return null
}

function readWidgetPerceptionHandler(widget = {}, perceptionName = null) {
  const perceptions = widget?.perceptions
  if (!perceptionName || !perceptions || typeof perceptions !== 'object' || Array.isArray(perceptions)) return null
  const perception = perceptions[perceptionName]
  if (typeof perception === 'function') return perception
  if (typeof perception?.query === 'function') return perception.query.bind(perception)
  if (typeof perception?.handler === 'function') return perception.handler.bind(perception)
  return null
}

function resolveWidgetRef(workspaceId, widget = {}, index = 0) {
  const widgetId = readNonEmptyString(widget.widgetId)
    || normalizeIdToken(widget.title, `widget_${index + 1}`)
  return {
    widgetId,
    ref: readNonEmptyString(widget.ref) || makeWidgetRef({ workspaceId, widgetId }),
  }
}

function normalizeContract(contract = {}, { sessionId = null } = {}) {
  const workspaceId = readNonEmptyString(contract.workspaceId)
    || readNonEmptyString(sessionId)
    || 'explicit-observable-d3-workspace'
  const widgets = (Array.isArray(contract.widgets) ? contract.widgets : [])
    .map((widget, index) => {
      const ids = resolveWidgetRef(workspaceId, widget, index)
      const actions = listActionEntries(widget.actions || widget.actionDescriptors)
      const perceptions = listPerceptionEntries(widget.perceptions || widget.perceptionQueries)
      const fields = normalizeFields(widget.fields)
      return {
        source: widget,
        ref: ids.ref,
        widgetId: ids.widgetId,
        kind: readNonEmptyString(widget.kind) || 'custom',
        title: readNonEmptyString(widget.title) || ids.widgetId,
        fields,
        encodings: normalizeEncodings(widget.fields),
        actionEntries: actions,
        perceptionEntries: perceptions,
        actionNames: actions.map((action) => action.name),
        perceptionNames: perceptions.map((perception) => perception.name),
      }
    })

  return {
    source: contract,
    workspaceId,
    title: readNonEmptyString(contract.title) || readNonEmptyString(contract.name) || workspaceId,
    widgets,
    links: Array.isArray(contract.links) ? contract.links : [],
  }
}

function buildWorkspaceDescription(normalized) {
  const dataHandles = normalized.widgets.map((widget) => ({
    ref: `wl://widgetva-app/workspace/${normalized.workspaceId}/data/${widget.widgetId}`,
    widgetRef: widget.ref,
    schema: {
      fields: widget.fields,
    },
    stats: {},
  }))
  const dataHandleByWidgetRef = new Map(dataHandles.map((handle) => [handle.widgetRef, handle]))

  return {
    workspaceId: normalized.workspaceId,
    provider: 'd3',
    source: 'explicit-widgetva-contract',
    title: normalized.title,
    widgets: normalized.widgets.map((widget) => ({
      ref: widget.ref,
      widgetId: widget.widgetId,
      kind: widget.kind,
      provider: 'd3',
      title: widget.title,
      actionNames: [...new Set(widget.actionNames)],
      perceptionNames: [...new Set(widget.perceptionNames)],
      primaryDataRef: dataHandleByWidgetRef.get(widget.ref)?.ref || null,
      encodings: widget.encodings,
    })),
    links: normalized.links.map((link, index) => ({
      linkId: readNonEmptyString(link.linkId) || `explicit_link_${index + 1}`,
      kind: readNonEmptyString(link.kind) || readNonEmptyString(link.effect) || 'linkedView',
      sourceWidgetId: readNonEmptyString(link.sourceWidgetId) || null,
      targetWidgetId: readNonEmptyString(link.targetWidgetId) || null,
      sourceAction: readNonEmptyString(link.sourceAction) || null,
      effect: readNonEmptyString(link.effect) || null,
      description: readNonEmptyString(link.description) || null,
    })),
    actions: normalized.widgets.flatMap((widget) => widget.actionEntries.map((action) => ({
      name: action.name,
      targetRef: widget.ref,
      ...(action.paramsSchema ? { paramsSchema: clone(action.paramsSchema) } : {}),
      ...(action.description ? { description: action.description } : {}),
    }))),
    perceptionQueries: normalized.widgets.flatMap((widget) => widget.perceptionEntries.map((perception) => ({
      name: perception.name,
      targetRef: widget.ref,
      ...(perception.paramsSchema ? { paramsSchema: clone(perception.paramsSchema) } : {}),
      ...(perception.description ? { description: perception.description } : {}),
    }))),
    dataHandles,
  }
}

function findWidgetByRefOrId(normalized, refOrId = null) {
  if (!refOrId) return normalized.widgets[0] || null
  return normalized.widgets.find((widget) => (
    widget.ref === refOrId
    || widget.widgetId === refOrId
  )) || null
}

function summarizeContractState(rawState = null) {
  if (typeof rawState?.summary === 'string' && rawState.summary.length > 0) {
    return rawState.summary
  }
  if (typeof rawState === 'string') return rawState
  return 'Explicit D3 workspace state from the host page contract.'
}

export function installWidgetVAWorkspaceContractRegistry(root = globalThis.window) {
  if (!root || typeof root !== 'object') {
    throw new Error('installWidgetVAWorkspaceContractRegistry requires a page-like root object.')
  }

  const existing = root.WidgetVA && typeof root.WidgetVA === 'object' ? root.WidgetVA : {}
  const api = {
    ...existing,
    registerWorkspace(contract) {
      if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
        throw new Error('WidgetVA.registerWorkspace requires a workspace contract object.')
      }
      root[REGISTRY_KEY] = contract
      return contract
    },
    readWorkspaceContract() {
      return root[REGISTRY_KEY] || null
    },
    clearWorkspaceContract() {
      root[REGISTRY_KEY] = null
    },
  }
  root.WidgetVA = api
  return api
}

export function readWidgetVAWorkspaceContract(root = globalThis.window) {
  return root?.[REGISTRY_KEY] || root?.WidgetVA?.readWorkspaceContract?.() || null
}

export function createObservableD3ExplicitWorkspaceController({
  contract,
  root = globalThis.window,
  sessionId = null,
  userIntent = 'Analyze and manipulate the current Observable D3 workspace through its explicit WidgetVA contract.',
} = {}) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    throw new Error('createObservableD3ExplicitWorkspaceController requires a workspace contract object.')
  }

  const normalized = normalizeContract(contract, { sessionId })
  if (normalized.widgets.length === 0) {
    throw new Error('WidgetVA explicit D3 workspace contract requires at least one widget.')
  }

  let stateIndex = 0
  const snapshots = new Map()

  async function readHostState() {
    if (typeof contract.readState === 'function') {
      return contract.readState()
    }
    if (typeof contract.readWorkspaceState === 'function') {
      return contract.readWorkspaceState()
    }
    return {}
  }

  async function captureState({ stateId = null } = {}) {
    const id = stateId || `${normalized.workspaceId}:s${stateIndex}`
    const raw = await readHostState()
    const state = {
      stateId: id,
      summary: summarizeContractState(raw),
      widgets: Object.fromEntries(normalized.widgets.map((widget) => {
        const widgetRawState = raw?.widgets?.[widget.widgetId]
          || raw?.widgets?.[widget.ref]
          || raw?.[widget.widgetId]
          || raw?.[widget.ref]
          || {}
        const dataRef = `wl://widgetva-app/workspace/${normalized.workspaceId}/data/${widget.widgetId}`
        return [widget.ref, {
          ref: widget.ref,
          widgetId: widget.widgetId,
          kind: widget.kind,
          title: widget.title,
          encodings: widget.encodings,
          data: {
            sourceDataRef: dataRef,
            currentDataRef: dataRef,
            ...(Number.isFinite(widgetRawState?.visibleCount) ? { visibleCount: widgetRawState.visibleCount } : {}),
            ...(Number.isFinite(widgetRawState?.selectedCount) ? { selectedCount: widgetRawState.selectedCount } : {}),
          },
          hostState: clone(widgetRawState),
        }]
      })),
    }
    const recoverableState = {
      stateId: id,
      workspaceId: normalized.workspaceId,
      hostState: clone(raw),
    }
    snapshots.set(id, recoverableState)
    return {
      state,
      recoverableState,
      raw,
    }
  }

  const description = buildWorkspaceDescription(normalized)

  const target = {
    describeWorkspace() {
      return clone(description)
    },
    async readState() {
      const captured = await captureState({ stateId: `${normalized.workspaceId}:s${stateIndex}` })
      return captured.state
    },
    async readObservation(options = {}) {
      const captured = await captureState({ stateId: `${normalized.workspaceId}:s${stateIndex}` })
      return readObservationFromContext({
        query: options?.query || null,
        workspace: description,
        state: captured.state,
        sharedAnalyticalState: {
          focusedWidgetRef: normalized.widgets[0]?.ref || null,
          sharedStructuralContext: {
            linkCount: normalized.links.length,
            links: {
              definitions: clone(description.links),
            },
          },
        },
        view: {
          stateId: captured.state.stateId,
          summary: captured.state.summary,
        },
      })
    },
    async executeAction(call = {}) {
      return this.executeVerifiedAction(call)
    },
    async executeVerifiedAction(call = {}) {
      const actionName = readNonEmptyString(call.name)
      const targetRef = call?.target?.widgetRef || call?.queryScope?.widgetRef || null
      const widget = findWidgetByRefOrId(normalized, targetRef)
      if (!actionName || !widget || !widget.actionNames.includes(actionName)) {
        throw new Error(`Unsupported explicit D3 workspace action: ${actionName || 'missing'}.`)
      }
      const handler = readWidgetActionHandler(widget.source, actionName)
        || readWorkspaceActionHandler(contract, actionName)
      if (typeof handler !== 'function') {
        throw new Error(`Explicit D3 workspace action has no handler: ${actionName}.`)
      }
      const params = clone(call.params || {})
      const actionResult = await handler(params, {
        root,
        contract,
        workspaceId: normalized.workspaceId,
        widget,
        target: call.target || { widgetRef: widget.ref },
        queryScope: call.queryScope || { widgetRef: widget.ref },
        readState: readHostState,
      })
      stateIndex += 1
      const captured = await captureState({ stateId: `${normalized.workspaceId}:s${stateIndex}` })
      return {
        ok: true,
        actionResult: {
          ok: true,
          actionName,
          stateId: captured.state.stateId,
          updatedRefs: [widget.ref],
          affectedRefs: [widget.ref],
          result: clone(actionResult || null),
          recoverableState: captured.recoverableState,
        },
        verification: {
          ok: true,
          summary: `${actionName} completed through the explicit D3 workspace contract.`,
        },
        recoverableState: captured.recoverableState,
      }
    },
    async queryPerception(call = {}) {
      const queryName = readNonEmptyString(call.name)
      const targetRef = call?.target?.widgetRef || call?.queryScope?.widgetRef || null
      const widget = findWidgetByRefOrId(normalized, targetRef)
      const handler = widget ? readWidgetPerceptionHandler(widget.source, queryName) : null
      if (typeof handler === 'function') {
        return handler(clone(call.params || {}), {
          root,
          contract,
          workspaceId: normalized.workspaceId,
          widget,
          readState: readHostState,
        })
      }
      if (typeof contract.queryPerception === 'function') {
        return contract.queryPerception(call, {
          root,
          contract,
          workspaceId: normalized.workspaceId,
          widget,
          readState: readHostState,
        })
      }
      const captured = await captureState({ stateId: `${normalized.workspaceId}:s${stateIndex}` })
      return {
        ok: true,
        name: queryName,
        result: {
          summary: captured.state.summary,
          stateId: captured.state.stateId,
        },
      }
    },
    async runDataQuery(call = {}) {
      if (typeof contract.runDataQuery === 'function') {
        return contract.runDataQuery(call, { root, contract, workspaceId: normalized.workspaceId })
      }
      throw new Error('Explicit D3 workspace contract does not expose runDataQuery().')
    },
    async readLatestCoordinationResult() {
      return null
    },
    async jumpToState(options = {}) {
      return this.restoreRecoverableState(options)
    },
    async restoreRecoverableState(state = {}) {
      const stateId = state?.stateId || null
      const snapshot = stateId ? snapshots.get(stateId) || null : null
      const hostState = state?.hostState || snapshot?.hostState || state || null
      if (typeof contract.restoreState === 'function') {
        await contract.restoreState(hostState, {
          root,
          contract,
          workspaceId: normalized.workspaceId,
          stateId,
        })
      } else if (typeof contract.restoreWorkspaceState === 'function') {
        await contract.restoreWorkspaceState(hostState, {
          root,
          contract,
          workspaceId: normalized.workspaceId,
          stateId,
        })
      }
      return {
        ok: true,
        restored: true,
        stateId,
      }
    },
    async readRecoverableState() {
      const captured = await captureState({ stateId: `${normalized.workspaceId}:s${stateIndex}` })
      return captured.recoverableState
    },
    planWorkspace() {
      return {
        userIntent,
        workspace: this.describeWorkspace(),
      }
    },
  }

  return {
    provider: 'd3',
    kind: 'explicitWorkspace',
    source: 'explicit-widgetva-contract',
    contract,
    workspace: target,
    pagePort: target,
    surface: {
      provider: 'd3',
      source: 'explicit-widgetva-contract',
      workspaceId: normalized.workspaceId,
      widgetCount: normalized.widgets.length,
    },
    runAgentLoop: (options = {}) => runAgentLoopOnTarget(target, options),
    readRecoverableState: () => target.readRecoverableState(),
    restoreRecoverableState: (state = {}) => target.restoreRecoverableState(state),
    readDebugSnapshot: async () => ({
      provider: 'd3',
      source: 'explicit-widgetva-contract',
      workspace: target.describeWorkspace(),
      state: await target.readState(),
    }),
    dispose() {},
  }
}

export async function createObservableD3ExplicitWorkspaceRpcController({
  root = globalThis.window,
  rpcHost,
  invokeWorker,
  description = null,
  sessionId = null,
  userIntent = 'Analyze and manipulate the current Observable D3 workspace through its explicit WidgetVA contract.',
  timeoutMs = 5000,
} = {}) {
  if (!rpcHost || typeof invokeWorker !== 'function') {
    throw new Error('createObservableD3ExplicitWorkspaceRpcController requires an Observable D3 RPC host and invokeWorker().')
  }

  const workspaceDescription = description || await invokeWorker(rpcHost, 'describeExplicitWorkspaceContract', null, {
    timeoutMs: Math.min(timeoutMs, 1000),
  })
  if (!workspaceDescription || typeof workspaceDescription !== 'object') {
    return null
  }

  let lastRecoverableState = null

  const target = {
    describeWorkspace() {
      return clone(workspaceDescription)
    },
    async readState() {
      return invokeWorker(rpcHost, 'readExplicitWorkspaceState', null, {
        timeoutMs: Math.min(timeoutMs, 1000),
      })
    },
    async readObservation(options = {}) {
      const state = await this.readState()
      return readObservationFromContext({
        query: options?.query || null,
        workspace: workspaceDescription,
        state,
        sharedAnalyticalState: {
          focusedWidgetRef: workspaceDescription.widgets?.[0]?.ref || null,
          sharedStructuralContext: {
            linkCount: Array.isArray(workspaceDescription.links) ? workspaceDescription.links.length : 0,
            links: {
              definitions: clone(workspaceDescription.links || []),
            },
          },
        },
        view: {
          stateId: state?.stateId || null,
          summary: state?.summary || null,
        },
      })
    },
    async executeAction(call = {}) {
      return this.executeVerifiedAction(call)
    },
    async executeVerifiedAction(call = {}) {
      const result = await invokeWorker(rpcHost, 'executeExplicitWorkspaceAction', call, {
        timeoutMs,
      })
      lastRecoverableState = result?.recoverableState
        || result?.actionResult?.recoverableState
        || lastRecoverableState
      return result
    },
    async queryPerception(call = {}) {
      return invokeWorker(rpcHost, 'queryExplicitWorkspacePerception', call, {
        timeoutMs: Math.min(timeoutMs, 1000),
      })
    },
    async runDataQuery(call = {}) {
      return invokeWorker(rpcHost, 'runExplicitWorkspaceDataQuery', call, {
        timeoutMs: Math.min(timeoutMs, 1000),
      })
    },
    async readLatestCoordinationResult() {
      return null
    },
    async readRecoverableState() {
      const recoverableState = await invokeWorker(rpcHost, 'readExplicitWorkspaceRecoverableState', null, {
        timeoutMs: Math.min(timeoutMs, 1000),
      })
      lastRecoverableState = recoverableState || lastRecoverableState
      return lastRecoverableState
    },
    async jumpToState(options = {}) {
      return this.restoreRecoverableState(options)
    },
    async restoreRecoverableState(state = {}) {
      return invokeWorker(rpcHost, 'restoreExplicitWorkspaceState', state, {
        timeoutMs,
      })
    },
    planWorkspace() {
      return {
        userIntent,
        workspace: clone(workspaceDescription),
      }
    },
  }

  return {
    provider: 'd3',
    kind: 'explicitWorkspace',
    source: 'explicit-widgetva-contract',
    workspace: target,
    pagePort: target,
    surface: {
      provider: 'd3',
      source: 'explicit-widgetva-contract',
      workspaceId: workspaceDescription.workspaceId || sessionId || null,
      widgetCount: Array.isArray(workspaceDescription.widgets) ? workspaceDescription.widgets.length : 0,
    },
    runAgentLoop: (options = {}) => runAgentLoopOnTarget(target, options),
    readRecoverableState: () => target.readRecoverableState(),
    restoreRecoverableState: (state = {}) => target.restoreRecoverableState(state),
    readDebugSnapshot: async () => ({
      provider: 'd3',
      source: 'explicit-widgetva-contract',
      workspace: target.describeWorkspace(),
      state: await target.readState(),
    }),
    dispose() {},
  }
}

export async function attachWidgetVAToObservableD3ExplicitWorkspacePage(options = {}) {
  const root = options?.root || globalThis.window
  const contract = options?.contract || readWidgetVAWorkspaceContract(root)
  return createObservableD3ExplicitWorkspaceController({
    contract,
    root,
    sessionId: options?.sessionId || null,
    userIntent: options?.userIntent,
  })
}
