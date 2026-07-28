export function selectionRefBelongsToWidget(selectionRef, targetWidget = null) {
  if (typeof selectionRef !== 'string' || selectionRef.length === 0 || !targetWidget) return false
  if (targetWidget?.selections?.[selectionRef]) return true
  return selectionRef.startsWith(`${targetWidget.ref}/selection/`)
}

export function resolveImplicitSelectionRefForWidget({
  targetWidget = null,
  explicitSelectionRef = null,
  selectionRegistry = {},
  primarySelectionRef = null,
} = {}) {
  if (typeof explicitSelectionRef === 'string' && explicitSelectionRef.length > 0) {
    return explicitSelectionRef
  }

  if (!targetWidget || !selectionRegistry || typeof selectionRegistry !== 'object') {
    return null
  }

  if (
    primarySelectionRef
    && selectionRegistry?.[primarySelectionRef]
    && selectionRefBelongsToWidget(primarySelectionRef, targetWidget)
  ) {
    return primarySelectionRef
  }

  const widgetSelectionRefs = Object.keys(selectionRegistry)
    .filter((selectionRef) => selectionRefBelongsToWidget(selectionRef, targetWidget))
  if (widgetSelectionRefs.length === 1) {
    return widgetSelectionRefs[0]
  }

  return null
}
