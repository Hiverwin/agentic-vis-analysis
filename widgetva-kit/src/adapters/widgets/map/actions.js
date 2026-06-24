import { makeActionDescriptor, makeHighlightEffect, makeSelectionEffect } from '../../../core/protocol/actions.js'
import { buildSelectionActionResult } from '../shared/selectionResult.js'

export function buildMapActionDescriptors({ widgetRef, selectionRef, scope = 'local', affectedRefs = [widgetRef] }) {
  const supportedWidgetKinds = ['map']
  return [
    makeActionDescriptor({
      name: 'map.selectRegion',
      title: 'Select map regions',
      description: 'Select one or more geographic regions represented in the current map view.',
      primitive: 'select',
      category: 'selection',
      scope,
      supportedWidgetKinds,
      targetRef: selectionRef || widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.map((ref) => (ref === widgetRef ? 'selections' : 'feedback')),
      paramsSchema: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          values: { type: 'array', items: {}, minItems: 1 },
        },
        required: ['field', 'values'],
      },
      postconditions: [
        {
          description: 'The active selection should contain the requested geographic region values.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid map widget in the current workspace.',
          failureMessage: 'map.selectRegion requires a valid map target widget.',
        },
      ],
      effects: [
        makeSelectionEffect(selectionRef || widgetRef, 'Creates or updates a categorical selection over map regions.'),
        ...affectedRefs
          .filter((ref) => ref !== widgetRef)
          .map((ref) => makeHighlightEffect(ref, 'Linked widgets may highlight or filter the selected regions.')),
      ],
      examples: [
        {
          userGoal: 'Focus one or more regions before comparing downstream statistics.',
          params: { field: 'State', values: ['California', 'Texas'] },
        },
      ],
      reversible: true,
    }),
  ]
}

export function registerMapActions(actionExecutor) {
  if (actionExecutor.has('map.selectRegion')) return
  actionExecutor.register(
    { name: 'map.selectRegion' },
    async (call, ctx) => {
      const params = call?.params || {}
      const targetWidget = ctx.requireTargetWidget({
        targetRef: call?.queryScope?.widgetRef || null,
        kind: 'map',
      })
      const field = typeof params.field === 'string' ? params.field : null
      const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : []
      if (!targetWidget || !field || values.length === 0) {
        throw new Error('map.selectRegion requires a map target, field, and one or more values.')
      }

      const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref)
      const matchedCount = visibleRows.filter((row) => values.includes(row?.[field])).length
      const nextState = ctx.commitSelection({
        selection_id: `sel_${Date.now()}`,
        source_widget_id: targetWidget.widgetId || undefined,
        selection_type: 'category',
        field,
        values,
        predicates: [{ field, op: 'in', value: values }],
        count: matchedCount,
        summary: `${field}: ${values.join(', ')}`,
      })

      return buildSelectionActionResult({
        ctx,
        nextState,
        selectedCount: matchedCount,
        verificationHints: [
          'Read the updated map selection state.',
          'Read linked widgets or visible rows to confirm region-level propagation.',
        ],
      })
    },
  )
}
