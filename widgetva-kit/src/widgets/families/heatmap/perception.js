import { makePerceptionDescriptor } from '../../../contracts/perception-contracts.js'
import { buildPerceptionDataResult, runDataPerceptionQuery } from '../shared/dataPerception.js'
import {
  appendQueryScopeGuidance,
  buildQueryScopeExample,
  buildScopedPerceptionParamsSchema,
} from '../shared/perceptionScope.js'

export function buildHeatmapPerceptionDescriptors({ dataRef }) {
  return [
    makePerceptionDescriptor({
      name: 'perception.findExtremes',
      title: 'Find extremes',
      description: appendQueryScopeGuidance('Return highest or lowest valued cells in the visible heatmap data.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        field: { type: 'string', minLength: 1 },
        direction: { type: 'string', enum: ['min', 'max'], default: 'max' },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 5 },
      }, ['field']),
      sideEffectFree: true,
      evidenceKinds: ['matrixEvidence', 'rankEvidence'],
      examples: [
        {
          userGoal: 'Find the highest or lowest cells in the matrix view.',
          params: { field: 'value', direction: 'max', limit: 5 },
        },
        buildQueryScopeExample({
          userGoal: 'Find extreme cells inside one selected heatmap region.',
          params: { field: 'value', direction: 'max', limit: 5 },
          widgetRef: 'wl://demo/workspace/main/widget/heatmap_a',
          dataRef: 'wl://demo/workspace/main/data/current_selection',
          selectionRef: 'wl://demo/workspace/main/widget/heatmap_a/selection/region',
        }),
      ],
    }),
    makePerceptionDescriptor({
      name: 'perception.findOutliers',
      title: 'Find outliers',
      description: appendQueryScopeGuidance('Return likely outlier cells in the visible heatmap data.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        field: { type: 'string', minLength: 1 },
        zThreshold: { type: 'number', exclusiveMinimum: 0, default: 2 },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 10 },
      }, ['field']),
      sideEffectFree: true,
      evidenceKinds: ['outlierEvidence', 'matrixEvidence'],
      examples: [
        {
          userGoal: 'Identify suspicious cells in the current heatmap view.',
          params: { field: 'value', zThreshold: 2.5, limit: 10 },
        },
        buildQueryScopeExample({
          userGoal: 'Identify outlier cells inside one selected heatmap region.',
          params: { field: 'value', zThreshold: 2.5, limit: 10 },
          widgetRef: 'wl://demo/workspace/main/widget/heatmap_a',
          dataRef: 'wl://demo/workspace/main/data/current_selection',
          selectionRef: 'wl://demo/workspace/main/widget/heatmap_a/selection/region',
        }),
      ],
    }),
  ]
}

export function registerHeatmapPerceptionQueries(perceptionRegistry) {
  if (!perceptionRegistry.has('perception.findExtremes', { supportedWidgetKinds: ['heatmap'] })) {
    perceptionRegistry.register(
      { name: 'perception.findExtremes', supportedWidgetKinds: ['heatmap'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'heatmap' })
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
      { supportedWidgetKinds: ['heatmap'] },
    )
  }

  if (!perceptionRegistry.has('perception.findOutliers', { supportedWidgetKinds: ['heatmap'] })) {
    perceptionRegistry.register(
      { name: 'perception.findOutliers', supportedWidgetKinds: ['heatmap'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'heatmap' })
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
      { supportedWidgetKinds: ['heatmap'] },
    )
  }
}
