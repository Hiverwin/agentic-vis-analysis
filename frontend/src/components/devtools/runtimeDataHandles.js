import {
  makeCurrentSelectionDataRef,
  makeCurrentViewDataRef,
  makeSelectionScopedDataRef,
  makeWidgetSelectionDataRef,
  summarizeWorkspaceState,
} from 'widgetva-kit/core-inspect'

function pickFocusedWidget(snapshot) {
  const focusedWidgetRef = summarizeWorkspaceState(snapshot)?.focusedWidgetRef || null
  return focusedWidgetRef ? snapshot?.widgets?.[focusedWidgetRef] || null : null
}

export function resolveRuntimeDataHandleOptions({ snapshot, workspace }) {
  const focusedWidget = pickFocusedWidget(snapshot)
  const workspaceHandles = Array.isArray(workspace?.dataHandles) ? workspace.dataHandles : []
  if (!focusedWidget?.widgetId) {
    return {
      focusedWidget: focusedWidget || null,
      options: [],
    }
  }

  const currentDataRefs = [
    focusedWidget?.data?.currentDataRef,
    focusedWidget?.data?.sourceDataRef,
  ].filter((ref, index, refs) => typeof ref === 'string' && ref.length > 0 && refs.indexOf(ref) === index)
  const appId = workspace?.appId || 'widgetva-app'
  const workspaceId = workspace?.workspaceId || 'main'

  const selectionRefs = Object.keys(focusedWidget?.selections || {})
  const currentViewRef = makeCurrentViewDataRef({ appId, workspaceId })
  const currentSelectionRef = selectionRefs.length > 0
    ? makeCurrentSelectionDataRef({ appId, workspaceId })
    : null
  const combinedSelectionRef = selectionRefs.length > 0
    ? makeWidgetSelectionDataRef({ appId, workspaceId, widgetId: focusedWidget.widgetId })
    : null
  const selectionScopedRefs = selectionRefs.map((selectionRef) => {
    const selectionId = selectionRef.split('/').pop() || null
    if (!selectionId) return null
    return makeSelectionScopedDataRef({
      appId,
      workspaceId,
      widgetId: focusedWidget.widgetId,
      selectionId,
    })
  }).filter(Boolean)

  const orderedRefs = [
    currentViewRef,
    ...currentDataRefs,
    ...(currentSelectionRef ? [currentSelectionRef] : []),
    ...selectionScopedRefs,
    ...(combinedSelectionRef ? [combinedSelectionRef] : []),
  ]

  const options = orderedRefs
    .map((ref) => workspaceHandles.find((handle) => handle?.ref === ref) || null)
    .filter(Boolean)

  return {
    focusedWidget,
    options,
  }
}

export function formatRuntimeDataHandleLabel(handle) {
  if (!handle) return '-'
  if (handle.scope === 'selection' && handle.sourceSelectionRef) {
    const selectionId = handle.sourceSelectionRef.split('/').pop() || handle.ref
    return `${handle.title || handle.ref} (${selectionId})`
  }
  if (handle.scope === 'workspaceCurrent') {
    return `${handle.title || handle.ref} (current selection)`
  }
  if (handle.scope === 'workspaceCurrentView') {
    return `${handle.title || handle.ref} (current view)`
  }
  if (handle.scope === 'combined') {
    return `${handle.title || handle.ref} (combined)`
  }
  if (handle.scope === 'visible') {
    return `${handle.title || handle.ref} (visible)`
  }
  return handle.title || handle.ref
}
