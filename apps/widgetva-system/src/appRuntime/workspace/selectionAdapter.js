function makeSelectionRef(widgetId, selectionId = 'current') {
  return `selection://widgetva-system/${widgetId}/${selectionId}`
}

export function buildWorkspaceSelectionEntry(session, {
  sourceWidgetId,
  selectionId = 'current',
  kind = 'point',
  summary = '',
  predicates = [],
  values,
  ...rest
} = {}) {
  if (!sourceWidgetId) return null
  const widget = session?.workspace?.getWidget?.(sourceWidgetId) || null
  const sourceWidgetRef = widget?.resolveWidgetRef?.() || widget?.describe?.()?.ref || null
  return {
    selectionRef: makeSelectionRef(sourceWidgetId, selectionId),
    selectionId,
    sourceWidgetRef,
    sourceWidgetId,
    scope: 'linked',
    kind,
    summary,
    predicates: Array.isArray(predicates) ? predicates : [],
    ...(values !== undefined ? { values } : {}),
    ...rest,
  }
}
