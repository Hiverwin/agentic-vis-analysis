function normalizeString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeReplayOptions(input) {
  if (typeof input === 'string') {
    return { stateId: input }
  }
  if (input && typeof input === 'object') {
    return { ...input }
  }
  return {}
}

function findWidgetInWorkspaceDescription(description, {
  targetRef = null,
  widgetRef = null,
  widgetId = null,
} = {}) {
  const requestedRef = normalizeString(targetRef) || normalizeString(widgetRef)
  const requestedId = normalizeString(widgetId)
  const widgets = Array.isArray(description?.widgets) ? description.widgets : []

  if (requestedRef) {
    return widgets.find((entry) => entry?.ref === requestedRef) || null
  }
  if (requestedId) {
    return widgets.find((entry) => entry?.widgetId === requestedId) || null
  }
  return widgets[0] || null
}

function requireMethod(delegate, methodNames, surfaceName) {
  for (const name of methodNames) {
    const method = delegate?.[name]
    if (typeof method === 'function') {
      return method.bind(delegate)
    }
  }
  throw new Error(`WidgetVA transport does not support ${surfaceName}().`)
}

function getAffectedRefs(record) {
  return Array.isArray(record?.affectedRefs) ? record.affectedRefs : []
}

function recordTouchesTargetRef(record, targetRef) {
  if (!targetRef) return true
  if (getAffectedRefs(record).includes(targetRef)) return true
  if (record?.action?.targetRef === targetRef) return true
  if (record?.query?.targetRef === targetRef) return true
  return false
}

export async function describeWidgetViaTransport(delegate, options = {}) {
  const describeWorkspace = requireMethod(delegate, ['describeWorkspace'], 'describeWorkspace')
  const workspaceDescription = await describeWorkspace(options.workspaceOptions || {})
  return findWidgetInWorkspaceDescription(workspaceDescription, options)
}

export async function readWorkspaceStateViaTransport(delegate, options = {}) {
  const readView = requireMethod(delegate, ['readView', 'readState'], 'readView')
  return readView(options)
}

export async function readWorkspaceObservationViaTransport(delegate, options = {}) {
  const readObservation = requireMethod(delegate, ['readObservation'], 'readObservation')
  return readObservation(options)
}

export async function readWorkspaceCoordinationStateViaTransport(delegate) {
  const readCoordinationState = requireMethod(delegate, ['readCoordinationState'], 'readCoordinationState')
  return readCoordinationState()
}

export async function readWorkspacePropagationSummaryViaTransport(delegate, options = {}) {
  const readPropagationSummary = requireMethod(delegate, ['readPropagationSummary'], 'readPropagationSummary')
  return readPropagationSummary(options)
}

export async function listAvailableActionsViaTransport(delegate) {
  const listAvailableActions = requireMethod(delegate, ['listAvailableActions'], 'listAvailableActions')
  return listAvailableActions()
}

export async function listAvailablePerceptionsViaTransport(delegate) {
  const listAvailablePerceptions = requireMethod(delegate, ['listAvailablePerceptions'], 'listAvailablePerceptions')
  return listAvailablePerceptions()
}

export async function executeWorkspaceActionViaTransport(delegate, call = {}) {
  const executeAction = requireMethod(delegate, ['runAction', 'executeAction'], 'executeWorkspaceAction')
  return executeAction(call)
}

export async function queryWorkspacePerceptionViaTransport(delegate, call = {}) {
  const queryPerception = requireMethod(delegate, ['queryPerception'], 'queryWorkspacePerception')
  return queryPerception(call)
}

export async function readWorkspaceTraceViaTransport(delegate, options = {}) {
  const readTrace = requireMethod(delegate, ['readInteractionTrace', 'getTrace', 'readTrace'], 'readWorkspaceTrace')
  return readTrace(options)
}

export async function replayWorkspaceViaTransport(delegate, stateIdOrOptions) {
  const jumpToState = requireMethod(delegate, ['jumpToState', 'replay'], 'replayWorkspace')
  return jumpToState(normalizeReplayOptions(stateIdOrOptions))
}

export async function runWorkspaceDataQueryViaTransport(delegate, call = {}) {
  const runDataQuery = requireMethod(delegate, ['queryData', 'dataQuery', 'runDataQuery'], 'runDataQuery')
  return runDataQuery(call)
}

export async function readWidgetStateViaTransport(delegate, options = {}) {
  const widgetDescription = await describeWidgetViaTransport(delegate, options)
  const widgetRef = widgetDescription?.ref || normalizeString(options.targetRef) || normalizeString(options.widgetRef)
  if (!widgetRef) return null

  const readView = requireMethod(delegate, ['readView'], 'readWidgetState')
  return readView({
    ...options.viewOptions,
    refs: [widgetRef],
  })
}

export async function executeWidgetActionViaTransport(delegate, call = {}) {
  const executeAction = requireMethod(delegate, ['runAction', 'executeAction'], 'executeWidgetAction')
  return executeAction(call)
}

export async function queryWidgetPerceptionViaTransport(delegate, call = {}) {
  const queryPerception = requireMethod(delegate, ['queryPerception'], 'queryWidgetPerception')
  return queryPerception(call)
}

export async function readWidgetTraceViaTransport(delegate, options = {}) {
  const widgetDescription = await describeWidgetViaTransport(delegate, options)
  const targetRef = widgetDescription?.ref || normalizeString(options.targetRef) || normalizeString(options.widgetRef)
  const trace = await readWorkspaceTraceViaTransport(delegate, options.traceOptions || options)
  if (!targetRef || !Array.isArray(trace)) {
    return trace
  }
  return trace.filter((record) => recordTouchesTargetRef(record, targetRef))
}

export async function replayWidgetViaTransport(delegate, stateIdOrOptions) {
  return replayWorkspaceViaTransport(delegate, stateIdOrOptions)
}

export function createWidgetWorkspaceTransportClient(delegate) {
  const client = {}

  if (typeof delegate?.describePagePort === 'function') {
    client.describePagePort = (...args) => delegate.describePagePort(...args)
  }
  if (typeof delegate?.listAvailableWidgetVAMcpTools === 'function') {
    client.listAvailableWidgetVAMcpTools = (...args) => delegate.listAvailableWidgetVAMcpTools(...args)
  }
  if (typeof delegate?.describeWorkspace === 'function') {
    client.describeWorkspace = (...args) => delegate.describeWorkspace(...args)
  }
  if (typeof delegate?.describeActionUsage === 'function') {
    client.describeActionUsage = (...args) => delegate.describeActionUsage(...args)
  }
  if (typeof delegate?.close === 'function') {
    client.close = (...args) => delegate.close(...args)
  }
  if ('ready' in (delegate || {})) {
    client.ready = delegate.ready
  }

  return Object.assign(client, {
    describeWidget(options = {}) {
      return describeWidgetViaTransport(delegate, options)
    },
    readWidgetState(options = {}) {
      return readWidgetStateViaTransport(delegate, options)
    },
    executeWidgetAction(call = {}) {
      return executeWidgetActionViaTransport(delegate, call)
    },
    queryWidgetPerception(call = {}) {
      return queryWidgetPerceptionViaTransport(delegate, call)
    },
    readWidgetTrace(options = {}) {
      return readWidgetTraceViaTransport(delegate, options)
    },
    replayWidget(stateIdOrOptions) {
      return replayWidgetViaTransport(delegate, stateIdOrOptions)
    },
    readWorkspaceState(options = {}) {
      return readWorkspaceStateViaTransport(delegate, options)
    },
    ...(typeof delegate?.readObservation === 'function'
      ? {
          readObservation(...args) {
            return delegate.readObservation(...args)
          },
        }
      : {
          readObservation(options = {}) {
            return readWorkspaceObservationViaTransport(delegate, options)
          },
        }),
    readCoordinationState() {
      return readWorkspaceCoordinationStateViaTransport(delegate)
    },
    readPropagationSummary(options = {}) {
      return readWorkspacePropagationSummaryViaTransport(delegate, options)
    },
    listAvailableActions() {
      return listAvailableActionsViaTransport(delegate)
    },
    listAvailablePerceptions() {
      return listAvailablePerceptionsViaTransport(delegate)
    },
    readState(options = {}) {
      return readWorkspaceStateViaTransport(delegate, options)
    },
    executeWorkspaceAction(call = {}) {
      return executeWorkspaceActionViaTransport(delegate, call)
    },
    executeAction(call = {}) {
      return executeWorkspaceActionViaTransport(delegate, call)
    },
    queryWorkspacePerception(call = {}) {
      return queryWorkspacePerceptionViaTransport(delegate, call)
    },
    runDataQuery(call = {}) {
      return runWorkspaceDataQueryViaTransport(delegate, call)
    },
    readWorkspaceTrace(options = {}) {
      return readWorkspaceTraceViaTransport(delegate, options)
    },
    readTrace(options = {}) {
      return readWorkspaceTraceViaTransport(delegate, options)
    },
    replayWorkspace(stateIdOrOptions) {
      return replayWorkspaceViaTransport(delegate, stateIdOrOptions)
    },
    replay(stateIdOrOptions) {
      return replayWorkspaceViaTransport(delegate, stateIdOrOptions)
    },
  })
}

export function attachWidgetWorkspaceTransportSurface(client) {
  const nativeReadObservation = typeof client?.readObservation === 'function'
    ? client.readObservation.bind(client)
    : null

  return Object.assign(client, {
    describeWidget(options = {}) {
      return describeWidgetViaTransport(client, options)
    },
    readWidgetState(options = {}) {
      return readWidgetStateViaTransport(client, options)
    },
    executeWidgetAction(call = {}) {
      return executeWidgetActionViaTransport(client, call)
    },
    queryWidgetPerception(call = {}) {
      return queryWidgetPerceptionViaTransport(client, call)
    },
    readWidgetTrace(options = {}) {
      return readWidgetTraceViaTransport(client, options)
    },
    replayWidget(stateIdOrOptions) {
      return replayWidgetViaTransport(client, stateIdOrOptions)
    },
    readWorkspaceState(options = {}) {
      return readWorkspaceStateViaTransport(client, options)
    },
    ...(typeof nativeReadObservation === 'function'
      ? {
          readObservation(...args) {
            return nativeReadObservation(...args)
          },
        }
      : {
          readObservation(options = {}) {
            return readWorkspaceObservationViaTransport(client, options)
          },
        }),
    readCoordinationState() {
      return readWorkspaceCoordinationStateViaTransport(client)
    },
    readPropagationSummary(options = {}) {
      return readWorkspacePropagationSummaryViaTransport(client, options)
    },
    listAvailableActions() {
      return listAvailableActionsViaTransport(client)
    },
    listAvailablePerceptions() {
      return listAvailablePerceptionsViaTransport(client)
    },
    readState(options = {}) {
      return readWorkspaceStateViaTransport(client, options)
    },
    executeWorkspaceAction(call = {}) {
      return executeWorkspaceActionViaTransport(client, call)
    },
    executeAction(call = {}) {
      return executeWorkspaceActionViaTransport(client, call)
    },
    queryWorkspacePerception(call = {}) {
      return queryWorkspacePerceptionViaTransport(client, call)
    },
    runDataQuery(call = {}) {
      return runWorkspaceDataQueryViaTransport(client, call)
    },
    readWorkspaceTrace(options = {}) {
      return readWorkspaceTraceViaTransport(client, options)
    },
    readTrace(options = {}) {
      return readWorkspaceTraceViaTransport(client, options)
    },
    replayWorkspace(stateIdOrOptions) {
      return replayWorkspaceViaTransport(client, stateIdOrOptions)
    },
    replay(stateIdOrOptions) {
      return replayWorkspaceViaTransport(client, stateIdOrOptions)
    },
  })
}
