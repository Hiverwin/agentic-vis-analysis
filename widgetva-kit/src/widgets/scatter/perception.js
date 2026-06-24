import { makePerceptionDescriptor } from '../../core/protocol/perception.js'
import { buildPerceptionDataResult, runDataPerceptionQuery } from '../../adapters/widgets/shared/dataPerception.js'
import {
  appendQueryScopeGuidance,
  buildQueryScopeExample,
  buildScopedPerceptionParamsSchema,
} from '../../adapters/widgets/shared/perceptionScope.js'

export function buildScatterPerceptionDescriptors({ dataRef }) {
  return [
    makePerceptionDescriptor({
      name: 'perception.computeCorrelation',
      title: 'Compute correlation',
      description: appendQueryScopeGuidance('Compute a correlation coefficient over the visible rows of the target scatter widget.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        xField: { type: 'string' },
        yField: { type: 'string' },
      }),
      sideEffectFree: true,
      evidenceKinds: ['statisticalEvidence', 'correlationEvidence'],
      examples: [
        {
          userGoal: 'Estimate the relationship between two numeric fields in the scatterplot.',
          params: { xField: 'Horsepower', yField: 'Miles_per_Gallon' },
        },
        buildQueryScopeExample({
          userGoal: 'Estimate the correlation inside one brushed scatter subset.',
          params: { xField: 'Horsepower', yField: 'Miles_per_Gallon' },
          widgetRef: 'wl://demo/workspace/main/widget/scatter_a',
          dataRef: 'wl://demo/workspace/main/data/current_selection',
          selectionRef: 'wl://demo/workspace/main/widget/scatter_a/selection/brush',
        }),
      ],
    }),
    makePerceptionDescriptor({
      name: 'perception.findOutliers',
      title: 'Find outliers',
      description: appendQueryScopeGuidance('Return likely outlier rows in the visible scatter data by numeric fields.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        field: { type: 'string' },
        xField: { type: 'string' },
        yField: { type: 'string' },
        zThreshold: { type: 'number' },
        limit: { type: 'number' },
      }),
      sideEffectFree: true,
      evidenceKinds: ['outlierEvidence', 'rowEvidence'],
      examples: [
        {
          userGoal: 'Identify candidate outliers in the visible scatter subset.',
          params: { xField: 'Horsepower', yField: 'Miles_per_Gallon', limit: 5 },
        },
        buildQueryScopeExample({
          userGoal: 'Identify outliers inside one brushed scatter subset.',
          params: { xField: 'Horsepower', yField: 'Miles_per_Gallon', limit: 5 },
          widgetRef: 'wl://demo/workspace/main/widget/scatter_a',
          dataRef: 'wl://demo/workspace/main/data/current_selection',
          selectionRef: 'wl://demo/workspace/main/widget/scatter_a/selection/brush',
        }),
      ],
    }),
    makePerceptionDescriptor({
      name: 'perception.findExtremes',
      title: 'Find extremes',
      description: appendQueryScopeGuidance('Return top-k or bottom-k visible rows by a numeric field.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        field: { type: 'string' },
        direction: { type: 'string' },
        limit: { type: 'number' },
      }),
      sideEffectFree: true,
      evidenceKinds: ['rankEvidence', 'rowEvidence'],
      examples: [
        {
          userGoal: 'Retrieve the highest or lowest visible rows by a metric.',
          params: { field: 'Horsepower', direction: 'max', limit: 5 },
        },
        buildQueryScopeExample({
          userGoal: 'Retrieve extremes inside one brushed scatter subset.',
          params: { field: 'Horsepower', direction: 'max', limit: 5 },
          widgetRef: 'wl://demo/workspace/main/widget/scatter_a',
          dataRef: 'wl://demo/workspace/main/data/current_selection',
          selectionRef: 'wl://demo/workspace/main/widget/scatter_a/selection/brush',
        }),
      ],
    }),
  ]
}

export function registerScatterPerceptionQueries(perceptionRegistry) {
  if (!perceptionRegistry.has('perception.computeCorrelation', { supportedWidgetKinds: ['scatter'] })) {
    perceptionRegistry.register(
      { name: 'perception.computeCorrelation', supportedWidgetKinds: ['scatter'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'scatter' })
        const params = ctx.readCallParams()
        const correlation = runDataPerceptionQuery({
          ctx,
          dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
          targetWidget,
          kind: 'computeCorrelation',
          spec: params,
        })
        ctx.recordQuery({ affectedRefs: [targetWidget.ref] })
        return {
          result: buildPerceptionDataResult({
            dataQueryResult: correlation,
            fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef,
          }),
        }
      },
      { supportedWidgetKinds: ['scatter'] },
    )
  }

  if (!perceptionRegistry.has('perception.findOutliers', { supportedWidgetKinds: ['scatter'] })) {
    perceptionRegistry.register(
      { name: 'perception.findOutliers', supportedWidgetKinds: ['scatter'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'scatter' })
        const params = ctx.readCallParams()
        const outliers = runDataPerceptionQuery({
          ctx,
          dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
          targetWidget,
          kind: 'findOutliers',
          spec: params,
        })
        ctx.recordQuery({ affectedRefs: [targetWidget.ref] })
        return {
          result: buildPerceptionDataResult({
            dataQueryResult: outliers,
            fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef,
          }),
        }
      },
      { supportedWidgetKinds: ['scatter'] },
    )
  }

  if (!perceptionRegistry.has('perception.findExtremes', { supportedWidgetKinds: ['scatter'] })) {
    perceptionRegistry.register(
      { name: 'perception.findExtremes', supportedWidgetKinds: ['scatter'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'scatter' })
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
      { supportedWidgetKinds: ['scatter'] },
    )
  }
}
