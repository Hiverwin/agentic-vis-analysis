import { ensureObjectSpec } from '../specModel.js'
import { updateRepresentativeSpec } from '../specTree.js'
import {
  replaceAggregateTransforms,
  replaceFilterTransformForField,
} from '../specMutators.js'

function hasEncoding(spec) {
  return spec?.encoding && typeof spec.encoding === 'object' && !Array.isArray(spec.encoding)
}

function markHighlightedRows(rows, field, values) {
  const highlightedValues = new Set(Array.isArray(values) ? values : [])
  const safeRows = Array.isArray(rows) ? rows : []
  return safeRows.map((row) => ({
    ...row,
    __widgetva_highlight: highlightedValues.has(row?.[field]),
  }))
}

export function executeVegaLiteChangeEncoding(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for encoding updates.')
  const channel = typeof params.channel === 'string' ? params.channel : null
  const field = typeof params.field === 'string' ? params.field : null
  if (!channel || !field) throw new Error('widget.changeEncoding requires a channel and field.')
  return updateRepresentativeSpec(
    spec,
    hasEncoding,
    (viewSpec) => ({
      ...viewSpec,
      encoding: {
        ...(viewSpec.encoding || {}),
        [channel]: {
          ...(viewSpec.encoding?.[channel] || {}),
          field,
          ...(typeof params.type === 'string' ? { type: params.type } : {}),
          ...(params.aggregate ? { aggregate: params.aggregate } : {}),
        },
      },
    }),
    'No representative encoded subview could be found for widget.changeEncoding.',
  )
}

export function executeVegaLiteZoomDomain(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for domain updates.')
  const normalizeDomain = (domain, channel) => {
    if (!Array.isArray(domain) || domain.length < 2) return null
    if (domain[0] == null && domain[1] == null) return null
    const field = spec?.encoding?.[channel]?.field
    const existingDomain = Array.isArray(spec?.encoding?.[channel]?.scale?.domain)
      ? spec.encoding[channel].scale.domain
      : null
    const values = Array.isArray(spec?.data?.values) && typeof field === 'string'
      ? spec.data.values
          .map((row) => row?.[field])
          .filter((value) => typeof value === 'number' && Number.isFinite(value))
      : []
    const extent = values.length > 0 ? [Math.min(...values), Math.max(...values)] : null
    const lower = domain[0] == null ? existingDomain?.[0] ?? extent?.[0] : domain[0]
    const upper = domain[1] == null ? existingDomain?.[1] ?? extent?.[1] : domain[1]
    if (lower == null || upper == null) return null
    if (typeof lower === 'number' && typeof upper === 'number' && (!Number.isFinite(lower) || !Number.isFinite(upper))) {
      return null
    }
    if (lower === upper) return null
    return [lower, upper]
  }
  const xDomain = normalizeDomain(params.xDomain, 'x')
  const yDomain = normalizeDomain(params.yDomain, 'y')
  if (!xDomain && !yDomain) throw new Error('widget.zoomDomain requires at least one domain.')
  const nextEncoding = { ...(spec.encoding || {}) }
  if (xDomain && nextEncoding.x) {
    nextEncoding.x = {
      ...nextEncoding.x,
      scale: { ...(nextEncoding.x.scale || {}), domain: xDomain },
    }
  }
  if (yDomain && nextEncoding.y) {
    nextEncoding.y = {
      ...nextEncoding.y,
      scale: { ...(nextEncoding.y.scale || {}), domain: yDomain },
    }
  }
  const nextMark = typeof spec.mark === 'string'
    ? { type: spec.mark, clip: true }
    : spec.mark && typeof spec.mark === 'object'
      ? { ...spec.mark, clip: true }
      : spec.mark
  return { ...spec, ...(nextMark ? { mark: nextMark } : {}), encoding: nextEncoding }
}

export function executeVegaLiteFilterByValues(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for filter updates.')
  const field = typeof params.field === 'string' ? params.field : null
  const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : []
  if (!field || values.length === 0) throw new Error('widget.filterByValues requires a field and values.')
  return {
    ...spec,
    transform: replaceFilterTransformForField(spec.transform, field, {
      filter: { field, oneOf: values },
    }),
  }
}

export function executeVegaLiteFilterByRange(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for filter updates.')
  const field = typeof params.field === 'string' ? params.field : null
  const range = Array.isArray(params.range) ? params.range : null
  if (!field || !range || range.length !== 2) throw new Error('widget.filterByRange requires a field and two-value range.')
  return {
    ...spec,
    transform: replaceFilterTransformForField(spec.transform, field, {
      filter: { field, range },
    }),
  }
}

export function executeVegaLiteAggregateData(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for aggregate updates.')
  const groupBy = Array.isArray(params.groupBy)
    ? params.groupBy.filter((field) => typeof field === 'string' && field.trim())
    : []
  const measures = Array.isArray(params.measures)
    ? params.measures
        .map((measure) => ({
          op: typeof measure?.op === 'string' ? measure.op : null,
          field: typeof measure?.field === 'string' ? measure.field : undefined,
          as: typeof measure?.as === 'string' ? measure.as : null,
        }))
        .filter((measure) => measure.op && measure.as)
    : []
  if (groupBy.length === 0 || measures.length === 0) {
    throw new Error('widget.aggregateData requires non-empty groupBy and measures.')
  }
  return {
    ...spec,
    transform: replaceAggregateTransforms(spec.transform, {
      aggregate: measures.map((measure) => ({
        op: measure.op,
        ...(measure.field ? { field: measure.field } : {}),
        as: measure.as,
      })),
      groupby: groupBy,
    }),
  }
}

export function executeVegaLiteSortEncoding(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for sort updates.')
  const channel = typeof params.channel === 'string' ? params.channel : null
  const order = typeof params.order === 'string' ? params.order : null
  const field = typeof params.field === 'string' ? params.field : null
  const aggregate = typeof params.aggregate === 'string' ? params.aggregate : null
  if (!channel || !order) throw new Error('widget.sortEncoding requires channel and order.')
  const currentChannel = spec.encoding?.[channel]
  if (!currentChannel || typeof currentChannel !== 'object') {
    throw new Error(`The active spec does not define encoding channel "${channel}".`)
  }
  const sortField = field || currentChannel.field
  return {
    ...spec,
    encoding: {
      ...(spec.encoding || {}),
      [channel]: {
        ...currentChannel,
        sort: sortField
          ? { field: sortField, order, ...(aggregate ? { op: aggregate } : {}) }
          : order,
      },
    },
  }
}

export function executeVegaLiteHighlightValues(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for highlight updates.')
  const field = typeof params.field === 'string' ? params.field : null
  const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : []
  if (!field || values.length === 0) {
    throw new Error('widget.highlightValues requires a field and values.')
  }
  if (!Array.isArray(spec?.data?.values)) return spec
  return {
    ...spec,
    data: {
      ...(spec.data || {}),
      values: markHighlightedRows(spec.data.values, field, values),
    },
  }
}
