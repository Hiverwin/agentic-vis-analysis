import {
  clone,
  normalizeSelections,
  resolveAddRemoveStatePayload,
  resolveAggregateStatePayload,
  resolveDrillDownStatePayload,
  resolveFocusPayload,
  resolveHighlightStatePayload,
  resolveNavigateStatePayload,
  resolvePrimaryIntervalSelection,
  resolveReencodeStatePayload,
  resolveRepresentativeSelection,
  resolveSortPayload,
} from '../shared/providerStatePayloads.js'

function uniqueValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => value != null))]
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

function writeSurfaceState(surface, state, selection) {
  if (!surface) return
  surface.dataset.widgetvaSelectedCount = String(state?.data?.selectedCount ?? 0)
  surface.dataset.widgetvaVisibleCount = String(state?.data?.visibleCount ?? 0)
  surface.dataset.widgetvaSelectionSummary = selection?.summary || ''
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
        const firstRule = normalizedRules[0]
        onActionCall(buildHumanActionCall({
          name: interactionConfig.actionName || 'parallelCoordinates.filterDimension',
          actionTargetRef,
          params: { dimension: firstRule?.field, range: clone(firstRule?.range) },
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

  return () => {}
}
