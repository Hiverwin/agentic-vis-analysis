import {
  clone,
  normalizeSelections,
  resolvePrimaryIntervalSelection,
  resolveRepresentativeSelection,
} from '../shared/providerStatePayloads.js'

function buildHumanActionCall({ name, actionTargetRef, params }) {
  return {
    callId: `human_${Date.now()}`,
    name,
    actor: 'human',
    targetRef: actionTargetRef || undefined,
    params: {
      targetRef: actionTargetRef || undefined,
      ...params,
    },
  }
}

function resolveCategoryField({ spec, interactionConfig, selection = null }) {
  if (typeof selection?.field === 'string' && selection.field.length > 0) return selection.field
  const enc = spec?.encoding || {}
  const preferredChannel = interactionConfig?.categoryFieldChannel
  if (preferredChannel && enc?.[preferredChannel]?.field) {
    return enc[preferredChannel].field
  }
  if (typeof interactionConfig?.categoryField === 'string' && interactionConfig.categoryField.length > 0) {
    return interactionConfig.categoryField
  }
  return enc.color?.field || enc.shape?.field || enc.detail?.field || enc.key?.field || enc.x?.field || enc.y?.field || null
}

function resolveCellFields({ spec, interactionConfig, selection = null }) {
  return {
    xField: selection?.xField || interactionConfig?.xField || spec?.encoding?.x?.field || null,
    yField: selection?.yField || interactionConfig?.yField || spec?.encoding?.y?.field || null,
  }
}

function buildAxisPatch(domain, currentAxis) {
  if (!Array.isArray(domain)) return null
  const nextAxis = {
    min: domain[0],
    max: domain[1],
  }
  if (Array.isArray(currentAxis)) {
    return currentAxis.map(() => ({ ...nextAxis }))
  }
  return nextAxis
}

function buildDataZoomPatches(currentDataZoom, { xDomain, yDomain }) {
  const zoomItems = Array.isArray(currentDataZoom)
    ? currentDataZoom
    : (currentDataZoom ? [currentDataZoom] : [])
  const patches = []

  for (const zoomItem of zoomItems) {
    if (Array.isArray(xDomain) && zoomItem?.xAxisIndex != null) {
      patches.push({
        xAxisIndex: zoomItem.xAxisIndex,
        startValue: xDomain[0],
        endValue: xDomain[1],
      })
    }
    if (Array.isArray(yDomain) && zoomItem?.yAxisIndex != null) {
      patches.push({
        yAxisIndex: zoomItem.yAxisIndex,
        startValue: yDomain[0],
        endValue: yDomain[1],
      })
    }
  }

  return patches
}

function readEChartsCurrentOption(view) {
  if (typeof view?.getOption !== 'function') return null
  try {
    return view.getOption() || null
  } catch {
    return null
  }
}

export function buildEChartsFamilyOption({ state, view }) {
  if (!state) return null

  const selections = normalizeSelections(state)
  const selection = resolveRepresentativeSelection(selections)
  const intervalSelection = resolvePrimaryIntervalSelection(selections)
  const xDomain = state?.view?.xDomain
    || intervalSelection?.domain?.xDomain
    || null
  const yDomain = state?.view?.yDomain
    || intervalSelection?.domain?.yDomain
    || null
  const currentOption = readEChartsCurrentOption(view)

  const option = {
    widgetva: {
      selection: clone(selection),
      selections: clone(selections),
      selectionSummary: selection?.summary || null,
      selectedCount: state?.data?.selectedCount ?? 0,
      visibleCount: state?.data?.visibleCount ?? 0,
      highlightedKeys: Array.isArray(state?.feedback?.highlightedKeys) ? [...state.feedback.highlightedKeys] : [],
    },
  }

  const xAxisPatch = buildAxisPatch(xDomain, currentOption?.xAxis)
  if (xAxisPatch) option.xAxis = xAxisPatch

  const yAxisPatch = buildAxisPatch(yDomain, currentOption?.yAxis)
  if (yAxisPatch) option.yAxis = yAxisPatch

  const dataZoomPatches = buildDataZoomPatches(currentOption?.dataZoom, { xDomain, yDomain })
  if (dataZoomPatches.length > 0) option.dataZoom = dataZoomPatches

  return option
}

export function bindEChartsFamilyInteractions({
  view,
  spec,
  interactionConfig,
  actionTargetRef,
  onActionCall,
}) {
  if (!view || typeof view.on !== 'function' || !interactionConfig || interactionConfig.mode === 'none' || typeof onActionCall !== 'function') {
    return () => {}
  }

  if (interactionConfig.mode === 'brush2d') {
    const handler = (event) => {
      const selection = event?.widgetvaSelection
        || event?.selection
        || event?.batch?.[0]?.widgetvaSelection
        || null
      const fields = Array.isArray(selection?.fields) ? selection.fields : []
      const [xField, yField] = fields
      const xRange = xField ? selection?.value?.[xField] || selection?.xRange : null
      const yRange = yField ? selection?.value?.[yField] || selection?.yRange : null
      if (!xField || !yField || !Array.isArray(xRange) || !Array.isArray(yRange)) return

      onActionCall(buildHumanActionCall({
        name: interactionConfig.actionName || 'scatter.brushRegion',
        actionTargetRef,
        params: { xField, yField, xRange, yRange },
      }))
    }
    view.on('brushselected', handler)
    return () => view.off?.('brushselected', handler)
  }

  if (interactionConfig.mode === 'categoryClick') {
    const handler = (event) => {
      const field = resolveCategoryField({ spec, interactionConfig, selection: event?.widgetvaSelection || event })
      const rawValue = event?.widgetvaSelection?.values?.[0]
        ?? event?.widgetvaSelection?.value
        ?? event?.data?.[field]
        ?? event?.name
      if (!field || rawValue == null) return

      onActionCall(buildHumanActionCall({
        name: interactionConfig.actionName || 'widget.selectCategory',
        actionTargetRef,
        params: {
          field,
          values: [rawValue],
        },
      }))
    }
    view.on('click', handler)
    return () => view.off?.('click', handler)
  }

  if (interactionConfig.mode === 'cellClick') {
    const handler = (event) => {
      const selection = event?.widgetvaSelection || event
      const { xField, yField } = resolveCellFields({ spec, interactionConfig, selection })
      const xValue = selection?.xValue ?? event?.data?.[xField]
      const yValue = selection?.yValue ?? event?.data?.[yField]
      if (!xField || !yField || xValue == null || yValue == null) return

      onActionCall(buildHumanActionCall({
        name: interactionConfig.actionName || 'heatmap.filterCells',
        actionTargetRef,
        params: { xField, yField, xValue, yValue },
      }))
    }
    view.on('click', handler)
    return () => view.off?.('click', handler)
  }

  if (interactionConfig.mode === 'multiBrush') {
    const handler = (event) => {
      const rules = clone(
        event?.widgetvaSelection?.rules
        || event?.rules
        || event?.selection?.rules
        || [],
      )
      if (!Array.isArray(rules) || rules.length === 0) return
      const firstRule = rules[0]

      onActionCall(buildHumanActionCall({
        name: interactionConfig.actionName || 'parallelCoordinates.filterDimension',
        actionTargetRef,
        params: { dimension: firstRule?.field, range: firstRule?.range },
      }))
    }
    view.on('axisareaselected', handler)
    return () => view.off?.('axisareaselected', handler)
  }

  return () => {}
}
