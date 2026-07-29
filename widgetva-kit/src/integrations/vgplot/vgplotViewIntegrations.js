import { cloneJsonValue as clone } from '../../shared/clone.js'
import { createVgplotWidgetAdapter } from '../../adapters/vgplot/VgplotWidgetAdapter.js'
import { normalizeVgplotBinding } from '../../adapters/vgplot/vgplotBinding.js'
import { captureVgplotRuntime, normalizeVgplotRuntime } from '../../adapters/vgplot/vgplotRuntimeCapture.js'
import {
  readControllerRecoverableState,
  restoreControllerRecoverableState,
} from '../officialPages/officialPageController.js'
import { createOfficialPageHostBridge } from '../../host/hostBridge.js'
import { runAgentLoopOnTarget } from '../../core/agent/adapters/agentTargetPort.js'
import { createWidgetInstance } from '../../core/rendering/widgetRuntimeSurface.js'
import { createWidgetWorkspace } from '../../workspace/widgetWorkspace.js'
import { getWidgetFamily } from '../../widgets/families/index.js'

function readBindingKind(binding = null) {
  return typeof binding?.widgetKind === 'string' && binding.widgetKind.length > 0
    ? binding.widgetKind
    : null
}

function createVgplotFamilyAdapter(kind) {
  return createVgplotWidgetAdapter({ kind: getWidgetFamily(kind).kind })
}

function readRuntimeKind(runtimeCapture = null) {
  if (runtimeCapture?.plots instanceof Map) {
    for (const entry of runtimeCapture.plots.values()) {
      if (typeof entry?.widgetKind === 'string' && entry.widgetKind.length > 0) {
        return entry.widgetKind
      }
    }
  }
  if (Array.isArray(runtimeCapture?.plots)) {
    for (const entry of runtimeCapture.plots) {
      if (typeof entry?.widgetKind === 'string' && entry.widgetKind.length > 0) {
        return entry.widgetKind
      }
    }
  }
  return null
}

function resolveVgplotWidgetKind({
  widgetKind = null,
  binding = null,
  runtimeCapture = null,
} = {}) {
  return (
    (typeof widgetKind === 'string' && widgetKind.length > 0 ? widgetKind : null)
    || readBindingKind(binding)
    || readRuntimeKind(runtimeCapture)
    || null
  )
}

function buildEncodingEntry(field = null, type = null) {
  if (typeof field !== 'string' || field.length === 0) return null
  return {
    field,
    ...(type ? { type } : {}),
  }
}

function inferNominalType(field = null) {
  return typeof field === 'string' && field.length > 0 ? 'nominal' : null
}

function buildVgplotPseudoSpec({
  widgetKind,
  binding = null,
} = {}) {
  const primaryBinding = Array.isArray(binding?.plotBindings) && binding.plotBindings.length > 0
    ? binding.plotBindings[0]
    : null
  const xField = primaryBinding?.xField || null
  const yField = primaryBinding?.yField || null
  const colorField = primaryBinding?.colorField || null
  const markByKind = {
    scatter: 'point',
    bar: 'bar',
    line: 'line',
    heatmap: 'rect',
  }

  return {
    data: { values: [] },
    mark: markByKind[widgetKind] || 'point',
    encoding: {
      ...(buildEncodingEntry(xField, widgetKind === 'line' ? null : inferNominalType(xField))
        ? { x: buildEncodingEntry(xField, widgetKind === 'bar' ? 'nominal' : null) }
        : {}),
      ...(buildEncodingEntry(yField, widgetKind === 'scatter' || widgetKind === 'heatmap' ? 'quantitative' : null)
        ? { y: buildEncodingEntry(yField, widgetKind === 'bar' ? 'quantitative' : null) }
        : {}),
      ...(buildEncodingEntry(colorField, 'nominal') ? { color: buildEncodingEntry(colorField, 'nominal') } : {}),
    },
    __widgetvaProvider: 'vgplot',
    __widgetvaWidgetKind: widgetKind,
    __widgetvaBinding: binding ? clone(binding) : null,
  }
}

function createVgplotAgentLoopRunner(agentTarget) {
  return async function runVgplotAgentLoop(options = {}) {
    if (!agentTarget || typeof agentTarget.describeWorkspace !== 'function') {
      throw new Error('WidgetVA page port is not ready for vgplot agent-loop execution.')
    }
    return runAgentLoopOnTarget(agentTarget, options)
  }
}

export async function attachWidgetVAToVgplotView({
  root = globalThis.window,
  view = null,
  runtimeCapture = null,
  binding = null,
  widgetKind = null,
  sessionId = null,
  userIntent = 'Analyze and manipulate the current vgplot view through WidgetVA structured actions.',
} = {}) {
  if (!view || typeof view !== 'object') {
    throw new Error('attachWidgetVAToVgplotView requires a vgplot view object.')
  }

  const normalizedBinding = normalizeVgplotBinding(binding)
  const normalizedRuntimeCapture = runtimeCapture
    ? normalizeVgplotRuntime(runtimeCapture)
    : captureVgplotRuntime({ view })
  const resolvedKind = resolveVgplotWidgetKind({
    widgetKind,
    binding: normalizedBinding,
    runtimeCapture: normalizedRuntimeCapture,
  })

  if (!resolvedKind) {
    throw new Error('attachWidgetVAToVgplotView requires a widgetKind or binding/runtime metadata that resolves one.')
  }

  const baselineSpec = buildVgplotPseudoSpec({
    widgetKind: resolvedKind,
    binding: normalizedBinding,
  })
  const currentSpecRef = { current: clone(baselineSpec) }
  const originalPagePort = root?.__widgetVA || null
  const hostBridge = createOfficialPageHostBridge({
    sessionId: sessionId || `vgplot-${resolvedKind}`,
    baselineSpec,
    currentSpecRef,
    userIntent,
    emitOnWrite: true,
  })
  const widgetAdapter = createVgplotFamilyAdapter(resolvedKind)
  const widget = createWidgetInstance({
    widgetAdapter,
    spec: baselineSpec,
    runtimeOptions: {
      hostBridge,
    },
  })

  await widget.mount({
    view,
    spec: baselineSpec,
    bindHumanInteractions: false,
    runtimeCapture: normalizedRuntimeCapture,
    binding: normalizedBinding,
  })
  const workspace = createWidgetWorkspace({
    runtime: widget.runtime,
    widgets: [widget],
  })

  return {
    provider: 'vgplot',
    kind: resolvedKind,
    widget,
    workspace,
    widgetAdapter,
    binding: normalizedBinding ? clone(normalizedBinding) : null,
    runtimeCapture: clone({
      provider: normalizedRuntimeCapture.provider,
      plotIds: [...normalizedRuntimeCapture.plots.keys()],
      selectionNames: [...normalizedRuntimeCapture.selections.keys()],
      paramNames: [...normalizedRuntimeCapture.params.keys()],
    }),
    pagePort: root?.__widgetVA || widget.runtime?.pagePort || null,
    runAgentLoop: createVgplotAgentLoopRunner(workspace),
    readRecoverableState() {
      return readControllerRecoverableState(widget)
    },
    async restoreRecoverableState(state) {
      return restoreControllerRecoverableState(widget, state, 'Vgplot view controller')
    },
    getCurrentSpec() {
      return clone(currentSpecRef.current)
    },
    dispose() {
      if (root?.__widgetVA && root.__widgetVA === widget.runtime?.pagePort) {
        if (originalPagePort) root.__widgetVA = originalPagePort
        else delete root.__widgetVA
      }
      workspace.dispose()
      widget.dispose()
    },
  }
}
