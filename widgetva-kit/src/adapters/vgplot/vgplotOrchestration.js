import { cloneJsonValue as clone } from '../../shared/clone.js'
import { normalizeVgplotBinding, attachVgplotBinding } from './vgplotBinding.js'
import { resolveVgplotCapabilities } from './vgplotCapabilityResolver.js'
import { createVgplotController } from './vgplotController.js'
import { captureVgplotRuntime, normalizeVgplotRuntime } from './vgplotRuntimeCapture.js'

function attachVgplotRuntimeCapture({ view = null, runtime = null, runtimeCapture = null } = {}) {
  const normalizedRuntime = runtimeCapture
    ? normalizeVgplotRuntime(runtimeCapture)
    : captureVgplotRuntime({ view, runtime })
  if (view && typeof view === 'object') {
    view.__widgetvaVgplotRuntime = normalizedRuntime
  }
  if (runtime && typeof runtime === 'object') {
    runtime.__widgetvaVgplotRuntime = normalizedRuntime
  }
  return normalizedRuntime
}

export function orchestrateVgplotView({
  view = null,
  runtime = null,
  runtimeCapture = null,
  binding = null,
  widgetKind = null,
} = {}) {
  const normalizedRuntime = attachVgplotRuntimeCapture({
    view,
    runtime,
    runtimeCapture: runtimeCapture || view?.__widgetvaVgplotRuntime || runtime?.__widgetvaVgplotRuntime || null,
  })
  const normalizedBinding = normalizeVgplotBinding(binding)
  if (normalizedBinding) {
    attachVgplotBinding({
      view,
      runtime,
      binding: normalizedBinding,
    })
  }
  const runtimeHandle = { __widgetvaVgplotRuntime: normalizedRuntime }
  return {
    runtimeCapture: clone({
      provider: normalizedRuntime.provider,
      plotIds: [...normalizedRuntime.plots.keys()],
      selectionNames: [...normalizedRuntime.selections.keys()],
      paramNames: [...normalizedRuntime.params.keys()],
    }),
    binding: normalizedBinding ? clone(normalizedBinding) : null,
    controller: createVgplotController({
      view,
      runtime: runtimeHandle,
    }),
    capabilities: resolveVgplotCapabilities({
      widgetKind,
      view,
      runtime: runtimeHandle,
    }),
  }
}
