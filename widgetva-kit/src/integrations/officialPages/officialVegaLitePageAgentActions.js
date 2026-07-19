import { makeVerifiedActionResult } from '../../core/agent/loop/agentLoopShapes.js'
import { makeActionResult } from '../../contracts/result-contracts.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function formatSelectionSummaryValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => formatSelectionSummaryValue(entry)).join('~')
  }
  if (value == null) return ''
  return String(value)
}

function buildPointSelectionSummary(predicates = [], fallbackParamName = null) {
  const parts = (Array.isArray(predicates) ? predicates : [])
    .map((predicate) => {
      const field = typeof predicate?.field === 'string' ? predicate.field : null
      if (!field) return null
      if (predicate?.op === 'in' && Array.isArray(predicate?.value)) {
        return `${field}: ${predicate.value.map((entry) => formatSelectionSummaryValue(entry)).join(', ')}`
      }
      return `${field}: ${formatSelectionSummaryValue(predicate?.value)}`
    })
    .filter((entry) => typeof entry === 'string' && entry.length > 0)
  return parts.join('; ') || `${fallbackParamName || 'point'} point selection`
}

function buildIntervalSelectionSummary(predicates = [], fallbackParamName = null) {
  const parts = (Array.isArray(predicates) ? predicates : [])
    .map((predicate) => {
      const field = typeof predicate?.field === 'string' ? predicate.field : null
      if (!field) return null
      if (predicate?.op === 'between' && Array.isArray(predicate?.value) && predicate.value.length >= 2) {
        return `${field} ${formatSelectionSummaryValue(predicate.value[0])}~${formatSelectionSummaryValue(predicate.value[1])}`
      }
      return `${field}: ${formatSelectionSummaryValue(predicate?.value)}`
    })
    .filter((entry) => typeof entry === 'string' && entry.length > 0)
  return parts.join('; ') || `${fallbackParamName || 'interval'} interval selection`
}

function isOfficialPageParamAction(actionCall) {
  const actionName = typeof actionCall?.name === 'string' ? actionCall.name : null
  return (
    actionName === 'vegaLite.setPointParam'
    || actionName === 'vegaLite.setIntervalParam'
    || actionName === 'vegaLite.clearParam'
    || actionName === 'widget.clearSelection'
    || actionName === 'widget.resetView'
    || actionName === 'widget.filterByValues'
    || actionName === 'bar.selectCategory'
    || actionName === 'bar.clickCategory'
    || actionName === 'bar.filterCategories'
    || actionName === 'line.selectSeries'
    || actionName === 'line.focusLines'
    || actionName === 'line.selectXValue'
    || actionName === 'line.zoomXRegion'
    || actionName === 'scatter.brushRegion'
    || actionName === 'scatter.zoomDomain'
    || actionName === 'heatmap.selectCell'
    || actionName === 'heatmap.filterCells'
    || actionName === 'heatmap.selectSubmatrix'
  )
}

function isExplicitVegaLiteParamAction(actionCall) {
  const actionName = typeof actionCall?.name === 'string' ? actionCall.name : null
  return (
    actionName === 'vegaLite.setPointParam'
    || actionName === 'vegaLite.setIntervalParam'
    || actionName === 'vegaLite.clearParam'
  )
}

function makeOfficialPageParamActionFailureResult(call, reason = null) {
  return makeActionResult({
    ok: false,
    callId: call?.callId || `official_page_param_failed_${Date.now()}`,
    actionName: call?.name || 'unknown',
    stateId: null,
    updatedRefs: [],
    result: {
      executionPath: 'official_page_param_dispatch',
      status: 'unsupported',
      reason: reason || 'The requested Vega-Lite param action could not be translated into WidgetVA shared-selection state for this page.',
    },
    verificationHints: [],
  })
}

function makeOfficialPageVerifiedParamActionFailureResult(call, options = {}, widget, reason = null) {
  const beforeStateId = widget?.readWorkspaceState?.()?.stateId || null
  const actionResult = makeOfficialPageParamActionFailureResult(call, reason)
  return makeVerifiedActionResult({
    ok: false,
    beforeStateId,
    actionResult,
    afterView: clone(widget?.readWorkspaceState?.({
      refs: [],
      deltaSince: options?.includeDeltaSince ? beforeStateId : undefined,
    }) || null),
    verification: options?.verify === false ? null : {
      ok: false,
      callId: `${call?.callId || 'official_page_param'}_verify`,
      queryName: 'perception.verifyActionEffect',
      result: {
        verified: false,
        matchedActionName: call?.name || null,
        matchedStateId: null,
      },
    },
    verificationHints: [],
  })
}

function resolveSpecNodeByViewId(spec, viewId) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec) || typeof viewId !== 'string' || viewId.length === 0) {
    return null
  }
  if (viewId === 'root') return spec
  const segments = viewId.split('.')
  let current = spec
  for (const segment of segments) {
    if (!current || typeof current !== 'object') return null
    if (/^\d+$/.test(segment)) {
      const index = Number(segment)
      if (!Array.isArray(current) || !Number.isInteger(index)) return null
      current = current[index]
      continue
    }
    current = current[segment]
  }
  return current && typeof current === 'object' ? current : null
}

function resolveSpecNodeAncestryByViewId(spec, viewId) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec) || typeof viewId !== 'string' || viewId.length === 0) {
    return []
  }
  if (viewId === 'root') return [spec]
  const segments = viewId.split('.')
  let current = spec
  const ancestry = [current]
  for (const segment of segments) {
    if (!current || typeof current !== 'object') break
    if (/^\d+$/.test(segment)) {
      const index = Number(segment)
      if (!Array.isArray(current) || !Number.isInteger(index)) break
      current = current[index]
    } else {
      current = current[segment]
    }
    if (current && typeof current === 'object') {
      ancestry.push(current)
    } else {
      break
    }
  }
  return ancestry.reverse()
}

function resolveProducerFieldByChannel(spec, param, channel, fieldIndex = 0) {
  const producerSpecs = resolveSpecNodeAncestryByViewId(spec, param?.producerViewId)
  for (const producerSpec of producerSpecs) {
    const channelDef = producerSpec?.encoding?.[channel]
    if (typeof channelDef?.field === 'string' && channelDef.field.length > 0) {
      return channelDef.field
    }
    if (channel === 'color' && typeof producerSpec?.encoding?.y?.field === 'string') {
      return producerSpec.encoding.y.field
    }
    if (channel === 'color' && typeof producerSpec?.encoding?.x?.field === 'string') {
      return producerSpec.encoding.x.field
    }
    const indexedChannel = Array.isArray(param?.encodings) ? param.encodings[fieldIndex] : null
    if (typeof indexedChannel === 'string' && typeof producerSpec?.encoding?.[indexedChannel]?.field === 'string') {
      return producerSpec.encoding[indexedChannel].field
    }
  }
  return null
}

function buildSelectionRefForWidget(widgetId, selectionId) {
  if (typeof widgetId !== 'string' || widgetId.length === 0) return null
  if (typeof selectionId !== 'string' || selectionId.length === 0) return null
  return `${widgetId}::${selectionId}`
}

function readActionResultStateId(widget) {
  return widget?.readWorkspaceState?.()?.stateId || null
}

function readActionRecoverableState(widget, hostBridge = null) {
  const workspaceState = clone(widget?.readWorkspaceState?.() || null)
  const baseState = workspaceState && typeof workspaceState === 'object' && !Array.isArray(workspaceState)
    ? workspaceState
    : {}
  const selections = typeof hostBridge?.readCurrentSelections === 'function'
    ? hostBridge.readCurrentSelections()
    : null
  const activeSelections = selections && typeof selections === 'object' && !Array.isArray(selections)
    ? clone(selections)
    : null
  if (!activeSelections) {
    return Object.keys(baseState).length > 0 ? baseState : null
  }
  return {
    ...baseState,
    shared: {
      ...(baseState.shared || {}),
      activeSelections,
    },
    sharedAnalyticalState: {
      ...(baseState.sharedAnalyticalState || {}),
      activeSelections,
    },
  }
}

function buildSharedSelectionEntry({
  sourceWidgetId,
  sourceWidgetRef,
  selectionId,
  selectionRef,
  selectionKind,
  summary,
  predicates = [],
  value = {},
  domain = null,
} = {}) {
  return {
    selectionId,
    selection_id: selectionId,
    selectionRef,
    selection_ref: selectionRef,
    selectionKind,
    selection_kind: selectionKind,
    sourceWidgetId,
    source_widget_id: sourceWidgetId,
    sourceWidgetRef,
    source_widget_ref: sourceWidgetRef,
    summary: summary || null,
    predicates: clone(predicates),
    value: clone(value),
    domain: domain ? clone(domain) : null,
  }
}

function buildSuccessfulParamActionResult(call, {
  widget,
  hostBridge = null,
  sourceWidgetRef = null,
  paramName = null,
  selectionId = null,
  selectionRef = null,
  selectionKind = null,
  propagated = [],
  propagationEffects = [],
} = {}) {
  const recoverableState = readActionRecoverableState(widget, hostBridge)
  return makeActionResult({
    ok: true,
    callId: call?.callId || `official_page_param_${Date.now()}`,
    actionName: call?.name || 'unknown',
    updatedRefs: sourceWidgetRef ? [sourceWidgetRef] : [],
    stateId: recoverableState?.stateId || null,
    recoverableState,
    statePatch: sourceWidgetRef
      ? {
        [sourceWidgetRef]: {
          sharedSelection: {
            selectionId,
            selectionRef,
            selectionKind,
            paramName,
          },
        },
      }
      : {},
    expectedPostconditions: [],
    verificationHints: [],
    result: {
      executionPath: 'official_page_param_dispatch',
      paramName,
      selectionId,
      selectionRef,
      selectionKind,
      propagated,
      propagationEffects,
    },
  })
}

function normalizePointActionIntent(actionCall = {}) {
  const actionName = typeof actionCall?.name === 'string' ? actionCall.name : null
  const params = actionCall?.params && typeof actionCall.params === 'object' && !Array.isArray(actionCall.params)
    ? actionCall.params
    : {}

  if (actionName === 'vegaLite.setPointParam') {
    return {
      requestedParamName: typeof params.paramName === 'string' ? params.paramName : null,
      field: typeof params.field === 'string' ? params.field : null,
      values: Array.isArray(params.values) ? params.values.filter((value) => value !== undefined) : [],
      record: params.record && typeof params.record === 'object' && !Array.isArray(params.record) ? clone(params.record) : null,
      preferredProducerMarks: [],
    }
  }

  if (actionName === 'bar.selectCategory' || actionName === 'bar.clickCategory') {
    return {
      requestedParamName: null,
      field: typeof params.field === 'string' ? params.field : null,
      values: Array.isArray(params.values) ? params.values.filter((value) => value !== undefined) : [],
      record: null,
      preferredProducerMarks: ['bar'],
    }
  }

  if (actionName === 'bar.filterCategories') {
    return {
      requestedParamName: null,
      field: typeof params.field === 'string' ? params.field : null,
      values: Array.isArray(params.categories) ? params.categories.filter((value) => value !== undefined) : [],
      record: null,
      preferredProducerMarks: ['bar'],
    }
  }

  if (actionName === 'widget.filterByValues') {
    return {
      requestedParamName: null,
      field: typeof params.field === 'string' ? params.field : null,
      values: Array.isArray(params.values) ? params.values.filter((value) => value !== undefined) : [],
      record: null,
      preferredProducerMarks: [],
    }
  }

  if (actionName === 'line.selectSeries') {
    return {
      requestedParamName: null,
      field: typeof params.field === 'string' ? params.field : typeof params.lineField === 'string' ? params.lineField : null,
      values: Array.isArray(params.values) ? params.values.filter((value) => value !== undefined) : [],
      record: null,
      preferredProducerMarks: [],
    }
  }

  if (actionName === 'line.focusLines') {
    return {
      requestedParamName: null,
      field: typeof params.lineField === 'string' ? params.lineField : typeof params.field === 'string' ? params.field : null,
      values: Array.isArray(params.lines) ? params.lines.filter((value) => value !== undefined) : [],
      record: null,
      preferredProducerMarks: [],
    }
  }

  if (actionName === 'line.selectXValue') {
    const singleValue = params.value !== undefined ? [params.value] : []
    return {
      requestedParamName: null,
      field: typeof params.field === 'string' ? params.field : null,
      values: Array.isArray(params.values)
        ? params.values.filter((value) => value !== undefined)
        : singleValue,
      record: null,
      preferredProducerMarks: [],
    }
  }

  if (actionName === 'heatmap.selectCell' || actionName === 'heatmap.filterCells') {
    const record = {}
    if (typeof params.xField === 'string' && params.xValue !== undefined) {
      record[params.xField] = clone(params.xValue)
    }
    if (typeof params.yField === 'string' && params.yValue !== undefined) {
      record[params.yField] = clone(params.yValue)
    }
    return {
      requestedParamName: null,
      field: null,
      values: [],
      record: Object.keys(record).length > 0 ? record : null,
      preferredProducerMarks: [],
    }
  }

  if (actionName === 'heatmap.selectSubmatrix') {
    return {
      requestedParamName: null,
      field: null,
      values: [],
      record: null,
      xValues: Array.isArray(params.xValues) ? params.xValues.filter((value) => value !== undefined) : [],
      yValues: Array.isArray(params.yValues) ? params.yValues.filter((value) => value !== undefined) : [],
      preferredProducerMarks: [],
    }
  }

  return null
}

function resolvePointParamFields(spec, param) {
  const fields = new Set((Array.isArray(param?.fields) ? param.fields : []).filter((field) => typeof field === 'string' && field.length > 0))
  for (const [index, channel] of (Array.isArray(param?.encodings) ? param.encodings : []).entries()) {
    const resolvedField = resolveProducerFieldByChannel(spec, param, channel, index)
    if (typeof resolvedField === 'string' && resolvedField.length > 0) {
      fields.add(resolvedField)
    }
  }
  return [...fields]
}

function findMatchingPointParam(spec, params, intent) {
  const pointParams = (Array.isArray(params) ? params : []).filter((param) => param?.selectionType === 'point')
  if (typeof intent?.requestedParamName === 'string' && intent.requestedParamName.length > 0) {
    return pointParams.find((param) => param?.name === intent.requestedParamName) || null
  }

  const preferredMarks = Array.isArray(intent?.preferredProducerMarks) ? intent.preferredProducerMarks : []
  const matchingByField = pointParams.filter((param) => {
    const fields = resolvePointParamFields(spec, param)
    if (intent?.record && typeof intent.record === 'object' && !Array.isArray(intent.record)) {
      const recordFields = Object.keys(intent.record)
      return recordFields.length > 0 && recordFields.every((field) => fields.includes(field))
    }
    if (typeof intent?.field === 'string' && intent.field.length > 0) {
      return fields.includes(intent.field)
    }
    return false
  })
  if (matchingByField.length === 1) {
    return matchingByField[0]
  }
  if (matchingByField.length > 1 && preferredMarks.length > 0) {
    const preferred = matchingByField.find((param) => preferredMarks.includes(param?.producerMark))
    if (preferred) return preferred
  }
  if (matchingByField.length > 0) return matchingByField[0]

  if (pointParams.length === 1) {
    return pointParams[0]
  }
  if (pointParams.length > 1 && preferredMarks.length > 0) {
    const preferred = pointParams.find((param) => preferredMarks.includes(param?.producerMark))
    if (preferred) return preferred
  }
  return null
}

function buildPointSelectionValue(spec, param, intent) {
  if (intent?.record && typeof intent.record === 'object' && !Array.isArray(intent.record)) {
    return clone(intent.record)
  }

  const resolvedFields = resolvePointParamFields(spec, param)
  const resolvedXField = resolveProducerFieldByChannel(spec, param, 'x')
  const resolvedYField = resolveProducerFieldByChannel(spec, param, 'y')
  const values = Array.isArray(intent?.values) ? intent.values : []
  const explicitField = typeof intent?.field === 'string' && intent.field.length > 0 ? intent.field : null

  const hasMatrixValues = (
    (Array.isArray(intent?.xValues) && intent.xValues.length > 0)
    || (Array.isArray(intent?.yValues) && intent.yValues.length > 0)
  )
  if (hasMatrixValues) {
    const selectionValue = {}
    if (typeof resolvedXField === 'string' && resolvedXField.length > 0 && Array.isArray(intent?.xValues) && intent.xValues.length > 0) {
      selectionValue[resolvedXField] = intent.xValues.length === 1 ? clone(intent.xValues[0]) : clone(intent.xValues)
    }
    if (typeof resolvedYField === 'string' && resolvedYField.length > 0 && Array.isArray(intent?.yValues) && intent.yValues.length > 0) {
      selectionValue[resolvedYField] = intent.yValues.length === 1 ? clone(intent.yValues[0]) : clone(intent.yValues)
    }
    if (Object.keys(selectionValue).length > 0) {
      return selectionValue
    }
  }

  if (explicitField && values.length > 0) {
    return {
      [explicitField]: clone(values[0]),
    }
  }

  if (resolvedFields.length === 1 && values.length > 0) {
    return {
      [resolvedFields[0]]: clone(values[0]),
    }
  }

  if (resolvedFields.length > 1 && resolvedFields.length === values.length && values.length > 0) {
    return Object.fromEntries(resolvedFields.map((field, index) => [field, clone(values[index])]))
  }

  return null
}

function buildPointSelectionPredicates(spec, param, selectionValue) {
  if (!selectionValue || typeof selectionValue !== 'object' || Array.isArray(selectionValue)) return []
  const predicates = []
  const paramFields = resolvePointParamFields(spec, param)
  for (const [field, value] of Object.entries(selectionValue)) {
    if (paramFields.length > 0 && !paramFields.includes(field)) continue
    predicates.push({
      field,
      op: Array.isArray(value) ? 'in' : 'eq',
      value: clone(value),
    })
  }
  return predicates
}

function buildIntervalActionSelection(spec, actionCall = {}, param = {}) {
  const params = actionCall?.params && typeof actionCall.params === 'object' && !Array.isArray(actionCall.params)
    ? actionCall.params
    : {}
  const predicates = []
  const domain = {}

  const inferredXField = typeof params.xField === 'string'
    ? params.xField
    : resolveProducerFieldByChannel(spec, param, 'x')
  const inferredYField = typeof params.yField === 'string'
    ? params.yField
    : resolveProducerFieldByChannel(spec, param, 'y')
  const xRange = Array.isArray(params.xRange)
    ? params.xRange
    : Array.isArray(params.xDomain)
      ? params.xDomain
      : (params.start !== undefined && params.end !== undefined ? [params.start, params.end] : null)
  const yRange = Array.isArray(params.yRange)
    ? params.yRange
    : Array.isArray(params.yDomain)
      ? params.yDomain
      : null

  if (typeof inferredXField === 'string' && Array.isArray(xRange) && xRange.length >= 2) {
    predicates.push({
      field: inferredXField,
      op: 'between',
      value: [clone(xRange[0]), clone(xRange[1])],
    })
    domain.xDomain = [clone(xRange[0]), clone(xRange[1])]
  }

  if (typeof inferredYField === 'string' && Array.isArray(yRange) && yRange.length >= 2) {
    predicates.push({
      field: inferredYField,
      op: 'between',
      value: [clone(yRange[0]), clone(yRange[1])],
    })
    domain.yDomain = [clone(yRange[0]), clone(yRange[1])]
  }

  return {
    selectionId: typeof param?.name === 'string' ? param.name : 'interval',
    selectionRef: buildSelectionRefForWidget(actionCall?.target?.widgetRef?.split('/').pop() || null, param?.name || null),
    predicates,
    domain,
    summary: buildIntervalSelectionSummary(predicates, param?.name || null),
  }
}

function buildPointActionSelection(spec, actionCall = {}, param = {}) {
  const intent = normalizePointActionIntent(actionCall)
  const selectionValue = buildPointSelectionValue(spec, param, intent)
  if (!selectionValue) return null

  const predicates = buildPointSelectionPredicates(spec, param, selectionValue)
  return {
    selectionId: typeof param?.name === 'string' ? param.name : 'point',
    selectionRef: buildSelectionRefForWidget(actionCall?.target?.widgetRef?.split('/').pop() || null, param?.name || null),
    predicates,
    value: selectionValue,
    summary: buildPointSelectionSummary(predicates, param?.name || null),
  }
}

function resolveIntervalParam(params = [], actionCall = {}) {
  const actionParams = actionCall?.params && typeof actionCall.params === 'object' && !Array.isArray(actionCall.params)
    ? actionCall.params
    : {}
  const actionName = typeof actionCall?.name === 'string' ? actionCall.name : null
  const requestedParamName = typeof actionParams.paramName === 'string' ? actionParams.paramName : null
  const intervalParams = (Array.isArray(params) ? params : []).filter((param) => param?.selectionType === 'interval')
  if (requestedParamName) {
    return intervalParams.find((param) => param?.name === requestedParamName) || null
  }
  if (intervalParams.length > 1) {
    if (actionName === 'scatter.brushRegion') {
      const semanticBrushParam = intervalParams.find((param) => !param?.isScaleBound)
      if (semanticBrushParam) return semanticBrushParam
    }
    if (actionName === 'line.zoomXRegion') {
      const scaleBoundParam = intervalParams.find((param) => param?.isScaleBound)
      if (scaleBoundParam) return scaleBoundParam
    }
  }
  return intervalParams.length === 1 ? intervalParams[0] : null
}

function isIntervalLikeAction(actionCall = {}) {
  const actionName = typeof actionCall?.name === 'string' ? actionCall.name : null
  return (
    actionName === 'vegaLite.setIntervalParam'
    || actionName === 'line.zoomXRegion'
    || actionName === 'scatter.brushRegion'
    || actionName === 'scatter.zoomDomain'
  )
}

export function createOfficialPageParamActionDispatcher({
  widget,
  spec,
  interactionModel,
  sourceWidgetId = null,
  sourceWidgetRef = null,
  hostBridge = null,
} = {}) {
  const readCurrentSpec = typeof spec === 'function' ? spec : null
  const staticSpec = spec && typeof spec === 'object' && !Array.isArray(spec) ? spec : null

  const writeSelectionRegistry = (nextRegistry = {}) => {
    if (typeof hostBridge?.writeCurrentSelections === 'function') {
      hostBridge.writeCurrentSelections(nextRegistry, {
        primarySelectionRef: Object.keys(nextRegistry)[0] || null,
      })
      return true
    }
    return false
  }

  const readSelectionRegistry = () => {
    if (typeof hostBridge?.readCurrentSelections === 'function') {
      const registry = hostBridge.readCurrentSelections()
      return registry && typeof registry === 'object' && !Array.isArray(registry)
        ? clone(registry)
        : {}
    }
    return {}
  }

  const executeParamAction = async (actionCall) => {
    if (!isOfficialPageParamAction(actionCall)) {
      return null
    }
    const strictParamAction = isExplicitVegaLiteParamAction(actionCall)

    const spec = typeof readCurrentSpec === 'function'
      ? readCurrentSpec()
      : staticSpec
    const params = Array.isArray(interactionModel?.params) ? interactionModel.params : []

    if (actionCall?.name === 'widget.clearSelection' || actionCall?.name === 'widget.resetView') {
      writeSelectionRegistry({})
      return buildSuccessfulParamActionResult(actionCall, {
        widget,
        hostBridge,
        sourceWidgetRef,
        paramName: null,
        selectionId: actionCall.name,
        selectionRef: null,
        selectionKind: 'clear',
      })
    }

    if (actionCall?.name === 'vegaLite.clearParam') {
      const actionParams = actionCall?.params && typeof actionCall.params === 'object' && !Array.isArray(actionCall.params)
        ? actionCall.params
        : {}
      const paramName = typeof actionParams.paramName === 'string' ? actionParams.paramName : null
      if (!paramName) {
        return makeOfficialPageParamActionFailureResult(
          actionCall,
          'The clear-param action did not include a paramName.',
        )
      }
      const currentRegistry = readSelectionRegistry()
      const nextRegistry = Object.fromEntries(
        Object.entries(currentRegistry).filter(([, selection]) => {
          const selectionId = selection?.selectionId || selection?.selection_id || null
          return selectionId !== paramName
        }),
      )
      writeSelectionRegistry(nextRegistry)
      return buildSuccessfulParamActionResult(actionCall, {
        widget,
        hostBridge,
        sourceWidgetRef,
        paramName,
        selectionId: paramName,
        selectionRef: null,
        selectionKind: 'clear',
      })
    }

    if (isIntervalLikeAction(actionCall)) {
      const param = resolveIntervalParam(params, actionCall)
      if (!param) {
        if (!strictParamAction) {
          return null
        }
        return makeOfficialPageParamActionFailureResult(
          actionCall,
          'The requested interval-param action did not match a recognized Vega-Lite interval selection on this page.',
        )
      }
      const nextSelection = buildIntervalActionSelection(spec, actionCall, param)
      const selectionRef = nextSelection.selectionRef || buildSelectionRefForWidget(sourceWidgetId, param.name)
      const nextRegistry = {
        ...readSelectionRegistry(),
        [selectionRef]: buildSharedSelectionEntry({
          sourceWidgetId,
          sourceWidgetRef,
          selectionId: param.name,
          selectionRef,
          selectionKind: 'interval',
          summary: nextSelection.summary,
          predicates: nextSelection.predicates,
          value: {},
          domain: nextSelection.domain,
        }),
      }
      writeSelectionRegistry(nextRegistry)
      return buildSuccessfulParamActionResult(actionCall, {
        widget,
        hostBridge,
        sourceWidgetRef,
        paramName: param.name,
        selectionId: param.name,
        selectionRef,
        selectionKind: 'interval',
      })
    }

    const pointIntent = normalizePointActionIntent(actionCall)
    const pointParam = findMatchingPointParam(spec, params, pointIntent)
    if (!pointParam) {
      if (!strictParamAction) {
        return null
      }
      return makeOfficialPageParamActionFailureResult(
        actionCall,
        'The requested point-param action did not match a recognized Vega-Lite point selection on this page.',
      )
    }

    const nextSelection = buildPointActionSelection(spec, actionCall, pointParam)
    if (!nextSelection) {
      if (!strictParamAction) {
        return null
      }
      return makeOfficialPageParamActionFailureResult(
        actionCall,
        'The requested point-param action could not be converted into a shared selection value for this page.',
      )
    }

    const selectionRef = nextSelection.selectionRef || buildSelectionRefForWidget(sourceWidgetId, pointParam.name)
    const nextRegistry = {
      ...readSelectionRegistry(),
      [selectionRef]: buildSharedSelectionEntry({
        sourceWidgetId,
        sourceWidgetRef,
        selectionId: pointParam.name,
        selectionRef,
        selectionKind: 'point',
        summary: nextSelection.summary,
        predicates: nextSelection.predicates,
        value: nextSelection.value,
        domain: null,
      }),
    }
    writeSelectionRegistry(nextRegistry)
    return buildSuccessfulParamActionResult(actionCall, {
      widget,
      hostBridge,
      sourceWidgetRef,
      paramName: pointParam.name,
      selectionId: pointParam.name,
      selectionRef,
      selectionKind: 'point',
    })
  }

  const executeVerifiedParamAction = async (actionCall, options = {}) => {
    const beforeStateId = readActionResultStateId(widget)
    const actionResult = await executeParamAction(actionCall)
    if (!actionResult) return null
    if (!actionResult.ok) {
      return makeOfficialPageVerifiedParamActionFailureResult(
        actionCall,
        options,
        widget,
        actionResult?.result?.reason || 'The requested action did not map to a recognized WidgetVA shared-state selection update.',
      )
    }
    return makeVerifiedActionResult({
      ok: true,
      beforeStateId,
      actionResult,
      afterView: clone(widget?.readWorkspaceState?.({
        refs: [],
        deltaSince: options?.includeDeltaSince ? beforeStateId : undefined,
      }) || null),
      verification: options?.verify === false ? null : {
        ok: true,
        callId: `${actionCall?.callId || 'official_page_param'}_verify`,
        queryName: 'perception.verifyActionEffect',
        result: {
          verified: true,
          matchedActionName: actionCall?.name || null,
          matchedStateId: actionResult?.stateId || null,
        },
      },
      verificationHints: [],
    })
  }

  return {
    executeParamAction,
    executeVerifiedParamAction,
  }
}

export function createOfficialPageActionDispatchProxy(target, {
  executeParamAction,
  executeVerifiedParamAction,
  syncAfterAction,
} = {}) {
  if (!target || typeof target !== 'object') return target
  if (typeof executeParamAction !== 'function' && typeof executeVerifiedParamAction !== 'function') return target

  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop !== 'executeAction' && prop !== 'executeVerifiedAction') {
        return Reflect.get(obj, prop, receiver)
      }
      const original = Reflect.get(obj, prop, receiver)
      if (typeof original !== 'function') return original
      return async (actionCall, options = {}) => {
        if (!isOfficialPageParamAction(actionCall)) {
          return original.call(obj, actionCall, options)
        }
        const strictParamAction = isExplicitVegaLiteParamAction(actionCall)
        const rematerializedResult = prop === 'executeVerifiedAction'
          ? await executeVerifiedParamAction?.(actionCall, options)
          : await executeParamAction?.(actionCall, options)
        if (rematerializedResult?.ok && typeof syncAfterAction === 'function') {
          await syncAfterAction()
        }
        if (rematerializedResult) return rematerializedResult
        if (!strictParamAction) {
          return original.call(obj, actionCall, options)
        }
        if (prop === 'executeVerifiedAction') {
          return makeOfficialPageVerifiedParamActionFailureResult(
            actionCall,
            options,
            obj,
            'The requested action did not map to a recognized WidgetVA shared-state selection update.',
          )
        }
        return makeOfficialPageParamActionFailureResult(
          actionCall,
          'The requested action did not map to a recognized WidgetVA shared-state selection update.',
        )
      }
    },
  })
}
