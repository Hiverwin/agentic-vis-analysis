import {
  applyVgplotIntervalSelection,
  applyVgplotNearestSelection,
  applyVgplotRegionSelection,
  resolveVgplotIntervalSelectionType,
  resolveVgplotToggleSelectionType,
  applyVgplotToggleSelection,
  applyVgplotViewport,
} from './vgplotActionExecutors.js'
import { createVgplotController } from './vgplotController.js'
import { resolveVgplotCapabilities } from './vgplotCapabilityResolver.js'

function hasArrayRange(value) {
  return Array.isArray(value) && value.length === 2
}

function hasValues(value) {
  return Array.isArray(value) && value.length > 0
}

function normalizeIntervalValue(params = {}) {
  const normalized = {}
  if (typeof params?.xField === 'string' && params.xField.length > 0) {
    normalized.xField = params.xField
  }
  if (typeof params?.yField === 'string' && params.yField.length > 0) {
    normalized.yField = params.yField
  }
  if (hasArrayRange(params?.xDomain)) {
    normalized.xDomain = params.xDomain
  } else if (hasArrayRange(params?.xRange)) {
    normalized.xDomain = params.xRange
  }
  if (hasArrayRange(params?.yDomain)) {
    normalized.yDomain = params.yDomain
  } else if (hasArrayRange(params?.yRange)) {
    normalized.yDomain = params.yRange
  }
  return normalized
}

function normalizeCategorySelectionValue(params = {}) {
  if (Array.isArray(params?.values) && params.values.length > 0) {
    return {
      field: params?.field || null,
      values: params.values,
    }
  }
  if (Array.isArray(params?.categories) && params.categories.length > 0) {
    return {
      field: params?.field || null,
      values: params.categories,
    }
  }
  return {
    field: params?.field || null,
    values: [],
  }
}

function normalizeHeatmapCellValue(params = {}) {
  return {
    xField: params?.xField || null,
    yField: params?.yField || null,
    xValue: params?.xValue ?? null,
    yValue: params?.yValue ?? null,
  }
}

function normalizeHeatmapRegionValue(params = {}) {
  const normalized = {}
  if (hasValues(params?.xValues)) {
    normalized.xValues = params.xValues
  }
  if (hasValues(params?.yValues)) {
    normalized.yValues = params.yValues
  }
  return normalized
}

function resolvePreferredIntervalTypes({ hasX = false, hasY = false } = {}) {
  if (hasX && hasY) return ['intervalXY']
  if (hasX) return ['intervalX', 'intervalXY']
  if (hasY) return ['intervalY', 'intervalXY']
  return ['intervalXY', 'intervalX', 'intervalY']
}

function firstPlotId(capabilities = null) {
  return Array.isArray(capabilities?.plotIds) && capabilities.plotIds.length > 0
    ? capabilities.plotIds[0]
    : null
}

export function executeVgplotStructuralAction({
  actionName = null,
  params = {},
  view = null,
  runtime = null,
} = {}) {
  const capabilities = resolveVgplotCapabilities({ view, runtime })
  const plotId = firstPlotId(capabilities)
  if (!plotId) return false
  return createVgplotController({ view, runtime }).executePlotConfigAction(plotId, actionName, params)
}

export function executeVgplotAction({
  widgetKind = null,
  actionName = null,
  params = {},
  view = null,
  runtime = null,
} = {}) {
  const structuralCapabilities = resolveVgplotCapabilities({
    widgetKind,
    view,
    runtime,
  })
  if (Array.isArray(structuralCapabilities?.configActionNames) && structuralCapabilities.configActionNames.includes(actionName)) {
    return executeVgplotStructuralAction({
      actionName,
      params,
      view,
      runtime,
    })
  }
  if (actionName === 'scatter.brushRegion' || actionName === 'scatter.selectRegion') {
    const intervalValue = normalizeIntervalValue(params)
    const intervalPreferredTypes = resolvePreferredIntervalTypes({
      hasX: hasArrayRange(intervalValue?.xDomain),
      hasY: hasArrayRange(intervalValue?.yDomain),
    })
    const intervalType = resolveVgplotIntervalSelectionType({
      view,
      runtime,
      preferredTypes: intervalPreferredTypes,
    })
    return (intervalType
      ? applyVgplotIntervalSelection({
          view,
          runtime,
          nextValue: {
            type: intervalType,
            value: intervalValue,
          },
        })
      : false) || applyVgplotRegionSelection({
      view,
      runtime,
      nextValue: {
        type: 'region',
        value: intervalValue,
      },
    })
  }
  if (actionName === 'scatter.filterCategorical') {
    const toggleType = resolveVgplotToggleSelectionType({
      view,
      runtime,
      preferredTypes: ['toggleColor', 'toggleX', 'toggleY', 'toggle'],
    }) || 'toggleColor'
    return applyVgplotToggleSelection({
      view,
      runtime,
      nextValue: {
        type: toggleType,
        value: normalizeCategorySelectionValue({
          field: params?.field,
          values: Array.isArray(params?.categoriesToRemove)
            ? params.categoriesToRemove
            : (
                Array.isArray(params?.values)
                  ? params.values
                  : []
              ),
        }),
      },
    })
  }
  if (actionName === 'scatter.zoomDomain') {
    return applyVgplotViewport({
      view,
      runtime,
      xDomain: hasArrayRange(params?.xDomain) ? params.xDomain : (hasArrayRange(params?.xRange) ? params.xRange : null),
      yDomain: hasArrayRange(params?.yDomain) ? params.yDomain : (hasArrayRange(params?.yRange) ? params.yRange : null),
    })
  }
  if (
    actionName === 'bar.clickCategory'
    || actionName === 'bar.selectCategory'
    || actionName === 'bar.filterCategories'
    || actionName === 'heatmap.filterCells'
    || actionName === 'heatmap.selectCell'
  ) {
    const toggleType = resolveVgplotToggleSelectionType({
      view,
      runtime,
      preferredTypes: widgetKind === 'heatmap'
        ? ['toggle']
        : ['toggleColor', 'toggleX', 'toggleY', 'toggle'],
    }) || (widgetKind === 'heatmap' ? 'toggle' : 'toggleColor')
    return applyVgplotToggleSelection({
      view,
      runtime,
      nextValue: {
        type: toggleType,
        value: widgetKind === 'heatmap'
          ? normalizeHeatmapCellValue(params)
          : normalizeCategorySelectionValue(params),
      },
    })
  }
  if (actionName === 'line.selectSeries') {
    const toggleType = resolveVgplotToggleSelectionType({
      view,
      runtime,
      preferredTypes: ['toggleColor', 'toggle', 'toggleY', 'toggleX'],
    }) || 'toggle'
    return applyVgplotToggleSelection({
      view,
      runtime,
      nextValue: {
        type: toggleType,
        value: normalizeCategorySelectionValue(params),
      },
    })
  }
  if (actionName === 'line.selectXValue') {
    return applyVgplotNearestSelection({
      view,
      runtime,
      nextValue: {
        type: 'nearestX',
        value: {
          field: params?.field || null,
          value: params?.value ?? null,
        },
      },
    })
  }
  if (actionName === 'line.focusLines') {
    const toggleType = resolveVgplotToggleSelectionType({
      view,
      runtime,
      preferredTypes: ['toggleColor', 'toggle', 'toggleY', 'toggleX'],
    }) || 'toggle'
    return applyVgplotToggleSelection({
      view,
      runtime,
      nextValue: {
        type: toggleType,
        value: {
          field: params?.lineField || params?.field || null,
          values: Array.isArray(params?.lineIds)
            ? params.lineIds
            : (
                Array.isArray(params?.values)
                  ? params.values
                  : []
              ),
        },
      },
    })
  }
  if (actionName === 'line.zoomXRegion') {
    return applyVgplotViewport({
      view,
      runtime,
      xDomain: hasArrayRange(params?.xDomain)
        ? params.xDomain
        : (hasArrayRange(params?.xRange)
            ? params.xRange
            : (
                params?.start != null && params?.end != null
                  ? [params.start, params.end]
                  : null
              )),
    })
  }
  if (actionName === 'heatmap.selectSubmatrix' || actionName === 'heatmap.filterCellsByRegion') {
    const regionValue = normalizeHeatmapRegionValue(params)
    const intervalPreferredTypes = resolvePreferredIntervalTypes({
      hasX: hasValues(regionValue?.xValues),
      hasY: hasValues(regionValue?.yValues),
    })
    const intervalType = resolveVgplotIntervalSelectionType({
      view,
      runtime,
      preferredTypes: intervalPreferredTypes,
    })
    return (intervalType
      ? applyVgplotIntervalSelection({
          view,
          runtime,
          nextValue: {
            type: intervalType,
            value: regionValue,
          },
        })
      : false) || applyVgplotRegionSelection({
      view,
      runtime,
      nextValue: {
        type: 'region',
        value: regionValue,
      },
    })
  }
  if (actionName === 'heatmap.highlightRegion') {
    const regionValue = normalizeHeatmapRegionValue(params)
    const intervalPreferredTypes = resolvePreferredIntervalTypes({
      hasX: hasValues(regionValue?.xValues),
      hasY: hasValues(regionValue?.yValues),
    })
    const intervalType = resolveVgplotIntervalSelectionType({
      view,
      runtime,
      preferredTypes: intervalPreferredTypes,
    })
    return (intervalType
      ? applyVgplotIntervalSelection({
          view,
          runtime,
          nextValue: {
            type: intervalType,
            value: regionValue,
          },
        })
      : false) || applyVgplotRegionSelection({
      view,
      runtime,
      nextValue: {
        type: 'region',
        value: regionValue,
      },
    })
  }
  return false
}
