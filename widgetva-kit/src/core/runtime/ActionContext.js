import {
  makeActionContextCapabilities,
  makeActionContextIntegrations,
  makeActionContextSummary,
} from '../protocol/actionContext.js'
import { makeSelectionState } from '../protocol/state.js'
import { buildSelectionStateInput } from './materializers/selectionStateShape.js'
import {
  listStoreWidgets,
  readSnapshotEntryFromStore,
  readSnapshotFromStore,
  readRuntimeDataFromStore,
  readWorkspaceDescriptionFromStore,
  readWorkspaceStateFromStore,
  resolveWidgetRecordFromStore,
} from './workspaceStoreReaders.js'
import {
  patchWidgetInStore,
  updateRuntimeDataInStore,
} from './workspaceStoreMutators.js'
import {
  hasRedoSelectionHistoryInStore,
  hasUndoSelectionHistoryInStore,
  recordSelectionHistorySnapshot,
  resetWorkspaceInteractionsInStore,
  restoreSnapshotStateInStore,
  redoSelectionInStore,
  undoSelectionInStore,
  updateSharedStateInStore,
} from '../../workspace/state/workspaceSharedStateMutators.js'
import {
  normalizePrimarySelectionView,
  readSelectionByWidgetView,
  readSelectionRegistry,
  withSelectionSubmodel,
} from '../../workspace/state/selectionStateModel.js'
import { withFocusSubmodel } from '../../workspace/state/focusStateModel.js'
import { readStatePatch } from './readStatePatch.js'
import { createDefaultWidgetVAHostBridge, createWidgetVAHostBridge } from './hostBridge.js'
import { readNormalizedQueryScope } from './queryScope.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export class ActionContext {
  constructor({
    store,
    descriptor,
    call,
    sync,
    hostBridge,
    getState,
    getAppState,
    subscribe,
    linkEngine,
    helpers = {},
  }) {
    this.store = store
    this.descriptor = descriptor
    this.call = call
    this.sync = sync
    this.hostBridge = hostBridge || createWidgetVAHostBridge({ getState, getAppState, subscribe }) || createDefaultWidgetVAHostBridge()
    this.linkEngine = linkEngine
    this.helpers = {
      cloneValue,
      primaryWidgetSpecFromSnapshot: helpers.primaryWidgetSpecFromSnapshot || (() => null),
      selectionPayloadFromSnapshot: helpers.selectionPayloadFromSnapshot || (() => null),
      selectionPayloadsFromSnapshot: helpers.selectionPayloadsFromSnapshot || (() => ({})),
      annotationsFromSnapshot: helpers.annotationsFromSnapshot || (() => []),
    }
  }

  static describeContract() {
    return makeActionContextSummary({
      methods: [
        'patchWidget',
        'propagate',
        'readStatePatch',
        'syncWorkspace',
        'hostBridge',
        'readDescription',
        'readCurrentState',
        'readCurrentSpec',
        'readBaselineSpec',
        'readFocusedWidgetRef',
        'readWorkspaceAnnotations',
        'readRuntimeData',
        'updateRuntimeData',
        'writeCurrentSpec',
        'updateCurrentSpec',
        'readSnapshot',
        'readSnapshotEntry',
        'resolveTargetWidget',
        'requireTargetWidget',
        'readWidgetAdapter',
        'resolveSelectionRef',
        'resolveSelectionRefs',
        'readRowsForWidget',
        'commitSelection',
        'commitSelections',
        'clearSelection',
        'setFocusedWidgetRef',
        'setWorkspaceAnnotations',
        'addWorkspaceAnnotation',
        'clearWorkspaceAnnotations',
        'undoSelection',
        'redoSelection',
        'resetWorkspace',
        'restoreSnapshotState',
        'collectUpdatedRefs',
        'collectPropagation',
      ],
      capabilities: makeActionContextCapabilities({
        workspaceRead: true,
        workspaceWrite: true,
        specMutation: true,
        snapshotReplay: true,
        runtimeDataRead: true,
        runtimeDataWrite: true,
        widgetTargetResolution: true,
        selectionMutation: true,
        annotationMutation: true,
        linkPropagation: true,
      }),
      integrations: makeActionContextIntegrations({
        store: true,
        appState: false,
        linkEngine: true,
        traceRecorder: false,
      }),
    })
  }

  syncWorkspace() {
    this.sync()
    return this.readCurrentState()
  }

  patchWidget(ref, patch) {
    return patchWidgetInStore(this.store, ref, patch)
  }

  propagate(changedRef, options = {}) {
    const propagation = this.collectPropagation(changedRef, options)
    return options?.returnDetails ? propagation : propagation.refs
  }

  readStatePatch(refs) {
    return readStatePatch(this.store, refs)
  }

  readDescription() {
    return readWorkspaceDescriptionFromStore(this.store)
  }

  readCurrentState(options = {}) {
    return readWorkspaceStateFromStore(this.store, options)
  }

  readCurrentSpec() {
    return this.hostBridge.readCurrentSpec()
  }

  readBaselineSpec() {
    return this.hostBridge.readBaselineSpec()
  }

  readFocusedWidgetRef() {
    return this.hostBridge.readFocusedWidgetRef()
  }

  readWorkspaceAnnotations() {
    return this.hostBridge.readWorkspaceAnnotations()
  }

  readRuntimeData(dataRef) {
    return readRuntimeDataFromStore(this.store, dataRef)
  }

  updateRuntimeData(dataRef, updater) {
    return updateRuntimeDataInStore(this.store, dataRef, updater)
  }

  writeCurrentSpec(nextSpec) {
    if (typeof this.hostBridge.writeCurrentSpec !== 'function') {
      return this.readCurrentState()
    }
    this.store.resetWidgetPatches?.()
    this.hostBridge.writeCurrentSpec(nextSpec, { trackHistory: true })
    this.sync()
    return this.readCurrentState()
  }

  updateCurrentSpec(updater) {
    const currentSpec = this.readCurrentSpec()
    const nextSpec = this.helpers.cloneValue(currentSpec)
    const updatedSpec = typeof updater === 'function' ? updater(nextSpec) || nextSpec : nextSpec
    return this.writeCurrentSpec(updatedSpec)
  }

  readSnapshot(stateId) {
    return readSnapshotFromStore(this.store, stateId) || this.store.readSnapshot?.(stateId) || null
  }

  readSnapshotEntry(stateId) {
    return readSnapshotEntryFromStore(this.store, stateId)
  }

  readQueryScope() {
    return readNormalizedQueryScope({
      call: this.call,
      descriptor: this.descriptor,
    })
  }

  resolveTargetWidget({ kind, targetRef } = {}) {
    const resolvedRef = targetRef || this.readQueryScope()?.widgetRef || null
    if (resolvedRef) {
      return resolveWidgetRecordFromStore(this.store, resolvedRef)
    }
    const focusedWidgetRef = this.readCurrentState()?.shared?.focusedWidget || this.readFocusedWidgetRef() || null
    if (focusedWidgetRef) {
      const focusedWidget = resolveWidgetRecordFromStore(this.store, focusedWidgetRef)
      if (focusedWidget && (!kind || focusedWidget.kind === kind)) {
        return focusedWidget
      }
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

  readWidgetAdapter(targetRef = null) {
    const targetWidget = this.resolveTargetWidget({
      targetRef: targetRef || this.readQueryScope()?.widgetRef || null,
    })
    const widgetRef = targetWidget?.ref || targetRef || null
    return widgetRef ? this.store.getWidgetAdapter?.(widgetRef) || null : null
  }

  resolveSelectionRefs(state = this.readCurrentState(), options = {}) {
    const activeSelections = readSelectionRegistry(state?.shared || {})
    const allRefs = Object.keys(activeSelections).filter(Boolean)
    if (allRefs.length === 0) return []

    const explicitTargetRef = options?.targetRef || null
    const targetWidget = explicitTargetRef
      ? resolveWidgetRecordFromStore(this.store, explicitTargetRef)
      : this.resolveTargetWidget({ kind: options?.kind, targetRef: options?.targetRef })
    const targetWidgetRef = targetWidget?.ref || explicitTargetRef || null
    if (!targetWidgetRef) return allRefs

    const targetSelectionRefs = allRefs.filter((selectionRef) => state?.widgets?.[targetWidgetRef]?.selections?.[selectionRef])
    return targetSelectionRefs.length > 0 ? targetSelectionRefs : allRefs
  }

  resolveSelectionRef(state = this.readCurrentState(), options = {}) {
    return this.resolveSelectionRefs(state, options)[0] || null
  }

  readRowsForWidget(widgetRef) {
    const widgetState = this.store.getWidgetState?.(widgetRef)
      || this.readCurrentState({ refs: [widgetRef] })?.widgets?.[widgetRef]
    const currentDataRef = widgetState?.data?.currentDataRef || widgetState?.data?.sourceDataRef
    const runtimeData = this.readRuntimeData(currentDataRef)
    return {
      dataRef: currentDataRef,
      rows: Array.isArray(runtimeData?.rows) ? runtimeData.rows : [],
    }
  }

  commitSelection(selection, options = {}) {
    if (typeof this.hostBridge.writeCurrentSelection !== 'function') {
      return this.commitSelectionFallback(selection, options)
    }
    this.hostBridge.writeCurrentSelection(selection || null, options)
    return this.syncWorkspace()
  }

  commitSelections(selections, options = {}) {
    if (typeof this.hostBridge.writeCurrentSelections !== 'function') {
      return this.readCurrentState()
    }
    this.hostBridge.writeCurrentSelections(selections || {}, options)
    return this.syncWorkspace()
  }

  clearSelection(options = {}) {
    if (typeof this.hostBridge.writeCurrentSelection !== 'function') {
      return this.clearSelectionFallback(options)
    }
    const targetWidget = this.resolveTargetWidget()
    if (targetWidget?.widgetId) {
      return this.commitSelection(null, {
        ...options,
        removeSourceWidgetId: options?.removeSourceWidgetId || targetWidget.widgetId,
        clearAll: options?.clearAll === true,
      })
    }
    return this.commitSelection(null, options)
  }

  commitSelectionFallback(selection, options = {}) {
    if (!selection) {
      return this.clearSelectionFallback(options)
    }

    const targetWidget = this.resolveTargetWidget({
      targetRef: this.readQueryScope()?.widgetRef || null,
    })
    if (!targetWidget?.ref) {
      return this.readCurrentState()
    }

    const currentState = this.readCurrentState()
    const currentWidgetState = currentState?.widgets?.[targetWidget.ref]
      || this.store.getWidgetState?.(targetWidget.ref)
      || null
    const selectionId = selection.selection_id || `sel_${Date.now()}`
    const selectionRef = `${targetWidget.ref}/selection/${selectionId}`
    const selectionState = makeSelectionState(buildSelectionStateInput({
      ...selection,
      selectionRef,
      selectionId,
      sourceWidgetRef: targetWidget.ref,
      sourceWidgetId: targetWidget.widgetId || null,
    }))
    const nextSelections = {
      ...(currentWidgetState?.selections || {}),
      [selectionRef]: selectionState,
    }

    recordSelectionHistorySnapshot(this.store)
    updateSharedStateInStore(this.store, (shared) => {
      const nextRegistry = {
        ...readSelectionRegistry(shared),
        [selectionRef]: selectionState,
      }
      const nextByWidget = {
        ...readSelectionByWidgetView(shared),
        [targetWidget.widgetId || targetWidget.ref]: normalizePrimarySelectionView({
          ...selectionState,
          selectionRef,
        }, nextRegistry),
      }
      return {
        ...withSelectionSubmodel(shared, {
          registry: nextRegistry,
          primary: normalizePrimarySelectionView({
            ...selectionState,
            selectionRef,
          }, nextRegistry),
          byWidget: nextByWidget,
        }),
        focusedWidget: targetWidget.ref,
      }
    })

    return this.patchWidget(targetWidget.ref, {
      selections: nextSelections,
      data: {
        ...(currentWidgetState?.data || {}),
        ...(Number.isFinite(selection.count) ? { selectedCount: selection.count } : {}),
      },
    })
  }

  clearSelectionFallback(_options = {}) {
    const targetWidget = this.resolveTargetWidget()
    if (!targetWidget?.ref) {
      return this.readCurrentState()
    }

    const currentState = this.readCurrentState()
    const currentWidgetState = currentState?.widgets?.[targetWidget.ref]
      || this.store.getWidgetState?.(targetWidget.ref)
      || null
    const widgetSelectionRefs = Object.keys(currentWidgetState?.selections || {})
    const currentShared = this.readCurrentState()?.shared || {}
    const nextActiveSelections = { ...readSelectionRegistry(currentShared) }
    for (const selectionRef of widgetSelectionRefs) {
      delete nextActiveSelections[selectionRef]
    }
    const nextByWidget = { ...readSelectionByWidgetView(currentShared) }
    delete nextByWidget[targetWidget.widgetId || targetWidget.ref]

    if (widgetSelectionRefs.length > 0) {
      recordSelectionHistorySnapshot(this.store)
    }
    updateSharedStateInStore(this.store, (shared) => withSelectionSubmodel(shared, {
      registry: nextActiveSelections,
      primary: null,
      byWidget: nextByWidget,
    }))

    return this.patchWidget(targetWidget.ref, {
      selections: {},
      data: {
        ...(currentWidgetState?.data || {}),
        selectedCount: 0,
      },
    })
  }

  setFocusedWidgetRef(widgetRef) {
    if (typeof this.hostBridge.setFocusedWidgetRef !== 'function') {
      const nextWidget = widgetRef ? resolveWidgetRecordFromStore(this.store, widgetRef) : null
      return updateSharedStateInStore(this.store, (shared) => withFocusSubmodel(shared, widgetRef
        ? {
          widgetRef,
          widgetId: nextWidget?.widgetId || null,
          source: 'workspace',
        }
        : null))
    }
    this.hostBridge.setFocusedWidgetRef(widgetRef || null)
    return this.syncWorkspace()
  }

  setWorkspaceAnnotations(annotations) {
    if (typeof this.hostBridge.setWorkspaceAnnotations !== 'function') {
      return updateSharedStateInStore(this.store, (shared) => ({
        ...shared,
        annotations: Array.isArray(annotations) ? annotations : [],
      }))
    }
    this.hostBridge.setWorkspaceAnnotations(Array.isArray(annotations) ? annotations : [])
    return this.syncWorkspace()
  }

  addWorkspaceAnnotation(annotation) {
    if (typeof this.hostBridge.addWorkspaceAnnotation !== 'function') {
      return updateSharedStateInStore(this.store, (shared) => ({
        ...shared,
        annotations: [...(Array.isArray(shared?.annotations) ? shared.annotations : []), annotation],
      }))
    }
    this.hostBridge.addWorkspaceAnnotation(annotation)
    return this.syncWorkspace()
  }

  clearWorkspaceAnnotations() {
    if (typeof this.hostBridge.clearWorkspaceAnnotations !== 'function') {
      return updateSharedStateInStore(this.store, (shared) => ({
        ...shared,
        annotations: [],
      }))
    }
    this.hostBridge.clearWorkspaceAnnotations()
    return this.syncWorkspace()
  }

  undoSelection() {
    if (typeof this.store?.beginTransition !== 'function'
      || typeof this.hostBridge.undoSelection !== 'function') {
      return undoSelectionInStore(this.store)
    }
    this.store.beginTransition({ transitionType: 'undo' })
    this.hostBridge.undoSelection()
    return this.syncWorkspace()
  }

  redoSelection() {
    if (typeof this.store?.beginTransition !== 'function'
      || typeof this.hostBridge.redoSelection !== 'function') {
      return redoSelectionInStore(this.store)
    }
    this.store.beginTransition({ transitionType: 'redo' })
    this.hostBridge.redoSelection()
    return this.syncWorkspace()
  }

  hasUndoSelectionHistory() {
    const history = this.hostBridge.readSelectionHistory()
    const selectionsHistory = this.hostBridge.readSelectionsHistory()
    return (Array.isArray(history) && history.length > 0)
      || (Array.isArray(selectionsHistory) && selectionsHistory.length > 0)
      || hasUndoSelectionHistoryInStore(this.store)
  }

  hasRedoSelectionHistory() {
    const future = this.hostBridge.readSelectionFuture()
    const selectionsFuture = this.hostBridge.readSelectionsFuture()
    return (Array.isArray(future) && future.length > 0)
      || (Array.isArray(selectionsFuture) && selectionsFuture.length > 0)
      || hasRedoSelectionHistoryInStore(this.store)
  }

  resetWorkspace() {
    if (typeof this.store?.beginTransition !== 'function'
      || typeof this.hostBridge.resetCurrentSpec !== 'function'
      || typeof this.hostBridge.writeCurrentSelection !== 'function'
      || typeof this.hostBridge.resetSelectionHistory !== 'function'
      || typeof this.hostBridge.setFocusedWidgetRef !== 'function'
      || typeof this.hostBridge.clearWorkspaceAnnotations !== 'function') {
      return resetWorkspaceInteractionsInStore(this.store)
    }
    this.store.beginTransition({ transitionType: 'reset' })
    this.store.resetWidgetPatches?.()
    this.hostBridge.resetCurrentSpec()
    this.hostBridge.writeCurrentSelection(null, { trackHistory: false })
    this.hostBridge.resetSelectionHistory()
    this.hostBridge.setFocusedWidgetRef(null)
    this.hostBridge.clearWorkspaceAnnotations()
    return this.syncWorkspace()
  }

  restoreSnapshotState(snapshot) {
    const snapshotState = snapshot?.state || snapshot
    const replayContext = snapshot?.replayContext || null
    const restoredSpec = this.helpers.primaryWidgetSpecFromSnapshot(snapshotState)
    if (typeof this.hostBridge.resetSelectionHistory !== 'function'
      || typeof this.hostBridge.writeCurrentSelections !== 'function'
      || typeof this.hostBridge.setFocusedWidgetRef !== 'function'
      || typeof this.hostBridge.setWorkspaceAnnotations !== 'function'
      || typeof this.hostBridge.writeCurrentSpec !== 'function') {
      return restoreSnapshotStateInStore(this.store, snapshot)
    }
    this.store.resetWidgetPatches?.()
    if (Object.prototype.hasOwnProperty.call(replayContext || {}, 'baselineSpec')) {
      this.hostBridge.writeCurrentSpec(replayContext?.baselineSpec ?? null, {
        replaceBaseline: true,
        trackHistory: false,
      })
    }
    this.hostBridge.writeWorkspaceSpec?.(replayContext?.workspaceSpec ?? null)
    this.hostBridge.writePlanningRequest?.(replayContext?.planningRequest ?? null)
    if (replayContext?.runMode) this.hostBridge.writeRunMode?.(replayContext.runMode)
    this.hostBridge.writeUserIntent?.(replayContext?.userIntent ?? '')
    if (restoredSpec) {
      this.hostBridge.writeCurrentSpec(restoredSpec, { trackHistory: false })
    } else if (Object.prototype.hasOwnProperty.call(replayContext || {}, 'currentSpec')) {
      this.hostBridge.writeCurrentSpec(replayContext?.currentSpec ?? null, { trackHistory: false })
    }
    const selection = this.helpers.selectionPayloadFromSnapshot(snapshotState)
    const selections = this.helpers.selectionPayloadsFromSnapshot(snapshotState)
    this.hostBridge.resetSelectionHistory()
    this.hostBridge.writeCurrentSelections(selections, { fallbackSelection: selection, trackHistory: false })
    this.hostBridge.setFocusedWidgetRef(snapshotState?.shared?.focusedWidget || null)
    this.hostBridge.setWorkspaceAnnotations(this.helpers.annotationsFromSnapshot(snapshotState))
    return this.syncWorkspace()
  }

  collectUpdatedRefs(nextState, extraRefs = []) {
    const changedRefs = nextState?.delta?.changedRefs?.length
      ? nextState.delta.changedRefs
      : Object.keys(nextState?.widgets || {})
    return Array.from(new Set([...(changedRefs || []), ...(extraRefs || [])]))
  }

  collectPropagation(selectionRef, options = {}) {
    if (!selectionRef || !this.linkEngine) {
      return {
        refs: [],
        links: [],
        effects: [],
      }
    }

    const propagation = this.linkEngine.propagate({
      sourceRef: selectionRef,
      state: options.state || this.readCurrentState(),
    })
    return {
      nextState: propagation?.nextState || this.readCurrentState(),
      refs: Array.isArray(propagation?.affectedRefs) ? propagation.affectedRefs : [],
      links: Array.isArray(propagation?.links) ? propagation.links : [],
      effects: Array.isArray(propagation?.effects) ? propagation.effects : [],
    }
  }
}
