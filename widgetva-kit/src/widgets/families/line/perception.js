import { makePerceptionDescriptor } from '../../../contracts/perception-contracts.js'
import { buildPerceptionDataResult, runDataPerceptionQuery } from '../shared/dataPerception.js'
import {
  appendQueryScopeGuidance,
  buildQueryScopeExample,
  buildScopedPerceptionParamsSchema,
} from '../shared/perceptionScope.js'

function buildLineAnomalyResult({ rows, threshold = 2, yField, xField = null }) {
  const resolvedYField = yField
  const resolvedXField = xField
  if (!resolvedYField) {
    throw new Error('perception.detectAnomalies requires yField.')
  }

  const numericValues = rows
    .map((row) => Number(row?.[resolvedYField]))
    .filter((value) => Number.isFinite(value))

  if (numericValues.length < 3) {
    throw new Error('perception.detectAnomalies requires at least 3 numeric values.')
  }

  const mean = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
  const variance = numericValues.reduce((sum, value) => {
    const delta = value - mean
    return sum + delta * delta
  }, 0) / numericValues.length
  const std = Math.sqrt(variance)

  const anomalies = rows
    .filter((row) => {
      const value = Number(row?.[resolvedYField])
      return Number.isFinite(value) && Math.abs(value - mean) > threshold * std
    })
    .map((row) => ({
      ...(resolvedXField && row?.[resolvedXField] != null ? { [resolvedXField]: row[resolvedXField] } : {}),
      [resolvedYField]: row?.[resolvedYField],
    }))

  return {
    operation: 'detect_anomalies',
    anomaly_count: anomalies.length,
    anomalies: anomalies.slice(0, 10),
    stats: {
      mean: Math.round(mean * 100) / 100,
      std: Math.round(std * 100) / 100,
      threshold,
      sample_size: numericValues.length,
      yField: resolvedYField,
      xField: resolvedXField,
    },
    message: `Detected ${anomalies.length} anomalies (threshold=${threshold} std)`,
  }
}

export function buildLinePerceptionDescriptors({ dataRef }) {
  return [
    makePerceptionDescriptor({
      name: 'perception.detectAnomalies',
      title: 'Detect anomalies',
      description: appendQueryScopeGuidance('Detect likely anomalous points in the visible line data using a standard-deviation threshold on the y metric.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        threshold: { type: 'number', exclusiveMinimum: 0, default: 2 },
        yField: { type: 'string', minLength: 1 },
        xField: { type: 'string', minLength: 1 },
      }, ['yField']),
      sideEffectFree: true,
      evidenceKinds: ['outlierEvidence', 'trendEvidence'],
      examples: [
        {
          userGoal: 'Identify likely anomalous line points without changing the chart encoding.',
          params: { threshold: 2, yField: 'Miles_per_Gallon' },
        },
        buildQueryScopeExample({
          userGoal: 'Detect anomalies inside one selected line subset.',
          params: { threshold: 2, yField: 'Miles_per_Gallon' },
          widgetRef: 'wl://demo/workspace/main/widget/line_a',
          dataRef: 'wl://demo/workspace/main/data/current_selection',
          selectionRef: 'wl://demo/workspace/main/widget/line_a/selection/current',
        }),
      ],
    }),
    makePerceptionDescriptor({
      name: 'perception.findExtremes',
      title: 'Find extremes',
      description: appendQueryScopeGuidance('Return top-k or bottom-k visible rows by a numeric field in the line view.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        field: { type: 'string' },
        direction: { type: 'string', enum: ['min', 'max'], default: 'max' },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 5 },
      }, ['field']),
      sideEffectFree: true,
      evidenceKinds: ['trendEvidence', 'rankEvidence'],
      examples: [
        {
          userGoal: 'Find extrema in the visible line series data.',
          params: { field: 'Miles_per_Gallon', direction: 'max', limit: 5 },
        },
        buildQueryScopeExample({
          userGoal: 'Find extremes inside one selected line subset.',
          params: { field: 'Miles_per_Gallon', direction: 'max', limit: 5 },
          widgetRef: 'wl://demo/workspace/main/widget/line_a',
          dataRef: 'wl://demo/workspace/main/data/current_selection',
          selectionRef: 'wl://demo/workspace/main/widget/line_a/selection/current',
        }),
      ],
    }),
    makePerceptionDescriptor({
      name: 'perception.compareGroups',
      title: 'Compare groups',
      description: appendQueryScopeGuidance('Compare grouped trend values in the visible line data.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        groupField: { type: 'string' },
        valueField: { type: 'string' },
        groups: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 2 },
      }, ['groupField', 'valueField', 'groups']),
      sideEffectFree: true,
      evidenceKinds: ['groupComparison', 'trendEvidence'],
      examples: [
        {
          userGoal: 'Compare the trends or magnitudes of a few line groups.',
          params: { groupField: 'Origin', valueField: 'Miles_per_Gallon', groups: ['Japan', 'USA'] },
        },
        buildQueryScopeExample({
          userGoal: 'Compare grouped line values inside one selected subset.',
          params: { groupField: 'Origin', valueField: 'Miles_per_Gallon', groups: ['Japan', 'USA'] },
          widgetRef: 'wl://demo/workspace/main/widget/line_a',
          dataRef: 'wl://demo/workspace/main/data/current_selection',
          selectionRef: 'wl://demo/workspace/main/widget/line_a/selection/current',
        }),
      ],
    }),
  ]
}

export function registerLinePerceptionQueries(perceptionRegistry) {
  if (!perceptionRegistry.has('perception.detectAnomalies', { supportedWidgetKinds: ['line'] })) {
    perceptionRegistry.register(
      { name: 'perception.detectAnomalies', supportedWidgetKinds: ['line'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'line' })
        const params = ctx.readCallParams()
        const { rows } = ctx.resolveRowsForWidget(targetWidget, params)
        const result = buildLineAnomalyResult({
          rows,
          threshold: Number.isFinite(params?.threshold) ? Number(params.threshold) : 2,
          yField: params?.yField || null,
          xField: params?.xField || null,
        })
        ctx.recordQuery({ affectedRefs: [targetWidget.ref] })
        return { result }
      },
      { supportedWidgetKinds: ['line'] },
    )
  }

  if (!perceptionRegistry.has('perception.findExtremes', { supportedWidgetKinds: ['line'] })) {
    perceptionRegistry.register(
      { name: 'perception.findExtremes', supportedWidgetKinds: ['line'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'line' })
        const params = ctx.readCallParams()
        const extremes = runDataPerceptionQuery({
          ctx,
          dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
          targetWidget,
          kind: 'findExtremes',
          spec: params,
        })
        ctx.recordQuery({ affectedRefs: [targetWidget.ref] })
        return {
          result: buildPerceptionDataResult({
            dataQueryResult: extremes,
            fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef,
          }),
        }
      },
      { supportedWidgetKinds: ['line'] },
    )
  }

  if (!perceptionRegistry.has('perception.compareGroups', { supportedWidgetKinds: ['line'] })) {
    perceptionRegistry.register(
      { name: 'perception.compareGroups', supportedWidgetKinds: ['line'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'line' })
        const params = ctx.readCallParams()
        const comparison = runDataPerceptionQuery({
          ctx,
          dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
          targetWidget,
          kind: 'compareGroups',
          spec: params,
        })
        ctx.recordQuery({ affectedRefs: [targetWidget.ref] })
        return {
          result: buildPerceptionDataResult({
            dataQueryResult: comparison,
            fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef,
          }),
        }
      },
      { supportedWidgetKinds: ['line'] },
    )
  }
}
