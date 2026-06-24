function makeSelectionRef(widgetId, selectionId = 'current') {
  return `selection://widgetva-system/${widgetId}/${selectionId}`
}

function normalizeBrushRange(value) {
  if (!Array.isArray(value) || value.length !== 2) return null
  const start = Number(value[0])
  const end = Number(value[1])
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return start <= end ? [start, end] : [end, start]
}

export function normalizeScatterBrushSelection(brush = null) {
  if (!brush || typeof brush !== 'object') return null
  const xRange = normalizeBrushRange(brush.horsepower || brush.x || brush.Horsepower)
  const yRange = normalizeBrushRange(brush.mpg || brush.y || brush.MPG)
  if (!xRange && !yRange) return null
  return { xRange, yRange }
}

export function buildScatterBrushSelectionEntry(session, normalizedBrush, {
  selectionRef = 'selection://widgetva-system/w_scatter_cars/hpBrush',
} = {}) {
  const scatterWidget = session?.workspace?.getWidget?.('w_scatter_cars') || null
  const sourceWidgetRef = scatterWidget?.resolveWidgetRef?.() || scatterWidget?.describe?.()?.ref || null
  const sourceWidgetId = scatterWidget?.resolveWidgetId?.() || scatterWidget?.describe?.()?.widgetId || 'w_scatter_cars'
  const predicates = []
  if (normalizedBrush?.xRange) {
    predicates.push({
      field: 'horsepower',
      op: 'between',
      value: normalizedBrush.xRange,
    })
  }
  if (normalizedBrush?.yRange) {
    predicates.push({
      field: 'mpg',
      op: 'between',
      value: normalizedBrush.yRange,
    })
  }
  const summaryParts = []
  if (normalizedBrush?.xRange) {
    summaryParts.push(`Horsepower ${normalizedBrush.xRange[0]}-${normalizedBrush.xRange[1]}`)
  }
  if (normalizedBrush?.yRange) {
    summaryParts.push(`MPG ${normalizedBrush.yRange[0]}-${normalizedBrush.yRange[1]}`)
  }
  return {
    selectionRef,
    selectionId: 'hpBrush',
    sourceWidgetRef,
    sourceWidgetId,
    scope: 'linked',
    kind: 'brush',
    summary: summaryParts.join(' · '),
    predicates,
    xField: 'horsepower',
    yField: 'mpg',
    domain: {
      ...(normalizedBrush?.xRange ? { xDomain: normalizedBrush.xRange } : {}),
      ...(normalizedBrush?.yRange ? { yDomain: normalizedBrush.yRange } : {}),
    },
    ...(normalizedBrush?.xRange ? { xRange: normalizedBrush.xRange } : {}),
    ...(normalizedBrush?.yRange ? { yRange: normalizedBrush.yRange } : {}),
  }
}

export function buildWorkspaceSelectionEntry(session, {
  sourceWidgetId,
  selectionId = 'current',
  kind = 'point',
  summary = '',
  predicates = [],
  values,
  ...rest
} = {}) {
  if (!sourceWidgetId) return null
  const widget = session?.workspace?.getWidget?.(sourceWidgetId) || null
  const sourceWidgetRef = widget?.resolveWidgetRef?.() || widget?.describe?.()?.ref || null
  return {
    selectionRef: makeSelectionRef(sourceWidgetId, selectionId),
    selectionId,
    sourceWidgetRef,
    sourceWidgetId,
    scope: 'linked',
    kind,
    summary,
    predicates: Array.isArray(predicates) ? predicates : [],
    ...(values !== undefined ? { values } : {}),
    ...rest,
  }
}
