const DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT = 'vega-lite'

export function createImportedWidgetId(existingWidgets = []) {
  const usedIds = new Set((Array.isArray(existingWidgets) ? existingWidgets : [])
    .map((widget) => widget?.id)
    .filter(Boolean))
  let index = usedIds.size + 1
  let widgetId = index === 1 ? 'w_imported_primary' : `w_imported_${index}`
  while (usedIds.has(widgetId)) {
    index += 1
    widgetId = `w_imported_${index}`
  }
  return widgetId
}

export function mergeImportedVisualizationCase(currentCase, nextCase) {
  const currentWidgets = Array.isArray(currentCase?.widgets) ? currentCase.widgets : []
  const nextWidget = Array.isArray(nextCase?.widgets) ? nextCase.widgets[0] : null
  if (!nextWidget) return currentCase || nextCase

  const mergedWidgets = [
    ...currentWidgets,
    { ...nextWidget, role: currentWidgets.length === 0 ? 'primary' : (nextWidget.role || 'secondary') },
  ]

  return {
    ...currentCase,
    id: currentCase?.id || nextCase.id,
    sourceType: 'importedSpec',
    title: currentCase?.title || 'Imported workspace',
    summary: 'User-loaded visualizations mounted into the current host VA.',
    topology: mergedWidgets.length > 1 ? 'multi-view' : (currentCase?.topology || nextCase.topology || 'single-view'),
    workspaceProviderEnvironment: currentCase?.workspaceProviderEnvironment || nextCase.workspaceProviderEnvironment || DEFAULT_WORKSPACE_PROVIDER_ENVIRONMENT,
    dataset: currentCase?.dataset || nextCase.dataset,
    widgets: mergedWidgets,
    coordinationLinks: [
      ...(Array.isArray(currentCase?.coordinationLinks) ? currentCase.coordinationLinks : []),
      ...(Array.isArray(nextCase?.coordinationLinks) ? nextCase.coordinationLinks : []),
    ],
    findings: Array.isArray(currentCase?.findings) ? currentCase.findings : [],
    trace: Array.isArray(currentCase?.trace) ? currentCase.trace : [],
    agentChat: Array.isArray(currentCase?.agentChat) ? currentCase.agentChat : [],
    replaySteps: Array.isArray(currentCase?.replaySteps) ? currentCase.replaySteps : [],
    branches: Array.isArray(currentCase?.branches) ? currentCase.branches : [],
    log: Array.isArray(currentCase?.log) ? currentCase.log : [],
  }
}

function linkReferencesWidget(link, widgetId) {
  if (!link || typeof link !== 'object' || !widgetId) return false
  if ([link.sourceWidgetId, link.targetWidgetId, link.from, link.to].filter(Boolean).includes(widgetId)) return true
  const refPattern = new RegExp(`/widget/${widgetId}(?:/|$)`)
  return [link.sourceStateRef, link.targetStateRef, link.sourceRef, link.targetRef, link.ref]
    .some((value) => typeof value === 'string' && refPattern.test(value))
}

export function removeWidgetFromImportedCase(currentCase, widgetId) {
  if (!currentCase || typeof widgetId !== 'string' || widgetId.length === 0) return null
  const currentWidgets = Array.isArray(currentCase.widgets) ? currentCase.widgets : []
  const nextWidgets = currentWidgets.filter((widget) => widget?.id !== widgetId)
  if (nextWidgets.length === currentWidgets.length) return null
  return {
    ...currentCase,
    title: nextWidgets[0]?.title || currentCase.title || 'Imported workspace',
    topology: nextWidgets.length > 1 ? 'multi-view' : 'single-view',
    widgets: nextWidgets.map((widget, index) => ({
      ...widget,
      role: index === 0 ? 'primary' : (widget.role === 'primary' ? 'secondary' : widget.role || 'secondary'),
    })),
    coordinationLinks: Array.isArray(currentCase.coordinationLinks)
      ? currentCase.coordinationLinks.filter((link) => !linkReferencesWidget(link, widgetId))
      : [],
  }
}

export function buildVisualizationBindSummary(description = {}, widget = {}) {
  const widgetRef = widget?.ref || null
  const workspaceRef = typeof widgetRef === 'string' && widgetRef.length > 0
    ? widgetRef.replace(/\/widget\/[^/]+$/, '')
    : null
  const adapter = Array.isArray(description?.widgetAdapters)
    ? description.widgetAdapters.find((entry) => entry?.widgetRef === widgetRef) || null
    : null
  const provider = widget?.provider || adapter?.provider || 'unknown'
  const actionCount = Array.isArray(widget?.actionNames) ? widget.actionNames.length : 0
  const perceptionNames = widget?.perceptionNames || widget?.perceptionQueryNames || []
  const perceptionCount = Array.isArray(perceptionNames) ? perceptionNames.length : 0
  return [
    'Bound successfully.',
    `Provider: ${provider}.`,
    `Widget kind: ${widget?.kind || widget?.widgetKind || 'unknown'}.`,
    widgetRef ? `widgetRef: ${widgetRef}.` : null,
    workspaceRef ? `workspaceRef: ${workspaceRef}.` : null,
    `${actionCount} actions available.`,
    `${perceptionCount} perceptions available.`,
  ].filter(Boolean).join(' ')
}
