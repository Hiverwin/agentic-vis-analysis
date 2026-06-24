import {
  makePerceptionContextCapabilities,
  makePerceptionContextIntegrations,
  makePerceptionContextSummary,
} from '../protocol/perceptionContext.js'
import { createDefaultWidgetVAHostBridge } from './hostBridge.js'
import {
  listStoreWidgets,
  readDataHandleFromStore,
  readRuntimeDataFromStore,
  readWorkspaceDescriptionFromStore,
  readWorkspaceStateFromStore,
  resolveSelectionDataRefFromStore,
  resolveWidgetRecordFromStore,
} from './workspaceStoreReaders.js'
import { readSelectionRegistry } from '../../workspace/state/selectionStateModel.js'
import { readFocusState } from '../../workspace/state/focusStateModel.js'
import { deriveHighlightState } from '../../workspace/state/highlightStateModel.js'
import { buildScopedParams, readNormalizedQueryScope } from './queryScope.js'

export class PerceptionContext {
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
    return makePerceptionContextSummary({
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
      capabilities: makePerceptionContextCapabilities({
        workspaceRead: true,
        runtimeDataRead: true,
        widgetTargetResolution: true,
        dataHandleResolution: true,
        selectionScopedQueries: true,
        traceRecording: true,
      }),
      integrations: makePerceptionContextIntegrations({
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

  resolveTargetWidget({ kind, targetRef } = {}) {
    const queryScope = this.readQueryScope()
    const resolvedRef = targetRef || queryScope?.widgetRef || null
    if (resolvedRef) {
      const explicitTarget = resolveWidgetRecordFromStore(this.store, resolvedRef)
      if (explicitTarget && (!kind || explicitTarget.kind === kind)) {
        return explicitTarget
      }
      return null
    }

    const focusedWidgetRef = this.readFocusedWidgetRef()
    if (focusedWidgetRef) {
      const focusedWidget = resolveWidgetRecordFromStore(this.store, focusedWidgetRef)
      if (focusedWidget && (!kind || focusedWidget.kind === kind)) return focusedWidget
    }

    const widgets = listStoreWidgets(this.store)
    if (kind) {
      const match = widgets.find((widget) => widget.kind === kind) || null
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
    const selectionScopedDataRef = this.resolveSelectionDataRef(queryScope?.selectionRef || callTargetRef)
    if (selectionScopedDataRef) {
      return selectionScopedDataRef
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
    const selectionRef = queryScope?.selectionRef || null

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
  if (predicate?.op === 'equals') return value === predicate?.value
  if (predicate?.op === 'in' && Array.isArray(predicate?.value)) {
    return predicate.value.includes(value)
  }
  if (predicate?.op === 'notIn' && Array.isArray(predicate?.value)) {
    return !predicate.value.includes(value)
  }
  return true
}
