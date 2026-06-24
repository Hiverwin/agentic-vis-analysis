import {
  makeDataQueryContextCapabilities,
  makeDataQueryContextIntegrations,
  makeDataQueryContextSummary,
} from '../protocol/dataQueryContext.js'
import { createDefaultWidgetVAHostBridge } from './hostBridge.js'
import {
  readDataHandleFromStore,
  readRuntimeDataFromStore,
  resolveSelectionDataRefFromStore,
  resolveWidgetRecordFromStore,
  readWorkspaceDescriptionFromStore,
  readWorkspaceStateFromStore,
} from './workspaceStoreReaders.js'
import { readSelectionRegistry } from '../../workspace/state/selectionStateModel.js'
import { readFocusState } from '../../workspace/state/focusStateModel.js'
import { deriveHighlightState } from '../../workspace/state/highlightStateModel.js'
import { buildScopedParams, readNormalizedQueryScope } from './queryScope.js'

export class DataQueryContext {
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
    return makeDataQueryContextSummary({
      methods: [
        'readDescription',
        'readCurrentState',
        'readSelectionRegistry',
        'readFocusState',
        'readHighlightState',
        'readQueryScope',
        'readNormalizedQuerySpec',
        'readFocusedWidgetRef',
        'readRuntimeData',
        'resolveTargetWidget',
        'resolveExplicitTarget',
        'resolveSelectionDataRef',
        'resolveDataRef',
        'resolveDataHandle',
        'resolveSelectionState',
        'resolveRows',
        'recordDataQuery',
      ],
      capabilities: makeDataQueryContextCapabilities({
        workspaceRead: true,
        runtimeDataRead: true,
        widgetTargetResolution: true,
        dataHandleResolution: true,
        selectionTargetResolution: true,
        explicitTargetValidation: true,
        selectionScopedQueries: true,
        traceRecording: true,
      }),
      integrations: makeDataQueryContextIntegrations({
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
    const dataRef = normalizedOptions?.queryScope?.dataRef || this.call?.dataRef || this.readQueryScope()?.dataRef
    const targetRef = normalizedOptions?.queryScope?.widgetRef || this.readQueryScope()?.widgetRef || null
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
      return explicitTarget.widget?.data?.currentDataRef
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

  resolveRows(dataRef = this.call?.dataRef, options = {}) {
    const resolvedDataRef = this.resolveDataRef(dataRef)
    const runtimeData = this.readRuntimeData(resolvedDataRef)
    const baseRows = Array.isArray(runtimeData?.rows) ? runtimeData.rows : []
    const normalizedOptions = this.normalizeScopedParams(options, { querySpec: options })
    const selectionRef = normalizedOptions?.queryScope?.selectionRef || this.readQueryScope()?.selectionRef || null
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
  if (predicate?.op === 'equals') return value === predicate?.value
  if (predicate?.op === 'in' && Array.isArray(predicate?.value)) {
    return predicate.value.includes(value)
  }
  if (predicate?.op === 'notIn' && Array.isArray(predicate?.value)) {
    return !predicate.value.includes(value)
  }
  return true
}
