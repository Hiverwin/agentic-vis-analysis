import { makePerceptionDescriptor } from '../../../contracts/perception-contracts.js'
import { buildPerceptionDataResult, runDataPerceptionQuery } from '../shared/dataPerception.js'
import {
  appendQueryScopeGuidance,
  buildQueryScopeExample,
  buildScopedPerceptionParamsSchema,
} from '../shared/perceptionScope.js'

export function buildBarPerceptionDescriptors({ dataRef }) {
  return [
    makePerceptionDescriptor({
      name: 'perception.compareGroups',
      title: 'Compare groups',
      description: appendQueryScopeGuidance('Compare summary statistics for specified groups in the visible bar data.'),
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: buildScopedPerceptionParamsSchema({
        groupField: { type: 'string', minLength: 1 },
        valueField: { type: 'string', minLength: 1 },
        groups: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 2 },
      }, ['groupField', 'valueField', 'groups']),
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

}
