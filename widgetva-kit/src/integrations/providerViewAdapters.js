import { createD3WidgetAdapter } from '../adapters/d3/D3WidgetAdapter.js'
import { createEChartsWidgetAdapter } from '../adapters/echarts/EChartsWidgetAdapter.js'
import { createVegaLiteWidgetAdapter } from '../adapters/vegaLite/VegaLiteWidgetAdapter.js'
import { createVgplotWidgetAdapter } from '../adapters/vgplot/VgplotWidgetAdapter.js'
import { getWidgetFamily } from '../widgets/families/index.js'

function normalizeProvider(provider = 'vega-lite') {
  const normalized = typeof provider === 'string' ? provider.trim().toLowerCase() : ''
  if (normalized === 'vegalite') return 'vega-lite'
  if (normalized === 'observable-d3' || normalized === 'observabled3') return 'd3'
  return normalized || 'vega-lite'
}

export function createWidgetVAViewAdapter({ kind, provider = 'vega-lite' } = {}) {
  const familyDefinition = { kind: getWidgetFamily(kind).kind }
  switch (normalizeProvider(provider)) {
    case 'd3':
      return createD3WidgetAdapter(familyDefinition)
    case 'echarts':
      return createEChartsWidgetAdapter(familyDefinition)
    case 'vgplot':
      return createVgplotWidgetAdapter(familyDefinition)
    case 'vega-lite':
    default:
      return createVegaLiteWidgetAdapter(familyDefinition)
  }
}
