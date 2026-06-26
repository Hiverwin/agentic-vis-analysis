function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function normalizeString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function normalizeDomain(value) {
  return Array.isArray(value) ? clone(value) : null
}

function normalizeZoom(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return clone(value)
}

export function normalizeViewportState(viewport = null) {
  if (!viewport || typeof viewport !== 'object' || Array.isArray(viewport)) return null
  const normalized = clone(viewport)
  return {
    ...normalized,
    sourceWidgetRef: normalizeString(normalized.sourceWidgetRef || normalized.source_widget_ref),
    xDomain: normalizeDomain(normalized.xDomain || normalized.x_domain),
    yDomain: normalizeDomain(normalized.yDomain || normalized.y_domain),
    zoom: normalizeZoom(normalized.zoom),
  }
}

export function readViewportState(shared = {}) {
  return normalizeViewportState(shared?.viewport || null)
}

export function withViewportSubmodel(shared = {}, viewport = undefined) {
  return {
    ...(shared || {}),
    viewport: viewport === undefined ? readViewportState(shared) : normalizeViewportState(viewport),
  }
}
