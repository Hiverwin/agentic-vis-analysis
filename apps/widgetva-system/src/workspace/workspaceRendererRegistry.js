import { createRendererAdapterRegistry } from '../../../../widgetva-kit/src/core/index.js'

function normalizeProvider(provider) {
  return typeof provider === 'string' && provider.trim().length > 0
    ? provider.trim()
    : null
}

function normalizeWidgetKind(widget = {}) {
  const widgetKind = widget?.widgetKind || widget?.kind || null
  return typeof widgetKind === 'string' && widgetKind.trim().length > 0
    ? widgetKind.trim()
    : null
}

function normalizeSupportedWidgetKinds(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    : []
}

function normalizeWorkspaceRendererEntry(entry = {}) {
  const provider = normalizeProvider(entry.provider)
  if (!provider) {
    throw new Error('Workspace renderer entries require a non-empty provider string.')
  }
  if (typeof entry.renderWidget !== 'function') {
    throw new Error(`Workspace renderer entry ${provider} requires renderWidget().`)
  }

  return {
    provider,
    supportedWidgetKinds: normalizeSupportedWidgetKinds(entry.supportedWidgetKinds),
    renderWidget: entry.renderWidget,
    metadata: entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
      ? { ...entry.metadata }
      : {},
  }
}

export function createWorkspaceRendererRegistry(entries = []) {
  const adapterRegistry = createRendererAdapterRegistry()
  const entryMap = new Map()

  function register(entry) {
    const normalized = normalizeWorkspaceRendererEntry(entry)
    adapterRegistry.register({
      provider: normalized.provider,
      supportedWidgetKinds: normalized.supportedWidgetKinds,
      metadata: normalized.metadata,
      createAdapter() {
        return { provider: normalized.provider }
      },
    })
    entryMap.set(normalized.provider, normalized)
    return normalized
  }

  function resolveProvider(provider) {
    const normalizedProvider = normalizeProvider(provider)
    return normalizedProvider ? entryMap.get(normalizedProvider) || null : null
  }

  function resolveWidget(widget = {}) {
    const provider = normalizeProvider(widget.provider)
    const widgetKind = normalizeWidgetKind(widget)
    if (!provider || !widgetKind) return null
    if (!adapterRegistry.supportsWidgetKind(provider, widgetKind)) return null
    const entry = resolveProvider(provider)
    if (!entry) return null
    return {
      ...entry,
      provider,
      widgetKind,
    }
  }

  function renderWidget({ widget, ...args } = {}) {
    const resolved = resolveWidget(widget)
    if (!resolved) return null
    return resolved.renderWidget({
      widget,
      resolution: resolved,
      ...args,
    })
  }

  for (const entry of Array.isArray(entries) ? entries : []) {
    register(entry)
  }

  return {
    register,
    resolveProvider,
    resolveWidget,
    renderWidget,
    list() {
      return adapterRegistry.list()
    },
    supportsWidget(widget = {}) {
      return Boolean(resolveWidget(widget))
    },
  }
}
