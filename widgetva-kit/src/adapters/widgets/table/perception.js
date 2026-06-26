import { buildPerceptionDataResult, runDataPerceptionQuery } from '../shared/dataPerception.js'
import { makePerceptionDescriptor } from '../../../core/protocol/perception.js'

export function buildTablePerceptionDescriptors({ dataRef }) {
  return [
    makePerceptionDescriptor({
      name: 'perception.findExtremes',
      title: 'Find extremes',
      description: 'Return top-k or bottom-k rows by a numeric field in the visible table data.',
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          direction: { type: 'string' },
          limit: { type: 'number' },
          dataRef: { type: 'string' },
        },
      },
      sideEffectFree: true,
      evidenceKinds: ['rowEvidence', 'rankEvidence'],
      examples: [
        {
          userGoal: 'Find the highest or lowest records directly from the visible table.',
          params: { field: 'Horsepower', direction: 'max', limit: 5 },
        },
      ],
    }),
    makePerceptionDescriptor({
      name: 'perception.compareGroups',
      title: 'Compare groups',
      description: 'Compare grouped statistics directly from the visible table rows.',
      category: 'compute',
      targetRef: dataRef,
      paramsSchema: {
        type: 'object',
        properties: {
          groupField: { type: 'string' },
          valueField: { type: 'string' },
          groups: { type: 'array', items: { type: 'string' } },
          dataRef: { type: 'string' },
        },
      },
      sideEffectFree: true,
      evidenceKinds: ['groupComparison', 'rowEvidence'],
      examples: [
        {
          userGoal: 'Compare grouped statistics directly from detail rows.',
          params: { groupField: 'Origin', valueField: 'Horsepower', groups: ['Japan', 'USA'] },
        },
      ],
    }),
  ]
}

export function registerTablePerceptionQueries(perceptionRegistry) {
  if (!perceptionRegistry.has('perception.findExtremes', { supportedWidgetKinds: ['table'] })) {
    perceptionRegistry.register(
      { name: 'perception.findExtremes', supportedWidgetKinds: ['table'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'table',
        })
        const extremes = runDataPerceptionQuery({
          ctx,
          dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
          targetWidget,
          kind: 'findExtremes',
          spec: call?.params || {},
        })
        ctx.recordQuery({ affectedRefs: [targetWidget.ref] })
        return {
          result: buildPerceptionDataResult({
            dataQueryResult: extremes,
            fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, call?.params || {}).dataRef,
          }),
        }
      },
      { supportedWidgetKinds: ['table'] },
    )
  }

  if (!perceptionRegistry.has('perception.compareGroups', { supportedWidgetKinds: ['table'] })) {
    perceptionRegistry.register(
      { name: 'perception.compareGroups', supportedWidgetKinds: ['table'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'table',
        })
        const comparison = runDataPerceptionQuery({
          ctx,
          dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
          targetWidget,
          kind: 'compareGroups',
          spec: call?.params || {},
        })
        ctx.recordQuery({ affectedRefs: [targetWidget.ref] })
        return {
          result: buildPerceptionDataResult({
            dataQueryResult: comparison,
            fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, call?.params || {}).dataRef,
          }),
        }
      },
      { supportedWidgetKinds: ['table'] },
    )
  }
}
