export const CANONICAL_WORKSPACE_WIDGET_KINDS = [
  'scatter',
  'bar',
  'line',
  'heatmap',
  'parallelCoordinates',
  'sankey',
]

const PROVIDER_WIDGET_SUPPORT = Object.freeze({
  'vega-lite': CANONICAL_WORKSPACE_WIDGET_KINDS,
  echarts: CANONICAL_WORKSPACE_WIDGET_KINDS,
  d3: CANONICAL_WORKSPACE_WIDGET_KINDS,
})

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function listProviderSupportedWidgetKinds(provider) {
  return clone(PROVIDER_WIDGET_SUPPORT[provider] || [])
}

export function resolveWidgetProviderSpec(widget = {}) {
  return clone(
    widget?.providerSpec
      || widget?.runtimeSource?.providerSpec
      || widget?.source?.providerSpec
      || null,
  )
}

export function resolveWidgetRenderModel(widget = {}) {
  return clone(
    widget?.baseRenderModel
      || widget?.renderModel
      || widget?.runtimeSource?.renderModel
      || widget?.source?.renderModel
      || null,
  )
}

export function resolveWidgetRenderMode(widget = {}) {
  const provider = widget?.provider || null
  const providerSpec = resolveWidgetProviderSpec(widget)
  const renderModel = resolveWidgetRenderModel(widget)

  if (provider === 'vega-lite' && providerSpec?.provider === 'vega-lite' && providerSpec?.spec) {
    return {
      mode: 'vega-lite',
      provider,
      providerSpec,
      renderModel,
    }
  }

  if (provider === 'echarts' && providerSpec?.provider === 'echarts' && providerSpec?.option) {
    return {
      mode: 'echarts',
      provider,
      providerSpec,
      renderModel,
    }
  }

  return {
    mode: 'glyph',
    provider,
    providerSpec,
    renderModel,
  }
}

export function resolveWidgetNativePayload(widget = {}) {
  const renderMode = resolveWidgetRenderMode(widget)
  if (renderMode.mode === 'vega-lite') {
    return {
      mode: 'vega-lite',
      payload: clone(renderMode.providerSpec?.spec || null),
      renderModel: clone(renderMode.renderModel),
      source: renderMode.providerSpec?.spec ? 'providerSpec' : 'none',
    }
  }
  if (renderMode.mode === 'echarts') {
    return {
      mode: 'echarts',
      payload: clone(renderMode.providerSpec?.option || null),
      renderModel: clone(renderMode.renderModel),
      source: renderMode.providerSpec?.option ? 'providerSpec' : 'none',
    }
  }
  return {
    mode: 'glyph',
    payload: null,
    renderModel: clone(renderMode.renderModel),
    source: 'renderModel',
  }
}
