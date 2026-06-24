import { makePerceptionDescriptor } from '../../core/protocol/perception.js'
import { buildPerceptionDataResult, runDataPerceptionQuery } from '../../adapters/widgets/shared/dataPerception.js'
import {
  appendQueryScopeGuidance,
  buildQueryScopeExample,
  buildScopedPerceptionParamsSchema,
} from '../../adapters/widgets/shared/perceptionScope.js'

export function buildBarPerceptionDescriptors({ dataRef }) {
  return [
    makePerceptionDescriptor({
      name: 'perception.compareGroups',
      title: 'Compare groups',
      description: appendQueryScopeGuidance('Compare summary statistics for specified groups in the visible bar data.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        groupField: { type: 'string' },
        valueField: { type: 'string' },
        groups: { type: 'array', items: { type: 'string' } },
      }),
      sideEffectFree: true,
      evidenceKinds: ['groupComparison', 'aggregateEvidence'],
      examples: [
        {
          userGoal: 'Compare a few selected groups in the summary bars.',
          params: { groupField: 'Origin', valueField: 'count', groups: ['Japan', 'USA'] },
        },
        buildQueryScopeExample({
          userGoal: 'Compare grouped bar summaries inside one filtered selection.',
          params: { groupField: 'Origin', valueField: 'count', groups: ['Japan', 'USA'] },
          widgetRef: 'wl://demo/workspace/main/widget/bar_a',
          dataRef: 'wl://demo/workspace/main/data/current_selection',
          selectionRef: 'wl://demo/workspace/main/widget/bar_a/selection/current',
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
      evidenceKinds: ['rankEvidence', 'aggregateEvidence'],
      examples: [
        {
          userGoal: 'Find the highest or lowest categories in the current summary view.',
          params: { field: 'count', direction: 'max', limit: 5 },
        },
        buildQueryScopeExample({
          userGoal: 'Find the highest bars inside one filtered bar subset.',
          params: { field: 'count', direction: 'max', limit: 5 },
          widgetRef: 'wl://demo/workspace/main/widget/bar_a',
          dataRef: 'wl://demo/workspace/main/data/current_selection',
          selectionRef: 'wl://demo/workspace/main/widget/bar_a/selection/current',
        }),
      ],
    }),
  ]
}

export function registerBarPerceptionQueries(perceptionRegistry) {
  if (!perceptionRegistry.has('perception.compareGroups', { supportedWidgetKinds: ['bar'] })) {
    perceptionRegistry.register(
      { name: 'perception.compareGroups', supportedWidgetKinds: ['bar'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'bar' })
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
      { supportedWidgetKinds: ['bar'] },
    )
  }

  if (!perceptionRegistry.has('perception.findExtremes', { supportedWidgetKinds: ['bar'] })) {
    perceptionRegistry.register(
      { name: 'perception.findExtremes', supportedWidgetKinds: ['bar'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({ kind: 'bar' })
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
      { supportedWidgetKinds: ['bar'] },
    )
  }
}
