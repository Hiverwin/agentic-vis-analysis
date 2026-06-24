function normalizeString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function normalizeFocusState(focus = null) {
  if (!focus || typeof focus !== 'object' || Array.isArray(focus)) return null
  return {
    widgetRef: normalizeString(focus.widgetRef || focus.widget_ref),
    widgetId: normalizeString(focus.widgetId || focus.widget_id),
    source: normalizeString(focus.source) || 'workspace',
  }
}

export function readFocusState(shared = {}, widgets = {}) {
  const explicitFocus = normalizeFocusState(shared?.focus || null)
  if (explicitFocus) return explicitFocus

  const focusedWidgetRef = normalizeString(shared?.focusedWidget)
  if (!focusedWidgetRef) return null
  const focusedWidget = widgets?.[focusedWidgetRef] || null
  return {
    widgetRef: focusedWidgetRef,
    widgetId: normalizeString(focusedWidget?.widgetId),
    source: 'workspace',
  }
}

export function withFocusSubmodel(shared = {}, focus = undefined, widgets = {}) {
  const nextFocus = focus === undefined ? readFocusState(shared, widgets) : normalizeFocusState(focus)
  return {
    ...(shared || {}),
    focusedWidget: nextFocus?.widgetRef || null,
    focus: nextFocus,
  }
}
