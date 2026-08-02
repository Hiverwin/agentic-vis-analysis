import { cloneJsonValue as clone } from '../../../shared/clone.js'
import { readNormalizedQueryScope } from '../../../core/runtime/support/queryScope.js'
import {
  buildWidgetAggregatePatch,
  buildWidgetChangeEncodingPatch,
} from './semanticPatches.js'
import {
  buildClearSelectionPatch,
  buildRuntimeSelectionPatch,
} from '../shared/selectionPatch.js'
import {
  readSelectionByWidgetView,
  readSelectionPrimaryView,
  readSelectionRegistry,
  withSelectionSubmodel,
} from '../../../workspace/state/selectionStateModel.js'

const GENERIC_WIDGET_ACTIONS = [
  'widget.aggregateData',
  'widget.changeEncoding',
  'widget.resetView',
  'widget.undoView',
]

function readTargetWidgetPrecondition({ call, ctx, message } = {}) {
  const targetRef = readNormalizedQueryScope({ call }).widgetRef || null
  const targetWidget = ctx?.resolveTargetWidget?.({ targetRef }) || null
  if (targetWidget?.ref) return { ok: true }
  return {
    ok: false,
    message: message || 'The requested target widget is not available in the current workspace.',
    details: { targetRef },
    recoveryHints: [
      'Call describeWorkspace() to inspect valid widget refs before retrying.',
      'Retry the action with a targetRef that resolves to a materialized widget.',
    ],
  }
}

function registerTargetWidgetPrecondition(actionExecutor, actionName) {
  actionExecutor?.registerPrecondition?.(actionName, (call, ctx) => (
    readTargetWidgetPrecondition({
      call,
      ctx,
      message: `${actionName} requires a valid target widget.`,
    })
  ))
}

function registerAction(actionExecutor, descriptor, handler) {
  if (!actionExecutor || typeof actionExecutor.register !== 'function') return
  if (typeof actionExecutor.has === 'function' && actionExecutor.has(descriptor.name)) return
  actionExecutor.register(descriptor, handler, { runtimeHandler: true })
}

function makeResetViewState(currentState, targetWidget, store = null) {
  const targetRef = targetWidget?.ref || null
  if (!targetRef) return currentState

  const currentWidget = currentState?.widgets?.[targetRef] || targetWidget
  const nextWidgets = { ...(currentState?.widgets || {}) }
  const rowCount = currentWidget?.data?.rowCount
  const nextData = {
    ...(currentWidget?.data || {}),
    selectedCount: 0,
  }
  if (Number.isFinite(rowCount)) {
    nextData.visibleCount = rowCount
  }

  nextWidgets[targetRef] = {
    ...clone(currentWidget),
    version: (currentWidget?.version || 0) + 1,
    updatedAt: new Date().toISOString(),
    transforms: [],
    selections: {},
    feedback: {},
    data: nextData,
    view: {},
  }

  const currentShared = currentState?.shared || {}
  const registry = readSelectionRegistry(currentShared)
  const refsToRemove = new Set(Object.keys(currentWidget?.selections || {}))
  const nextRegistry = {}
  for (const [selectionRef, selection] of Object.entries(registry)) {
    if (refsToRemove.has(selectionRef) || selection?.sourceWidgetRef === targetRef || selection?.source_widget_ref === targetRef) {
      continue
    }
    nextRegistry[selectionRef] = selection
  }

  const byWidget = readSelectionByWidgetView(currentShared)
  const nextByWidget = {}
  const targetWidgetKey = targetWidget?.widgetId || targetRef
  for (const [widgetKey, selectionView] of Object.entries(byWidget)) {
    if (widgetKey === targetWidgetKey || widgetKey === targetRef) continue
    if (selectionView?.selectionRef && refsToRemove.has(selectionView.selectionRef)) continue
    nextByWidget[widgetKey] = selectionView
  }

  const primary = readSelectionPrimaryView(currentShared)
  const nextPrimary = primary?.selectionRef && refsToRemove.has(primary.selectionRef) ? null : primary
  const stateMeta = typeof store?.stateManager?.createStateMeta === 'function'
    ? store.stateManager.createStateMeta({
        workspaceId: store.workspaceId || 'main',
        previousState: currentState,
        nextWidgets,
        nextShared: withSelectionSubmodel(currentShared, {
          registry: nextRegistry,
          primary: nextPrimary,
          byWidget: nextByWidget,
        }),
        nextTaskContext: currentState?.taskContext,
        nextReplayContext: store?.replayContext ?? currentState?.replayContext,
        branchId: store?.currentBranchId || 'main',
      })
    : null

  return {
    ...(clone(currentState) || {}),
    stateId: stateMeta?.stateId || currentState?.stateId || null,
    createdAt: stateMeta?.createdAt || new Date().toISOString(),
    widgets: nextWidgets,
    shared: withSelectionSubmodel(currentShared, {
      registry: nextRegistry,
      primary: nextPrimary,
      byWidget: nextByWidget,
    }),
  }
}

function collectResetPropagationSourceRefs(currentState, targetWidget) {
  const targetRef = targetWidget?.ref || null
  if (!targetRef) return []
  const currentWidget = currentState?.widgets?.[targetRef] || targetWidget || {}
  const view = currentWidget?.view || {}
  const refs = Object.keys(currentWidget?.selections || {})

  if (view?.zoom || Array.isArray(view?.xDomain) || Array.isArray(view?.yDomain)) refs.push(`${targetRef}/view/zoom`)
  if (view?.sort) refs.push(`${targetRef}/view/sort`)
  if (view?.reencode) refs.push(`${targetRef}/view/reencode`)
  if (view?.highlight) refs.push(`${targetRef}/view/highlight`)
  if (view?.addRemove) refs.push(`${targetRef}/view/addRemove`)

  return Array.from(new Set(refs))
}

function commitViewState(ctx, nextState, transitionType) {
  if (typeof ctx?.store?.commitState === 'function') {
    return ctx.store.commitState(nextState, { transitionType })
  }
  if (ctx?.store && typeof ctx.store === 'object') {
    ctx.store.state = nextState
    ctx.store.widgets = nextState?.widgets || {}
    ctx.store.shared = nextState?.shared || {}
    ctx.store.version = (ctx.store.version || 0) + 1
    ctx.store.stateId = nextState?.stateId || ctx.store.stateId
  }
  return nextState
}

function readPreviousStateSnapshot(ctx) {
  const currentStateId = ctx?.readCurrentState?.()?.stateId || null
  const history = typeof ctx?.store?.listStateSnapshots === 'function'
    ? ctx.store.listStateSnapshots(24)
    : Array.isArray(ctx?.store?.stateSnapshots)
      ? ctx.store.stateSnapshots
      : []
  const snapshots = Array.isArray(history) ? history : []
  if (snapshots.length === 0) return null
  const currentIndex = currentStateId
    ? snapshots.findIndex((entry) => entry?.stateId === currentStateId)
    : snapshots.length - 1
  if (currentIndex > 0) return snapshots[currentIndex - 1]
  return snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
}

export function registerGenericWidgetRuntimeActions(actionExecutor) {
  for (const actionName of GENERIC_WIDGET_ACTIONS) {
    registerTargetWidgetPrecondition(actionExecutor, actionName)
  }

  registerAction(
    actionExecutor,
    { name: 'widget.updateSelection' },
    async (params, ctx) => {
      const selectionType = typeof params.selection_type === 'string' ? params.selection_type : null
      if (!selectionType) {
        throw new Error('widget.updateSelection requires a selection_type.')
      }
      const targetWidget = ctx.targetWidget()
      const selection = {
        selection_id: typeof params.selection_id === 'string' ? params.selection_id : `sel_${Date.now()}`,
        source_widget_id: typeof params.source_widget_id === 'string'
          ? params.source_widget_id
          : targetWidget?.widgetId || undefined,
        selection_type: selectionType,
        ...(params.domain && typeof params.domain === 'object' ? { domain: params.domain } : {}),
        ...(Array.isArray(params.fields) ? { fields: params.fields } : {}),
        ...(params.value && typeof params.value === 'object' && !Array.isArray(params.value) ? { value: params.value } : {}),
        ...(typeof params.keyField === 'string' ? { keyField: params.keyField } : {}),
        ...(Array.isArray(params.keys) ? { keys: params.keys } : {}),
        ...(typeof params.field === 'string' ? { field: params.field } : {}),
        ...(Array.isArray(params.values) ? { values: params.values } : {}),
        predicates: Array.isArray(params.predicates) ? params.predicates : [],
        count: Number.isFinite(params.count) ? params.count : 0,
        summary: typeof params.summary === 'string' ? params.summary : '',
      }
      const patch = buildRuntimeSelectionPatch({
        state: ctx.readCurrentState(),
        targetWidget,
        selection,
      })
      return {
        patch,
        affectedRefs: [targetWidget.ref],
        propagateFromSelection: true,
        result: {
          selection,
          widgetId: targetWidget?.widgetId || null,
        },
        verificationHints: [
          'Read the widget selection state and confirm it matches the supplied runtime selection payload.',
          'Read linked widgets to confirm propagation follows the updated selection.',
        ],
        notes: {
          userVisibleSummary: selection.summary || 'Human-driven selection was applied through the shared action pipeline.',
        },
      }
    },
  )

  registerAction(
    actionExecutor,
    { name: 'widget.clearSelection' },
    (params, ctx) => {
      const targetWidget = ctx.resolveTargetWidget()
      const patch = buildClearSelectionPatch({
        state: ctx.readCurrentState(),
        targetWidget,
      })
      return {
        patch,
        affectedRefs: Object.keys(patch).filter((ref) => ref !== 'shared'),
        result: { cleared: true },
        verificationHints: ['Read the widget state and confirm there is no active selection.'],
      }
    },
  )

  registerAction(
    actionExecutor,
    { name: 'widget.resetView' },
    async (params, ctx) => {
      const targetWidget = ctx.targetWidget()
      const currentState = ctx.readCurrentState()
      const propagateFromRefs = collectResetPropagationSourceRefs(currentState, targetWidget)
      const nextState = makeResetViewState(currentState, targetWidget, ctx.store)
      const committedState = commitViewState(ctx, nextState, 'reset_view')
      return {
        nextState: committedState,
        updatedRefs: [targetWidget.ref],
        affectedRefs: [targetWidget.ref],
        propagateFromRefs,
        result: { reset: true, widgetId: targetWidget.widgetId || null },
        verificationHints: [
          'Read the target widget state and confirm view, transforms, and local selections returned to baseline.',
          'Read the widget render payload and confirm the provider spec no longer contains runtime view projections.',
        ],
        transition: {
          type: 'reset_view',
          notes: {
            userVisibleSummary: 'Widget view state was reset to its baseline.',
          },
        },
      }
    },
  )

  registerAction(
    actionExecutor,
    { name: 'widget.undoView' },
    async (params, ctx) => {
      const targetWidget = ctx.targetWidget()
      const snapshot = readPreviousStateSnapshot(ctx)
      const snapshotState = snapshot?.state || snapshot || null
      if (!snapshotState) {
        throw new Error('widget.undoView requires a previous runtime state snapshot.')
      }
      const committedState = commitViewState(ctx, snapshotState, 'undo_view')
      return {
        nextState: committedState,
        updatedRefs: [targetWidget.ref],
        affectedRefs: [targetWidget.ref],
        result: {
          restored: true,
          widgetId: targetWidget.widgetId || null,
          restoredStateId: snapshotState.stateId || snapshot?.stateId || null,
        },
        verificationHints: [
          'Read the target widget state and confirm the previous view state was restored.',
          'Read the widget render payload and confirm the provider spec matches the restored state.',
        ],
        transition: {
          type: 'undo_view',
          parentStateId: snapshotState.stateId || snapshot?.stateId || null,
          notes: {
            userVisibleSummary: 'Widget view state was restored from the previous runtime snapshot.',
          },
        },
      }
    },
  )

  registerAction(
    actionExecutor,
    { name: 'widget.aggregateData' },
    async (params, ctx) => {
      const groupBy = Array.isArray(params.groupBy) ? params.groupBy.filter((field) => typeof field === 'string' && field.trim()) : []
      const measures = Array.isArray(params.measures)
        ? params.measures
            .map((measure) => ({
              op: typeof measure?.op === 'string' ? measure.op : null,
              field: typeof measure?.field === 'string' ? measure.field : undefined,
              as: typeof measure?.as === 'string' ? measure.as : null,
            }))
            .filter((measure) => measure.op && measure.as)
        : []
      const supportedMeasureOps = new Set(['count', 'sum', 'mean', 'min', 'max', 'median'])
      if (groupBy.length === 0 || measures.length === 0 || measures.some((measure) => !supportedMeasureOps.has(measure.op))) {
        throw new Error('widget.aggregateData requires non-empty groupBy and supported measures (count, sum, mean, min, max, or median) with explicit aliases.')
      }

      const targetWidget = ctx.targetWidget()

      return {
        patch: buildWidgetAggregatePatch({ targetWidget, groupBy, measures }),
        affectedRefs: [targetWidget.ref],
        result: {
          widgetId: targetWidget.widgetId,
          groupBy,
          measures,
        },
        verificationHints: [
          'Call perception.inspectViewConfig to verify the target spec now includes the requested aggregate transform.',
          'Call perception.inspectVisibleRows or summarizeVisible to confirm the widget now exposes grouped summary rows.',
        ],
      }
    },
  )

  registerAction(
    actionExecutor,
    { name: 'widget.changeEncoding' },
    async (params, ctx) => {
      const channel = typeof params.channel === 'string' ? params.channel : null
      const field = typeof params.field === 'string' ? params.field : null
      const type = typeof params.type === 'string' ? params.type : null
      const aggregate = typeof params.aggregate === 'string' ? params.aggregate : null
      const targetWidget = ctx.targetWidget()
      const targetWidgetId = targetWidget?.widgetId || null
      if (!channel || !field || !targetWidgetId) {
        throw new Error('widget.changeEncoding requires a target widget, channel, and field.')
      }

      return {
        patch: buildWidgetChangeEncodingPatch({
          targetWidget,
          channel,
          field,
          type,
          aggregate,
        }),
        affectedRefs: [targetWidget.ref],
        result: {
          widgetId: targetWidgetId,
          channel,
          field,
          ...(type ? { type } : {}),
          ...(aggregate ? { aggregate } : {}),
        },
        verificationHints: [
          'Call perception.inspectViewConfig to verify the encoding channel now points to the new field.',
          'Read the target widget state to confirm the encoding update propagated.',
        ],
      }
    },
  )
}
