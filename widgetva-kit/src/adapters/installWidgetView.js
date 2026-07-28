import { applyWidgetRuntimeState, attachWidgetRendererBridge } from '../core/rendering/WidgetRendererBridge.js'
import { orchestrateVgplotView } from './vgplot/vgplotOrchestration.js'

export async function installWidgetVAOnView({
  runtime = null,
  view = null,
  surface = null,
  container = null,
  widgetRef = null,
  widgetState = null,
  spec = null,
  interactionConfig = null,
  selectionSourceWidgetId = null,
  actionTargetRef = null,
  onActionCall = null,
  onSelectionChange = null,
  bindHumanInteractions = true,
  widgetAdapter = null,
  provider = null,
  runtimeCapture = null,
  binding = null,
} = {}) {
  const effectiveSurface = surface || container || null
  if (!view && !effectiveSurface) {
    throw new Error('installWidgetVAOnView requires either a view, surface, or container.')
  }
  const resolvedAdapter = widgetAdapter || null
  if (!resolvedAdapter) {
    throw new Error('installWidgetVAOnView requires an explicit widgetAdapter.')
  }
  const resolvedProvider = resolvedAdapter?.provider || provider || null
  if (resolvedProvider === 'vgplot') {
    orchestrateVgplotView({
      view,
      runtime,
      runtimeCapture,
      binding,
      widgetKind: resolvedAdapter?.kind || widgetState?.kind || null,
    })
  }
  const resolvedInteractionConfig = interactionConfig
    || widgetState?.humanInteraction
    || null

  const bridge = attachWidgetRendererBridge({
    runtime,
    widgetRef,
    widgetAdapter: resolvedAdapter,
    widgetState,
    view,
    surface: effectiveSurface,
    spec,
    interactionConfig: resolvedInteractionConfig,
    selectionSourceWidgetId,
    actionTargetRef: actionTargetRef || widgetRef,
    onActionCall,
    onSelectionChange,
    bindHumanInteractions,
  })

  async function apply({
    widgetState: nextWidgetState = widgetState,
    spec: nextSpec = spec,
    interactionConfig: nextInteractionConfig = resolvedInteractionConfig,
  } = {}) {
    await applyWidgetRuntimeState({
      runtime,
      widgetRef,
      widgetAdapter: resolvedAdapter,
      widgetState: nextWidgetState,
      view,
      surface: effectiveSurface,
      spec: nextSpec,
      interactionConfig: nextInteractionConfig,
    })
  }

  await apply()

  return {
    adapter: resolvedAdapter,
    apply,
    dispose: bridge.cleanup,
  }
}

export async function installWidgetVAOnVegaLiteView({
  widgetAdapter,
  ...args
} = {}) {
  return installWidgetVAOnView({
    ...args,
    provider: 'vega-lite',
    widgetAdapter,
  })
}

export async function installWidgetVAOnD3View({
  widgetAdapter,
  ...args
} = {}) {
  return installWidgetVAOnView({
    ...args,
    provider: 'd3',
    widgetAdapter,
  })
}

export async function installWidgetVAOnEChartsView({
  widgetAdapter,
  ...args
} = {}) {
  return installWidgetVAOnView({
    ...args,
    provider: 'echarts',
    widgetAdapter,
  })
}

export async function installWidgetVAOnVgplotView({
  widgetAdapter,
  ...args
} = {}) {
  return installWidgetVAOnView({
    ...args,
    provider: 'vgplot',
    widgetAdapter,
  })
}
