function splitStateRef(value) {
  const text = String(value || '')
  const marker = text.indexOf('/widget/')
  if (marker < 0) return null

  const segments = text.slice(marker + '/widget/'.length).split('/').filter(Boolean)
  if (segments.length < 2) return null

  return {
    widgetId: segments[0],
    statePath: segments.slice(1).join('/'),
  }
}

function displayWidget(widgetId, widgetLookup) {
  const widget = widgetLookup?.get(widgetId)
  return widget?.title || widget?.widgetKind || widget?.kind || widgetId || 'widget'
}

export function formatKitStateRef(stateRef, widgetLookup = new Map()) {
  const parsed = splitStateRef(stateRef)
  if (!parsed) return String(stateRef || 'state')
  return `${displayWidget(parsed.widgetId, widgetLookup)}.${parsed.statePath}`
}

export function buildKitLinkRows(links = [], widgets = []) {
  const widgetLookup = new Map((Array.isArray(widgets) ? widgets : [])
    .map((widget) => [widget?.id || widget?.widgetId, widget])
    .filter(([id]) => id))

  return (Array.isArray(links) ? links : []).map((link, index) => ({
    id: link?.ref || link?.linkRef || link?.id || `kit-link-${index}`,
    source: formatKitStateRef(link?.sourceStateRef || link?.from, widgetLookup),
    target: formatKitStateRef(link?.targetStateRef || link?.to, widgetLookup),
    transformKind: link?.transform?.kind || link?.relation || link?.effect || link?.kind || null,
    raw: link,
  }))
}
