function normalizeProvider(provider) {
  return typeof provider === 'string' && provider.trim().length > 0
    ? provider.trim()
    : null
}

function normalizeSupportedWidgetKinds(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    : []
}

function normalizeRegistryEntry(entry = {}) {
  const provider = normalizeProvider(entry.provider)
  if (!provider) {
    throw new Error('RendererAdapterRegistry entries require a non-empty provider string.')
  }
  if (typeof entry.createAdapter !== 'function') {
    throw new Error(`RendererAdapterRegistry entry ${provider} requires createAdapter().`)
  }
  return {
    provider,
    createAdapter: entry.createAdapter,
    createDefinition: typeof entry.createDefinition === 'function' ? entry.createDefinition : null,
    supportedWidgetKinds: normalizeSupportedWidgetKinds(entry.supportedWidgetKinds),
    metadata: entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
      ? { ...entry.metadata }
      : {},
  }
}

export function createRendererAdapterRegistry(entries = []) {
  const entryMap = new Map()

  function register(entry) {
    const normalized = normalizeRegistryEntry(entry)
    entryMap.set(normalized.provider, normalized)
    return normalized
  }

  function resolve(provider) {
    const normalized = normalizeProvider(provider)
    return normalized ? entryMap.get(normalized) || null : null
  }

  function has(provider) {
    return Boolean(resolve(provider))
  }

  function list() {
    return [...entryMap.values()].map((entry) => ({
      provider: entry.provider,
      supportedWidgetKinds: [...entry.supportedWidgetKinds],
      metadata: { ...entry.metadata },
    }))
  }

  function supportsWidgetKind(provider, widgetKind) {
    const entry = resolve(provider)
    if (!entry || typeof widgetKind !== 'string' || widgetKind.length === 0) return false
    return entry.supportedWidgetKinds.length === 0 || entry.supportedWidgetKinds.includes(widgetKind)
  }

  function createAdapter(provider, args = {}) {
    const entry = resolve(provider)
    if (!entry) {
      throw new Error(`Renderer adapter provider ${provider} is not registered.`)
    }
    return entry.createAdapter(args)
  }

  for (const entry of Array.isArray(entries) ? entries : []) {
    register(entry)
  }

  return {
    register,
    resolve,
    has,
    list,
    supportsWidgetKind,
    createAdapter,
  }
}

