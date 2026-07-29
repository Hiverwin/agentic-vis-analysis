import { cloneJsonValue as clone } from '../../shared/clone.js'
function normalizeStringArray(values) {
  return Array.isArray(values)
    ? values.filter((value) => typeof value === 'string' && value.length > 0)
    : []
}

export function normalizeVgplotBinding(binding = null) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    return null
  }
  return {
    widgetRef: typeof binding.widgetRef === 'string' ? binding.widgetRef : null,
    dataRef: typeof binding.dataRef === 'string' ? binding.dataRef : null,
    widgetKind: typeof binding.widgetKind === 'string' ? binding.widgetKind : null,
    selectionNames: normalizeStringArray(binding.selectionNames),
    paramNames: normalizeStringArray(binding.paramNames),
    plotBindings: Array.isArray(binding.plotBindings)
      ? binding.plotBindings
        .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
        .map((entry) => ({
          plotId: typeof entry.plotId === 'string' ? entry.plotId : null,
          role: typeof entry.role === 'string' ? entry.role : null,
          xField: typeof entry.xField === 'string' ? entry.xField : null,
          yField: typeof entry.yField === 'string' ? entry.yField : null,
          colorField: typeof entry.colorField === 'string' ? entry.colorField : null,
        }))
      : [],
    fields: normalizeStringArray(binding.fields),
  }
}

export function readVgplotBinding({ view = null, runtime = null } = {}) {
  const fromRuntime = runtime?.__widgetvaVgplotRuntime?.binding
  if (fromRuntime) return clone(fromRuntime)
  const fromViewRuntime = view?.__widgetvaVgplotRuntime?.binding
  if (fromViewRuntime) return clone(fromViewRuntime)
  const fromView = view?.__widgetvaVgplotBinding
  return fromView ? clone(fromView) : null
}

export function attachVgplotBinding({
  view = null,
  runtime = null,
  binding = null,
} = {}) {
  const normalized = normalizeVgplotBinding(binding)
  if (!normalized) return null
  if (view && typeof view === 'object') {
    view.__widgetvaVgplotBinding = clone(normalized)
    if (view.__widgetvaVgplotRuntime && typeof view.__widgetvaVgplotRuntime === 'object') {
      view.__widgetvaVgplotRuntime.binding = clone(normalized)
    }
  }
  if (runtime && typeof runtime === 'object' && runtime.__widgetvaVgplotRuntime && typeof runtime.__widgetvaVgplotRuntime === 'object') {
    runtime.__widgetvaVgplotRuntime.binding = clone(normalized)
  }
  return normalized
}
