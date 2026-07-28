import { validateAgainstSchema } from './support/schemaValidation.js'
import { evaluateActionEffectVerification } from './verification/actionEffectVerification.js'
import { DataQueryExecutor } from './DataQueryExecutor.js'
import { createDefaultWidgetVAHostBridge } from '../../host/hostBridge.js'
import {
  listStoreWidgets,
  readDataHandleFromStore,
  readRuntimeDataFromStore,
  readSnapshotFromStore,
  readWorkspaceDescriptionFromStore,
  readWorkspaceStateFromStore,
  resolveSelectionDataRefFromStore,
  resolveWidgetRecordFromStore,
} from '../../workspace/store/workspaceStoreReaders.js'
import { makePerceptionResult, makeResultError } from '../../contracts/result-contracts.js'
import { readSelectionRegistry } from '../../workspace/state/selectionStateModel.js'
import { readFocusState } from '../../workspace/state/focusStateModel.js'
import { deriveHighlightState } from '../../workspace/state/highlightStateModel.js'
import {
  buildScopedParams,
  hasScopedQueryScopeValues,
  readNormalizedQueryScope,
  readScopedQueryScope,
} from './support/queryScope.js'
import { resolveImplicitSelectionRefForWidget } from './support/implicitQueryScope.js'
import { PERCEPTION_QUERY_CALL_SCHEMA } from '../../schemas/perception.schema.js'

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

class PerceptionHandlerContext {
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

function makePerceptionRegistryCounts(counts = {}) {
  return {
    descriptorCount: 0,
    handlerEntryCount: 0,
    ...counts,
  }
}

function makePerceptionRegistryCapabilities(capabilities = {}) {
  return {
    paramsValidation: true,
    returnsValidation: true,
    traceRecording: false,
    linkPropagationEvidence: false,
    ...capabilities,
  }
}

function makePerceptionRegistryQueryEntry(entry = {}) {
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

function makePerceptionRegistrySummary(summary = {}) {
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

function buildQueryError({ call, code, message, details, recoveryHints }) {
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

function resolveCallTargetRef(call, descriptor) {
  return readNormalizedQueryScope({ call, descriptor }).widgetRef || null
}

function resolveWidgetSelections(targetWidget) {
  return Object.entries(targetWidget?.selections || {})
    .map(([selectionRef, selectionState]) => ({
      ref: selectionRef,
      selection: selectionState,
    }))
    .filter((entry) => entry.ref && entry.selection)
}

function resolveRequestedSelectionEntries(targetWidget, requestedSelectionRef = null) {
  const selectionEntries = resolveWidgetSelections(targetWidget)
  if (!requestedSelectionRef) return selectionEntries
  return selectionEntries.filter((entry) => entry.ref === requestedSelectionRef)
}

function formatSummaryText({ rowCount = 0, groupCount = 0, fallback = '' } = {}) {
  if (typeof fallback === 'string' && fallback.trim().length > 0) return fallback.trim()
  if (groupCount > 0) return `${groupCount} grouped summaries over ${rowCount} rows`
  return `${rowCount} rows`
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
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

function resolveViewConfigEncodings(targetWidget = null) {
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

function countSemanticSelectionRows({ widgetKind = null, spec = null, rows = [] } = {}) {
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

function normalizeSemanticVisibleRows({ widgetKind = null, spec = null, rows = [] } = {}) {
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

function buildPerceptionTraceNotes({ userVisibleSummary, rationale = null, verification = null } = {}) {
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

function summarizeSupportedWidgetKinds(entries = []) {
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

function buildHandlerInput(call, descriptor) {
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

function buildPerceptionCallSchemaInput(call) {
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

export class PerceptionExecutor {
  constructor({ store, dataQueryEngine, dataQueryExecutor, traceRecorder, coordinationEngine, hostBridge } = {}) {
    this.store = store || {
      listPerceptionQueries() {
        return []
      },
      getPerceptionDescriptor() {
        return null
      },
      listWidgetDescriptions() {
        return []
      },
      getResolvedWidgetForTarget() {
        return null
      },
      getResolvedWidget() {
        return null
      },
      getWidgetDescription() {
        return null
      },
      readState() {
        return {}
      },
    }
    this.dataQueryEngine = dataQueryEngine || null
    this.traceRecorder = traceRecorder || null
    this.hostBridge = hostBridge || createDefaultWidgetVAHostBridge()
    this.dataQueryExecutor = dataQueryExecutor
      || (this.dataQueryEngine
        ? new DataQueryExecutor({
            store: this.store,
            dataQueryEngine: this.dataQueryEngine,
            traceRecorder: this.traceRecorder,
            hostBridge: this.hostBridge,
          })
        : null)
    this.coordinationEngine = coordinationEngine || null
    this.builtinDescriptors = new Map()
    this.handlerEntries = new Map()
    this.registerBuiltinQueries()
  }

  register(descriptor, handler, options = {}) {
    if (!descriptor?.name || typeof handler !== 'function') {
      throw new Error('PerceptionExecutor.register requires a descriptor.name and handler.')
    }
    const supportedWidgetKinds = normalizeSupportedWidgetKinds(
      options.supportedWidgetKinds || descriptor.supportedWidgetKinds || null,
    )
    const entries = this.handlerEntries.get(descriptor.name) || []
    if (entries.some((entry) => sameSupportedKinds(entry.supportedWidgetKinds, supportedWidgetKinds))) {
      throw new Error(`Duplicate perception query registration: ${descriptor.name}`)
    }
    this.builtinDescriptors.set(descriptor.name, descriptor)
    this.handlerEntries.set(descriptor.name, [
      ...entries,
      {
        descriptor,
        handler,
        supportedWidgetKinds,
      },
    ])
  }

  list() {
    const descriptors = this.store.listPerceptionQueries()
    if (descriptors.length > 0) {
      return descriptors.filter((descriptor) => this.handlerEntries.has(descriptor.name))
    }
    return Array.from(this.builtinDescriptors.values())
  }

  has(name, options = {}) {
    const entries = this.handlerEntries.get(name) || []
    const supportedWidgetKinds = normalizeSupportedWidgetKinds(options.supportedWidgetKinds || null)
    if (!supportedWidgetKinds) return entries.length > 0
    return entries.some((entry) => sameSupportedKinds(entry.supportedWidgetKinds, supportedWidgetKinds))
  }

  describeRegistry() {
    const queries = this.list().map((descriptor) => {
      const handlerEntries = this.handlerEntries.get(descriptor.name) || []
      return makePerceptionRegistryQueryEntry({
        name: descriptor.name,
        category: descriptor.category || null,
        targetRef: descriptor.targetRef || null,
        sideEffectFree: descriptor.sideEffectFree !== false,
        evidenceKinds: Array.isArray(descriptor.evidenceKinds) ? [...descriptor.evidenceKinds] : [],
        verificationTargets: Array.isArray(descriptor.verificationTargets) ? [...descriptor.verificationTargets] : [],
        supportedWidgetKinds: summarizeSupportedWidgetKinds(handlerEntries),
        handlerVariantCount: handlerEntries.length,
      })
    })
    let handlerEntryCount = 0
    for (const entries of this.handlerEntries.values()) {
      handlerEntryCount += Array.isArray(entries) ? entries.length : 0
    }
    return makePerceptionRegistrySummary({
      counts: makePerceptionRegistryCounts({
        descriptorCount: queries.length,
        handlerEntryCount,
      }),
      capabilities: makePerceptionRegistryCapabilities({
        paramsValidation: true,
        returnsValidation: true,
        traceRecording: typeof this.traceRecorder?.recordQuery === 'function',
        linkPropagationEvidence: Boolean(this.coordinationEngine),
      }),
      queries,
    })
  }

  describeContext() {
    return PerceptionHandlerContext.describeContract()
  }

  resolveDescriptor(call) {
    return (
      this.store.getPerceptionDescriptor(call?.name, resolveCallTargetRef(call)) ||
      this.builtinDescriptors.get(call?.name) ||
      null
    )
  }

  createContext(call, descriptor) {
    const normalizedCall = buildHandlerInput(call, descriptor)
    return new PerceptionHandlerContext({
      store: this.store,
      descriptor,
      call: normalizedCall,
      traceRecorder: this.traceRecorder,
      hostBridge: this.hostBridge,
    })
  }

  resolveHandlerEntry(call, descriptor, targetWidget) {
    const entries = this.handlerEntries.get(call?.name) || []
    if (entries.length === 0) return null
    const widgetKind = targetWidget?.kind || null
    const targetRef = resolveCallTargetRef(call, descriptor)
    if (widgetKind) {
      const exactKindEntry = entries.find((entry) => entry.supportedWidgetKinds?.includes(widgetKind))
      if (exactKindEntry) return exactKindEntry
    }
    if (targetRef) {
      const scopedEntry = entries.find((entry) => entry.descriptor?.targetRef === targetRef)
      if (scopedEntry) return scopedEntry
    }
    return entries.find((entry) => !entry.supportedWidgetKinds || entry.supportedWidgetKinds.length === 0) || entries[0]
  }

  async query(call) {
    try {
      validateAgainstSchema(buildPerceptionCallSchemaInput(call), PERCEPTION_QUERY_CALL_SCHEMA, 'query')
    } catch (error) {
      this.traceRecorder?.recordQueryFailure?.({
        call,
        code: 'INVALID_PARAMS',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: ['Inspect the perception query call schema in describeWorkspace() before retrying.'],
      })
      return buildQueryError({
        call,
        code: 'INVALID_PARAMS',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: ['Inspect the perception query call schema in describeWorkspace() before retrying.'],
      })
    }
    const descriptor = this.resolveDescriptor(call)
    const ctx = this.createContext(call, descriptor)
    const targetWidget = ctx.resolveTargetWidget()
    const handlerEntry = this.resolveHandlerEntry(call, descriptor, targetWidget)
    if (!handlerEntry?.handler) {
      this.traceRecorder?.recordQueryFailure?.({
        call,
        code: 'UNKNOWN_QUERY',
        message: `Unsupported WidgetVA perception query: ${call?.name || 'unknown'}.`,
        recoveryHints: ['Call describeWorkspace() to inspect currently supported perception queries.'],
      })
      return buildQueryError({
        call,
        code: 'UNKNOWN_QUERY',
        message: `Unsupported WidgetVA perception query: ${call?.name || 'unknown'}.`,
        recoveryHints: ['Call describeWorkspace() to inspect currently supported perception queries.'],
      })
    }

    if (descriptor?.paramsSchema) {
      try {
        validateAgainstSchema(ctx.readCallParams(), descriptor.paramsSchema, 'params')
      } catch (error) {
        this.traceRecorder?.recordQueryFailure?.({
          call,
          code: 'INVALID_PARAMS',
          message: error instanceof Error ? error.message : String(error),
          recoveryHints: ['Inspect the query paramsSchema in describeWorkspace() before retrying.'],
        })
        return buildQueryError({
          call,
          code: 'INVALID_PARAMS',
          message: error instanceof Error ? error.message : String(error),
          recoveryHints: ['Inspect the query paramsSchema in describeWorkspace() before retrying.'],
        })
      }
    }

    try {
      const output = await handlerEntry.handler(buildHandlerInput(call, descriptor), ctx)
      if (descriptor?.returnsSchema) {
        validateAgainstSchema(output?.result, descriptor.returnsSchema, 'result')
      }
      const tracePayload = ctx.consumeRecordedQuery?.() || null
      if (tracePayload) {
        this.traceRecorder?.recordQuery?.(tracePayload)
      }
      return makePerceptionResult({
        ok: true,
        callId: call?.callId || `call_${Date.now()}`,
        queryName: call?.name || 'unknown',
        result: output?.result,
      })
    } catch (error) {
      this.traceRecorder?.recordQueryFailure?.({
        call,
        code: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: [
          'Call readState() or describeWorkspace() to verify the current target widget and data refs.',
          'Retry with a focused widget/query combination that is declared in the current workspace.',
        ],
      })
      return buildQueryError({
        call,
        code: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: [
          'Call readState() or describeWorkspace() to verify the current target widget and data refs.',
          'Retry with a focused widget/query combination that is declared in the current workspace.',
          'Inspect the query returnsSchema if the runtime result shape does not match the declared contract.',
        ],
      })
    }
  }

  async run(call) {
    return this.query(call)
  }

  registerBuiltinQueries() {
    this.register(
      { name: 'perception.inspectViewConfig' },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget()
        ctx.recordQuery({
          affectedRefs: [targetWidget.ref],
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: `Inspected the ${targetWidget.kind || 'widget'} view configuration.`,
            rationale: 'View configuration evidence was requested for the current target widget.',
          }),
        })
        return {
          result: {
            ref: targetWidget.ref,
            kind: targetWidget.kind,
            encodings: resolveViewConfigEncodings(targetWidget),
            transforms: targetWidget.transforms,
            view: targetWidget.view,
            selections: targetWidget.selections,
            feedback: targetWidget.feedback || null,
          },
        }
      },
    )

    this.register(
      { name: 'perception.inspectSelection' },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget()
        const params = ctx.readCallParams()
        const requestedSelectionRef = params?.queryScope?.selectionRef || null
        const selectionEntries = resolveRequestedSelectionEntries(targetWidget, requestedSelectionRef)
        if (requestedSelectionRef && selectionEntries.length === 0) {
          throw new Error(`Selection ref ${requestedSelectionRef} is not active on the target widget.`)
        }
        const selections = selectionEntries.map((entry) => entry.selection)
        const { rows: visibleRows, dataRef } = ctx.resolveRowsForWidget(targetWidget, params)
        const currentSpec = targetWidget?.currentSpec || targetWidget?.rawSpec || null
        const filteredRows = selections.length > 0
          ? selections.reduce(
              (rows, activeSelection) => this.dataQueryEngine.filter(rows, activeSelection.predicates || []),
              visibleRows,
            )
          : []
        const selectedCount = selections.length > 0
          ? countSemanticSelectionRows({
              widgetKind: targetWidget?.kind || null,
              spec: currentSpec,
              rows: filteredRows,
            })
          : 0
        const result = {
          hasSelection: selectionEntries.length > 0,
          selectionCount: selectionEntries.length,
          selectionRefs: selectionEntries.map((entry) => entry.ref),
          dataRef,
          selectedCount,
          predicates: selectionEntries.flatMap((entry) => entry?.selection?.predicates || []),
          selectionSummaries: selectionEntries
            .map((entry) => entry?.selection?.summary || '')
            .filter((summary) => typeof summary === 'string' && summary.trim().length > 0),
          selections: selectionEntries.map((entry) => ({
            ref: entry.ref,
            kind: entry?.selection?.kind || null,
            summary: entry?.selection?.summary || '',
            predicates: cloneValue(entry?.selection?.predicates || []),
            value: cloneValue(entry?.selection?.value ?? null),
          })),
        }
        ctx.recordQuery({
          affectedRefs: [targetWidget.ref],
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: result.hasSelection
              ? `Inspected ${result.selectionCount} active selection${result.selectionCount === 1 ? '' : 's'} covering ${result.selectedCount} row${result.selectedCount === 1 ? '' : 's'}.`
              : 'Confirmed that there is no active selection on the target widget.',
            rationale: 'Selection payload evidence was requested for the target widget.',
          }),
        })
        return { result }
      },
    )

    this.register(
      { name: 'perception.summarizeSelection' },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget()
        const params = ctx.readCallParams()
        const requestedSelectionRef = params?.queryScope?.selectionRef || null
        const selectionEntries = resolveRequestedSelectionEntries(targetWidget, requestedSelectionRef)
        if (requestedSelectionRef && selectionEntries.length === 0) {
          throw new Error(`Selection ref ${requestedSelectionRef} is not active on the target widget.`)
        }
        const selections = selectionEntries.map((entry) => entry.selection)
        const { rows: visibleRows, dataRef } = ctx.resolveRowsForWidget(targetWidget, params)
        const currentSpec = targetWidget?.currentSpec || targetWidget?.rawSpec || null
        let result
        if (selections.length > 0) {
          const filteredRows = selections.reduce(
            (rows, activeSelection) => this.dataQueryEngine.filter(rows, activeSelection.predicates || []),
            visibleRows,
          )
          const semanticSelectedCount = countSemanticSelectionRows({
            widgetKind: targetWidget?.kind || null,
            spec: currentSpec,
            rows: filteredRows,
          })
          const summary = this.dataQueryEngine.summarize(filteredRows, params)
          const summaryRows = Array.isArray(summary?.rows) ? summary.rows : []
          const selectionSummaries = selections.map((selection) => selection.summary || '').filter(Boolean)
          result = {
            hasSelection: true,
            selectionCount: selections.length,
            selectionRefs: selectionEntries.map((entry) => entry.ref),
            dataRef,
            selectedCount: semanticSelectedCount,
            summary: formatSummaryText({
              rowCount: semanticSelectedCount,
              groupCount: summaryRows.length,
              fallback: selectionSummaries.join(' | '),
            }),
            selectionSummaries,
            predicates: selections.flatMap((selection) => selection.predicates || []),
            selectionPredicates: selections.map((selection) => selection.predicates || []),
            groups: summaryRows,
            aggregates: summaryRows,
          }
        } else {
          result = {
            hasSelection: false,
            selectionCount: 0,
            selectionRefs: [],
            dataRef,
            selectedCount: 0,
            summary: '',
            selectionSummaries: [],
            groups: [],
            aggregates: [],
            predicates: [],
            selectionPredicates: [],
          }
        }
        ctx.recordQuery({
          affectedRefs: [targetWidget.ref],
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: result.hasSelection
              ? `Summarized ${result.selectedCount} selected rows across ${result.selectionCount} active selection${result.selectionCount === 1 ? '' : 's'}.`
              : 'Confirmed that there is no active selection on the target widget.',
            rationale: 'Selection evidence was requested for the target widget.',
          }),
        })
        return { result }
      },
    )

    this.register(
      { name: 'perception.summarizeVisible' },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget()
        const params = ctx.readCallParams()
        const { rows: resolvedRows, dataRef } = ctx.resolveRowsForWidget(targetWidget, params)
        const widgetState = ctx.readCurrentState()?.widgets?.[targetWidget.ref] || null
        const activeSpec = widgetState?.rawSpec || null
        const selectionRef = ctx.resolveImplicitSelectionRefForWidget?.(targetWidget, params?.queryScope || null)
          || ctx.readPrimarySelectionRef?.()
          || null
        const selectionState = selectionRef ? ctx.readSelectionRegistry?.()?.[selectionRef] || null : null
        const selectionPredicates = Array.isArray(selectionState?.predicates) ? selectionState.predicates : []
        const rawVisibleRows = selectionPredicates.length > 0
          ? this.dataQueryEngine.filter(resolvedRows, selectionPredicates)
          : resolvedRows
        const { visibleRows, visibleCount } = normalizeSemanticVisibleRows({
          widgetKind: targetWidget?.kind || null,
          spec: activeSpec,
          rows: rawVisibleRows,
        })
        const summary = this.dataQueryEngine.summarize(visibleRows, params)
        const summaryRows = Array.isArray(summary?.rows) ? summary.rows : []
        ctx.recordQuery({
          affectedRefs: [targetWidget.ref],
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: `Summarized ${visibleCount} visible rows for the target widget.`,
            rationale: 'Visible-view evidence was requested for the target widget.',
          }),
        })
        return {
          result: {
            dataRef,
            rowCount: visibleCount,
            groups: summaryRows,
            aggregates: summaryRows,
            summary: formatSummaryText({
              rowCount: visibleCount,
              groupCount: summaryRows.length,
            }),
          },
        }
      },
    )

    this.register(
      { name: 'perception.findExtremes' },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget()
        const params = ctx.readCallParams()
        const { dataRef } = ctx.resolveRowsForWidget(targetWidget, params)
        const extremes = this.dataQueryExecutor.run({
          dataRef,
          query: {
            kind: 'findExtremes',
            spec: params,
          },
        })
        const rows = extremes?.result?.rows || []
        const direction = typeof params?.direction === 'string' ? params.direction : 'max'
        const field = typeof params?.field === 'string' ? params.field : 'value'
        ctx.recordQuery({
          affectedRefs: [targetWidget.ref],
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: `Found ${rows.length} ${direction} extreme row${rows.length === 1 ? '' : 's'} for ${field}.`,
            rationale: 'An extremes query was requested for the current target widget.',
          }),
        })
        return {
          result: {
            dataRef,
            field: typeof params?.field === 'string' ? params.field : null,
            direction,
            rows,
          },
        }
      },
    )

    this.register(
      { name: 'perception.inspectVisibleRows' },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget()
        const params = ctx.readCallParams()
        const { rows: resolvedRows, dataRef } = ctx.resolveRowsForWidget(targetWidget, params)
        const widgetState = ctx.readCurrentState()?.widgets?.[targetWidget.ref] || null
        const activeSpec = widgetState?.rawSpec || null
        const selectionRef = ctx.resolveImplicitSelectionRefForWidget?.(targetWidget, params?.queryScope || null)
          || ctx.readPrimarySelectionRef?.()
          || null
        const selectionState = selectionRef ? ctx.readSelectionRegistry?.()?.[selectionRef] || null : null
        const selectionPredicates = Array.isArray(selectionState?.predicates) ? selectionState.predicates : []
        const rawVisibleRows = selectionPredicates.length > 0
          ? this.dataQueryEngine.filter(resolvedRows, selectionPredicates)
          : resolvedRows
        const { visibleRows, visibleCount } = normalizeSemanticVisibleRows({
          widgetKind: targetWidget?.kind || null,
          spec: activeSpec,
          rows: rawVisibleRows,
        })
        const limit = Number.isFinite(params?.limit) ? params.limit : 20
        ctx.recordQuery({
          affectedRefs: [targetWidget.ref],
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: `Inspected ${visibleCount} visible rows and returned a sample.`,
            rationale: 'Visible-row evidence was requested for the target widget.',
          }),
        })
        return {
          result: {
            ref: targetWidget.ref,
            dataRef,
            visibleCount,
            rows: visibleRows.slice(0, limit),
          },
        }
      },
    )

    this.register(
      { name: 'perception.verifyActionEffect' },
      async (call, ctx) => {
        const params = ctx.readCallParams()
        const verification = evaluateActionEffectVerification({
          store: this.store,
          getFinalWorkspaceSnapshot: (options = {}) => readSnapshotFromStore(
            this.store,
            options?.stateId || params?.stateId || null,
            options,
          ),
          evaluateLinkPropagation: (options) => this.coordinationEngine?.evaluatePropagation?.(options) || null,
          actionName: params?.actionName || null,
          actionParams: params?.actionParams || {},
          stateId: params?.stateId || null,
          refs: params?.refs || [],
          targetRef: call?.target?.widgetRef || null,
          traceLimit: 50,
        })
        ctx.recordQuery({
          affectedRefs: Array.isArray(params?.refs) && params.refs.length > 0
            ? params.refs
            : verification.affectedRefs,
          notes: buildPerceptionTraceNotes({
            userVisibleSummary: verification.verified
              ? `Verified the effect of ${verification.matchedActionName || 'the action'} on the requested runtime refs.`
              : `Verification for ${verification.matchedActionName || 'the action'} found missing refs or propagation mismatches.`,
            rationale: 'Post-action verification evidence was requested from the runtime trace and state patch.',
            verification: verification.verified
              ? 'Trace evidence, state patch, and link propagation checks all matched the requested action effect.'
              : [
                `Missing refs: ${verification.missingRefs.length}.`,
                `Propagation ok: ${verification.linkPropagation.every((entry) => entry.ok)}.`,
                verification?.semanticVerification?.ok === false ? verification.semanticVerification.summary : null,
              ].filter(Boolean).join(' '),
          }),
        })
        return {
          result: verification,
        }
      },
    )
  }
}

function normalizeSupportedWidgetKinds(value) {
  if (!Array.isArray(value) || value.length === 0) return null
  return [...new Set(value.filter((item) => typeof item === 'string' && item.length > 0))].sort()
}

function sameSupportedKinds(left, right) {
  const a = normalizeSupportedWidgetKinds(left)
  const b = normalizeSupportedWidgetKinds(right)
  if (!a && !b) return true
  if (!a || !b || a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}
