import { ensureObjectSpec } from '../specModel.js'
import { updateRepresentativeSpec } from '../specTree.js'
import {
  replaceAggregateTransforms,
} from '../specMutators.js'

function hasEncoding(spec) {
  return spec?.encoding && typeof spec.encoding === 'object' && !Array.isArray(spec.encoding)
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
