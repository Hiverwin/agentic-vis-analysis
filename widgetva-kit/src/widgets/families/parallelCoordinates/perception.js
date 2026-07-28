import { makePerceptionDescriptor } from '../../../contracts/perception-contracts.js'
import { buildPerceptionDataResult, runDataPerceptionQuery } from '../shared/dataPerception.js'
import {
  appendQueryScopeGuidance,
  buildQueryScopeExample,
  buildScopedPerceptionParamsSchema,
} from '../shared/perceptionScope.js'

export function buildParallelCoordinatesPerceptionDescriptors({ dataRef }) {
  return [
    makePerceptionDescriptor({
      name: 'perception.findOutliers',
      title: 'Find outliers',
      description: appendQueryScopeGuidance('Return likely outlier rows in the visible parallel coordinates data.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        field: { type: 'string', minLength: 1 },
        zThreshold: { type: 'number', exclusiveMinimum: 0, default: 2 },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 10 },
      }, ['field']),
      sideEffectFree: true,
      evidenceKinds: ['outlierEvidence', 'multivariateEvidence'],
      examples: [
        {
          userGoal: 'Find multivariate outliers in the visible parallel coordinates subset.',
          params: { field: 'Horsepower', zThreshold: 2.5, limit: 10 },
        },
        buildQueryScopeExample({
          userGoal: 'Find multivariate outliers inside one brushed parallel-coordinates subset.',
          params: { field: 'Horsepower', zThreshold: 2.5, limit: 10 },
          widgetRef: 'wl://demo/workspace/main/widget/parallel_a',
          dataRef: 'wl://demo/workspace/main/data/current_selection',
          selectionRef: 'wl://demo/workspace/main/widget/parallel_a/selection/brush',
        }),
      ],
    }),
  ]
}

export function registerParallelCoordinatesPerceptionQueries(perceptionRegistry) {
  if (!perceptionRegistry.has('perception.findOutliers', { supportedWidgetKinds: ['parallelCoordinates'] })) {
    perceptionRegistry.register(
      { name: 'perception.findOutliers', supportedWidgetKinds: ['parallelCoordinates'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'parallelCoordinates' })
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
      { supportedWidgetKinds: ['parallelCoordinates'] },
    )
  }
}
