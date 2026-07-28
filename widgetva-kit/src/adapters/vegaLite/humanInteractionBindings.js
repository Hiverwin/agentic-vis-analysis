function buildActionCall({ name, actionTargetRef, params }) {
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

function resolveCategoryField({ enc, interactionConfig }) {
  const preferredChannel = interactionConfig?.categoryFieldChannel
  if (preferredChannel && enc?.[preferredChannel]?.field) {
    return enc[preferredChannel].field
  }
  if (interactionConfig?.categoryField && typeof interactionConfig.categoryField === 'string') {
    return interactionConfig.categoryField
  }
  return enc.color?.field || enc.shape?.field || enc.detail?.field || enc.key?.field || enc.x?.field || enc.y?.field
}

function resolveCellFields({ enc, interactionConfig }) {
  const xField = interactionConfig?.xField || enc.x?.field || null
  const yField = interactionConfig?.yField || enc.y?.field || null
  return { xField, yField }
}

function normalizeMultiBrushRules(rawRules) {
  if (!Array.isArray(rawRules)) return []
  return rawRules
    .filter((rule) => typeof rule?.field === 'string' && Array.isArray(rule?.range) && rule.range.length === 2)
    .map((rule) => ({
      field: rule.field,
      range: [Math.min(...rule.range), Math.max(...rule.range)],
    }))
}

function buildFallbackSelection({
  selectionSourceWidgetId,
  selectionType,
  domain,
  predicates,
  count,
  summary,
  fields,
  value,
  keyField,
  keys,
  field,
  values,
}) {
  return {
    selection_id: `sel_${Date.now()}`,
    source_widget_id: selectionSourceWidgetId || undefined,
    selection_type: selectionType,
    ...(domain ? { domain } : {}),
    ...(Array.isArray(fields) ? { fields } : {}),
    ...(value && typeof value === 'object' && !Array.isArray(value) ? { value } : {}),
    ...(typeof keyField === 'string' ? { keyField } : {}),
    ...(Array.isArray(keys) ? { keys } : {}),
    ...(typeof field === 'string' ? { field } : {}),
    ...(Array.isArray(values) ? { values } : {}),
    predicates,
    count,
    summary,
  }
}

export function bindWidgetHumanInteractions({
  view,
  spec,
  interactionConfig,
  selectionSourceWidgetId,
  actionTargetRef,
  onActionCall,
  onSelectionChange,
}) {
  const data = Array.isArray(spec?.data?.values) ? spec.data.values : []
  const enc = spec?.encoding || {}
  const cleanups = []

  if (!interactionConfig || interactionConfig.mode === 'none') {
    return () => {}
  }

  function emitBrushSelection() {
    try {
      const xField = enc.x?.field ?? 'x'
      const yField = enc.y?.field ?? 'y'
      let xMin
      let xMax
      let yMin
      let yMax

      const brush = view.signal('brush')
      if (brush && (Array.isArray(brush) || (brush.x && brush.y))) {
        const xr = Array.isArray(brush) ? brush : brush.x
        const yr = Array.isArray(brush) ? brush : brush.y
        if (xr && yr && xr.length >= 2 && yr.length >= 2) {
          xMin = Math.min(xr[0], xr[1])
          xMax = Math.max(xr[0], xr[1])
          yMin = Math.min(yr[0], yr[1])
          yMax = Math.max(yr[0], yr[1])
        }
      }

      if (xMin == null) {
        const x1 = view.signal('brush_x_1')
        const x2 = view.signal('brush_x_2')
        const y1 = view.signal('brush_y_1')
        const y2 = view.signal('brush_y_2')
        if (x1 != null && x2 != null && y1 != null && y2 != null) {
          xMin = Math.min(x1, x2)
          xMax = Math.max(x1, x2)
          yMin = Math.min(y1, y2)
          yMax = Math.max(y1, y2)
        }
      }

      if (xMin == null) {
        const tupleStore = view.data?.('brush_store')
        const tuple = Array.isArray(tupleStore) && tupleStore.length > 0 ? tupleStore[0] : null
        const fields = tuple?.fields
        const values = tuple?.values
        if (Array.isArray(fields) && Array.isArray(values) && fields.length >= 2 && values.length >= 2) {
          const xVal = values[0]
          const yVal = values[1]
          if (Array.isArray(xVal) && xVal.length >= 2 && Array.isArray(yVal) && yVal.length >= 2) {
            xMin = Math.min(xVal[0], xVal[1])
            xMax = Math.max(xVal[0], xVal[1])
            yMin = Math.min(yVal[0], yVal[1])
            yMax = Math.max(yVal[0], yVal[1])
          }
        }
      }

      if (xMin == null || xMax == null || yMin == null || yMax == null) {
        onSelectionChange?.(null)
        return
      }

      const filtered = data.filter((row) => {
        const x = row?.[xField]
        const y = row?.[yField]
        return x != null && y != null && x >= xMin && x <= xMax && y >= yMin && y <= yMax
      })

      if (onActionCall) {
        onActionCall(
          buildActionCall({
            name: interactionConfig.actionName || 'scatter.brushRegion',
            actionTargetRef,
            params: {
              xField,
              yField,
              xRange: [xMin, xMax],
              yRange: [yMin, yMax],
            },
          }),
        )
        return
      }

      onSelectionChange?.(
        buildFallbackSelection({
          selectionSourceWidgetId,
          selectionType: 'interval',
          fields: [xField, yField],
          value: {
            [xField]: [xMin, xMax],
            [yField]: [yMin, yMax],
          },
          domain: {
            xDomain: [xMin, xMax],
            yDomain: [yMin, yMax],
          },
          predicates: [
            { field: xField, op: 'between', value: [xMin, xMax] },
            { field: yField, op: 'between', value: [yMin, yMax] },
          ],
          count: filtered.length,
          summary: `${xField} ${xMin.toFixed(1)}–${xMax.toFixed(1)}, ${yField} ${yMin.toFixed(1)}–${yMax.toFixed(1)}`,
        }),
      )
    } catch {
      onSelectionChange?.(null)
    }
  }

  function emitCategorySelection(_event, item) {
    try {
      const categoryField = resolveCategoryField({ enc, interactionConfig })
      const categoryValue = categoryField ? item?.datum?.[categoryField] : undefined
      if (!categoryField || categoryValue == null) return
      const matched = data.filter((row) => row?.[categoryField] === categoryValue)

      if (onActionCall) {
        onActionCall(
          buildActionCall({
            name: interactionConfig.actionName || 'bar.selectCategory',
            actionTargetRef,
            params: {
              field: categoryField,
              values: [categoryValue],
            },
          }),
        )
        return
      }

      onSelectionChange?.(
        buildFallbackSelection({
          selectionSourceWidgetId,
          selectionType: 'category',
          field: categoryField,
          values: [categoryValue],
          predicates: [{ field: categoryField, op: 'in', value: [categoryValue] }],
          count: matched.length,
          summary: `${categoryField}: ${String(categoryValue)}`,
        }),
      )
    } catch {
      onSelectionChange?.(null)
    }
  }

  function emitCellSelection(_event, item) {
    try {
      const { xField, yField } = resolveCellFields({ enc, interactionConfig })
      const xValue = xField ? item?.datum?.[xField] : undefined
      const yValue = yField ? item?.datum?.[yField] : undefined
      if (!xField || !yField || xValue == null || yValue == null) return
      const matched = data.filter((row) => row?.[xField] === xValue && row?.[yField] === yValue)

      if (onActionCall) {
        onActionCall(
          buildActionCall({
            name: interactionConfig.actionName || 'heatmap.selectCell',
            actionTargetRef,
            params: {
              xField,
              yField,
              xValue,
              yValue,
            },
          }),
        )
        return
      }

      onSelectionChange?.(
        buildFallbackSelection({
          selectionSourceWidgetId,
          selectionType: 'cell',
          fields: [xField, yField],
          value: {
            [xField]: xValue,
            [yField]: yValue,
          },
          predicates: [
            { field: xField, op: 'equals', value: xValue },
            { field: yField, op: 'equals', value: yValue },
          ],
          count: matched.length,
          summary: `${xField}: ${String(xValue)}; ${yField}: ${String(yValue)}`,
        }),
      )
    } catch {
      onSelectionChange?.(null)
    }
  }

  function emitMultiBrushSelection(...args) {
    try {
      const maybeRules = args.find((value) => Array.isArray(value))
      const rules = normalizeMultiBrushRules(maybeRules || interactionConfig?.rules)
      if (rules.length === 0) return

      const matched = data.filter((row) =>
        rules.every((rule) => {
          const value = row?.[rule.field]
          return typeof value === 'number' && value >= rule.range[0] && value <= rule.range[1]
        }),
      )

      if (onActionCall) {
        const firstRule = rules[0]
        onActionCall(
          buildActionCall({
            name: interactionConfig.actionName || 'parallelCoordinates.filterDimension',
            actionTargetRef,
            params: { dimension: firstRule?.field, range: firstRule?.range },
          }),
        )
        return
      }

      onSelectionChange?.(
        buildFallbackSelection({
          selectionSourceWidgetId,
          selectionType: 'interval',
          predicates: rules.map((rule) => ({
            field: rule.field,
            op: 'between',
            value: rule.range,
          })),
          count: matched.length,
          summary: rules.map((rule) => `${rule.field} ${rule.range[0]}–${rule.range[1]}`).join('; '),
        }),
      )
    } catch {
      onSelectionChange?.(null)
    }
  }

  if (interactionConfig.mode === 'brush2d') {
    try {
      view.addSignalListener('brush', emitBrushSelection)
      cleanups.push(() => view.removeSignalListener?.('brush', emitBrushSelection))
    } catch {}
    for (const signalName of ['brush_x_1', 'brush_x_2', 'brush_y_1', 'brush_y_2']) {
      try {
        view.addSignalListener(signalName, emitBrushSelection)
        cleanups.push(() => view.removeSignalListener?.(signalName, emitBrushSelection))
      } catch {}
    }
    try {
      view.addEventListener('mouseup', emitBrushSelection)
      cleanups.push(() => view.removeEventListener?.('mouseup', emitBrushSelection))
    } catch {}
  }

  if (interactionConfig.mode === 'categoryClick') {
    try {
      view.addEventListener('click', emitCategorySelection)
      cleanups.push(() => view.removeEventListener?.('click', emitCategorySelection))
    } catch {}
  }

  if (interactionConfig.mode === 'cellClick') {
    try {
      view.addEventListener('click', emitCellSelection)
      cleanups.push(() => view.removeEventListener?.('click', emitCellSelection))
    } catch {}
  }

  if (interactionConfig.mode === 'multiBrush') {
    for (const signalName of ['widgetva_multiBrush', 'multiBrush']) {
      try {
        view.addSignalListener(signalName, emitMultiBrushSelection)
        cleanups.push(() => view.removeSignalListener?.(signalName, emitMultiBrushSelection))
      } catch {}
    }
  }

  return () => {
    cleanups.forEach((cleanup) => {
      try {
        cleanup()
      } catch {}
    })
  }
}
