import { buildPerceptionDataResult, runDataPerceptionQuery } from '../shared/dataPerception.js'
import { makePerceptionDescriptor } from '../../../core/protocol/perception.js'

export function buildMapPerceptionDescriptors({ dataRef }) {
  return [
    makePerceptionDescriptor({
      name: 'perception.compareGroups',
      title: 'Compare groups',
      description: 'Compare visible geographic groups in the current map view.',
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
      evidenceKinds: ['groupComparison', 'geographicEvidence'],
      examples: [
        {
          userGoal: 'Compare a few visible regions geographically.',
          params: { groupField: 'State', valueField: 'Population', groups: ['California', 'Texas'] },
        },
      ],
    }),
  ]
}

export function registerMapPerceptionQueries(perceptionRegistry) {
  if (!perceptionRegistry.has('perception.compareGroups', { supportedWidgetKinds: ['map'] })) {
    perceptionRegistry.register(
      { name: 'perception.compareGroups', supportedWidgetKinds: ['map'] },
      async (call, ctx) => {
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'map',
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
      { supportedWidgetKinds: ['map'] },
    )
  }
}
