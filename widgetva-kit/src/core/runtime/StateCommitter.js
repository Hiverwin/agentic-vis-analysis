import { makeActionResult } from '../../contracts/result-contracts.js'
import {
  readSelectionByWidgetView,
  readSelectionPrimaryView,
  readSelectionRegistry,
  withSelectionSubmodel,
} from '../../workspace/state/selectionStateModel.js'
import { buildActionVerificationPayload } from './verification/actionVerification.js'
import { readNormalizedQueryScope } from './support/queryScope.js'
import { readWorkspaceStateFromStore, resolveWidgetRecordFromStore } from '../../workspace/store/workspaceStoreReaders.js'
import { deriveGlobalFiltersFromState } from '../../workspace/state/sharedStateDerivation.js'

const MERGE_SHARED_PATCH_MODE = 'widgetva.mergeSharedPatch'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function mergeRuntimePatch(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return cloneValue(base) || {}
  const output = Array.isArray(base) ? [...base] : { ...(cloneValue(base) || {}) }
  for (const [key, value] of Object.entries(patch)) {
    if (key === '__widgetvaPatchMode') continue
    if (Array.isArray(value)) {
      output[key] = cloneValue(value)
      continue
    }
    if (value && typeof value === 'object') {
      output[key] = mergeRuntimePatch(output[key], value)
      continue
    }
    output[key] = value
  }
  return output
}

function prepareWidgetBaseForPatch(currentWidget, patch) {
  const base = {
    ...cloneValue(currentWidget),
    version: (currentWidget.version || 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  if (!patch?.view || typeof patch.view !== 'object' || Array.isArray(patch.view)) {
    return base
  }

  const nextViewBase = { ...(base.view || {}) }
  for (const key of Object.keys(patch.view)) {
    delete nextViewBase[key]
  }
  return {
    ...base,
    view: nextViewBase,
  }
}

function mergeSharedStatePatch(currentShared = {}, sharedPatch = {}) {
  const patch = cloneValue(sharedPatch) || {}
  const nextSharedBase = mergeRuntimePatch(currentShared, patch)
  const patchRegistry = readSelectionRegistry(patch)
  const patchHasSelectionState = Object.keys(patchRegistry).length > 0
    || Object.prototype.hasOwnProperty.call(patch, 'activeSelections')
    || Object.prototype.hasOwnProperty.call(patch, 'selections')

  if (!patchHasSelectionState) return nextSharedBase

  const nextRegistry = {
    ...readSelectionRegistry(currentShared),
    ...patchRegistry,
  }
  const patchPrimary = readSelectionPrimaryView(patch)
  const nextByWidget = {
    ...readSelectionByWidgetView(currentShared),
    ...readSelectionByWidgetView(patch),
  }

  return withSelectionSubmodel(nextSharedBase, {
    registry: nextRegistry,
    primary: patchPrimary === null ? undefined : patchPrimary,
    byWidget: nextByWidget,
  })
}

function createCommittedState({ store, currentState, nextWidgets, nextShared, transition = {} } = {}) {
  const stateMeta = typeof store?.stateManager?.createStateMeta === 'function'
    ? store.stateManager.createStateMeta({
        workspaceId: store.workspaceId || 'main',
        previousState: currentState,
        nextWidgets,
        nextShared,
        nextTaskContext: currentState?.taskContext,
        nextReplayContext: store?.replayContext ?? currentState?.replayContext,
        branchId: store?.currentBranchId || 'main',
      })
    : null
  const nextState = {
    ...(cloneValue(currentState) || {}),
    stateId: stateMeta?.stateId || currentState?.stateId || null,
    createdAt: stateMeta?.createdAt || new Date().toISOString(),
    widgets: nextWidgets,
    shared: {
      ...(nextShared || {}),
      globalFilters: deriveGlobalFiltersFromState({
        ...(currentState || {}),
        widgets: nextWidgets,
        shared: nextShared || {},
      }),
    },
  }

  if (typeof store?.commitState === 'function') {
    return store.commitState(nextState, {
      transitionType: transition?.type || transition?.transitionType || 'continue',
      parentStateId: transition?.parentStateId,
      branchId: transition?.branchId,
      branchLabel: transition?.branchLabel,
    })
  }

  if (store?.state && typeof store.state === 'object') {
    store.state = nextState
  }
  store.widgets = nextWidgets
  store.shared = nextState.shared
  store.version = (store?.version || 0) + 1
  store.stateId = nextState.stateId
  return nextState
}

function rememberWidgetPatches(store, widgetPatchEntries) {
  if (!store || !Object.prototype.hasOwnProperty.call(store, 'widgetStatePatches')) return
  const nextPatches = { ...(store.widgetStatePatches || {}) }
  for (const [ref, patch] of widgetPatchEntries) {
    nextPatches[ref] = mergeRuntimePatch(nextPatches[ref] || {}, patch)
  }
  store.widgetStatePatches = nextPatches
}

export function buildActionStatePatch(store, refs = []) {
  const normalizedRefs = Array.isArray(refs) ? refs.filter(Boolean) : []

  if (typeof store?.buildStatePatch === 'function') {
    return store.buildStatePatch(normalizedRefs)
  }

  const state = readWorkspaceStateFromStore(store, { refs: normalizedRefs }) || {}
  const patch = {}

  for (const ref of normalizedRefs) {
    if (state?.widgets?.[ref]) {
      patch[ref] = cloneValue(state.widgets[ref])
      continue
    }
    if (ref === 'shared' && state?.shared !== undefined) {
      patch.shared = cloneValue(state.shared)
      continue
    }
    if (ref === 'taskContext' && state?.taskContext !== undefined) {
      patch.taskContext = cloneValue(state.taskContext)
      continue
    }
    if (ref === 'replayContext' && state?.replayContext !== undefined) {
      patch.replayContext = cloneValue(state.replayContext)
    }
  }

  return patch
}

export function commitActionPatch(output, ctx) {
  if (!output || typeof output !== 'object' || !output.patch || typeof output.patch !== 'object' || Array.isArray(output.patch)) {
    return output
  }

  const patchEntries = Object.entries(output.patch)
  const widgetPatchEntries = patchEntries.filter(([ref]) => ref !== 'shared')
  const affectedRefs = Array.isArray(output.affectedRefs) && output.affectedRefs.length > 0
    ? output.affectedRefs
    : widgetPatchEntries.map(([ref]) => ref)
  const currentState = ctx.readCurrentState()
  const currentWidgets = currentState?.widgets || {}
  const nextWidgets = { ...currentWidgets }

  for (const [ref, patch] of widgetPatchEntries) {
    const currentWidget = currentWidgets?.[ref]
    if (!currentWidget) {
      throw new Error(`Unknown widget: ${ref}`)
    }
    nextWidgets[ref] = mergeRuntimePatch(prepareWidgetBaseForPatch(currentWidget, patch), patch)
  }

  let nextShared = cloneValue(currentState?.shared || {})
  if (Object.prototype.hasOwnProperty.call(output.patch, 'shared')) {
    nextShared = output.patch.shared?.__widgetvaPatchMode === MERGE_SHARED_PATCH_MODE
      ? mergeSharedStatePatch(nextShared, output.patch.shared)
      : cloneValue(output.patch.shared)
  }
  rememberWidgetPatches(ctx.store, widgetPatchEntries)
  const nextState = createCommittedState({
    store: ctx.store,
    currentState,
    nextWidgets,
    nextShared,
    transition: output.transition,
  })

  return {
    ...output,
    updatedRefs: Array.isArray(output.updatedRefs) ? output.updatedRefs : affectedRefs,
    nextState: output.nextState || nextState,
  }
}

function defaultCollectUpdatedRefs(nextState, extraRefs = []) {
  const changedRefs = nextState?.delta?.changedRefs?.length
    ? nextState.delta.changedRefs
    : Object.keys(nextState?.widgets || {})
  return Array.from(new Set([...(changedRefs || []), ...(extraRefs || [])]))
}

function mergeUniqueRefs(...groups) {
  return Array.from(
    new Set(
      groups.flatMap((group) => (Array.isArray(group) ? group : [])).filter((ref) => typeof ref === 'string' && ref.length > 0),
    ),
  )
}

function resolveActionTargetRef(call, descriptor = null) {
  return readNormalizedQueryScope({ call, descriptor }).widgetRef || null
}

function resolveSelectionRefsForAction(ctx, state, options = {}) {
  const activeSelections = readSelectionRegistry(state?.shared || {})
  const allRefs = Object.keys(activeSelections).filter(Boolean)
  if (allRefs.length === 0) return []

  const explicitTargetRef = options?.targetRef || null
  const resolvedTargetWidget = explicitTargetRef
    ? resolveWidgetRecordFromStore(ctx.store, explicitTargetRef)
    : ctx.resolveTargetWidget({ kind: options?.kind, targetRef: options?.targetRef })
  const targetWidgetRef = resolvedTargetWidget?.ref || explicitTargetRef || null
  if (!targetWidgetRef) return allRefs

  const targetSelectionRefs = allRefs.filter((selectionRef) => state?.widgets?.[targetWidgetRef]?.selections?.[selectionRef])
  return targetSelectionRefs.length > 0 ? targetSelectionRefs : allRefs
}

function resolveSelectionRefForAction(ctx, state, options = {}) {
  return resolveSelectionRefsForAction(ctx, state, options)[0] || null
}

function descriptorUpdatesSelection(descriptor) {
  return descriptor?.category === 'selection'
    || (Array.isArray(descriptor?.effects) && descriptor.effects.some((effect) => effect?.kind === 'updatesSelection'))
}

function actionMayClearSelection(call) {
  const actionName = call?.name || ''
  return actionName === 'widget.clearSelection'
    || actionName === 'workspace.resetWorkspace'
    || actionName === 'workspace.jumpToState'
    || actionName === 'workspace.branchFromState'
    || actionName.endsWith('.reset')
    || actionName.toLowerCase().includes('reset')
    || actionName.toLowerCase().includes('undo')
}

function callRemovesSelection(output, descriptor) {
  if (output?.clearsSelection === true) return true
  const actionName = descriptor?.name || null
  return actionName === 'widget.clearSelection'
    || actionName === 'workspace.resetWorkspace'
    || actionName === 'workspace.jumpToState'
    || actionName === 'workspace.branchFromState'
}

function collectPropagation(sourceRef, options = {}) {
  const coordinationEngine = options.coordinationEngine || null
  if (!sourceRef || typeof coordinationEngine?.propagate !== 'function') {
    return {
      refs: [],
      links: [],
      effects: [],
    }
  }

  const fallbackState = typeof options.readCurrentState === 'function'
    ? options.readCurrentState()
    : null
  const propagation = coordinationEngine.propagate({
    sourceRef,
    state: options.state || fallbackState,
  })
  return {
    nextState: propagation?.nextState || options.state || fallbackState,
    refs: Array.isArray(propagation?.affectedRefs) ? propagation.affectedRefs : [],
    links: Array.isArray(propagation?.links) ? propagation.links : [],
    effects: Array.isArray(propagation?.effects) ? propagation.effects : [],
  }
}

function normalizePropagationSourceRefs(...sources) {
  return Array.from(new Set(
    sources
      .flatMap((source) => (Array.isArray(source) ? source : [source]))
      .filter((source) => typeof source === 'string' && source.length > 0),
  ))
}

function collectPropagationForSources(sourceRefs, options = {}) {
  const refs = []
  const links = []
  const effects = []
  let nextState = options.state

  for (const sourceRef of sourceRefs) {
    const propagation = collectPropagation(sourceRef, {
      ...options,
      state: nextState || options.state,
    })
    nextState = propagation.nextState || nextState
    refs.push(...propagation.refs)
    links.push(...propagation.links)
    effects.push(...propagation.effects)
  }

  return {
    nextState,
    refs: mergeUniqueRefs(refs),
    links,
    effects: Array.from(new Set(effects)),
  }
}

export function enrichActionOutputWithPropagation({
  output,
  descriptor,
  call,
  ctx,
  coordinationEngine = null,
  previousState,
  nextState,
  collectUpdatedRefs = defaultCollectUpdatedRefs,
} = {}) {
  if (!output || typeof output !== 'object') return output

  const selectionResolveOptions = {
    targetRef: resolveActionTargetRef(call, descriptor),
    kind: descriptor?.supportedWidgetKinds?.[0] || null,
  }
  const previousSelectionRef = resolveSelectionRefForAction(ctx, previousState, selectionResolveOptions)
  const nextSelectionRef = resolveSelectionRefForAction(ctx, nextState, selectionResolveOptions)
  const shouldPropagateSelection = Boolean(output.propagateFromSelection)
    || (descriptorUpdatesSelection(descriptor) && !Array.isArray(output.updatedRefs))
  const inferredPropagateFromRef = output.propagateFromRef
    || (shouldPropagateSelection ? nextSelectionRef : null)
    || (
      previousSelectionRef && !nextSelectionRef && (
        descriptorUpdatesSelection(descriptor)
        || actionMayClearSelection(call)
        || callRemovesSelection(output, descriptor)
      )
        ? previousSelectionRef
        : null
    )
  const propagateFromRefs = normalizePropagationSourceRefs(output.propagateFromRefs, inferredPropagateFromRef)

  if (propagateFromRefs.length === 0) {
    return output
  }

  const propagation = collectPropagationForSources(propagateFromRefs, {
    state: nextState,
    coordinationEngine,
    readCurrentState: () => ctx.readCurrentState(),
  })
  const primaryPropagationSourceRef = propagateFromRefs[0] || null

  return {
    ...output,
    nextState: propagation.nextState || nextState,
    updatedRefs: mergeUniqueRefs(
      Array.isArray(output.updatedRefs) ? output.updatedRefs : collectUpdatedRefs(nextState, output?.extraRefs || []),
      propagation.refs,
    ),
    result: {
      ...(output.result || {}),
      ...(output.result?.propagationSourceRef ? {} : { propagationSourceRef: primaryPropagationSourceRef }),
      ...(output.result?.propagationSourceRefs ? {} : { propagationSourceRefs: propagateFromRefs }),
      ...(output.result?.propagated ? {} : { propagated: propagation.links }),
      ...(output.result?.propagationEffects ? {} : { propagationEffects: propagation.effects }),
    },
  }
}

export function finalizeActionCommit({
  store,
  traceRecorder = null,
  call,
  descriptor,
  output,
  nextState,
  collectUpdatedRefs = defaultCollectUpdatedRefs,
} = {}) {
  const resolvedNextState = nextState || output?.nextState || {}
  const updatedRefs = Array.isArray(output?.updatedRefs)
    ? output.updatedRefs
    : Array.isArray(output?.affectedRefs)
      ? output.affectedRefs
      : collectUpdatedRefs(resolvedNextState, output?.extraRefs || [])
  const statePatch = output?.statePatch || buildActionStatePatch(store, updatedRefs)
  const verificationPayload = buildActionVerificationPayload({
    descriptor,
    updatedRefs,
    verificationHints: output?.verificationHints,
  })

  traceRecorder?.recordAction?.({
    call,
    updatedRefs,
    stateId: resolvedNextState.stateId,
    statePatch,
    notes: {
      ...(output?.notes || {}),
      ...(Array.isArray(output?.result?.propagationSourceRefs)
        ? { propagationSourceRefs: output.result.propagationSourceRefs }
        : output?.result?.propagationSourceRef
          ? { propagationSourceRefs: [output.result.propagationSourceRef] }
          : {}),
      ...(typeof verificationPayload.verificationNote === 'string'
        && verificationPayload.verificationNote.length > 0
        ? { verification: verificationPayload.verificationNote }
        : {}),
      ...(verificationPayload.verificationHints.length > 0
        ? { verificationHints: verificationPayload.verificationHints }
        : {}),
    },
  })

  if (output?.transition && typeof traceRecorder?.recordSystemTransition === 'function') {
    traceRecorder.recordSystemTransition({
      actor: call?.actor || 'agent',
      transitionType: output.transition.type || 'continue',
      stateId: resolvedNextState.stateId,
      affectedRefs: updatedRefs,
      statePatch,
      notes: output.transition.notes,
    })
  }

  return makeActionResult({
    ok: true,
    callId: call?.callId || `call_${Date.now()}`,
    actionName: call?.name || 'unknown',
    updatedRefs,
    stateId: resolvedNextState.stateId,
    statePatch,
    providerParams: output?.providerParams,
    result: output?.result,
    expectedPostconditions: verificationPayload.expectedPostconditions,
    verificationHints: verificationPayload.verificationHints.length > 0
      ? verificationPayload.verificationHints
      : [
          'Call readState({ refs: updatedRefs }) to verify the state update.',
          'Call a perception query if the task requires numerical or aggregate evidence.',
        ],
  })
}

export function createStateCommitter({ store } = {}) {
  return {
    commitActionPatch(output, ctx) {
      return commitActionPatch(output, ctx)
    },
    buildActionStatePatch(refs = []) {
      return buildActionStatePatch(store || null, refs)
    },
    finalizeActionCommit(options = {}) {
      return finalizeActionCommit({
        store: store || null,
        ...options,
      })
    },
    enrichActionOutputWithPropagation(options = {}) {
      return enrichActionOutputWithPropagation(options)
    },
  }
}
