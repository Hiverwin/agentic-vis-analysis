export const WORKSPACE_PROVIDER_ENVIRONMENTS = ['mixed', 'vega-lite', 'echarts', 'd3']

const KIND_PROVIDER_TO_TYPE = {
  scatter: {
    'vega-lite': 'scatter-vega',
    echarts: 'scatter-echarts',
    d3: 'scatter-d3',
  },
  bar: {
    'vega-lite': 'bar-vega',
    echarts: 'bar-echarts',
    d3: 'bar-d3',
  },
  line: {
    'vega-lite': 'line-vega',
    echarts: 'line-echarts',
    d3: 'line-d3',
  },
  heatmap: {
    'vega-lite': 'heatmap-vega',
    echarts: 'heatmap-echarts',
    d3: 'heatmap-d3',
  },
  parallelCoordinates: {
    'vega-lite': 'parallel-vega',
    echarts: 'parallel-echarts',
    d3: 'parallel-d3',
  },
  sankey: {
    'vega-lite': 'sankey-vega',
    echarts: 'sankey-echarts',
    d3: 'sankey-d3',
  },
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function normalizeWorkspaceProviderEnvironment(value) {
  return WORKSPACE_PROVIDER_ENVIRONMENTS.includes(value) ? value : 'mixed'
}

export function resolveWidgetTypeForProviderEnvironment(widgetKind, providerEnvironment) {
  const normalizedEnvironment = normalizeWorkspaceProviderEnvironment(providerEnvironment)
  if (normalizedEnvironment === 'mixed') return null
  return KIND_PROVIDER_TO_TYPE?.[widgetKind]?.[normalizedEnvironment] || null
}

export function buildWorkspaceCaseForProviderEnvironment(caseDef, providerEnvironment = 'mixed') {
  const normalizedEnvironment = normalizeWorkspaceProviderEnvironment(providerEnvironment)
  const baseCase = clone(caseDef || {})
  if (!Array.isArray(baseCase.widgets)) {
    return {
      ...baseCase,
      workspaceProviderEnvironment: normalizedEnvironment,
    }
  }

  if (normalizedEnvironment === 'mixed') {
    return {
      ...baseCase,
      workspaceProviderEnvironment: 'mixed',
    }
  }

  return {
    ...baseCase,
    workspaceProviderEnvironment: normalizedEnvironment,
    widgets: baseCase.widgets.map((widget) => {
      const nextType = resolveWidgetTypeForProviderEnvironment(widget?.widgetKind, normalizedEnvironment)
      return {
        ...widget,
        provider: normalizedEnvironment,
        ...(nextType ? { type: nextType } : {}),
      }
    }),
  }
}
