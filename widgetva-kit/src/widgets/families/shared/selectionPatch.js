import { makeSelectionState } from '../../../contracts/state-contracts.js'
import { buildSelectionStateInput } from '../../../core/runtime/materializers/state/selectionStateShape.js'
import {
  normalizePrimarySelectionView,
  readSelectionByWidgetView,
  readSelectionRegistry,
  withSelectionSubmodel,
} from '../../../workspace/state/selectionStateModel.js'

export const MERGE_SHARED_PATCH_MODE = 'widgetva.mergeSharedPatch'

export function buildWidgetSelectionPatch({ targetWidget, selection }) {
  const selectionId = selection.selection_id || selection.selectionId || selection.id || 'selection'
  const selectionRef = `${targetWidget.ref}/selection/${selectionId}`
  const selectionState = makeSelectionState(buildSelectionStateInput({
    ...selection,
    selectionRef,
    selectionId,
    sourceWidgetRef: targetWidget.ref,
    sourceWidgetId: targetWidget.widgetId || null,
  }))
  const nextRegistry = { [selectionRef]: selectionState }
  const primarySelectionView = {
    ...selectionState,
    selectionRef,
  }
  const widgetSelectionViews = {
    [targetWidget.widgetId || targetWidget.ref]: primarySelectionView,
  }

  return {
    [targetWidget.ref]: {
      selections: {
        [selectionRef]: selectionState,
      },
      ...(Number.isFinite(selection.count)
        ? { data: { selectedCount: selection.count } }
        : {}),
    },
    shared: {
      __widgetvaPatchMode: MERGE_SHARED_PATCH_MODE,
      ...withSelectionSubmodel({}, {
        registry: nextRegistry,
        primary: primarySelectionView,
        byWidget: widgetSelectionViews,
      }),
      focusedWidget: targetWidget.ref,
    },
  }
}

export function buildRuntimeSelectionPatch({ state, targetWidget, selection }) {
  const selectionId = selection.selection_id || selection.selectionId || selection.id || 'selection'
  const selectionRef = `${targetWidget.ref}/selection/${selectionId}`
  const selectionState = makeSelectionState(buildSelectionStateInput({
    ...selection,
    selectionRef,
    selectionId,
    sourceWidgetRef: targetWidget.ref,
    sourceWidgetId: targetWidget.widgetId || null,
  }))
  const currentWidgetState = state?.widgets?.[targetWidget.ref] || targetWidget || {}
  const currentShared = state?.shared || {}
  const nextRegistry = {
    ...readSelectionRegistry(currentShared),
    [selectionRef]: selectionState,
  }
  const primaryView = normalizePrimarySelectionView({
    ...selectionState,
    selectionRef,
  }, nextRegistry)
  const nextByWidget = {
    ...readSelectionByWidgetView(currentShared),
    [targetWidget.widgetId || targetWidget.ref]: primaryView,
  }

  return {
    [targetWidget.ref]: {
      selections: {
        ...(currentWidgetState.selections || {}),
        [selectionRef]: selectionState,
      },
      data: {
        ...(currentWidgetState.data || {}),
        ...(Number.isFinite(selection.count) ? { selectedCount: selection.count } : {}),
      },
    },
    shared: {
      ...withSelectionSubmodel(currentShared, {
        registry: nextRegistry,
        primary: primaryView,
        byWidget: nextByWidget,
      }),
      focusedWidget: targetWidget.ref,
    },
  }
}

export function buildClearSelectionPatch({ state, targetWidget = null }) {
  const shared = state?.shared || {}
  const widgets = state?.widgets || {}
  const targetRef = targetWidget?.ref || null
  const targetWidgetState = targetRef ? widgets?.[targetRef] || targetWidget : null
  const selectionRefsToClear = targetRef
    ? Object.keys(targetWidgetState?.selections || {})
    : Object.keys(readSelectionRegistry(shared))
  const refsToClear = new Set(selectionRefsToClear)
  const nextRegistry = { ...readSelectionRegistry(shared) }
  for (const selectionRef of refsToClear) {
    delete nextRegistry[selectionRef]
  }

  const currentByWidget = readSelectionByWidgetView(shared)
  const nextByWidget = {}
  for (const [widgetKey, selectionView] of Object.entries(currentByWidget || {})) {
    if (!selectionView?.selectionRef || !refsToClear.has(selectionView.selectionRef)) {
      nextByWidget[widgetKey] = selectionView
    }
  }

  const patch = {
    shared: withSelectionSubmodel(shared, {
      registry: nextRegistry,
      primary: null,
      byWidget: nextByWidget,
    }),
  }

  if (targetRef) {
    patch[targetRef] = {
      selections: {},
      data: {
        ...(targetWidgetState?.data || {}),
        selectedCount: 0,
      },
    }
  } else {
    for (const [widgetRef, widgetState] of Object.entries(widgets)) {
      if (Object.keys(widgetState?.selections || {}).length === 0) continue
      patch[widgetRef] = {
        selections: {},
        data: {
          ...(widgetState?.data || {}),
          selectedCount: 0,
        },
      }
    }
  }

  return patch
}
