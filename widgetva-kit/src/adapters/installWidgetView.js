import { createD3WidgetAdapter } from './D3WidgetAdapter.js'
import { createEChartsWidgetAdapter } from './EChartsWidgetAdapter.js'
import { createVegaLiteWidgetAdapter } from './VegaLiteWidgetAdapter.js'
import { applyWidgetRuntimeState, attachWidgetRendererBridge } from '../core/rendering/WidgetRendererBridge.js'
import { createRendererAdapterRegistry } from '../core/rendering/RendererAdapterRegistry.js'
import { createProviderFamilyAdapter } from './widgetFamilies/index.js'

function createDefaultProviderBackedAdapter(provider, definition = {}) {
  const normalizedDefinition = definition && typeof definition === 'object' && !Array.isArray(definition)
    ? definition
    : {}
  const kind = typeof normalizedDefinition.kind === 'string' ? normalizedDefinition.kind : null

  if (kind && !['vega-lite-view', 'd3-view', 'echarts-view'].includes(kind)) {
    const familyAdapter = createProviderFamilyAdapter(kind, provider)
    return {
      ...familyAdapter,
      ...normalizedDefinition,
      provider: familyAdapter.provider,
      providerCapabilities: {
        ...(familyAdapter.providerCapabilities || {}),
        ...(normalizedDefinition.providerCapabilities || {}),
      },
    }
  }

  if (provider === 'd3') {
    return createD3WidgetAdapter(normalizedDefinition)
  }
  if (provider === 'echarts') {
    return createEChartsWidgetAdapter(normalizedDefinition)
  }
  return createVegaLiteWidgetAdapter(normalizedDefinition)
}

const DEFAULT_RENDERER_ADAPTER_REGISTRY = createRendererAdapterRegistry([
  {
    provider: 'vega-lite',
    createAdapter({ definition = {} } = {}) {
      return createDefaultProviderBackedAdapter('vega-lite', definition)
    },
  },
  {
    provider: 'd3',
    createAdapter({ definition = {} } = {}) {
      return createDefaultProviderBackedAdapter('d3', definition)
    },
  },
  {
    provider: 'echarts',
    createAdapter({ definition = {} } = {}) {
      return createDefaultProviderBackedAdapter('echarts', definition)
    },
  },
])

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
  widgetAdapter = null,
  provider = null,
  adapterDefinition = {},
  adapterRegistry = DEFAULT_RENDERER_ADAPTER_REGISTRY,
} = {}) {
  const effectiveSurface = surface || container || null
  if (!view && !effectiveSurface) {
    throw new Error('installWidgetVAOnView requires either a view, surface, or container.')
  }
  const resolvedAdapter = widgetAdapter || (
    provider
      ? adapterRegistry?.createAdapter?.(provider, {
          definition: adapterDefinition,
          runtime,
          view,
          surface: effectiveSurface,
          widgetRef,
          widgetState,
          spec,
          interactionConfig,
          selectionSourceWidgetId,
          actionTargetRef: actionTargetRef || widgetRef,
        })
      : null
  )
  if (!resolvedAdapter) {
    throw new Error('installWidgetVAOnView requires a widgetAdapter or provider-backed adapterRegistry.')
  }
  const resolvedInteractionConfig = interactionConfig
    || widgetState?.humanInteraction
    || resolvedAdapter.getHumanInteractionConfig?.()
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
  adapterDefinition = {},
  ...args
} = {}) {
  return installWidgetVAOnView({
    ...args,
    provider: 'vega-lite',
    widgetAdapter,
    adapterDefinition: {
      kind: 'vega-lite-view',
      ...adapterDefinition,
    },
  })
}

export async function installWidgetVAOnD3View({
  widgetAdapter,
  adapterDefinition = {},
  ...args
} = {}) {
  return installWidgetVAOnView({
    ...args,
    provider: 'd3',
    widgetAdapter,
    adapterDefinition: {
      kind: 'd3-view',
      ...adapterDefinition,
    },
  })
}

export async function installWidgetVAOnEChartsView({
  widgetAdapter,
  adapterDefinition = {},
  ...args
} = {}) {
  return installWidgetVAOnView({
    ...args,
    provider: 'echarts',
    widgetAdapter,
    adapterDefinition: {
      kind: 'echarts-view',
      ...adapterDefinition,
    },
  })
}
