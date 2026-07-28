import {
  updateRepresentativeSpec,
} from '../specTree.js'
import { ensureObjectSpec, readMarkType } from '../specModel.js'
import {
  replaceFilterTransformForField,
  replaceTaggedLayer,
  replaceTaggedTransform,
} from '../specMutators.js'
import { datumRef, expressionEqualsAny, expressionNotEqualsAny, valueList } from './specActionShared.js'

function isLineFamilySpec(spec) {
  const markType = readMarkType(spec?.mark)
  return (markType === 'line' || markType === 'area')
    && spec?.encoding
    && typeof spec.encoding === 'object'
    && !Array.isArray(spec.encoding)
}

function updateLine(spec, updater) {
  return updateRepresentativeSpec(
    spec,
    isLineFamilySpec,
    updater,
    'No representative line subview could be found in the active spec.',
  )
}

function inferLineRootEncoding(spec) {
  return spec?.layer?.[0]?.encoding || spec?.encoding || {}
}

function inferRawTimeField(spec, rootEncoding, originalTransforms) {
  const taggedTimeUnit = (Array.isArray(originalTransforms) ? originalTransforms : []).find(
    (transform) => transform && typeof transform === 'object' && 'timeUnit' in transform && typeof transform.field === 'string',
  )
  if (taggedTimeUnit?.field) return taggedTimeUnit.field
  const xField = rootEncoding?.x?.field
  if (typeof xField !== 'string' || xField.length === 0) return null
  if (!xField.includes('_')) return xField
  const candidate = xField.split('_').at(-1)
  const rows = spec?.data?.values
  if (Array.isArray(rows) && rows.length > 0 && candidate && Object.prototype.hasOwnProperty.call(rows[0], candidate)) {
    return candidate
  }
  return xField
}

function inferRawValueField(_spec, rootEncoding, originalTransforms) {
  const aggregateTransform = (Array.isArray(originalTransforms) ? originalTransforms : []).find(
    (transform) => transform && typeof transform === 'object' && Array.isArray(transform.aggregate) && transform.aggregate.length > 0,
  )
  if (aggregateTransform?.aggregate?.[0]?.field) return aggregateTransform.aggregate[0].field
  const yField = rootEncoding?.y?.field
  if (typeof yField !== 'string' || yField.length === 0) return null
  if (yField.startsWith('total_')) return yField.slice('total_'.length)
  if (yField.startsWith('sum_')) return yField.slice('sum_'.length)
  return yField
}

const MONTH_MAP = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
}

function normalizeTimeUnitValues(field, values, timeUnit) {
  const safeValues = Array.isArray(values) ? values.filter((value) => value != null) : []
  if (!timeUnit) return { valueListExpr: valueList(safeValues), datumExpr: datumRef(field) }
  const normalizedTimeUnit = String(timeUnit).toLowerCase().trim()
  if (normalizedTimeUnit === 'date') {
    const numericValues = safeValues.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite)
    return { valueListExpr: valueList(numericValues.length > 0 ? numericValues : safeValues), datumExpr: `date(${datumRef(field)})` }
  }
  if (normalizedTimeUnit === 'month') {
    const monthValues = safeValues.map((value) => {
      if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(MONTH_MAP, value)) return MONTH_MAP[value]
      const parsed = Number.parseInt(value, 10)
      return Number.isFinite(parsed) ? parsed - 1 : null
    }).filter(Number.isFinite)
    return { valueListExpr: valueList(monthValues.length > 0 ? monthValues : safeValues), datumExpr: `month(${datumRef(field)})` }
  }
  if (normalizedTimeUnit === 'year') {
    const numericValues = safeValues.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite)
    return { valueListExpr: valueList(numericValues.length > 0 ? numericValues : safeValues), datumExpr: `year(${datumRef(field)})` }
  }
  return { valueListExpr: valueList(safeValues), datumExpr: `${normalizedTimeUnit}(${datumRef(field)})` }
}

export function executeVegaLiteLineZoomXRegion(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for line x-domain updates.')
  const start = params.start ?? params.xMin ?? params.min
  const end = params.end ?? params.xMax ?? params.max
  if (start == null || end == null) throw new Error('line.zoomXRegion requires start and end.')
  return updateLine(spec, (lineSpec) => ({
    ...lineSpec,
    mark: typeof lineSpec.mark === 'string'
      ? { type: lineSpec.mark, clip: true }
      : { ...(lineSpec.mark || { type: 'line' }), clip: true },
    encoding: {
      ...(lineSpec.encoding || {}),
      x: {
        ...(lineSpec.encoding?.x || {}),
        scale: { ...(lineSpec.encoding?.x?.scale || {}), domain: [start, end] },
      },
    },
    _line_zoom_state: { start, end },
  }))
}

export function executeVegaLiteLineFocusLines(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for line focus updates.')
  const lines = Array.isArray(params.lines) ? params.lines.filter((line) => line != null) : []
  if (lines.length === 0) throw new Error('line.focusLines requires lines.')
  return updateLine(spec, (lineSpec) => {
    const lineField = params.lineField || lineSpec.encoding?.color?.field || lineSpec.encoding?.detail?.field
    if (!lineField) throw new Error('line.focusLines requires a lineField.')
    return {
      ...lineSpec,
      encoding: {
        ...(lineSpec.encoding || {}),
        opacity: {
          condition: { test: expressionEqualsAny(lineField, lines), value: 1 },
          value: Number.isFinite(params.dimOpacity) ? params.dimOpacity : 0.12,
        },
      },
      _line_focus_state: { lineField, lines },
    }
  })
}

export function executeVegaLiteLineHighlightTrend(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for line trend updates.')
  return updateLine(spec, (lineSpec) => {
    const encoding = inferLineRootEncoding(lineSpec)
    const trendLayer = {
      _widgetvaTag: 'line.highlightTrend',
      mark: { type: 'line', color: '#d62728', strokeDash: [4, 3], strokeWidth: 2 },
      transform: [{ regression: encoding?.y?.field, on: encoding?.x?.field, method: params.method || 'linear' }],
      encoding: { x: { ...encoding.x }, y: { ...encoding.y } },
    }
    return {
      ...lineSpec,
      layer: replaceTaggedLayer(Array.isArray(lineSpec.layer) ? lineSpec.layer : [{ mark: lineSpec.mark || 'line', encoding }], 'line.highlightTrend', trendLayer),
      _line_trend_state: { trendType: params.trendType || params.method || 'linear' },
    }
  })
}

export function executeVegaLiteLineShowMovingAverage(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for line moving average updates.')
  return updateLine(spec, (lineSpec) => {
    const encoding = inferLineRootEncoding(lineSpec)
    const xField = encoding?.x?.field
    const yField = encoding?.y?.field
    if (!xField || !yField) throw new Error('line.showMovingAverage requires x and y encodings.')
    const windowSize = Number.isFinite(params.windowSize) ? Math.max(1, Math.floor(params.windowSize)) : 3
    const movingAverageLayer = {
      _widgetvaTag: 'line.showMovingAverage',
      mark: { type: 'line', color: '#ff7f0e', strokeWidth: 2 },
      transform: [{
        window: [{ op: 'mean', field: yField, as: '__widgetva_moving_average' }],
        frame: [1 - windowSize, 0],
        sort: [{ field: xField }],
        ...(encoding?.color?.field ? { groupby: [encoding.color.field] } : {}),
      }],
      encoding: {
        x: { ...encoding.x },
        y: { ...encoding.y, field: '__widgetva_moving_average' },
        ...(encoding?.color ? { color: { ...encoding.color } } : {}),
      },
    }
    return {
      ...lineSpec,
      layer: replaceTaggedLayer(Array.isArray(lineSpec.layer) ? lineSpec.layer : [{ mark: lineSpec.mark || 'line', encoding }], 'line.showMovingAverage', movingAverageLayer),
      _line_moving_average_state: { sourceAction: 'line.showMovingAverage', windowSize },
    }
  })
}

export function executeVegaLiteLineDrilldown(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for line drill-down updates.')
  return updateLine(spec, (lineSpec) => {
    const encoding = inferLineRootEncoding(lineSpec)
    const transforms = Array.isArray(lineSpec.transform) ? lineSpec.transform : []
    const rawTimeField = inferRawTimeField(lineSpec, encoding, transforms)
    const rawValueField = inferRawValueField(lineSpec, encoding, transforms)
    const level = typeof params.level === 'string' ? params.level : 'year'
    const value = params.value
    if (!rawTimeField || !rawValueField || value == null) throw new Error('line.drillDownXAxis requires level, value, and temporal/value fields.')
    const { valueListExpr, datumExpr } = normalizeTimeUnitValues(rawTimeField, [value], level)
    return {
      ...lineSpec,
      transform: replaceTaggedTransform(transforms, 'line.drillDownXAxis', {
        filter: `indexof([${valueListExpr}], ${datumExpr}) >= 0`,
        _widgetvaTag: 'line.drillDownXAxis',
      }),
      _line_drilldown_state: { sourceAction: 'line.drillDownXAxis', level, value, rawTimeField, rawValueField },
    }
  })
}

export function executeVegaLiteLineResetDrilldown(spec) {
  ensureObjectSpec(spec, 'No active base spec is available for resetting line drill-down.')
  return updateLine(spec, (lineSpec) => {
    const { _line_drilldown_state: _removed, ...rest } = lineSpec
    return {
      ...rest,
      transform: replaceTaggedTransform(lineSpec.transform, 'line.drillDownXAxis', null),
    }
  })
}

export function executeVegaLiteLineResample(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for line resampling.')
  const granularity = typeof params.granularity === 'string' ? params.granularity : 'month'
  const aggregate = typeof params.agg === 'string' ? params.agg : 'mean'
  return updateLine(spec, (lineSpec) => {
    const encoding = inferLineRootEncoding(lineSpec)
    const transforms = Array.isArray(lineSpec.transform) ? lineSpec.transform : []
    const rawTimeField = inferRawTimeField(lineSpec, encoding, transforms)
    const rawValueField = inferRawValueField(lineSpec, encoding, transforms)
    if (!rawTimeField || !rawValueField) throw new Error('line.resampleXAxis requires temporal/value fields.')
    const timeAs = `${granularity}_${rawTimeField}`
    const valueAs = `${aggregate}_${rawValueField}`
    return {
      ...lineSpec,
      transform: replaceTaggedTransform(transforms, 'line.resampleXAxis', {
        timeUnit: granularity,
        field: rawTimeField,
        as: timeAs,
        _widgetvaTag: 'line.resampleXAxis',
      }).concat({
        aggregate: [{ op: aggregate, field: rawValueField, as: valueAs }],
        groupby: [timeAs, ...(encoding?.color?.field ? [encoding.color.field] : [])],
        _widgetvaTag: 'line.resampleXAxis.aggregate',
      }),
      encoding: {
        ...(lineSpec.encoding || {}),
        x: { ...(encoding.x || {}), field: timeAs, timeUnit: undefined },
        y: { ...(encoding.y || {}), field: valueAs, aggregate: undefined },
      },
      _line_resample_state: { sourceAction: 'line.resampleXAxis', granularity, aggregate, rawTimeField, rawValueField },
    }
  })
}

export function executeVegaLiteLineResetResample(spec) {
  ensureObjectSpec(spec, 'No active base spec is available for resetting line resample.')
  return updateLine(spec, (lineSpec) => {
    const { _line_resample_state: _removed, ...rest } = lineSpec
    return {
      ...rest,
      transform: (Array.isArray(lineSpec.transform) ? lineSpec.transform : [])
        .filter((transform) => !String(transform?._widgetvaTag || '').startsWith('line.resampleXAxis')),
    }
  })
}

export function executeVegaLiteLineBoldLines(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for line bolding.')
  return updateLine(spec, (lineSpec) => {
    const lineField = params.lineField || lineSpec.encoding?.color?.field || lineSpec.encoding?.detail?.field
    const lineNames = Array.isArray(params.lineNames) ? params.lineNames.filter((name) => name != null) : []
    if (!lineField || lineNames.length === 0) throw new Error('line.boldLines requires lineNames and lineField.')
    return {
      ...lineSpec,
      encoding: {
        ...(lineSpec.encoding || {}),
        strokeWidth: {
          condition: { test: expressionEqualsAny(lineField, lineNames), value: params.boldWidth || 4 },
          value: params.baseWidth || 1,
        },
      },
      _line_bold_state: { lineField, lineNames },
    }
  })
}

export function executeVegaLiteLineFilterLines(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for line filtering.')
  return updateLine(spec, (lineSpec) => {
    const lineField = params.lineField || lineSpec.encoding?.color?.field || lineSpec.encoding?.detail?.field
    const linesToRemove = Array.isArray(params.linesToRemove) ? params.linesToRemove.filter((line) => line != null) : []
    if (!lineField || linesToRemove.length === 0) throw new Error('line.filterLines requires linesToRemove and lineField.')
    return {
      ...lineSpec,
      transform: replaceFilterTransformForField(lineSpec.transform, lineField, {
        filter: expressionNotEqualsAny(lineField, linesToRemove),
        _widgetvaTag: 'line.filterLines',
      }),
      _line_filter_state: { lineField, linesToRemove },
    }
  })
}
