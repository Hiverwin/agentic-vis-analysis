import {
  DATA_QUERY_KINDS,
  DATA_QUERY_RESULT_SCHEMAS,
  DATA_QUERY_SCHEMAS,
  makeDataQueryDescriptor,
} from '../../contracts/data-contracts.js'
import { DATA_QUERY_CALL_SCHEMA } from '../../schemas/data-handles.schema.js'
import { DataQueryEngine } from '../data/DataQueryEngine.js'
import { DATA_QUERY_DESCRIPTOR_TEMPLATES } from '../data/dataQueryDescriptorTemplates.js'
import { makeDataQueryResult, makeResultError } from '../../contracts/result-contracts.js'
import { createDefaultWidgetVAHostBridge } from '../../host/hostBridge.js'
import { validateAgainstSchema } from './support/schemaValidation.js'
import {
  readDataHandleFromStore,
  readRuntimeDataFromStore,
  readWorkspaceDescriptionFromStore,
  readWorkspaceStateFromStore,
  resolveSelectionDataRefFromStore,
  resolveWidgetRecordFromStore,
} from '../../workspace/store/workspaceStoreReaders.js'
import { readSelectionRegistry } from '../../workspace/state/selectionStateModel.js'
import { readFocusState } from '../../workspace/state/focusStateModel.js'
import { deriveHighlightState } from '../../workspace/state/highlightStateModel.js'
import { buildScopedParams, readNormalizedQueryScope } from './support/queryScope.js'
import { resolveImplicitSelectionRefForWidget } from './support/implicitQueryScope.js'

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

class DataQueryHandlerContext {
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

function makeDataQueryExecutorEngineSummary(summary = {}) {
  return {
    kind: null,
    className: null,
    ...summary,
  }
}

function makeDataQueryExecutorCounts(counts = {}) {
  return {
    supportedQueryKindCount: 0,
    supportedQueryDescriptorCount: 0,
    ...counts,
  }
}

function makeDataQueryExecutorCapabilities(capabilities = {}) {
  return {
    schemaValidation: true,
    returnsValidation: true,
    traceRecording: false,
    runtimeDataReads: false,
    ...capabilities,
  }
}

function makeDataQueryExecutorSummary(summary = {}) {
  return {
    supportedQueryKinds: [],
    supportedQueryDescriptors: [],
    ...summary,
    engine: makeDataQueryExecutorEngineSummary(summary?.engine),
    counts: makeDataQueryExecutorCounts(summary?.counts),
    capabilities: makeDataQueryExecutorCapabilities(summary?.capabilities),
  }
}

function buildDataQueryError({ dataRef, code, message, details, recoveryHints }) {
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

function recordDataQueryFailure(traceRecorder, call, { code, message, details, recoveryHints }) {
  traceRecorder?.recordDataQueryFailure?.({
    call,
    code,
    message,
    details,
    recoveryHints,
  })
}

function buildDataQueryTraceNotes({ kind, selectionRef = null, dataRef = null, rowCount = null } = {}) {
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

function buildSupportedQueryDescriptors(kinds = []) {
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

function supportsUnifiedEngineQuery(engine) {
  if (!engine || typeof engine.query !== 'function') return false
  if (!(engine instanceof DataQueryEngine)) return true
  if (engine.query !== DataQueryEngine.prototype.query) return true
  if (typeof engine.resolveSource === 'function') return true
  if (typeof engine.options?.resolveSource === 'function') return true
  return false
}

export class DataQueryExecutor {
  constructor({ store, dataQueryEngine, traceRecorder, hostBridge } = {}) {
    this.store = store || {
      readDescription() {
        return { widgets: [], dataHandles: [] }
      },
      readState() {
        return { shared: { focusedWidget: null } }
      },
      getResolvedWidgetForTarget() {
        return null
      },
      getResolvedWidget() {
        return null
      },
      getDataHandle() {
        return null
      },
      readRuntimeData() {
        return null
      },
      resolveSelectionDataRef() {
        return null
      },
    }
    this.dataQueryEngine = dataQueryEngine || {
      kind: 'manual',
      listSupportedQueryKinds() {
        return []
      },
    }
    this.traceRecorder = traceRecorder || null
    this.hostBridge = hostBridge || createDefaultWidgetVAHostBridge()
  }

  run(call = {}) {
    try {
      validateAgainstSchema(call, DATA_QUERY_CALL_SCHEMA, 'dataQuery')
    } catch (error) {
      recordDataQueryFailure(this.traceRecorder, call, {
        code: 'INVALID_QUERY_SPEC',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: ['Inspect the data query call schema in describeWorkspace() before retrying.'],
      })
      return buildDataQueryError({
        dataRef: call?.dataRef || null,
        code: 'INVALID_QUERY_SPEC',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: ['Inspect the data query call schema in describeWorkspace() before retrying.'],
      })
    }
    const ctx = this.createContext(call)
    const querySpec = ctx.readNormalizedQuerySpec()
    const queryScope = ctx.readQueryScope()
    const targetRef = ctx.readTargetWidgetRef() || null
    const explicitTargetRef =
      targetRef
      || queryScope?.dataRef
      || null
    const explicitTarget = ctx.resolveExplicitTarget({
      dataRef: call?.dataRef || querySpec?.queryScope?.dataRef || null,
      targetRef,
    })
    if (!call?.dataRef && !querySpec?.queryScope?.dataRef && explicitTargetRef && !explicitTarget) {
      recordDataQueryFailure(this.traceRecorder, call, {
        code: 'UNSUPPORTED_TARGET',
        message: `The requested data-query target ref is not available: ${explicitTargetRef}.`,
        details: {
          targetRef: explicitTargetRef,
        },
        recoveryHints: [
          'Call describeWorkspace() to inspect valid widget refs and data refs before retrying.',
          'Retry the data query with a targetRef that resolves to a materialized widget or data handle.',
        ],
      })
      return buildDataQueryError({
        dataRef: null,
        code: 'UNSUPPORTED_TARGET',
        message: `The requested data-query target ref is not available: ${explicitTargetRef}.`,
        details: {
          targetRef: explicitTargetRef,
        },
        recoveryHints: [
          'Call describeWorkspace() to inspect valid widget refs and data refs before retrying.',
          'Retry the data query with a targetRef that resolves to a materialized widget or data handle.',
        ],
      })
    }
    const dataRef = ctx.resolveDataRef(call?.dataRef)
    const query = call?.query || {}
    const selectionRef = ctx.resolveImplicitSelectionRef({
      queryScope: querySpec?.queryScope || queryScope || null,
      dataRef,
    })
    const runtimeData = ctx.readRuntimeData(dataRef)
    const dataHandle = ctx.resolveDataHandle(dataRef)
    if (!runtimeData) {
      recordDataQueryFailure(this.traceRecorder, call, {
        code: 'UNKNOWN_DATA_REF',
        message: `Unknown data ref: ${dataRef || 'missing'}.`,
        recoveryHints: [
          'Call describeWorkspace() to inspect materialized data handles and valid data refs.',
          'Retry the query with an explicit dataRef, a targetRef, or after focusing the widget whose data you want to inspect.',
        ],
      })
      return buildDataQueryError({
        dataRef,
        code: 'UNKNOWN_DATA_REF',
        message: `Unknown data ref: ${dataRef || 'missing'}.`,
        recoveryHints: [
          'Call describeWorkspace() to inspect materialized data handles and valid data refs.',
          'Retry the query with an explicit dataRef, a targetRef, or after focusing the widget whose data you want to inspect.',
        ],
      })
    }

    const rows = ctx.resolveRows(dataRef, { queryScope: { selectionRef } })
    const kind = query.kind
    if (!DATA_QUERY_KINDS.includes(kind)) {
      recordDataQueryFailure(this.traceRecorder, call, {
        code: 'UNKNOWN_QUERY_KIND',
        message: `Unsupported data query kind: ${kind || 'missing'}.`,
        recoveryHints: ['Inspect supportedQueryDescriptors on the current data handle before retrying.'],
      })
      return buildDataQueryError({
        dataRef,
        code: 'UNKNOWN_QUERY_KIND',
        message: `Unsupported data query kind: ${kind || 'missing'}.`,
        recoveryHints: ['Inspect supportedQueryDescriptors on the current data handle before retrying.'],
      })
    }

    if (dataHandle && Array.isArray(dataHandle.supportedQueries) && !dataHandle.supportedQueries.includes(kind)) {
      recordDataQueryFailure(this.traceRecorder, call, {
        code: 'UNSUPPORTED_QUERY_KIND',
        message: `Data query kind ${kind} is not supported by the current data handle.`,
        details: {
          supportedQueries: dataHandle.supportedQueries,
          dataHandleRef: dataHandle.ref || null,
        },
        recoveryHints: [
          'Inspect supportedQueries or supportedQueryDescriptors on the current data handle before retrying.',
          'Retry with a query kind exposed by the current widget data handle.',
        ],
      })
      return buildDataQueryError({
        dataRef,
        code: 'UNSUPPORTED_QUERY_KIND',
        message: `Data query kind ${kind} is not supported by the current data handle.`,
        details: {
          supportedQueries: dataHandle.supportedQueries,
          dataHandleRef: dataHandle.ref || null,
        },
        recoveryHints: [
          'Inspect supportedQueries or supportedQueryDescriptors on the current data handle before retrying.',
          'Retry with a query kind exposed by the current widget data handle.',
        ],
      })
    }

    if (selectionRef && rows == null) {
      recordDataQueryFailure(this.traceRecorder, call, {
        code: 'INVALID_QUERY_SPEC',
        message: `Selection ref ${selectionRef} is not active in the current workspace state.`,
        recoveryHints: [
          'Inspect shared.selections.registry in readState() or call perception.summarizeSelection() before retrying.',
          'Retry the data query with an active selectionRef or omit selectionRef to query the full current view.',
        ],
      })
      return buildDataQueryError({
        dataRef,
        code: 'INVALID_QUERY_SPEC',
        message: `Selection ref ${selectionRef} is not active in the current workspace state.`,
        recoveryHints: [
          'Inspect shared.selections.registry in readState() or call perception.summarizeSelection() before retrying.',
          'Retry the data query with an active selectionRef or omit selectionRef to query the full current view.',
        ],
      })
    }

    const querySchema = DATA_QUERY_SCHEMAS[kind]
    if (querySchema) {
      try {
        validateAgainstSchema(querySpec, querySchema, `query.spec.${kind}`)
      } catch (error) {
        recordDataQueryFailure(this.traceRecorder, call, {
          code: 'INVALID_QUERY_SPEC',
          message: error instanceof Error ? error.message : String(error),
          recoveryHints: ['Inspect the selected data query descriptor inputSchema/examples before retrying.'],
        })
        return buildDataQueryError({
          dataRef,
          code: 'INVALID_QUERY_SPEC',
          message: error instanceof Error ? error.message : String(error),
          recoveryHints: ['Inspect the selected data query descriptor inputSchema/examples before retrying.'],
        })
      }
    }
    const resultSchema = DATA_QUERY_RESULT_SCHEMAS[kind] || null
    try {
      let result
      const runUnifiedQuery = () => this.dataQueryEngine.query(dataRef, { kind, spec: querySpec })
      if (kind === 'schema') {
        result = runtimeData.handle?.schema || (
          supportsUnifiedEngineQuery(this.dataQueryEngine)
            ? runUnifiedQuery()
            : this.dataQueryEngine.getSchema(rows)
        )
      }
      if (kind === 'filter') {
        const predicates = Array.isArray(querySpec?.predicates) ? querySpec.predicates : []
        const filteredRows = supportsUnifiedEngineQuery(this.dataQueryEngine)
          ? runUnifiedQuery()
          : this.dataQueryEngine.filter(rows, predicates)
        result = {
          rows: Array.isArray(filteredRows?.rows) ? filteredRows.rows : filteredRows,
          rowCount: Array.isArray(filteredRows?.rows) ? filteredRows.rows.length : filteredRows.length,
          predicates,
        }
      }
      if (kind === 'sampleRows') {
        result = supportsUnifiedEngineQuery(this.dataQueryEngine)
          ? runUnifiedQuery()
          : this.dataQueryEngine.sampleRows(rows, querySpec?.limit || 20)
      }
      if (kind === 'summary') {
        result = supportsUnifiedEngineQuery(this.dataQueryEngine)
          ? runUnifiedQuery()
          : this.dataQueryEngine.summarize(rows, normalizeSummarySpec(querySpec))
      }
      if (kind === 'aggregate' || kind === 'groupBy') {
        const aggregateSpec = normalizeAggregateSpec(querySpec)
        result = normalizeAggregateResult(
          supportsUnifiedEngineQuery(this.dataQueryEngine)
            ? runUnifiedQuery()
            : this.dataQueryEngine.aggregate(rows, aggregateSpec),
        )
      }
      if (kind === 'sql') {
        result = supportsUnifiedEngineQuery(this.dataQueryEngine)
          ? runUnifiedQuery()
          : this.dataQueryEngine.executeSql(rows, querySpec)
      }
      if (kind === 'computeCorrelation') {
        result = normalizeCorrelationResult(
          supportsUnifiedEngineQuery(this.dataQueryEngine)
            ? runUnifiedQuery()
            : this.dataQueryEngine.computeCorrelation(rows, querySpec),
          querySpec,
        )
      }
      if (kind === 'findExtremes') {
        result = normalizeExtremesResult(
          supportsUnifiedEngineQuery(this.dataQueryEngine)
            ? runUnifiedQuery()
            : this.dataQueryEngine.findExtremes(rows, normalizeExtremesSpec(querySpec)),
          querySpec,
        )
      }
      if (kind === 'findOutliers') {
        result = normalizeOutliersResult(
          supportsUnifiedEngineQuery(this.dataQueryEngine)
            ? runUnifiedQuery()
            : this.dataQueryEngine.findOutliers(rows, querySpec),
          querySpec,
        )
      }
      if (kind === 'compareGroups') {
        result = normalizeCompareGroupsResult(
          supportsUnifiedEngineQuery(this.dataQueryEngine)
            ? runUnifiedQuery()
            : this.dataQueryEngine.compareGroups(rows, normalizeCompareGroupsSpec(querySpec)),
          querySpec,
        )
      }
      const output = makeDataQueryResult({
        ok: false,
        dataRef,
        error: null,
      })
      if (result !== undefined) {
        if (result?.ok === false && result?.error) {
          recordDataQueryFailure(this.traceRecorder, call, {
            code: result.error.code || 'RUNTIME_ERROR',
            message: result.error.message || 'Data query execution failed.',
            ...(result?.error?.details !== undefined ? { details: result.error.details } : {}),
            recoveryHints: Array.isArray(result?.recoveryHints) ? result.recoveryHints : [],
          })
          output.error = result.error
          if (Array.isArray(result?.recoveryHints)) {
            output.recoveryHints = result.recoveryHints
          }
          return output
        }
        output.ok = true
        output.result = result
        if (resultSchema) {
          validateAgainstSchema(output.result, resultSchema, `result.${kind}`)
        }
        ctx.recordDataQuery({
          affectedRefs: runtimeData.widgetRef ? [runtimeData.widgetRef] : [dataRef],
          notes: buildDataQueryTraceNotes({
            kind,
            selectionRef,
            dataRef,
            rowCount: Array.isArray(rows) ? rows.length : null,
          }),
        })
        const tracePayload = ctx.consumeRecordedDataQuery?.() || null
        if (tracePayload) {
          this.traceRecorder?.recordDataQuery?.(tracePayload)
        }
      } else {
        recordDataQueryFailure(this.traceRecorder, call, {
          code: 'UNKNOWN_QUERY_KIND',
          message: `Unsupported data query kind: ${kind || 'missing'}.`,
          recoveryHints: ['Inspect supportedQueryDescriptors on the current data handle before retrying.'],
        })
        output.error = {
          code: 'UNKNOWN_QUERY_KIND',
          message: `Unsupported data query kind: ${kind || 'missing'}.`,
        }
        output.recoveryHints = ['Inspect supportedQueryDescriptors on the current data handle before retrying.']
      }
      return output
    } catch (error) {
      recordDataQueryFailure(this.traceRecorder, call, {
        code: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: [
          'Inspect the current data handle, target ref, and query kind in describeWorkspace() before retrying.',
          'Inspect the selected data query descriptor inputSchema/resultSchema/examples if the runtime result shape does not match the declared contract.',
        ],
      })
      return buildDataQueryError({
        dataRef,
        code: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: [
          'Inspect the current data handle, target ref, and query kind in describeWorkspace() before retrying.',
          'Inspect the selected data query descriptor inputSchema/resultSchema/examples if the runtime result shape does not match the declared contract.',
        ],
      })
    }
  }

  createContext(call = {}) {
    return new DataQueryHandlerContext({
      store: this.store,
      call,
      traceRecorder: this.traceRecorder,
      hostBridge: this.hostBridge,
    })
  }

  describeExecutor() {
    const supportedQueryKinds =
      typeof this.dataQueryEngine?.listSupportedQueryKinds === 'function'
        ? this.dataQueryEngine.listSupportedQueryKinds()
        : [...DATA_QUERY_KINDS]
    const supportedQueryDescriptors = buildSupportedQueryDescriptors(supportedQueryKinds)
    return makeDataQueryExecutorSummary({
      engine: makeDataQueryExecutorEngineSummary({
        kind: this.dataQueryEngine?.kind || null,
        className: this.dataQueryEngine?.constructor?.name || null,
      }),
      counts: makeDataQueryExecutorCounts({
        supportedQueryKindCount: supportedQueryKinds.length,
        supportedQueryDescriptorCount: supportedQueryDescriptors.length,
      }),
      capabilities: makeDataQueryExecutorCapabilities({
        schemaValidation: true,
        returnsValidation: true,
        traceRecording: typeof this.traceRecorder?.recordDataQuery === 'function',
        runtimeDataReads: typeof this.store?.readRuntimeData === 'function',
      }),
      supportedQueryKinds,
      supportedQueryDescriptors,
    })
  }

  describeContext() {
    return DataQueryHandlerContext.describeContract()
  }
}

function normalizeAggregateSpec(spec = {}) {
  const groupBy = Array.isArray(spec.groupBy) ? spec.groupBy : []
  const measures = Array.isArray(spec.measures)
    ? spec.measures
    : Array.isArray(spec.metrics)
      ? spec.metrics
      : []
  return {
    ...spec,
    groupBy,
    measures,
  }
}

function normalizeAggregateResult(result) {
  return {
    rows: Array.isArray(result?.rows) ? result.rows : [],
    rowCount: Number.isFinite(result?.rowCount) ? result.rowCount : (Array.isArray(result?.rows) ? result.rows.length : 0),
  }
}

function buildSummaryMeasures({ fields = [], metrics = [] } = {}) {
  const normalizedFields = Array.isArray(fields) ? fields.filter((field) => typeof field === 'string' && field.length > 0) : []
  const normalizedMetrics = Array.isArray(metrics) ? metrics.filter((metric) => typeof metric === 'string' && metric.length > 0) : []
  const measures = []
  for (const metric of normalizedMetrics) {
    if (metric === 'count') {
      measures.push({ op: 'count', as: 'count' })
      continue
    }
    for (const field of normalizedFields) {
      measures.push({
        op: metric,
        field,
        as: `${field}_${metric}`,
      })
    }
  }
  return measures
}

function normalizeSummarySpec(spec = {}) {
  const measures = Array.isArray(spec.measures) && spec.measures.length > 0
    ? spec.measures
    : buildSummaryMeasures({
        fields: spec.fields,
        metrics: spec.metrics,
      })
  return {
    ...spec,
    measures,
  }
}

function normalizeExtremesSpec(spec = {}) {
  const direction = typeof spec.direction === 'string' ? spec.direction : null
  return {
    ...spec,
    order: direction === 'min' ? 'ascending' : 'descending',
  }
}

function normalizeExtremesResult(result, spec = {}) {
  const direction = typeof spec.direction === 'string'
    ? spec.direction
    : (spec.order === 'ascending' ? 'min' : 'max')
  return {
    field: typeof spec.field === 'string' ? spec.field : null,
    direction,
    rows: Array.isArray(result?.rows) ? result.rows : [],
  }
}

function normalizeOutliersResult(result, spec = {}) {
  return {
    field: typeof spec.field === 'string' ? spec.field : null,
    method: typeof spec.method === 'string' ? spec.method : 'zscore',
    rows: Array.isArray(result?.rows) ? result.rows : [],
    ...(result?.summary ? { summary: result.summary } : {}),
  }
}

function normalizeCompareGroupsSpec(spec = {}) {
  if (Array.isArray(spec.groups) && spec.groups.length >= 2) return spec
  return {
    ...spec,
    groups: [spec.leftGroup, spec.rightGroup].filter((value) => value != null),
  }
}

function normalizeCompareGroupsResult(result, spec = {}) {
  const groups = Array.isArray(result?.groups) ? result.groups : []
  const groupField = typeof spec.groupField === 'string' ? spec.groupField : null
  const valueField = typeof spec.valueField === 'string' ? spec.valueField : null
  let comparison = null
  if (groups.length >= 2) {
    const [left, right] = groups
    const leftMean = typeof left?.mean === 'number' ? left.mean : null
    const rightMean = typeof right?.mean === 'number' ? right.mean : null
    comparison = {
      groupField,
      valueField,
      leftGroup: left?.group ?? null,
      rightGroup: right?.group ?? null,
      deltaMean: leftMean != null && rightMean != null ? leftMean - rightMean : null,
    }
  }
  return {
    groupField,
    valueField,
    groups,
    comparison,
  }
}

function normalizeCorrelationResult(result, spec = {}) {
  return {
    xField: typeof spec.xField === 'string' ? spec.xField : result?.fields?.[0] || null,
    yField: typeof spec.yField === 'string' ? spec.yField : result?.fields?.[1] || null,
    correlation: typeof result?.coefficient === 'number' ? result.coefficient : null,
    sampleSize: Number.isFinite(result?.sampleSize) ? result.sampleSize : 0,
  }
}
