import { buildWidgetFilterPatch } from '../shared/filterPatch.js'
import { buildWidgetSelectionPatch } from '../shared/selectionPatch.js'
import { buildHeatmapSemanticPatch } from './semanticPatches.js'

function targetWidgetState(targetWidget) {
  return { widgets: { [targetWidget.ref]: targetWidget } }
}

function isPrimitiveSelectionValue(value) {
  return typeof value === 'string' || typeof value === 'number'
}

function resolveHeatmapAxisFieldAlias(spec, requestedField, axis) {
  if (typeof requestedField !== 'string' || requestedField.length === 0) {
    return null
  }

  const encodingField = typeof spec?.encoding?.[axis]?.field === 'string'
    ? spec.encoding[axis].field
    : null
  if (!encodingField) {
    return requestedField
  }

  if (requestedField === axis || requestedField === encodingField) {
    return encodingField
  }

  return requestedField
}

function resolveHeatmapRootEncoding(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return {}
  }

  if (spec.encoding && typeof spec.encoding === 'object' && !Array.isArray(spec.encoding)) {
    return spec.encoding
  }

  const rowSpec = Array.isArray(spec.vconcat) && spec.vconcat.length > 0
    ? spec.vconcat[spec.vconcat.length - 1]
    : spec
  const mainSpec = Array.isArray(rowSpec?.hconcat) && rowSpec.hconcat.length > 0
    ? rowSpec.hconcat[0]
    : rowSpec

  if (mainSpec?.encoding && typeof mainSpec.encoding === 'object' && !Array.isArray(mainSpec.encoding)) {
    return mainSpec.encoding
  }

  return {}
}

function readMarkType(mark) {
  return typeof mark === 'string' ? mark : mark?.type || null
}

function isHeatmapFamilyMark(mark) {
  return readMarkType(mark) === 'rect'
}

function collectNestedHeatmapSpecs(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return []
  const nested = []
  for (const key of ['layer', 'vconcat', 'hconcat', 'concat']) {
    if (Array.isArray(spec?.[key])) {
      nested.push(...spec[key].filter((entry) => entry && typeof entry === 'object'))
    }
  }
  if (spec?.spec && typeof spec.spec === 'object' && !Array.isArray(spec.spec)) {
    nested.push(spec.spec)
  }
  return nested
}

function findRepresentativeHeatmapSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null
  if (isHeatmapFamilyMark(spec?.mark) && spec?.encoding && typeof spec.encoding === 'object') {
    return spec
  }
  if (Array.isArray(spec?.layer)) {
    const layeredMatch = spec.layer.find((entry) => (
      entry && typeof entry === 'object' && isHeatmapFamilyMark(entry?.mark) && entry?.encoding && typeof entry.encoding === 'object'
    ))
    if (layeredMatch) return layeredMatch
  }
  for (const child of collectNestedHeatmapSpecs(spec)) {
    const match = findRepresentativeHeatmapSpec(child)
    if (match) return match
  }
  return null
}

export function registerHeatmapActions(actionExecutor) {
  const registerHeatmapCellAction = (name, invalidTargetMessage, invalidParamsMessage) => {
    if (actionExecutor.has(name)) return
    actionExecutor.register(
      { name },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const currentSpec = targetWidget?.currentSpec || targetWidget?.rawSpec || null
        const representativeSpec = findRepresentativeHeatmapSpec(currentSpec) || currentSpec
        const xField = resolveHeatmapAxisFieldAlias(representativeSpec, typeof params.xField === 'string' ? params.xField : null, 'x')
        const yField = resolveHeatmapAxisFieldAlias(representativeSpec, typeof params.yField === 'string' ? params.yField : null, 'y')
        const xValue = isPrimitiveSelectionValue(params.xValue) ? params.xValue : null
        const yValue = isPrimitiveSelectionValue(params.yValue) ? params.yValue : null
        if (!targetWidget || !xField || !yField || xValue == null || yValue == null) {
          throw new Error(invalidParamsMessage)
        }

        const visibleRows = ctx.readRows(targetWidget.ref)
        const matchedCount = visibleRows.filter((row) => row?.[xField] === xValue && row?.[yField] === yValue).length
        const selection = {
          selection_id: name === 'heatmap.selectCell' ? 'cell' : 'cell-filter',
          source_widget_id: targetWidget.widgetId || undefined,
          selection_type: 'cell',
          fields: [xField, yField],
          value: {
            [xField]: xValue,
            [yField]: yValue,
          },
          predicates: [
            { field: xField, op: 'equals', value: xValue },
            { field: yField, op: 'equals', value: yValue },
          ],
          count: matchedCount,
          summary: `${xField}: ${xValue}; ${yField}: ${yValue}`,
        }

        const currentState = targetWidgetState(targetWidget)
        const selectionPatch = buildWidgetSelectionPatch({
          targetWidget,
          currentState,
          selection,
        })
        const filterPatch = name === 'heatmap.filterCells'
          ? buildWidgetFilterPatch({
              targetWidget,
              currentState,
              actionName: 'heatmap.filterCells',
              fields: [xField, yField],
              value: {
                [xField]: xValue,
                [yField]: yValue,
              },
              predicates: selection.predicates,
              visibleCount: matchedCount,
            })
          : null
        const patch = filterPatch
          ? {
              ...selectionPatch,
              [targetWidget.ref]: {
                ...selectionPatch[targetWidget.ref],
                transforms: filterPatch[targetWidget.ref]?.transforms || [],
                data: {
                  ...(selectionPatch[targetWidget.ref]?.data || {}),
                  ...(filterPatch[targetWidget.ref]?.data || {}),
                },
              },
            }
          : selectionPatch

        return {
          patch,
          affectedRefs: [targetWidget.ref],
          result: {
            selectedCount: matchedCount,
          },
          selectedCount: matchedCount,
          verificationHints: [
            ...(name === 'heatmap.filterCells'
              ? [
                  'Call perception.inspectVisibleRows to verify only the requested heatmap cell remains visible.',
                  'Call perception.inspectViewConfig to verify the active heatmap state includes x/y equality filters for the requested cell.',
                ]
              : [
                  'Read the updated heatmap selection state.',
                  'Read linked widgets to confirm cell-level filter propagation.',
                ]),
          ],
          propagateFromSelection: name !== 'heatmap.filterCells',
        }
      },
    )
  }

  registerHeatmapCellAction(
    'heatmap.filterCells',
    'heatmap.filterCells requires a valid heatmap target widget.',
    'heatmap.filterCells requires a heatmap target, xField, yField, xValue, and yValue.',
  )
  registerHeatmapCellAction(
    'heatmap.selectCell',
    'heatmap.selectCell requires a valid heatmap target widget.',
    'heatmap.selectCell requires a heatmap target, xField, yField, xValue, and yValue.',
  )

  if (!actionExecutor.has('heatmap.selectSubmatrix')) {
    actionExecutor.register(
      { name: 'heatmap.selectSubmatrix' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const xValues = Array.isArray(params.xValues) ? params.xValues.filter((value) => value != null) : []
        const yValues = Array.isArray(params.yValues) ? params.yValues.filter((value) => value != null) : []
        if (!targetWidget || (xValues.length === 0 && yValues.length === 0)) {
          throw new Error('heatmap.selectSubmatrix requires a heatmap target and at least one of xValues or yValues.')
        }

        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget
        const spec = currentWidgetState?.currentSpec || currentWidgetState?.rawSpec || null
        const representativeSpec = findRepresentativeHeatmapSpec(spec) || spec
        const encoding = resolveHeatmapRootEncoding(representativeSpec)
        const xField = encoding?.x?.field || null
        const yField = encoding?.y?.field || null
        if (!xField || !yField) {
          throw new Error('heatmap.selectSubmatrix requires x and y encodings on the active heatmap spec.')
        }

        const visibleRows = ctx.readRows(targetWidget.ref)
        const matchedCount = visibleRows.filter((row) => {
          const xMatch = xValues.length === 0 || xValues.includes(row?.[xField])
          const yMatch = yValues.length === 0 || yValues.includes(row?.[yField])
          return xMatch && yMatch
        }).length

        const predicates = []
        if (xValues.length > 0) {
          predicates.push({ field: xField, op: 'in', value: xValues })
        }
        if (yValues.length > 0) {
          predicates.push({ field: yField, op: 'in', value: yValues })
        }

        const selection = {
          selection_id: 'submatrix',
          source_widget_id: targetWidget.widgetId || undefined,
          selection_type: 'cell',
          fields: [xField, yField],
          value: {
            ...(xValues.length > 0 ? { [xField]: xValues } : {}),
            ...(yValues.length > 0 ? { [yField]: yValues } : {}),
          },
          predicates,
          count: matchedCount,
          summary: `${xField}: ${xValues.length > 0 ? xValues.join(', ') : 'all'}; ${yField}: ${yValues.length > 0 ? yValues.join(', ') : 'all'}`,
        }

        return {
          patch: buildWidgetSelectionPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            selection,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            selectedCount: matchedCount,
          },
          selectedCount: matchedCount,
          verificationHints: [
            'Read the updated heatmap selection state.',
            'Read linked widgets to confirm submatrix-level filter propagation.',
          ],
          propagateFromSelection: true,
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.drilldownAxis')) {
    actionExecutor.register(
      { name: 'heatmap.drilldownAxis' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const level = typeof params.level === 'string' ? params.level.toLowerCase().trim() : null
        const value = params.value
        const parent = params.parent && typeof params.parent === 'object' && !Array.isArray(params.parent)
          ? params.parent
          : {}
        if (!targetWidget || !level || value == null || value === '') {
          throw new Error('heatmap.drilldownAxis requires a heatmap target plus level and value.')
        }

        return {
          patch: buildHeatmapSemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'heatmap.drilldownAxis',
            transformKind: 'filter',
            analysisKey: 'drillDown',
            viewKey: 'drillDown',
            viewState: {
              level,
              value,
              parent,
            },
            spec: {
              level,
              value,
              parent,
            },
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            level,
            value,
            parent,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap x-axis timeUnit now reflects the finer drill-down level.',
            'Read the target widget view state to confirm the tagged drill-down filter now narrows the visible period.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.resetDrilldown')) {
    actionExecutor.register(
      { name: 'heatmap.resetDrilldown' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        if (!targetWidget) {
          throw new Error('heatmap.resetDrilldown requires a valid heatmap target widget.')
        }

        return {
          patch: buildHeatmapSemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'heatmap.resetDrilldown',
            analysisKey: 'drillDown',
            viewKey: 'drillDown',
            viewState: null,
            spec: {
              reset: true,
            },
            clearActionName: 'heatmap.drilldownAxis',
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            reset: true,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the original heatmap x-axis encoding was restored.',
            'Read the target widget view state to confirm the drill-down filter and state marker were removed.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.addMarginalBars')) {
    actionExecutor.register(
      { name: 'heatmap.addMarginalBars' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const op = typeof params.op === 'string' ? params.op.toLowerCase().trim() : 'mean'
        const showTop = params.showTop !== false
        const showRight = params.showRight !== false
        const barSize = Number.isFinite(params.barSize) ? Number(params.barSize) : 70
        const barColor = typeof params.barColor === 'string' && params.barColor.length > 0 ? params.barColor : '#666666'
        const allowedAgg = new Set(['mean', 'sum', 'median', 'max', 'min', 'count'])
        if (!targetWidget) {
          throw new Error('heatmap.addMarginalBars requires a valid heatmap target widget.')
        }
        if (!showTop && !showRight) {
          throw new Error('heatmap.addMarginalBars requires at least one of showTop/showRight to be true.')
        }
        if (!allowedAgg.has(op)) {
          throw new Error(`heatmap.addMarginalBars does not support op "${params.op}".`)
        }

        return {
          patch: buildHeatmapSemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'heatmap.addMarginalBars',
            transformKind: 'aggregate',
            analysisKey: 'marginalBars',
            viewKey: 'addRemove',
            viewState: {
              mode: 'marginalBars',
              op,
              showTop,
              showRight,
              barSize,
              barColor,
            },
            spec: {
              op,
              showTop,
              showRight,
              barSize,
              barColor,
            },
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            op,
            showTop,
            showRight,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap was composed with top and/or right marginal bar charts.',
            'Read the target widget view state to confirm the marginal bars aggregate the original heatmap value field.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.highlightRegion')) {
    actionExecutor.register(
      { name: 'heatmap.highlightRegion' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const xValues = Array.isArray(params.xValues) ? params.xValues.filter((value) => value != null) : []
        const yValues = Array.isArray(params.yValues) ? params.yValues.filter((value) => value != null) : []
        if (!targetWidget || (xValues.length === 0 && yValues.length === 0)) {
          throw new Error('heatmap.highlightRegion requires a heatmap target and at least one of xValues or yValues.')
        }

        return {
          patch: buildHeatmapSemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'heatmap.highlightRegion',
            transformKind: 'derive',
            analysisKey: 'regionHighlight',
            viewKey: 'highlight',
            viewState: {
              mode: 'regionHighlight',
              xValues,
              yValues,
            },
            spec: {
              xValues,
              yValues,
            },
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            xValues,
            yValues,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap opacity condition was updated.',
            'Read the target widget view state to confirm the requested region is emphasized.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.adjustColorScale')) {
    actionExecutor.register(
      { name: 'heatmap.adjustColorScale' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const scheme = typeof params.scheme === 'string' ? params.scheme.trim() : ''
        const domain = Array.isArray(params.domain) ? params.domain : null
        if (!targetWidget || !scheme) {
          throw new Error('heatmap.adjustColorScale requires a heatmap target and a non-empty scheme.')
        }
        if (domain && domain.length !== 2) {
          throw new Error('heatmap.adjustColorScale domain must contain exactly two values when provided.')
        }

        return {
          patch: buildHeatmapSemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'heatmap.adjustColorScale',
            transformKind: 'reencode',
            analysisKey: 'colorScale',
            viewKey: 'reencode',
            viewState: {
              mode: 'colorScale',
              scheme,
              ...(domain ? { domain } : {}),
            },
            spec: {
              scheme,
              ...(domain ? { domain } : {}),
            },
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            scheme,
            ...(domain ? { domain } : {}),
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap color scale scheme was updated.',
            'Read the target widget view state to confirm the requested color domain values.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.thresholdMask')) {
    actionExecutor.register(
      { name: 'heatmap.thresholdMask' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const hasMinValue = params.minValue !== undefined && params.minValue !== null && params.minValue !== ''
        const hasMaxValue = params.maxValue !== undefined && params.maxValue !== null && params.maxValue !== ''
        const minValue = hasMinValue ? Number(params.minValue) : null
        const maxValue = hasMaxValue ? Number(params.maxValue) : null
        const outsideOpacity = Number.isFinite(params.outsideOpacity)
          ? Math.max(0, Math.min(1, params.outsideOpacity))
          : 0.1
        const hasFiniteMin = Number.isFinite(minValue)
        const hasFiniteMax = Number.isFinite(maxValue)
        if (!targetWidget || (!hasFiniteMin && !hasFiniteMax)) {
          throw new Error('heatmap.thresholdMask requires a heatmap target plus at least one finite minValue or maxValue.')
        }
        const predicates = [
          ...(hasFiniteMin ? [{ field: 'value', op: 'gte', value: minValue }] : []),
          ...(hasFiniteMax ? [{ field: 'value', op: 'lte', value: maxValue }] : []),
        ]
        const thresholdRange = hasFiniteMin && hasFiniteMax ? [minValue, maxValue] : null

        return {
          patch: buildHeatmapSemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'heatmap.thresholdMask',
            transformKind: 'filter',
            analysisKey: 'thresholdMask',
            viewKey: 'highlight',
            viewState: {
              mode: 'thresholdMask',
              ...(hasFiniteMin ? { minValue } : {}),
              ...(hasFiniteMax ? { maxValue } : {}),
              outsideOpacity,
            },
            spec: {
              ...(hasFiniteMin ? { minValue } : {}),
              ...(hasFiniteMax ? { maxValue } : {}),
              outsideOpacity,
              ...(thresholdRange ? { thresholdRange } : {}),
              predicates,
            },
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            ...(hasFiniteMin ? { minValue } : {}),
            ...(hasFiniteMax ? { maxValue } : {}),
            outsideOpacity,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap opacity condition now masks values outside the requested threshold range.',
            'Read the target widget view state to confirm the requested threshold mask was applied.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.filterCellsByRegion')) {
    actionExecutor.register(
      { name: 'heatmap.filterCellsByRegion' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()

        const xValues = Array.isArray(params.xValues)
          ? params.xValues.filter((value) => value != null)
          : (params.xValue != null ? [params.xValue] : [])
        const yValues = Array.isArray(params.yValues)
          ? params.yValues.filter((value) => value != null)
          : (params.yValue != null ? [params.yValue] : [])
        if (!targetWidget || (xValues.length === 0 && yValues.length === 0)) {
          throw new Error('heatmap.filterCellsByRegion requires a heatmap target and at least one of xValues/yValues or xValue/yValue.')
        }

        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget
        const spec = findRepresentativeHeatmapSpec(currentWidgetState?.currentSpec || currentWidgetState?.rawSpec || null)
          || currentWidgetState?.currentSpec
          || currentWidgetState?.rawSpec
          || null
        const xField = spec?.encoding?.x?.field || null
        const yField = spec?.encoding?.y?.field || null
        const predicates = [
          ...(xField && xValues.length > 0 ? [{ field: xField, op: 'in', value: xValues }] : []),
          ...(yField && yValues.length > 0 ? [{ field: yField, op: 'in', value: yValues }] : []),
        ]

        return {
          patch: buildWidgetFilterPatch({
            targetWidget,
            currentState,
            actionName: 'heatmap.filterCellsByRegion',
            fields: [xField, yField].filter(Boolean),
            value: {
              ...(xField && xValues.length > 0 ? { [xField]: xValues } : {}),
              ...(yField && yValues.length > 0 ? { [yField]: yValues } : {}),
            },
            predicates,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            xValues,
            yValues,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap transform now excludes the requested region.',
            'Read the target widget rows to confirm the requested region no longer appears in the visible matrix.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.highlightRegionByValue')) {
    actionExecutor.register(
      { name: 'heatmap.highlightRegionByValue' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const hasMin = params.minValue != null && params.minValue !== ''
        const hasMax = params.maxValue != null && params.maxValue !== ''
        const minValue = hasMin ? Number(params.minValue) : null
        const maxValue = hasMax ? Number(params.maxValue) : null
        const outsideOpacity = Number.isFinite(params.outsideOpacity)
          ? Math.max(0, Math.min(1, params.outsideOpacity))
          : 0.12
        if (!targetWidget || (!hasMin && !hasMax) || (hasMin && !Number.isFinite(minValue)) || (hasMax && !Number.isFinite(maxValue))) {
          throw new Error('heatmap.highlightRegionByValue requires a heatmap target and at least one finite minValue or maxValue.')
        }

        return {
          patch: buildHeatmapSemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'heatmap.highlightRegionByValue',
            transformKind: 'derive',
            analysisKey: 'valueHighlight',
            viewKey: 'highlight',
            viewState: {
              mode: 'valueHighlight',
              ...(hasMin ? { minValue } : {}),
              ...(hasMax ? { maxValue } : {}),
              outsideOpacity,
            },
            spec: {
              ...(hasMin ? { minValue } : {}),
              ...(hasMax ? { maxValue } : {}),
              outsideOpacity,
            },
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            ...(hasMin ? { minValue } : {}),
            ...(hasMax ? { maxValue } : {}),
            outsideOpacity,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap opacity condition now highlights values inside the requested range.',
            'Read the target widget view state to confirm the value-range highlight was applied without filtering data away.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.clusterRowsCols')) {
    actionExecutor.register(
      { name: 'heatmap.clusterRowsCols' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const clusterRows = params.clusterRows !== false
        const clusterCols = params.clusterCols !== false
        const requestedMethod = typeof params.method === 'string' ? params.method.toLowerCase().trim() : 'sum'
        const method = ['sum', 'mean', 'max'].includes(requestedMethod) ? requestedMethod : 'sum'
        if (!targetWidget || (!clusterRows && !clusterCols)) {
          throw new Error('heatmap.clusterRowsCols requires a heatmap target and at least one of clusterRows or clusterCols to be true.')
        }

        return {
          patch: buildHeatmapSemanticPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
            actionName: 'heatmap.clusterRowsCols',
            transformKind: 'aggregate',
            analysisKey: 'cluster',
            viewKey: 'reencode',
            viewState: {
              mode: 'clusterRowsCols',
              clusterRows,
              clusterCols,
              method,
            },
            spec: {
              clusterRows,
              clusterCols,
              method,
            },
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            clusterRows,
            clusterCols,
            method,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap x/y encodings now carry aggregate sort metadata.',
            'Read the target widget view state to confirm the requested rows and/or columns are reordered by aggregated value.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('heatmap.transpose')) {
    actionExecutor.register(
      { name: 'heatmap.transpose' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        if (!targetWidget) {
          throw new Error('heatmap.transpose requires a valid heatmap target widget.')
        }

        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget
        const transposed = currentWidgetState?.data?.analysis?.transpose?.transposed !== true

        return {
          patch: buildHeatmapSemanticPatch({
            targetWidget,
            currentState,
            actionName: 'heatmap.transpose',
            transformKind: 'reencode',
            analysisKey: 'transpose',
            viewKey: 'reencode',
            viewState: {
              mode: 'transpose',
              transposed,
            },
            spec: {
              transposed,
            },
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            transposed,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the heatmap x and y encodings were swapped.',
            'Read the target widget view state to confirm the transpose marker and any width/height swap were applied.',
          ],
        }
      },
    )
  }
}
