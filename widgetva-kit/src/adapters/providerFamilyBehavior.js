function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function uniqueValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => value != null))]
}

function normalizeSelections(state) {
  return Object.values(state?.selections || {}).filter(Boolean)
}

function resolveRepresentativeSelection(selections) {
  const normalizedSelections = Array.isArray(selections) ? selections.filter(Boolean) : []
  if (normalizedSelections.length === 1) return normalizedSelections[0] || null
  const pointSelections = normalizedSelections.filter((selection) => selection?.kind === 'point')
  if (pointSelections.length === 1) return pointSelections[0] || null
  return normalizedSelections[0] || null
}

function resolvePrimaryIntervalSelection(selections) {
  return (Array.isArray(selections) ? selections : []).find((selection) => selection?.kind === 'interval') || null
}

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

function resolveTableKeyField({ interactionConfig, selection = null, eventData = null }) {
  return selection?.keyField
    || interactionConfig?.keyField
    || (eventData && typeof eventData === 'object' ? Object.keys(eventData)[0] || null : null)
    || null
}

function writeSurfaceState(surface, state, selection) {
  if (!surface) return
  surface.dataset.widgetvaSelectedCount = String(state?.data?.selectedCount ?? 0)
  surface.dataset.widgetvaVisibleCount = String(state?.data?.visibleCount ?? 0)
  surface.dataset.widgetvaSelectionSummary = selection?.summary || ''
}

export function resolveFocusPayload(state) {
  const view = state?.view && typeof state.view === 'object' && !Array.isArray(state.view)
    ? state.view
    : null
  if (!view) return null

  const focusPayload = {
    ...(view.focusedCarId != null ? { focusedCarId: view.focusedCarId } : {}),
    ...(view.focusedSeries != null ? { focusedSeries: clone(view.focusedSeries) } : {}),
    ...(view.focusedNode != null ? { focusedNode: view.focusedNode } : {}),
    ...(view.focusedFlow != null ? { focusedFlow: clone(view.focusedFlow) } : {}),
  }

  return Object.keys(focusPayload).length > 0 ? focusPayload : null
}

export function resolveHighlightStatePayload(state) {
  const highlight = state?.view?.highlight
  if (!highlight || typeof highlight !== 'object' || Array.isArray(highlight)) return null
  return clone(highlight)
}

export function resolveAggregateStatePayload(state) {
  const aggregate = state?.view?.aggregate
  if (!aggregate || typeof aggregate !== 'object' || Array.isArray(aggregate)) return null
  return clone(aggregate)
}

export function resolveAddRemoveStatePayload(state) {
  const addRemove = state?.view?.addRemove
  if (!addRemove || typeof addRemove !== 'object' || Array.isArray(addRemove)) return null
  return clone(addRemove)
}

export function resolveAnnotateStatePayload(state) {
  const annotate = state?.view?.annotate
  if (!annotate || typeof annotate !== 'object' || Array.isArray(annotate)) return null
  return clone(annotate)
}

export function resolveDrillDownStatePayload(state) {
  const drillDown = state?.view?.drillDown
  if (!drillDown || typeof drillDown !== 'object' || Array.isArray(drillDown)) return null
  return clone(drillDown)
}

export function resolveNavigateStatePayload(state) {
  const navigate = state?.view?.navigate
  if (!navigate || typeof navigate !== 'object' || Array.isArray(navigate)) return null
  return clone(navigate)
}

export function resolveReencodeStatePayload(state) {
  const reencode = state?.view?.reencode
  if (!reencode || typeof reencode !== 'object' || Array.isArray(reencode)) return null
  return clone(reencode)
}

export function resolveSortPayload(state) {
  const sort = state?.view?.sort
  if (!sort || typeof sort !== 'object' || Array.isArray(sort)) return null

  const payload = {
    ...(typeof sort.channel === 'string' ? { channel: sort.channel } : {}),
    ...(typeof sort.field === 'string' ? { field: sort.field } : {}),
    ...(typeof sort.mode === 'string' ? { mode: sort.mode } : {}),
    ...(typeof sort.order === 'string' ? { order: sort.order } : {}),
    ...(typeof sort.aggregate === 'string' ? { aggregate: sort.aggregate } : {}),
    ...(Array.isArray(sort.values) ? { values: clone(sort.values) } : {}),
  }

  return Object.keys(payload).length > 0 ? payload : null
}

export function applyD3HostState({ view, surface, state }) {
  if (!state) return

  const selections = normalizeSelections(state)
  const selection = resolveRepresentativeSelection(selections)
  const intervalSelection = resolvePrimaryIntervalSelection(selections)
  const xDomain = state?.view?.xDomain
    || intervalSelection?.domain?.xDomain
    || null
  const yDomain = state?.view?.yDomain
    || intervalSelection?.domain?.yDomain
    || null
  const aggregateState = resolveAggregateStatePayload(state)
  const addRemoveState = resolveAddRemoveStatePayload(state)
  const annotateState = resolveAnnotateStatePayload(state)
  const drillDownState = resolveDrillDownStatePayload(state)
  const highlightState = resolveHighlightStatePayload(state)
  const focusPayload = resolveFocusPayload(state)
  const navigateState = resolveNavigateStatePayload(state)
  const reencodeState = resolveReencodeStatePayload(state)
  const sortPayload = resolveSortPayload(state)
  const highlightedKeys = Array.isArray(state?.feedback?.highlightedKeys) ? state.feedback.highlightedKeys : []

  writeSurfaceState(surface, state, selection)

  if (typeof view?.setBrush === 'function') {
    view.setBrush(intervalSelection || null)
  }
  if (typeof view?.setViewport === 'function') {
    view.setViewport({
      ...(Array.isArray(xDomain) ? { xDomain: clone(xDomain) } : {}),
      ...(Array.isArray(yDomain) ? { yDomain: clone(yDomain) } : {}),
    })
  } else if ((Array.isArray(xDomain) || Array.isArray(yDomain)) && typeof view?.setDomain === 'function') {
    view.setDomain(Array.isArray(xDomain) ? xDomain : null, Array.isArray(yDomain) ? yDomain : null)
  }
  if (typeof view?.setSelection === 'function') {
    view.setSelection(selection || null)
  }
  if (typeof view?.setHighlights === 'function') {
    view.setHighlights([...highlightedKeys])
  }
  if (highlightState && typeof view?.setHighlightState === 'function') {
    view.setHighlightState(highlightState)
  }
  if (aggregateState && typeof view?.setAggregateState === 'function') {
    view.setAggregateState(aggregateState)
  }
  if (addRemoveState && typeof view?.setAddRemoveState === 'function') {
    view.setAddRemoveState(addRemoveState)
  }
  if (annotateState && typeof view?.setAnnotateState === 'function') {
    view.setAnnotateState(annotateState)
  }
  if (drillDownState && typeof view?.setDrillDownState === 'function') {
    view.setDrillDownState(drillDownState)
  }
  if (focusPayload && typeof view?.setFocus === 'function') {
    view.setFocus(focusPayload)
  }
  if (navigateState && typeof view?.setNavigateState === 'function') {
    view.setNavigateState(navigateState)
  }
  if (reencodeState && typeof view?.setReencodeState === 'function') {
    view.setReencodeState(reencodeState)
  }
  if (sortPayload && typeof view?.setSort === 'function') {
    view.setSort(sortPayload)
  }
}

export async function renderD3FamilyState({ view, surface, state }) {
  if (!state) return
  if (typeof view?.renderFromState === 'function') {
    return view.renderFromState(clone(state), {
      view,
      surface,
    })
  }
  return undefined
}

export function bindD3FamilyInteractions({
  view,
  spec,
  interactionConfig,
  selectionSourceWidgetId,
  actionTargetRef,
  onActionCall,
  onSelectionChange,
}) {
  if (!view || !interactionConfig || interactionConfig.mode === 'none') {
    return () => {}
  }

  if (interactionConfig.mode === 'brush2d' && typeof view.onBrush === 'function') {
    const cleanup = view.onBrush((selection) => {
      const normalizedSelection = selection || null
      const fields = Array.isArray(normalizedSelection?.fields) ? normalizedSelection.fields : []
      const [xField, yField] = fields
      const xRange = xField ? normalizedSelection?.value?.[xField] : null
      const yRange = yField ? normalizedSelection?.value?.[yField] : null

      if (typeof onActionCall === 'function' && xField && yField && Array.isArray(xRange) && Array.isArray(yRange)) {
        onActionCall(buildHumanActionCall({
          name: interactionConfig.actionName || 'scatter.brushRegion',
          actionTargetRef,
          params: { xField, yField, xRange, yRange },
        }))
        return
      }

      if (typeof onSelectionChange === 'function') {
        onSelectionChange(
          normalizedSelection
            ? {
                ...normalizedSelection,
                source_widget_id: selectionSourceWidgetId || undefined,
              }
            : null,
        )
      }
    })
    return typeof cleanup === 'function' ? cleanup : () => {}
  }

  if (interactionConfig.mode === 'categoryClick' && typeof view.onCategoryClick === 'function') {
    const cleanup = view.onCategoryClick((selection) => {
      const field = resolveCategoryField({ spec, interactionConfig, selection })
      const values = uniqueValues(selection?.values || [selection?.value]).filter((value) => typeof value === 'string' || typeof value === 'number')
      if (!field || values.length === 0 || typeof onActionCall !== 'function') return

      onActionCall(buildHumanActionCall({
        name: interactionConfig.actionName || 'widget.selectCategory',
        actionTargetRef,
        params: { field, values },
      }))
    })
    return typeof cleanup === 'function' ? cleanup : () => {}
  }

  if (interactionConfig.mode === 'cellClick' && typeof view.onCellClick === 'function') {
    const cleanup = view.onCellClick((selection) => {
      const { xField, yField } = resolveCellFields({ spec, interactionConfig, selection })
      const xValue = selection?.xValue
      const yValue = selection?.yValue
      if (!xField || !yField || xValue == null || yValue == null || typeof onActionCall !== 'function') return

      onActionCall(buildHumanActionCall({
        name: interactionConfig.actionName || 'heatmap.filterCells',
        actionTargetRef,
        params: { xField, yField, xValue, yValue },
      }))
    })
    return typeof cleanup === 'function' ? cleanup : () => {}
  }

  if (interactionConfig.mode === 'multiBrush' && typeof view.onMultiBrush === 'function') {
    const cleanup = view.onMultiBrush((rules) => {
      const normalizedRules = Array.isArray(rules) ? rules : []
      if (normalizedRules.length === 0) return
      if (typeof onActionCall === 'function') {
        onActionCall(buildHumanActionCall({
          name: interactionConfig.actionName || 'parallelCoordinates.brushAxes',
          actionTargetRef,
          params: { rules: clone(normalizedRules) },
        }))
        return
      }
      if (typeof onSelectionChange === 'function') {
        onSelectionChange({
          selection_id: `sel_${Date.now()}`,
          source_widget_id: selectionSourceWidgetId || undefined,
          selection_type: 'interval',
          predicates: normalizedRules.map((rule) => ({
            field: rule.field,
            op: 'between',
            value: rule.range,
          })),
        })
      }
    })
    return typeof cleanup === 'function' ? cleanup : () => {}
  }

  if (interactionConfig.mode === 'rowClick' && typeof view.onRowClick === 'function') {
    const cleanup = view.onRowClick((selection) => {
      const keyField = resolveTableKeyField({ interactionConfig, selection })
      const keys = uniqueValues(selection?.keys || [selection?.key])
      if (!keyField || keys.length === 0 || typeof onActionCall !== 'function') return

      onActionCall(buildHumanActionCall({
        name: interactionConfig.actionName || 'table.focusRows',
        actionTargetRef,
        params: { keyField, keys },
      }))
    })
    return typeof cleanup === 'function' ? cleanup : () => {}
  }

  return () => {}
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

      onActionCall(buildHumanActionCall({
        name: interactionConfig.actionName || 'parallelCoordinates.brushAxes',
        actionTargetRef,
        params: { rules },
      }))
    }
    view.on('axisareaselected', handler)
    return () => view.off?.('axisareaselected', handler)
  }

  if (interactionConfig.mode === 'rowClick') {
    const handler = (event) => {
      const eventData = event?.data && typeof event.data === 'object' ? event.data : null
      const selection = event?.widgetvaSelection || event
      const keyField = resolveTableKeyField({ interactionConfig, selection, eventData })
      const rawKey = selection?.keys?.[0] ?? selection?.key ?? (keyField ? eventData?.[keyField] : null)
      if (!keyField || rawKey == null) return

      onActionCall(buildHumanActionCall({
        name: interactionConfig.actionName || 'table.focusRows',
        actionTargetRef,
        params: {
          keyField,
          keys: [rawKey],
        },
      }))
    }
    view.on('click', handler)
    return () => view.off?.('click', handler)
  }

  return () => {}
}
