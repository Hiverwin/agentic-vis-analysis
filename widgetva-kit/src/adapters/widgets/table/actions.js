import { makeActionDescriptor, makeSelectionEffect } from '../../../core/protocol/actions.js'

function resolveDefaultKeyField(widgetState) {
  const columns = Array.isArray(widgetState?.rawSpec?.columns) ? widgetState.rawSpec.columns : []
  return columns[0] || null
}

export function buildTableActionDescriptors({ widgetRef, scope = 'local', affectedRefs = [widgetRef] }) {
  const supportedWidgetKinds = ['table']
  return [
    makeActionDescriptor({
      name: 'table.focusRows',
      title: 'Focus table rows',
      description: 'Focus a set of rows in the current table using a key field and one or more keys.',
      primitive: 'navigate',
      category: 'navigation',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      paramsSchema: {
        type: 'object',
        properties: {
          keyField: { type: 'string' },
          keys: { type: 'array', items: {}, minItems: 1 },
        },
        required: ['keys'],
      },
      postconditions: [
        {
          description: 'The workspace focus should move to the table and the table should expose a point selection for the requested keys.',
        },
      ],
      preconditions: [
        {
          description: 'The table exposes at least one stable key field for row identity.',
          failureMessage: 'No usable key field is available for row focus.',
        },
      ],
      effects: [
        makeSelectionEffect(widgetRef, 'Creates a point selection that identifies focused table rows.'),
      ],
      examples: [
        {
          userGoal: 'Jump to one or more detail rows that should be examined closely.',
          params: { keyField: 'Name', keys: ['ford pinto'] },
        },
      ],
      reversible: true,
    }),
  ]
}

export function registerTableActions(actionExecutor) {
  if (!actionExecutor.has('table.focusRows')) {
    actionExecutor.register(
      { name: 'table.focusRows' },
      async (call, ctx) => {
        const params = call?.params || {}
        const targetWidget = ctx.requireTargetWidget({
          targetRef: call?.queryScope?.widgetRef || null,
          kind: 'table',
          message: 'table.focusRows requires a valid target table widget.',
        })

        const widgetState = ctx.readCurrentState({ refs: [targetWidget.ref] })?.widgets?.[targetWidget.ref]
        const keyField = typeof params.keyField === 'string' ? params.keyField : resolveDefaultKeyField(widgetState)
        const keys = Array.isArray(params.keys) ? params.keys.filter((key) => key != null) : []
        if (!keyField || keys.length === 0) {
          throw new Error('table.focusRows requires a keyField and at least one key.')
        }

        const selection = {
          selection_id: `table_focus_${Date.now()}`,
          source_widget_id: targetWidget.widgetId,
          selection_type: 'point',
          keyField,
          keys,
          predicates: [
            {
              field: keyField,
              op: keys.length === 1 ? 'equals' : 'in',
              value: keys.length === 1 ? keys[0] : keys,
            },
          ],
          count: keys.length,
          summary: `Focused ${keys.length} row${keys.length === 1 ? '' : 's'} in ${targetWidget.widgetId}.`,
        }

        const appState = ctx.getAppState()
        appState.setCurrentFocusedWidgetRef(targetWidget.ref)
        const nextState = ctx.commitSelection(selection)

        return {
          nextState,
          propagateFromSelection: true,
          result: {
            widgetId: targetWidget.widgetId,
            keyField,
            keys,
          },
          verificationHints: [
            'Read the workspace state and confirm shared.focusedWidget points to the table.',
            'Read the table widget state and confirm a point selection exists for the requested keys.',
          ],
          notes: {
            userVisibleSummary: `Focused ${keys.length} table row${keys.length === 1 ? '' : 's'} via ${keyField}.`,
          },
        }
      },
    )
  }
}
