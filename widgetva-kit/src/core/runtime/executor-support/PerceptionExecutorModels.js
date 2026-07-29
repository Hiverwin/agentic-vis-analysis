import { cloneJsonValue as cloneValue } from '../../../shared/clone.js'
import { createDefaultWidgetVAHostBridge } from '../../../host/hostBridge.js'
import {
  listStoreWidgets,
  readDataHandleFromStore,
  readRuntimeDataFromStore,
  readWorkspaceDescriptionFromStore,
  readWorkspaceStateFromStore,
  resolveSelectionDataRefFromStore,
  resolveWidgetRecordFromStore,
} from '../../../workspace/store/workspaceStoreReaders.js'
import { makePerceptionResult, makeResultError } from '../../../contracts/result-contracts.js'
import { readSelectionRegistry } from '../../../workspace/state/selectionStateModel.js'
import { readFocusState } from '../../../workspace/state/focusStateModel.js'
import { deriveHighlightState } from '../../../workspace/state/highlightStateModel.js'
import {
  buildScopedParams,
  hasScopedQueryScopeValues,
  readNormalizedQueryScope,
  readScopedQueryScope,
} from '../support/queryScope.js'
import { resolveImplicitSelectionRefForWidget } from '../support/implicitQueryScope.js'

function widgetMatchesKind(widget, kind) {
  if (!widget || !kind) return Boolean(widget)
  if (widget.kind === kind) return true
  return Array.isArray(widget.recognizedKinds) && widget.recognizedKinds.includes(kind)
}

function makePerceptionHandlerContextCapabilities(capabilities = {}) {
  return {
    workspaceRead: false,
    runtimeDataRead: false,
    widgetTargetResolution: false,
    dataHandleResolution: false,
    selectionScopedQueries: false,
    traceRecording: false,
    ...capabilities,
  }
}

function makePerceptionHandlerContextIntegrations(integrations = {}) {
  return {
    store: false,
    traceRecorder: false,
    ...integrations,
  }
}

function makePerceptionHandlerContextSummary(summary = {}) {
  return {
    methods: Array.isArray(summary?.methods) ? [...summary.methods] : [],
    capabilities: makePerceptionHandlerContextCapabilities(summary?.capabilities),
    integrations: makePerceptionHandlerContextIntegrations(summary?.integrations),
  }
}

export class PerceptionHandlerContext {
  constructor({
    store,
    descriptor,
    call,
    traceRecorder,
    hostBridge,
  }) {
    this.store = store
    this.descriptor = descriptor
    this.call = call
    this.traceRecorder = traceRecorder
    this.hostBridge = hostBridge || createDefaultWidgetVAHostBridge()
    this.pendingQueryTrace = null
  }

  static describeContract() {
    return makePerceptionHandlerContextSummary({
      methods: [
        'readDescription',
        'readCurrentState',
        'readSelectionRegistry',
        'readFocusState',
        'readHighlightState',
        'readQueryScope',
        'readCallParams',
        'readFocusedWidgetRef',
        'resolveTargetWidget',
        'requireTargetWidget',
        'resolveSelectionDataRef',
        'resolveDataRefForWidget',
        'resolveRowsForWidget',
        'recordQuery',
      ],
      capabilities: makePerceptionHandlerContextCapabilities({
        workspaceRead: true,
        runtimeDataRead: true,
        widgetTargetResolution: true,
        dataHandleResolution: true,
        selectionScopedQueries: true,
        traceRecording: true,
      }),
      integrations: makePerceptionHandlerContextIntegrations({
        store: true,
        traceRecorder: true,
      }),
    })
  }

  readDescription() {
    return readWorkspaceDescriptionFromStore(this.store)
  }

  readCurrentState(options = {}) {
    return readWorkspaceStateFromStore(this.store, options)
  }

  readSelectionRegistry() {
    const hostRegistry = this.hostBridge.readSelectionRegistry?.()
    if (
      hostRegistry
      && typeof hostRegistry === 'object'
      && !Array.isArray(hostRegistry)
      && Object.keys(hostRegistry).length > 0
    ) {
      return hostRegistry
    }
    return readSelectionRegistry(this.readCurrentState()?.shared || {})
  }

  readFocusState() {
    const hostFocusState = this.hostBridge.readFocusState?.()
    if (hostFocusState && typeof hostFocusState === 'object' && !Array.isArray(hostFocusState)) {
      return hostFocusState
    }
    const currentState = this.readCurrentState()
    return readFocusState(currentState?.shared || {}, currentState?.widgets || {})
  }

  readHighlightState() {
    const hostHighlightState = this.hostBridge.readHighlightState?.()
    if (hostHighlightState && typeof hostHighlightState === 'object' && !Array.isArray(hostHighlightState)) {
      return hostHighlightState
    }
    return deriveHighlightState(this.readCurrentState() || {})
  }

  readQueryScope() {
    return readNormalizedQueryScope({
      call: this.call,
      descriptor: this.descriptor,
    })
  }

  readCallParams() {
    return this.normalizeScopedParams(this.call?.params || {})
  }

  readFocusedWidgetRef() {
    const hostFocusedWidgetRef = this.hostBridge.readFocusedWidgetRef?.()
    if (typeof hostFocusedWidgetRef === 'string' && hostFocusedWidgetRef.length > 0) {
      return hostFocusedWidgetRef
    }
    const hostFocusWidgetRef = this.readFocusState()?.widgetRef
    if (typeof hostFocusWidgetRef === 'string' && hostFocusWidgetRef.length > 0) {
      return hostFocusWidgetRef
    }
    return this.readCurrentState()?.shared?.focusedWidget || null
  }

  readPrimarySelectionRef() {
    const hostPrimarySelectionRef = this.hostBridge.readPrimarySelectionRef?.()
    if (typeof hostPrimarySelectionRef === 'string' && hostPrimarySelectionRef.length > 0) {
      return hostPrimarySelectionRef
    }
    return this.readCurrentState()?.shared?.selections?.views?.primary?.selectionRef || null
  }

  resolveImplicitSelectionRefForWidget(targetWidget, queryScope = null) {
    return resolveImplicitSelectionRefForWidget({
      targetWidget,
      explicitSelectionRef: queryScope?.selectionRef || null,
      selectionRegistry: this.readSelectionRegistry() || {},
      primarySelectionRef: this.readPrimarySelectionRef(),
    })
  }

  resolveTargetWidget({ kind, targetRef } = {}) {
    const resolvedRef = targetRef || this.readQueryScope()?.widgetRef || null
    if (resolvedRef) {
      const explicitTarget = resolveWidgetRecordFromStore(this.store, resolvedRef)
      if (explicitTarget && widgetMatchesKind(explicitTarget, kind)) {
        return explicitTarget
      }
      return null
    }

    const focusedWidgetRef = this.readFocusedWidgetRef()
    if (focusedWidgetRef) {
      const focusedWidget = resolveWidgetRecordFromStore(this.store, focusedWidgetRef)
      if (focusedWidget && widgetMatchesKind(focusedWidget, kind)) return focusedWidget
    }

    const widgets = listStoreWidgets(this.store)
    if (kind) {
      const match = widgets.find((widget) => widgetMatchesKind(widget, kind)) || null
      return match
        ? resolveWidgetRecordFromStore(this.store, match.ref) || match
        : null
    }
    const firstWidget = widgets[0] || null
    return firstWidget
      ? resolveWidgetRecordFromStore(this.store, firstWidget.ref) || firstWidget
      : null
  }

  requireTargetWidget({ kind = null, targetRef = null, message = null } = {}) {
    const targetWidget = this.resolveTargetWidget({ kind, targetRef })
    if (targetWidget) return targetWidget
    if (message) {
      throw new Error(message)
    }
    if (kind) {
      throw new Error(`No active ${kind} widget in the current workspace.`)
    }
    throw new Error('No active widget/spec in the current workspace.')
  }

  resolveSelectionDataRef(selectionRef) {
    if (!selectionRef) return null
    const resolvedDataRef = resolveSelectionDataRefFromStore(this.store, selectionRef)
    if (!resolvedDataRef) return null
    if (readDataHandleFromStore(this.store, resolvedDataRef) || readRuntimeDataFromStore(this.store, resolvedDataRef)) {
      return resolvedDataRef
    }
    return null
  }

  resolveCompositePrimarySelectionDataRef(targetWidget = null) {
    if (targetWidget?.kind !== 'custom') return null
    const currentState = this.readCurrentState() || {}
    const selectionRegistry = this.readSelectionRegistry() || {}
    const primarySelectionRef = this.readPrimarySelectionRef()
    if (primarySelectionRef) {
      const dataRef = this.resolveSelectionDataRef(primarySelectionRef)
      if (dataRef) return dataRef
    }

    const resolveWidgetDataRefForSelection = (selectionRef) => {
      if (!selectionRef) return null
      const sourceWidget = Object.values(currentState?.widgets || {})
        .find((widget) => widget?.selections?.[selectionRef]) || null
      return sourceWidget?.data?.currentDataRef
        || sourceWidget?.data?.sourceDataRef
        || sourceWidget?.primaryDataRef
        || null
    }

    if (primarySelectionRef) {
      const sourceWidgetDataRef = resolveWidgetDataRefForSelection(primarySelectionRef)
      if (sourceWidgetDataRef) return sourceWidgetDataRef
    }

    const focusedWidgetRef = this.readFocusedWidgetRef()
    const focusedWidget = focusedWidgetRef ? resolveWidgetRecordFromStore(this.store, focusedWidgetRef) : null
    if (focusedWidget) {
      const implicitFocusedSelectionRef = resolveImplicitSelectionRefForWidget({
        targetWidget: focusedWidget,
        selectionRegistry,
        primarySelectionRef,
      })
      const dataRef = this.resolveSelectionDataRef(implicitFocusedSelectionRef)
      if (dataRef) return dataRef
      const sourceWidgetDataRef = resolveWidgetDataRefForSelection(implicitFocusedSelectionRef)
      if (sourceWidgetDataRef) return sourceWidgetDataRef
      const focusedWidgetDataRef = focusedWidget?.data?.currentDataRef
        || focusedWidget?.data?.sourceDataRef
        || focusedWidget?.primaryDataRef
        || null
      if (focusedWidgetDataRef) return focusedWidgetDataRef
    }

    const selectionRefs = Object.keys(selectionRegistry).filter(Boolean)
    if (selectionRefs.length === 1) {
      return this.resolveSelectionDataRef(selectionRefs[0]) || resolveWidgetDataRefForSelection(selectionRefs[0])
    }

    return null
  }

  normalizeScopedParams(params = {}, options = {}) {
    return buildScopedParams({
      params,
      call: options?.call || this.call,
      descriptor: options?.descriptor || this.descriptor,
      querySpec: options?.querySpec || null,
    })
  }

  resolveDataRefForWidget(targetWidget, params = {}) {
    const scopedParams = this.normalizeScopedParams(params)
    const queryScope = scopedParams?.queryScope || null
    const explicitDataRef = queryScope?.dataRef || null
    if (typeof explicitDataRef === 'string' && explicitDataRef.length > 0) {
      return explicitDataRef
    }

    const callTargetRef = this.readQueryScope()?.widgetRef || null
    const implicitSelectionRef = this.resolveImplicitSelectionRefForWidget(targetWidget, queryScope)
    const selectionScopedDataRef = this.resolveSelectionDataRef(implicitSelectionRef || callTargetRef)
    if (selectionScopedDataRef) {
      return selectionScopedDataRef
    }

    const compositePrimarySelectionDataRef = this.resolveCompositePrimarySelectionDataRef(targetWidget)
    if (compositePrimarySelectionDataRef) {
      return compositePrimarySelectionDataRef
    }

    if (typeof callTargetRef === 'string' && (
      readDataHandleFromStore(this.store, callTargetRef) || readRuntimeDataFromStore(this.store, callTargetRef)
    )) {
      return callTargetRef
    }

    return (
      targetWidget?.data?.currentDataRef ||
      targetWidget?.data?.sourceDataRef ||
      targetWidget?.primaryDataRef ||
      null
    )
  }

  resolveRowsForWidget(targetWidget, params = {}) {
    const scopedParams = this.normalizeScopedParams(params)
    const queryScope = scopedParams?.queryScope || null
    const targetDataRef = this.resolveDataRefForWidget(targetWidget, scopedParams)
    const runtimeData = readRuntimeDataFromStore(this.store, targetDataRef)
    let rows = Array.isArray(runtimeData?.rows) ? runtimeData.rows : []
    const selectionRef = this.resolveImplicitSelectionRefForWidget(targetWidget, queryScope)

    if (selectionRef) {
      const selectionState = this.readSelectionRegistry()?.[selectionRef] || null
      const baseDataRef =
        targetWidget?.data?.currentDataRef ||
        targetWidget?.data?.sourceDataRef ||
        targetWidget?.primaryDataRef ||
        null
      const baseRuntimeData = readRuntimeDataFromStore(this.store, baseDataRef)
      const baseRows = Array.isArray(baseRuntimeData?.rows) ? baseRuntimeData.rows : []
      const predicates = Array.isArray(selectionState?.predicates) ? selectionState.predicates : []
      if ((!runtimeData || targetDataRef === baseDataRef) && predicates.length > 0) {
        rows = baseRows.filter((row) =>
          predicates.every((predicate) => applyPredicate(row, predicate)),
        )
      }
    }

    return {
      dataRef: targetDataRef,
      rows,
    }
  }

  recordQuery({ affectedRefs = [], notes } = {}) {
    this.pendingQueryTrace = {
      call: this.call,
      affectedRefs,
      notes,
    }
  }

  consumeRecordedQuery() {
    const pending = this.pendingQueryTrace
    this.pendingQueryTrace = null
    return pending
  }
}

function applyPredicate(row, predicate) {
  const value = row?.[predicate?.field]
  if (predicate?.op === 'between' && Array.isArray(predicate?.value)) {
    return value >= predicate.value[0] && value <= predicate.value[1]
  }
  if (predicate?.op === 'equals' || predicate?.op === 'eq') return value === predicate?.value
  if (predicate?.op === 'in' && Array.isArray(predicate?.value)) {
    return predicate.value.includes(value)
  }
  if (predicate?.op === 'notIn' && Array.isArray(predicate?.value)) {
    return !predicate.value.includes(value)
  }
  return true
}

export function makePerceptionRegistryCounts(counts = {}) {
  return {
    descriptorCount: 0,
    handlerEntryCount: 0,
    ...counts,
  }
}

export function makePerceptionRegistryCapabilities(capabilities = {}) {
  return {
    paramsValidation: true,
    returnsValidation: true,
    traceRecording: false,
    linkPropagationEvidence: false,
    ...capabilities,
  }
}

export function makePerceptionRegistryQueryEntry(entry = {}) {
  return {
    name: '',
    category: null,
    targetRef: null,
    handlerVariantCount: 0,
    sideEffectFree: true,
    evidenceKinds: [],
    verificationTargets: [],
    supportedWidgetKinds: null,
    ...entry,
  }
}

export function makePerceptionRegistrySummary(summary = {}) {
  return {
    queries: [],
    ...summary,
    counts: makePerceptionRegistryCounts(summary?.counts),
    capabilities: makePerceptionRegistryCapabilities(summary?.capabilities),
    queries: Array.isArray(summary?.queries)
      ? summary.queries.map((query) => makePerceptionRegistryQueryEntry(query))
      : [],
  }
}

export function buildQueryError({ call, code, message, details, recoveryHints }) {
  return makePerceptionResult({
    ok: false,
    callId: call?.callId || `query_${Date.now()}`,
    queryName: call?.name || 'unknown',
    error: makeResultError({
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    }),
    ...(Array.isArray(recoveryHints) && recoveryHints.length > 0 ? { recoveryHints } : {}),
  })
}

export function resolveCallTargetRef(call, descriptor) {
  return readNormalizedQueryScope({ call, descriptor }).widgetRef || null
}

export function resolveWidgetSelections(targetWidget) {
  return Object.entries(targetWidget?.selections || {})
    .map(([selectionRef, selectionState]) => ({
      ref: selectionRef,
      selection: selectionState,
    }))
    .filter((entry) => entry.ref && entry.selection)
}

export function resolveRequestedSelectionEntries(targetWidget, requestedSelectionRef = null) {
  const selectionEntries = resolveWidgetSelections(targetWidget)
  if (!requestedSelectionRef) return selectionEntries
  return selectionEntries.filter((entry) => entry.ref === requestedSelectionRef)
}

export function formatSummaryText({ rowCount = 0, groupCount = 0, fallback = '' } = {}) {
  if (typeof fallback === 'string' && fallback.trim().length > 0) return fallback.trim()
  if (groupCount > 0) return `${groupCount} grouped summaries over ${rowCount} rows`
  return `${rowCount} rows`
}

function hasEncodingChannels(encoding = null) {
  return Boolean(
    encoding
    && typeof encoding === 'object'
    && !Array.isArray(encoding)
    && Object.keys(encoding).length > 0,
  )
}

function collectSpecEncodings(spec = null, path = 'spec', entries = []) {
  if (!spec || typeof spec !== 'object') return entries
  if (hasEncodingChannels(spec.encoding)) {
    entries.push({
      path,
      channels: Object.keys(spec.encoding),
      encoding: cloneValue(spec.encoding),
    })
  }
  for (const key of ['layer', 'vconcat', 'hconcat', 'concat']) {
    if (!Array.isArray(spec[key])) continue
    spec[key].forEach((child, index) => {
      collectSpecEncodings(child, `${path}.${key}[${index}]`, entries)
    })
  }
  if (spec.spec && typeof spec.spec === 'object') {
    collectSpecEncodings(spec.spec, `${path}.spec`, entries)
  }
  return entries
}

export function resolveViewConfigEncodings(targetWidget = null) {
  if (hasEncodingChannels(targetWidget?.encodings)) {
    return cloneValue(targetWidget.encodings)
  }
  const currentSpec = targetWidget?.currentSpec || targetWidget?.rawSpec || targetWidget?.spec || null
  const entries = collectSpecEncodings(currentSpec)
  if (entries.length === 0) {
    return cloneValue(targetWidget?.encodings || {})
  }
  if (entries.length === 1) {
    return entries[0].encoding
  }
  return {
    representative: entries[0].encoding,
    views: entries,
  }
}

function readRootEncoding(spec) {
  if (Array.isArray(spec?.layer) && spec.layer.length > 0) {
    return spec.layer[0]?.encoding || spec.encoding || {}
  }
  return spec?.encoding || {}
}

function isParallelFoldSpec(spec = null) {
  const transforms = Array.isArray(spec?.transform) ? spec.transform : []
  const hasFoldTransform = transforms.some((transform) => Array.isArray(transform?.fold) && transform.fold.length > 0)
  if (!hasFoldTransform) return false
  const encoding = readRootEncoding(spec)
  return ['dimension', 'key', 'variable'].includes(encoding?.x?.field)
}

export function countSemanticSelectionRows({ widgetKind = null, spec = null, rows = [] } = {}) {
  const safeRows = Array.isArray(rows) ? rows : []
  if (widgetKind !== 'parallelCoordinates' && !isParallelFoldSpec(spec)) return safeRows.length

  const encoding = readRootEncoding(spec)
  const recordField = typeof encoding?.detail?.field === 'string' && encoding.detail.field.length > 0
    ? encoding.detail.field
    : null
  if (!recordField) return safeRows.length

  return new Set(
    safeRows
      .map((row) => row?.[recordField])
      .filter((value) => value != null)
      .map((value) => JSON.stringify(value)),
  ).size
}

export function normalizeSemanticVisibleRows({ widgetKind = null, spec = null, rows = [] } = {}) {
  const safeRows = Array.isArray(rows) ? rows : []
  if (widgetKind !== 'parallelCoordinates' && !isParallelFoldSpec(spec)) {
    return {
      visibleRows: safeRows,
      visibleCount: safeRows.length,
    }
  }

  const encoding = readRootEncoding(spec)
  const recordField = typeof encoding?.detail?.field === 'string' && encoding.detail.field.length > 0
    ? encoding.detail.field
    : null
  if (!recordField) {
    return {
      visibleRows: safeRows,
      visibleCount: safeRows.length,
    }
  }

  const dedupedRows = []
  const seen = new Set()
  for (const row of safeRows) {
    const recordValue = row?.[recordField]
    if (recordValue == null) continue
    const key = JSON.stringify(recordValue)
    if (seen.has(key)) continue
    seen.add(key)
    dedupedRows.push(row)
  }

  return {
    visibleRows: dedupedRows,
    visibleCount: countSemanticSelectionRows({ widgetKind, spec, rows: safeRows }),
  }
}

export function buildPerceptionTraceNotes({ userVisibleSummary, rationale = null, verification = null } = {}) {
  return {
    ...(typeof userVisibleSummary === 'string' && userVisibleSummary.trim().length > 0
      ? { userVisibleSummary: userVisibleSummary.trim() }
      : {}),
    ...(typeof rationale === 'string' && rationale.trim().length > 0
      ? { rationale: rationale.trim() }
      : {}),
    ...(typeof verification === 'string' && verification.trim().length > 0
      ? { verification: verification.trim() }
      : {}),
  }
}

export function summarizeSupportedWidgetKinds(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return null
  const collectedKinds = Array.from(
    new Set(
      entries.flatMap((entry) => (
        Array.isArray(entry?.supportedWidgetKinds)
          ? entry.supportedWidgetKinds
          : []
      )).filter((kind) => typeof kind === 'string' && kind.length > 0),
    ),
  )
  return collectedKinds.length > 0 ? collectedKinds : null
}

export function buildHandlerInput(call, descriptor) {
  const params = buildScopedParams({
    params: call?.params || {},
    call,
    descriptor,
  })
  const queryScope = readScopedQueryScope({ call, descriptor })
  const scopedParams = {
    ...params,
    ...(hasScopedQueryScopeValues(queryScope) && !params.queryScope ? { queryScope } : {}),
  }
  const {
    targetRef: _legacyTargetRef,
    dataRef: _legacyDataRef,
    params: _legacyParams,
    queryScope: _legacyQueryScope,
    ...rawCall
  } = call && typeof call === 'object' ? call : {}
  const input = {
    ...rawCall,
    ...scopedParams,
    params: scopedParams,
    queryScope: scopedParams.queryScope || null,
  }
  delete input.targetRef
  delete input.dataRef
  return input
}

export function buildPerceptionCallSchemaInput(call) {
  const {
    targetRef: _legacyTargetRef,
    dataRef: _legacyDataRef,
    queryScope: _legacyQueryScope,
    ...rawCall
  } = call && typeof call === 'object' ? call : {}
  const queryScope = readScopedQueryScope({ call })
  return {
    ...rawCall,
    ...(hasScopedQueryScopeValues(queryScope) ? { queryScope } : {}),
  }
}
