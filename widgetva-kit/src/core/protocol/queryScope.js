function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function normalizeString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function makeQueryScope(scope = {}) {
  const normalizedScope = scope && typeof scope === 'object' && !Array.isArray(scope) ? scope : {}
  return {
    widgetRef: normalizeString(normalizedScope.widgetRef || normalizedScope.widget_ref),
    dataRef: normalizeString(normalizedScope.dataRef || normalizedScope.data_ref),
    selectionRef: normalizeString(normalizedScope.selectionRef || normalizedScope.selection_ref),
    focusRef: normalizeString(normalizedScope.focusRef || normalizedScope.focus_ref),
    viewportRef: normalizeString(normalizedScope.viewportRef || normalizedScope.viewport_ref),
  }
}

export function describeQueryScopeSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: false,
    properties: {
      widgetRef: { type: 'string' },
      dataRef: { type: 'string' },
      selectionRef: { type: 'string' },
      focusRef: { type: 'string' },
      viewportRef: { type: 'string' },
    },
  })
}
