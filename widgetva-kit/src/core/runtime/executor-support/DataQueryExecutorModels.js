import {
  DATA_QUERY_KINDS,
  DATA_QUERY_RESULT_SCHEMAS,
  DATA_QUERY_SCHEMAS,
  makeDataQueryDescriptor,
} from '../../../contracts/data-contracts.js'
import { DATA_QUERY_CALL_SCHEMA } from '../../../schemas/data-handles.schema.js'
import { DataQueryEngine } from '../../data/DataQueryEngine.js'
import { DATA_QUERY_DESCRIPTOR_TEMPLATES } from '../../data/dataQueryDescriptorTemplates.js'
import { makeDataQueryResult, makeResultError } from '../../../contracts/result-contracts.js'
import { createDefaultWidgetVAHostBridge } from '../../../host/hostBridge.js'
import { validateAgainstSchema } from '../support/schemaValidation.js'
import {
  readDataHandleFromStore,
  readRuntimeDataFromStore,
  readWorkspaceDescriptionFromStore,
  readWorkspaceStateFromStore,
  resolveSelectionDataRefFromStore,
  resolveWidgetRecordFromStore,
} from '../../../workspace/store/workspaceStoreReaders.js'
import { readSelectionRegistry } from '../../../workspace/state/selectionStateModel.js'
import { readFocusState } from '../../../workspace/state/focusStateModel.js'
import { deriveHighlightState } from '../../../workspace/state/highlightStateModel.js'
import { buildScopedParams, readNormalizedQueryScope } from '../support/queryScope.js'
import { resolveImplicitSelectionRefForWidget } from '../support/implicitQueryScope.js'

function makeDataQueryHandlerContextCapabilities(capabilities = {}) {
  return {
    workspaceRead: false,
    runtimeDataRead: false,
    widgetTargetResolution: false,
    dataHandleResolution: false,
    selectionTargetResolution: false,
    explicitTargetValidation: false,
    selectionScopedQueries: false,
    traceRecording: false,
    ...capabilities,
  }
}

function makeDataQueryHandlerContextIntegrations(integrations = {}) {
  return {
    store: false,
    traceRecorder: false,
    ...integrations,
  }
}

function makeDataQueryHandlerContextSummary(summary = {}) {
  return {
    methods: Array.isArray(summary?.methods) ? [...summary.methods] : [],
    capabilities: makeDataQueryHandlerContextCapabilities(summary?.capabilities),
    integrations: makeDataQueryHandlerContextIntegrations(summary?.integrations),
  }
}

export class DataQueryHandlerContext {
  constructor({
    store,
    call,
    traceRecorder,
    hostBridge,
  }) {
    this.store = store
    this.call = call
    this.traceRecorder = traceRecorder
    this.hostBridge = hostBridge || createDefaultWidgetVAHostBridge()
    this.pendingDataQueryTrace = null
  }

  static describeContract() {
    return makeDataQueryHandlerContextSummary({
      methods: [
        'readDescription',
        'readCurrentState',
        'readSelectionRegistry',
        'readFocusState',
        'readHighlightState',
        'readQueryScope',
        'readNormalizedQuerySpec',
        'readFocusedWidgetRef',
        'readPrimarySelectionRef',
        'readRuntimeData',
        'resolveTargetWidget',
        'resolveExplicitTarget',
        'resolveSelectionDataRef',
        'resolveImplicitSelectionRef',
        'resolveDataRef',
        'resolveDataHandle',
        'resolveSelectionState',
        'resolveRows',
        'recordDataQuery',
      ],
      capabilities: makeDataQueryHandlerContextCapabilities({
        workspaceRead: true,
        runtimeDataRead: true,
        widgetTargetResolution: true,
        dataHandleResolution: true,
        selectionTargetResolution: true,
        explicitTargetValidation: true,
        selectionScopedQueries: true,
        traceRecording: true,
      }),
      integrations: makeDataQueryHandlerContextIntegrations({
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
      querySpec: this.readQuerySpec(),
    })
  }

  readTargetWidgetRef() {
    return readNormalizedQueryScope({
      call: this.call,
      querySpec: this.readQuerySpec(),
    }).widgetRef
  }

  readNormalizedQuerySpec() {
    return this.normalizeScopedParams(this.readQuerySpec(), {
      querySpec: this.readQuerySpec(),
      includeTopLevelLegacyTargeting: false,
    })
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

  readRuntimeData(dataRef) {
    return readRuntimeDataFromStore(this.store, dataRef)
  }

  normalizeScopedParams(params = {}, options = {}) {
    return buildScopedParams({
      params,
      call: options?.call || this.call,
      querySpec: options?.querySpec || this.readQuerySpec(),
      includeTopLevelLegacyTargeting: options?.includeTopLevelLegacyTargeting ?? true,
    })
  }

  resolveTargetWidget(targetRef = this.readQueryScope()?.widgetRef || null) {
    const resolvedTargetRef = targetRef || this.readQueryScope()?.widgetRef || null
    if (!resolvedTargetRef) return null
    return resolveWidgetRecordFromStore(this.store, resolvedTargetRef)
  }

  readQuerySpec() {
    return this.call?.query?.spec || {}
  }

  resolveExplicitTarget(options = {}) {
    const normalizedOptions = this.normalizeScopedParams(options, {
      querySpec: options,
    })
    const callTargetRef = this.readQueryScope()?.widgetRef || null
    const dataRef = normalizedOptions?.queryScope?.dataRef || this.call?.dataRef || this.readQueryScope()?.dataRef
    const targetRef = callTargetRef
    if (dataRef) {
      const selectionDataRef = this.resolveSelectionDataRef(dataRef)
      if (selectionDataRef) {
        return { kind: 'data', ref: selectionDataRef, sourceRef: dataRef }
      }
      if (this.store.getDataHandle?.(dataRef) || this.readRuntimeData(dataRef)) {
        return { kind: 'data', ref: dataRef }
      }
      return null
    }

    if (!targetRef) return null

    const selectionDataRef = this.resolveSelectionDataRef(targetRef)
    if (selectionDataRef) {
      return { kind: 'data', ref: selectionDataRef, sourceRef: targetRef }
    }

    if (this.store.getDataHandle?.(targetRef) || this.readRuntimeData(targetRef)) {
      return { kind: 'data', ref: targetRef }
    }

    const targetWidget = this.resolveTargetWidget(targetRef)
    if (targetWidget?.ref) {
      return {
        kind: 'widget',
        ref: targetWidget.ref,
        widget: targetWidget,
      }
    }

    return null
  }

  resolveSelectionDataRef(selectionRef) {
    if (!selectionRef) return null
    const resolvedDataRef = resolveSelectionDataRefFromStore(this.store, selectionRef)
    if (!resolvedDataRef) return null
    if (readDataHandleFromStore(this.store, resolvedDataRef) || this.readRuntimeData(resolvedDataRef)) {
      return resolvedDataRef
    }
    return null
  }

  resolveImplicitSelectionRef({
    queryScope = null,
    dataRef = null,
    targetWidget = null,
  } = {}) {
    const explicitSelectionRef = queryScope?.selectionRef || null
    if (typeof explicitSelectionRef === 'string' && explicitSelectionRef.length > 0) {
      return explicitSelectionRef
    }

    const scopedRuntimeData = dataRef ? this.readRuntimeData(dataRef) : null
    const runtimeSelectionRef = scopedRuntimeData?.sourceSelectionRef || null
    if (typeof runtimeSelectionRef === 'string' && runtimeSelectionRef.length > 0) {
      return runtimeSelectionRef
    }

    const resolvedTargetWidget = targetWidget
      || (scopedRuntimeData?.widgetRef ? this.resolveTargetWidget(scopedRuntimeData.widgetRef) : null)
      || this.resolveTargetWidget(this.readTargetWidgetRef() || this.readFocusedWidgetRef())
      || null

    return resolveImplicitSelectionRefForWidget({
      targetWidget: resolvedTargetWidget,
      explicitSelectionRef,
      selectionRegistry: this.readSelectionRegistry() || {},
      primarySelectionRef: this.readPrimarySelectionRef(),
    })
  }

  resolveDataRef(preferredDataRef = this.call?.dataRef) {
    const normalizedQuerySpec = this.readNormalizedQuerySpec()
    const queryScope = normalizedQuerySpec?.queryScope || this.readQueryScope()
    if (preferredDataRef) return preferredDataRef
    if (typeof queryScope?.dataRef === 'string' && queryScope.dataRef.length > 0) {
      return queryScope.dataRef
    }

    const explicitTarget = this.resolveExplicitTarget()
    if (explicitTarget?.kind === 'data') {
      return explicitTarget.ref
    }
    if (explicitTarget?.kind === 'widget') {
      const compositePrimarySelectionDataRef = this.resolveCompositePrimarySelectionDataRef(explicitTarget.widget)
      return compositePrimarySelectionDataRef
        || explicitTarget.widget?.data?.currentDataRef
        || explicitTarget.widget?.data?.sourceDataRef
        || explicitTarget.widget?.primaryDataRef
        || null
    }

    const focusedWidgetRef = this.readFocusedWidgetRef()
    const focusedWidget = focusedWidgetRef ? this.store.getResolvedWidget?.(focusedWidgetRef) || null : null
    return focusedWidget?.data?.currentDataRef || focusedWidget?.data?.sourceDataRef || focusedWidget?.primaryDataRef || null
  }

  resolveDataHandle(dataRef = this.call?.dataRef) {
    const resolvedDataRef = this.resolveDataRef(dataRef)
    return resolvedDataRef
      ? readDataHandleFromStore(this.store, resolvedDataRef)
      : null
  }

  resolveSelectionState(selectionRef) {
    if (!selectionRef) return null
    return this.readSelectionRegistry()?.[selectionRef] || null
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

  resolveRows(dataRef = this.call?.dataRef, options = {}) {
    const resolvedDataRef = this.resolveDataRef(dataRef)
    const runtimeData = this.readRuntimeData(resolvedDataRef)
    const baseRows = Array.isArray(runtimeData?.rows) ? runtimeData.rows : []
    const normalizedOptions = this.normalizeScopedParams(options, { querySpec: options })
    const selectionRef = this.resolveImplicitSelectionRef({
      queryScope: normalizedOptions?.queryScope || this.readQueryScope() || null,
      dataRef: resolvedDataRef,
    })
    if (!selectionRef) return baseRows

    const selectionState = this.resolveSelectionState(selectionRef)
    if (!selectionState) return null

    const predicates = Array.isArray(selectionState?.predicates) ? selectionState.predicates : []
    if (predicates.length === 0) return baseRows

    return baseRows.filter((row) =>
      predicates.every((predicate) => applyPredicate(row, predicate)),
    )
  }

  recordDataQuery({ affectedRefs = [], notes } = {}) {
    this.pendingDataQueryTrace = {
      call: this.call,
      affectedRefs,
      notes,
    }
  }

  consumeRecordedDataQuery() {
    const pending = this.pendingDataQueryTrace
    this.pendingDataQueryTrace = null
    return pending
  }
}

function applyPredicate(row, predicate) {
  const value = row?.[predicate?.field]
  if (predicate?.op === 'between' && Array.isArray(predicate?.value)) {
    return value >= predicate.value[0] && value <= predicate.value[1]
  }
  if (predicate?.op === 'gte' || predicate?.op === 'greaterThanOrEqual') return value >= predicate?.value
  if (predicate?.op === 'lte' || predicate?.op === 'lessThanOrEqual') return value <= predicate?.value
  if (predicate?.op === 'gt' || predicate?.op === 'greaterThan') return value > predicate?.value
  if (predicate?.op === 'lt' || predicate?.op === 'lessThan') return value < predicate?.value
  if (predicate?.op === 'equals' || predicate?.op === 'eq') return value === predicate?.value
  if (predicate?.op === 'in' && Array.isArray(predicate?.value)) {
    return predicate.value.includes(value)
  }
  if (predicate?.op === 'notIn' && Array.isArray(predicate?.value)) {
    return !predicate.value.includes(value)
  }
  return true
}

export function makeDataQueryExecutorEngineSummary(summary = {}) {
  return {
    kind: null,
    className: null,
    ...summary,
  }
}

export function makeDataQueryExecutorCounts(counts = {}) {
  return {
    supportedQueryKindCount: 0,
    supportedQueryDescriptorCount: 0,
    ...counts,
  }
}

export function makeDataQueryExecutorCapabilities(capabilities = {}) {
  return {
    schemaValidation: true,
    returnsValidation: true,
    traceRecording: false,
    runtimeDataReads: false,
    ...capabilities,
  }
}

export function makeDataQueryExecutorSummary(summary = {}) {
  return {
    supportedQueryKinds: [],
    supportedQueryDescriptors: [],
    ...summary,
    engine: makeDataQueryExecutorEngineSummary(summary?.engine),
    counts: makeDataQueryExecutorCounts(summary?.counts),
    capabilities: makeDataQueryExecutorCapabilities(summary?.capabilities),
  }
}

export function buildDataQueryError({ dataRef, code, message, details, recoveryHints }) {
  return makeDataQueryResult({
    ok: false,
    dataRef,
    error: makeResultError({
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    }),
    ...(Array.isArray(recoveryHints) && recoveryHints.length > 0 ? { recoveryHints } : {}),
  })
}

export function recordDataQueryFailure(traceRecorder, call, { code, message, details, recoveryHints }) {
  traceRecorder?.recordDataQueryFailure?.({
    call,
    code,
    message,
    details,
    recoveryHints,
  })
}

export function buildDataQueryTraceNotes({ kind, selectionRef = null, dataRef = null, rowCount = null } = {}) {
  const scopedText = selectionRef ? ` scoped to ${selectionRef}` : ''
  const rowText = Number.isFinite(rowCount) ? ` over ${rowCount} row${rowCount === 1 ? '' : 's'}` : ''
  return {
    userVisibleSummary: `Data query: ${kind}${scopedText}${rowText}`,
    rationale: selectionRef
      ? 'A selection-scoped data query was requested for the current runtime data view.'
      : 'A data query was requested for the current runtime data view.',
    ...(dataRef ? { verification: `Query executed against ${dataRef}.` } : {}),
  }
}

export function buildSupportedQueryDescriptors(kinds = []) {
  return kinds.map((kind) =>
    makeDataQueryDescriptor({
      name: kind,
      ...DATA_QUERY_DESCRIPTOR_TEMPLATES[kind],
      inputSchema: DATA_QUERY_SCHEMAS[kind] || {
        type: 'object',
        additionalProperties: true,
        properties: {},
      },
    }),
  )
}

export function supportsUnifiedEngineQuery(engine) {
  if (!engine || typeof engine.query !== 'function') return false
  if (!(engine instanceof DataQueryEngine)) return true
  if (engine.query !== DataQueryEngine.prototype.query) return true
  if (typeof engine.resolveSource === 'function') return true
  if (typeof engine.options?.resolveSource === 'function') return true
  return false
}
