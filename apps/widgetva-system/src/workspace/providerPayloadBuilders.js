import {
  buildBarRenderModel,
  buildHeatmapRenderModel,
  buildLineRenderModel,
  buildParallelCoordinatesRenderModel,
  buildSankeyRenderModel,
  buildScatterRenderModel,
} from './renderModels.js'
import {
  buildBarOriginEChartsOption,
  buildBarOriginSpec,
  buildHeatmapEChartsOptionFromRenderModel,
  buildHeatmapSpec,
  buildLineEChartsOptionFromRenderModel,
  buildLineSpec,
  buildParallelCoordinatesEChartsOption,
  buildParallelCoordinatesSpec,
  buildSankeyEChartsOption,
  buildSankeyVegaSpec,
  buildScatterEChartsOptionFromRenderModel,
  buildScatterVegaSpecFromRenderModel,
} from './widgetSpecs.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function buildWidgetLiveRenderModel(widget = {}) {
  const widgetKind = widget?.widgetKind || widget?.kind || null
  if (widgetKind === 'scatter') {
    return buildScatterRenderModel(widget?.derivedData || [], widget?.viewState || {})
  }
  if (widgetKind === 'bar') {
    return buildBarRenderModel(widget?.derivedData || [], widget?.viewState || {})
  }
  if (widgetKind === 'line') {
    return buildLineRenderModel(widget?.derivedData || [], widget?.viewState || {})
  }
  if (widgetKind === 'heatmap') {
    return buildHeatmapRenderModel(widget?.derivedData || [], widget?.viewState || {}, widget?.viewState || {})
  }
  if (widgetKind === 'parallelCoordinates') {
    return buildParallelCoordinatesRenderModel(widget?.derivedData || [], widget?.viewState || {})
  }
  if (widgetKind === 'sankey') {
    return buildSankeyRenderModel(widget?.derivedData || { nodes: [], links: [] }, widget?.viewState || {})
  }
  return clone(widget?.baseRenderModel || widget?.renderModel || null)
}

export function buildWidgetLiveProviderSpec(widget = {}, renderModel = null) {
  const provider = widget?.provider || null
  const widgetKind = widget?.widgetKind || widget?.kind || null
  const derivedData = widget?.derivedData || []
  const viewState = widget?.viewState || {}

  if (provider === 'd3') {
    return {
      provider: 'd3',
      sceneType: widgetKind,
      sceneConfig: clone(renderModel),
    }
  }

  if (provider === 'vega-lite') {
    if (widgetKind === 'scatter') {
      return {
        provider: 'vega-lite',
        specType: 'scatter',
        spec: buildScatterVegaSpecFromRenderModel(renderModel, viewState),
      }
    }
    if (widgetKind === 'bar') {
      return {
        provider: 'vega-lite',
        specType: 'bar',
        spec: buildBarOriginSpec(derivedData, viewState),
      }
    }
    if (widgetKind === 'line') {
      return {
        provider: 'vega-lite',
        specType: 'line',
        spec: buildLineSpec(derivedData, viewState),
      }
    }
    if (widgetKind === 'heatmap') {
      return {
        provider: 'vega-lite',
        specType: 'heatmap',
        spec: buildHeatmapSpec(derivedData, viewState, viewState),
      }
    }
    if (widgetKind === 'parallelCoordinates') {
      return {
        provider: 'vega-lite',
        specType: 'parallelCoordinates',
        spec: buildParallelCoordinatesSpec(renderModel),
      }
    }
    if (widgetKind === 'sankey') {
      return {
        provider: 'vega-lite',
        specType: 'sankey',
        spec: buildSankeyVegaSpec(renderModel),
      }
    }
  }

  if (provider === 'echarts') {
    if (widgetKind === 'scatter') {
      return {
        provider: 'echarts',
        optionType: 'scatter',
        option: buildScatterEChartsOptionFromRenderModel(renderModel),
      }
    }
    if (widgetKind === 'bar') {
      return {
        provider: 'echarts',
        optionType: 'bar',
        option: buildBarOriginEChartsOption(derivedData, viewState),
      }
    }
    if (widgetKind === 'line') {
      return {
        provider: 'echarts',
        optionType: 'line',
        option: buildLineEChartsOptionFromRenderModel(renderModel, viewState),
      }
    }
    if (widgetKind === 'heatmap') {
      return {
        provider: 'echarts',
        optionType: 'heatmap',
        option: buildHeatmapEChartsOptionFromRenderModel(renderModel, viewState, viewState),
      }
    }
    if (widgetKind === 'parallelCoordinates') {
      return {
        provider: 'echarts',
        optionType: 'parallelCoordinates',
        option: buildParallelCoordinatesEChartsOption(renderModel),
      }
    }
    if (widgetKind === 'sankey') {
      return {
        provider: 'echarts',
        optionType: 'sankey',
        option: buildSankeyEChartsOption(renderModel),
      }
    }
  }

  return clone(widget?.providerSpec || null)
}

export function projectWidgetRuntimeSurface(widget = {}) {
  const renderModel = buildWidgetLiveRenderModel(widget)
  const providerSpec = buildWidgetLiveProviderSpec(widget, renderModel)
  return {
    ...widget,
    baseRenderModel: clone(renderModel),
    providerSpec: clone(providerSpec),
    runtimeSource: widget?.runtimeSource
      ? {
          ...widget.runtimeSource,
          renderModel: clone(renderModel),
          providerSpec: clone(providerSpec),
        }
      : widget.runtimeSource,
  }
}
