import { buildWidgetViewPatch } from '../shared/viewPatch.js'
import {
  buildLineBoldPatch,
  buildLineDrillDownPatch,
  buildLineFilterPatch,
  buildLineMovingAveragePatch,
  buildLineResetDrillDownPatch,
  buildLineResetResamplePatch,
  buildLineResamplePatch,
  buildLineSeriesSelectionPatch,
  buildLineTrendPatch,
  buildLineZoomXRegionPatch,
} from './semanticPatches.js'

function targetWidgetState(targetWidget) {
  return { widgets: { [targetWidget.ref]: targetWidget } }
}

function inferLineRootEncoding(spec) {
  return spec?.layer?.[0]?.encoding || spec?.encoding || {}
}

function readMarkType(mark) {
  return typeof mark === 'string' ? mark : mark?.type || null
}

function isLineFamilyMark(mark) {
  const markType = readMarkType(mark)
  return markType === 'line' || markType === 'area'
}

function collectNestedLineSpecs(spec) {
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

function findRepresentativeLineSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return spec
  if (isLineFamilyMark(spec?.mark) && spec?.encoding && typeof spec.encoding === 'object') {
    return spec
  }
  if (Array.isArray(spec?.layer)) {
    const layeredMatch = spec.layer.find((entry) => (
      entry && typeof entry === 'object' && isLineFamilyMark(entry?.mark) && entry?.encoding && typeof entry.encoding === 'object'
    ))
    if (layeredMatch) return layeredMatch
  }
  for (const child of collectNestedLineSpecs(spec)) {
    const match = findRepresentativeLineSpec(child)
    if (match && match !== spec) return match
  }
  return spec
}

function inferRawTimeField(spec, rootEncoding, originalTransforms) {
  const taggedTimeUnit = (Array.isArray(originalTransforms) ? originalTransforms : []).find(
    (transform) => transform && typeof transform === 'object' && 'timeUnit' in transform && typeof transform.field === 'string',
  )
  if (taggedTimeUnit?.field) {
    return taggedTimeUnit.field
  }

  const xField = rootEncoding?.x?.field
  if (typeof xField !== 'string' || xField.length === 0) {
    return null
  }
  if (!xField.includes('_')) {
    return xField
  }

  const candidate = xField.split('_').at(-1)
  const rows = spec?.data?.values
  if (Array.isArray(rows) && rows.length > 0 && candidate && Object.prototype.hasOwnProperty.call(rows[0], candidate)) {
    return candidate
  }
  return xField
}

function inferRawValueField(spec, rootEncoding, originalTransforms) {
  const aggregateTransform = (Array.isArray(originalTransforms) ? originalTransforms : []).find(
    (transform) => transform && typeof transform === 'object' && Array.isArray(transform.aggregate) && transform.aggregate.length > 0,
  )
  if (aggregateTransform?.aggregate?.[0]?.field) {
    return aggregateTransform.aggregate[0].field
  }

  const yField = rootEncoding?.y?.field
  if (typeof yField !== 'string' || yField.length === 0) {
    return null
  }
  if (yField.startsWith('total_')) {
    return yField.slice('total_'.length)
  }
  if (yField.startsWith('sum_')) {
    return yField.slice('sum_'.length)
  }
  return yField
}

function resolveLineDescriptorCapabilities(spec) {
  const representativeSpec = findRepresentativeLineSpec(spec)
  const rootEncoding = inferLineRootEncoding(representativeSpec)
  const originalTransforms = Array.isArray(representativeSpec?.transform) ? representativeSpec.transform : []
  const xField = typeof rootEncoding?.x?.field === 'string' && rootEncoding.x.field.length > 0
    ? rootEncoding.x.field
    : null
  const yField = typeof rootEncoding?.y?.field === 'string' && rootEncoding.y.field.length > 0
    ? rootEncoding.y.field
    : null
  const groupingField = typeof rootEncoding?.color?.field === 'string' && rootEncoding.color.field.length > 0
    ? rootEncoding.color.field
    : (typeof rootEncoding?.detail?.field === 'string' && rootEncoding.detail.field.length > 0
        ? rootEncoding.detail.field
        : null)
  const hasTemporalAxis = rootEncoding?.x?.type === 'temporal'
    || rootEncoding?.y?.type === 'temporal'
    || typeof rootEncoding?.x?.timeUnit === 'string'
    || typeof rootEncoding?.y?.timeUnit === 'string'
  const rawTimeField = inferRawTimeField(representativeSpec, rootEncoding, originalTransforms)
  const rawValueField = inferRawValueField(representativeSpec, rootEncoding, originalTransforms)

  return {
    hasXField: Boolean(xField),
    hasXYFields: Boolean(xField && yField),
    hasGroupingField: Boolean(groupingField),
    hasTemporalAxis,
    hasDrilldownFields: Boolean(rawTimeField && rawValueField),
  }
}

export function registerLineActions(actionExecutor) {
  if (!actionExecutor.has('line.selectSeries')) {
    actionExecutor.register(
      { name: 'line.selectSeries' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const field = typeof params.field === 'string' ? params.field : null
        const values = Array.isArray(params.values)
          ? params.values.filter((value) => typeof value === 'string' || typeof value === 'number')
          : []
        if (!targetWidget || !field || values.length === 0) {
          throw new Error('line.selectSeries requires a line target, field, and one or more values.')
        }

        const visibleRows = ctx.readRows(targetWidget.ref)
        const matchedCount = visibleRows.filter((row) => values.includes(row?.[field])).length
        return {
          patch: buildLineSeriesSelectionPatch({
            targetWidget,
            field,
            values,
            selectedCount: matchedCount,
            selectionId: `${field}-series`,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            selectedCount: matchedCount,
          },
          selectedCount: matchedCount,
          verificationHints: [
            'Read the updated line selection state.',
            'Read linked widgets to confirm series-level filter propagation.',
          ],
          propagateFromSelection: true,
        }
      },
    )
  }

  if (!actionExecutor.has('line.zoomXRegion')) {
    actionExecutor.register(
      { name: 'line.zoomXRegion' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const start = typeof params.start === 'string' ? params.start : null
        const end = typeof params.end === 'string' ? params.end : null
        if (!targetWidget || !start || !end) {
          throw new Error('line.zoomXRegion requires a line target plus start and end values.')
        }

        return {
          patch: buildLineZoomXRegionPatch({ targetWidget, start, end }),
          affectedRefs: [targetWidget.ref],
          propagateFromRef: `${targetWidget.ref}/view/zoom`,
          result: {
            widgetId: targetWidget.widgetId,
            xDomain: [start, end],
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the line chart x-domain was updated.',
            'Read the target widget view state to confirm the new temporal x-domain values.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.selectXValue')) {
    actionExecutor.register(
      { name: 'line.selectXValue' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const rawValue = params.value
        const explicitField = typeof params.field === 'string' && params.field.length > 0 ? params.field : null
        if (!targetWidget || rawValue == null) {
          throw new Error('line.selectXValue requires a line target and a non-null x-axis value.')
        }

        const visibleRows = ctx.readRows(targetWidget.ref)
        const currentSpec = targetWidget?.currentSpec
          || targetWidget?.rawSpec
          || targetWidget.readState?.().currentSpec
          || targetWidget.readState?.().rawSpec
          || null
        const rootEncoding = currentSpec?.layer?.[0]?.encoding || currentSpec?.encoding || {}
        const field = explicitField || rootEncoding?.x?.field || null
        if (!field) {
          throw new Error('line.selectXValue requires a resolvable x-axis field on the active line spec.')
        }

        const matchedCount = visibleRows.filter((row) => row?.[field] === rawValue).length
        return {
          patch: buildLineSeriesSelectionPatch({
            targetWidget,
            field,
            values: [rawValue],
            selectedCount: matchedCount,
            selectionId: `${field}-value`,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            selectedCount: matchedCount,
          },
          selectedCount: matchedCount,
          verificationHints: [
            'Read the updated line selection state.',
            'Read linked widgets to confirm the selected x-axis slice propagated beyond the line chart.',
          ],
          propagateFromSelection: true,
        }
      },
    )
  }

  if (!actionExecutor.has('line.focusLines')) {
    actionExecutor.register(
      { name: 'line.focusLines' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const lines = Array.isArray(params.lines) ? params.lines.filter((value) => typeof value === 'string' && value.length > 0) : []
        const dimOpacity = typeof params.dimOpacity === 'number' ? params.dimOpacity : 0.08
        if (!targetWidget || lines.length === 0) {
          throw new Error('line.focusLines requires a line target and at least one line identifier.')
        }

        return {
          patch: buildWidgetViewPatch({
            targetWidget,
            view: {
              focus: {
                sourceAction: 'line.focusLines',
                focusedSeries: lines,
                focusKeys: { focusedSeries: lines },
              },
              highlight: {
                sourceAction: 'line.focusLines',
                mode: 'seriesFocus',
                lines,
                dimOpacity,
                lineField: params.lineField || null,
              },
            },
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            lines,
            lineField: params.lineField || null,
            dimOpacity,
          },
          verificationHints: [
            'Call perception.inspectViewConfig to verify the line chart opacity condition now focuses the requested series.',
            'Read the target widget view state to confirm non-focused lines are dimmed.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.highlightTrend')) {
    actionExecutor.register(
      { name: 'line.highlightTrend' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const trendType = typeof params.trendType === 'string' && params.trendType.length > 0
          ? params.trendType
          : 'increasing'
        if (!targetWidget) {
          throw new Error('line.highlightTrend requires a valid line target widget.')
        }
        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget
        const currentSpec = currentWidgetState?.currentSpec || currentWidgetState?.rawSpec || null
        const rootEncoding = inferLineRootEncoding(findRepresentativeLineSpec(currentSpec))
        const xField = rootEncoding?.x?.field || null
        const yField = rootEncoding?.y?.field || null
        if (!xField || !yField) {
          throw new Error('line.highlightTrend requires x and y encodings.')
        }

        return {
          patch: buildLineTrendPatch({
            targetWidget,
            currentState,
            trendType,
            xField,
            yField,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            trendType,
            overlay: 'regression',
            xField,
            yField,
          },
          verificationHints: [
            'Read the target widget state and confirm view.reencode.mode is regressionOverlay.',
            'Read data.analysis.trend to confirm the semantic trend overlay metadata.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.showMovingAverage')) {
    actionExecutor.register(
      { name: 'line.showMovingAverage' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const windowSize = Number.isFinite(params.windowSize) ? Math.floor(Number(params.windowSize)) : 3
        if (!targetWidget || windowSize < 1) {
          throw new Error('line.showMovingAverage requires a valid line target widget and a windowSize >= 1.')
        }
        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget
        const currentSpec = currentWidgetState?.currentSpec || currentWidgetState?.rawSpec || null
        const rootEncoding = inferLineRootEncoding(findRepresentativeLineSpec(currentSpec))
        const xField = rootEncoding?.x?.field || null
        const yField = rootEncoding?.y?.field || null
        const groupBy = rootEncoding?.color?.field || rootEncoding?.detail?.field || null
        if (!xField || !yField) {
          throw new Error('line.showMovingAverage requires x and y encodings.')
        }

        return {
          patch: buildLineMovingAveragePatch({
            targetWidget,
            currentState,
            windowSize,
            xField,
            yField,
            groupBy,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            windowSize,
            overlay: 'movingAverage',
            xField,
            yField,
            ...(groupBy ? { groupBy } : {}),
          },
          verificationHints: [
            'Read the target widget state and confirm view.addRemove.mode is movingAverageOverlay.',
            'Read data.analysis.movingAverage to confirm the semantic moving-average metadata.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.drillDownXAxis')) {
    actionExecutor.register(
      { name: 'line.drillDownXAxis' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const level = typeof params.level === 'string' ? params.level.toLowerCase().trim() : null
        const numericValue = Number.isFinite(params.value) ? Number(params.value) : null
        const parent = params.parent && typeof params.parent === 'object' && !Array.isArray(params.parent)
          ? params.parent
          : {}
        if (!targetWidget || !level || numericValue === null) {
          throw new Error('line.drillDownXAxis requires a line target plus level and numeric value.')
        }
        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget
        const currentSpec = currentWidgetState?.currentSpec || currentWidgetState?.rawSpec || null
        const representativeSpec = findRepresentativeLineSpec(currentSpec)
        const rootEncoding = inferLineRootEncoding(representativeSpec)
        const originalTransforms = Array.isArray(representativeSpec?.transform) ? representativeSpec.transform : []
        const rawTimeField = inferRawTimeField(representativeSpec, rootEncoding, originalTransforms)
        const rawValueField = inferRawValueField(representativeSpec, rootEncoding, originalTransforms)
        if (!rawTimeField || !rawValueField) {
          throw new Error('line.drillDownXAxis requires resolvable temporal and value fields.')
        }

        return {
          patch: buildLineDrillDownPatch({
            targetWidget,
            currentState,
            level,
            value: numericValue,
            parent,
            rawTimeField,
            rawValueField,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            level,
            value: numericValue,
            parent,
            rawTimeField,
            rawValueField,
          },
          verificationHints: [
            'Read the target widget state and confirm view.drillDown describes the finer temporal drill-down.',
            'Read the target widget transforms and confirm a line.drillDownXAxis filter transform was recorded.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.resetDrilldownXAxis')) {
    actionExecutor.register(
      { name: 'line.resetDrilldownXAxis' },
      (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        if (!targetWidget) {
          throw new Error('line.resetDrilldownXAxis requires a valid line target widget.')
        }
        return {
          patch: buildLineResetDrillDownPatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            reset: true,
          },
          verificationHints: [
            'Read the target widget view state and confirm view.drillDown is cleared.',
            'Read the target widget transforms and confirm line.drillDownXAxis is removed.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.resampleXAxis')) {
    actionExecutor.register(
      { name: 'line.resampleXAxis' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const granularity = typeof params.granularity === 'string' ? params.granularity.toLowerCase().trim() : null
        const agg = typeof params.agg === 'string' ? params.agg.toLowerCase().trim() : 'mean'
        const granularityMap = {
          day: 'yearmonthdate',
          week: 'yearweek',
          month: 'yearmonth',
          quarter: 'yearquarter',
          year: 'year',
        }
        const allowedAgg = new Set(['mean', 'sum', 'max', 'min', 'median', 'count'])
        if (!targetWidget || !granularity || !granularityMap[granularity]) {
          throw new Error('line.resampleXAxis requires a line target and a supported granularity: day, week, month, quarter, or year.')
        }
        if (!allowedAgg.has(agg)) {
          throw new Error('line.resampleXAxis requires a supported aggregation: mean, sum, max, min, median, or count.')
        }
        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget
        const currentSpec = currentWidgetState?.currentSpec || currentWidgetState?.rawSpec || null
        const representativeSpec = findRepresentativeLineSpec(currentSpec)
        const rootEncoding = inferLineRootEncoding(representativeSpec)
        const originalTransforms = Array.isArray(representativeSpec?.transform) ? representativeSpec.transform : []
        const rawTimeField = inferRawTimeField(representativeSpec, rootEncoding, originalTransforms)
        const rawValueField = inferRawValueField(representativeSpec, rootEncoding, originalTransforms)
        const groupBy = rootEncoding?.color?.field || rootEncoding?.detail?.field || null
        if (!rawTimeField || !rawValueField) {
          throw new Error('line.resampleXAxis requires resolvable temporal and value fields.')
        }

        return {
          patch: buildLineResamplePatch({
            targetWidget,
            currentState,
            granularity,
            timeUnit: granularityMap[granularity],
            agg,
            rawTimeField,
            rawValueField,
            groupBy,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            granularity,
            agg,
            rawTimeField,
            rawValueField,
            ...(groupBy ? { groupBy } : {}),
          },
          verificationHints: [
            'Read the target widget state and confirm view.reencode.mode is resample.',
            'Read data.analysis.resample to confirm the temporal aggregation metadata.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.resetResampleXAxis')) {
    actionExecutor.register(
      { name: 'line.resetResampleXAxis' },
      (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        if (!targetWidget) {
          throw new Error('line.resetResampleXAxis requires a valid line target widget.')
        }
        return {
          patch: buildLineResetResamplePatch({
            targetWidget,
            currentState: targetWidgetState(targetWidget),
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            reset: true,
          },
          verificationHints: [
            'Read the target widget view state and confirm resample reencoding is cleared.',
            'Read the target widget transforms and confirm line.resampleXAxis is removed.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.boldLines')) {
    actionExecutor.register(
      { name: 'line.boldLines' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const lineNames = Array.isArray(params.lineNames)
          ? params.lineNames.filter((value) => typeof value === 'string' && value.length > 0)
          : []
        const boldWidth = typeof params.boldWidth === 'number' ? params.boldWidth : 4
        const baseWidth = typeof params.baseWidth === 'number' ? params.baseWidth : 1
        if (!targetWidget || lineNames.length === 0) {
          throw new Error('line.boldLines requires a line target and at least one line identifier.')
        }
        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget
        const currentSpec = currentWidgetState?.currentSpec || currentWidgetState?.rawSpec || null
        const rootEncoding = inferLineRootEncoding(findRepresentativeLineSpec(currentSpec))
        const lineField = typeof params.lineField === 'string' && params.lineField.length > 0
          ? params.lineField
          : rootEncoding?.color?.field || rootEncoding?.detail?.field || null
        if (!lineField) {
          throw new Error('line.boldLines requires a lineField or color/detail encoding field.')
        }

        return {
          patch: buildLineBoldPatch({
            targetWidget,
            currentState,
            lineField,
            lineNames,
            boldWidth,
            baseWidth,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            lineNames,
            lineField,
            boldWidth,
            baseWidth,
          },
          verificationHints: [
            'Read the target widget state and confirm view.highlight.mode is seriesEmphasis.',
            'Read the target widget transforms and confirm line.boldLines metadata was recorded.',
          ],
        }
      },
    )
  }

  if (!actionExecutor.has('line.filterLines')) {
    actionExecutor.register(
      { name: 'line.filterLines' },
      async (params, ctx) => {
        const targetWidget = ctx.targetWidget()
        const linesToRemove = Array.isArray(params.linesToRemove)
          ? params.linesToRemove.filter((value) => typeof value === 'string' && value.length > 0)
          : []
        if (!targetWidget || linesToRemove.length === 0) {
          throw new Error('line.filterLines requires a line target and one or more line names to remove.')
        }
        const currentState = targetWidgetState(targetWidget)
        const currentWidgetState = currentState?.widgets?.[targetWidget.ref] || targetWidget
        const currentSpec = currentWidgetState?.currentSpec || currentWidgetState?.rawSpec || null
        const rootEncoding = inferLineRootEncoding(findRepresentativeLineSpec(currentSpec))
        const lineField = typeof params.lineField === 'string' && params.lineField.length > 0
          ? params.lineField
          : rootEncoding?.color?.field || rootEncoding?.detail?.field || null
        if (!lineField) {
          throw new Error('line.filterLines requires a lineField or color/detail encoding field.')
        }
        const rows = ctx.readRows(targetWidget.ref)
        const visibleCount = rows.filter((row) => !linesToRemove.includes(row?.[lineField])).length

        return {
          patch: buildLineFilterPatch({
            targetWidget,
            currentState,
            lineField,
            linesToRemove,
            visibleCount,
          }),
          affectedRefs: [targetWidget.ref],
          result: {
            widgetId: targetWidget.widgetId,
            linesToRemove,
            lineField,
            visibleCount,
          },
          verificationHints: [
            'Read the target widget transforms and confirm line.filterLines is recorded as a semantic filter.',
            'Read the target widget data.visibleCount to confirm the filtered row count.',
          ],
        }
      },
    )
  }
}
