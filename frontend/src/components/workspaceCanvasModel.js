import { buildSingleWidgetWorkspace } from 'widgetva-kit/core-compose'

export function resolveWidgetLayout(widgetDescriptions, widgetStatesByRef, focusedWidgetRef) {
  const orderedWidgets = widgetDescriptions
    .map((description) => ({
      description,
      state: widgetStatesByRef[description.ref],
    }))
    .filter((entry) => entry.state)

  if (!orderedWidgets.length) {
    return {
      orderedWidgets,
      primaryWidget: null,
      secondaryWidgets: [],
    }
  }

  const focusedIndex = focusedWidgetRef
    ? orderedWidgets.findIndex(({ description }) => description.ref === focusedWidgetRef)
    : -1

  if (focusedIndex <= 0) {
    return {
      orderedWidgets,
      primaryWidget: orderedWidgets[0] || null,
      secondaryWidgets: orderedWidgets.slice(1),
    }
  }

  const primaryWidget = orderedWidgets[focusedIndex]
  const secondaryWidgets = orderedWidgets.filter((_, index) => index !== focusedIndex)
  return {
    orderedWidgets,
    primaryWidget,
    secondaryWidgets,
  }
}

export function resolveWorkspaceCanvasWorkspace({
  runtimeStoreSnapshot,
  spec,
  workspaceSpec = null,
  planningRequest = null,
  currentSelection = null,
  currentSelections = null,
}) {
  if (runtimeStoreSnapshot?.description && runtimeStoreSnapshot?.state) {
    return {
      description: runtimeStoreSnapshot.description,
      state: runtimeStoreSnapshot.state,
    }
  }
  return buildSingleWidgetWorkspace({
    appId: 'widgetva-app',
    workspaceId: 'preview',
    sessionId: 'preview',
    spec,
    workspaceSpec,
    planningRequest: planningRequest || { runMode: 'goal_oriented' },
    selection: currentSelection,
    selections: currentSelections,
  })
}

export function shouldRenderWorkspaceCanvasPlaceholder({ spec, primaryWidget }) {
  return !spec && !primaryWidget
}
