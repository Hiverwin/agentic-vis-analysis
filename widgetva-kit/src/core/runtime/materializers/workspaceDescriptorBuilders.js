import { getWidgetFamilyAdapter } from '../../../adapters/widgetFamilies/index.js'
import { createDataQueryEngine } from '../../data/index.js'
import {
  makeActionDescriptor,
  makeDomainEffect,
  makeEncodingEffect,
  makeFilterEffect,
  makeHighlightEffect,
  makeSelectionEffect,
} from '../../protocol/actions.js'
import {
  DATA_QUERY_DESCRIPTOR_TEMPLATES,
  DATA_QUERY_SCHEMAS,
  makeDataHandle,
  makeDataQueryDescriptor,
} from '../../protocol/dataHandles.js'
import { makeCurrentSelectionDataRef, makeCurrentViewDataRef } from '../../protocol/refs.js'
import { makePerceptionDescriptor } from '../../protocol/perception.js'

const dataQueryEngine = createDataQueryEngine({ kind: 'js_array' })
const supportedQueryKinds = dataQueryEngine.listSupportedQueryKinds()

function buildSupportedQueryDescriptors(kinds) {
  return kinds.map((kind) =>
    makeDataQueryDescriptor({
      name: kind,
      ...DATA_QUERY_DESCRIPTOR_TEMPLATES[kind],
      inputSchema: DATA_QUERY_SCHEMAS[kind] || {
        type: 'object',
        additionalProperties: true,
        properties: {},
      },
    }),
  )
}

function buildSelectionAffectedStatePaths(affectedRefs, widgetRef) {
  return affectedRefs.map((ref) => (ref === widgetRef ? 'selections' : 'transforms'))
}

function buildHighlightAffectedStatePaths(affectedRefs) {
  return affectedRefs.map(() => 'feedback')
}

function buildDataTransformAffectedStatePaths(affectedRefs) {
  return affectedRefs.flatMap(() => ['transforms', 'data.currentDataRef', 'data.visibleCount', 'data.selectedCount'])
}

function buildSortAffectedStatePaths(affectedRefs) {
  return affectedRefs.flatMap(() => ['encodings', 'view.sort'])
}

function buildEncodingAffectedStatePaths(affectedRefs) {
  return affectedRefs.map(() => 'encodings')
}

function buildZoomAffectedStatePaths(affectedRefs) {
  return affectedRefs.flatMap(() => ['view.xDomain', 'view.yDomain', 'view.zoom'])
}

function buildWorkspaceAffectedStatePaths(actionName, affectedRefs, widgetRef) {
  if (actionName === 'workspace.focusWidget') {
    return ['shared.focusedWidget']
  }
  if (actionName === 'workspace.addAnnotation' || actionName === 'workspace.clearAnnotations') {
    return ['shared.annotations']
  }
  if (actionName === 'workspace.jumpToState' || actionName === 'workspace.branchFromState') {
    return ['widgets', 'shared', 'replayContext']
  }
  if (actionName === 'workspace.resetWorkspace') {
    return ['widgets', 'shared.selections.registry', 'shared.globalFilters', 'shared.annotations']
  }
  return affectedRefs.map((ref) => (ref === widgetRef ? 'selections' : 'transforms'))
}

export function buildDataHandle({ appId, workspaceId, spec }) {
  const rows = Array.isArray(spec?.data?.values) ? spec.data.values : []
  const supportedQueries = supportedQueryKinds
  return makeDataHandle({
    ref: `wl://${appId}/workspace/${workspaceId}/data/primary`,
    title: 'Primary Data',
    description: 'Current inline dataset bound to the active widget.',
    sourceKind: 'inline',
    schema: dataQueryEngine.getSchema(rows),
    stats: {
      rowCount: rows.length,
    },
    supportedQueries,
    supportedQueryDescriptors: buildSupportedQueryDescriptors(supportedQueries),
  })
}

export function buildDerivedDataHandle({
  ref,
  title,
  description,
  rows,
  selectedCount = 0,
  kind = 'dataView',
  scope = 'workspace',
  widgetRef = undefined,
  sourceSelectionRef = undefined,
}) {
  const supportedQueries = supportedQueryKinds
  return makeDataHandle({
    ref,
    title,
    description,
    sourceKind: 'inline',
    kind,
    scope,
    widgetRef,
    sourceSelectionRef,
    schema: dataQueryEngine.getSchema(rows),
    stats: {
      rowCount: rows.length,
      visibleCount: rows.length,
      selectedCount,
    },
    supportedQueries,
    supportedQueryDescriptors: buildSupportedQueryDescriptors(supportedQueries),
  })
}

export function buildActionDescriptors({
  widgetRef,
  selectionRef,
  widgetKind,
  widgetSourceKind,
  scope = 'local',
  affectedRefs = [widgetRef],
}) {
  const supportedWidgetKinds = typeof widgetKind === 'string' ? [widgetKind] : null
  const descriptors = [
    makeActionDescriptor({
      name: 'widget.updateSelection',
      title: 'Update widget selection',
      description: 'Apply a runtime selection payload to the current widget through the shared action pipeline.',
      primitive: 'select',
      category: 'selection',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: buildSelectionAffectedStatePaths(affectedRefs, widgetRef),
      paramsSchema: {
        type: 'object',
        properties: {
          selection_id: { type: 'string' },
          source_widget_id: { type: 'string' },
          selection_type: { type: 'string' },
          domain: { type: 'object' },
          fields: { type: 'array', items: { type: 'string' } },
          value: { type: 'object' },
          keyField: { type: 'string' },
          keys: { type: 'array', items: {} },
          field: { type: 'string' },
          values: { type: 'array', items: {} },
          predicates: { type: 'array', items: { type: 'object' } },
          count: { type: 'integer' },
          summary: { type: 'string' },
        },
        required: ['selection_type'],
      },
      postconditions: [
        {
          description: 'The widget selection state should match the supplied runtime selection payload.',
        },
      ],
      effects: [
        makeSelectionEffect(widgetRef, 'Creates or updates the active selection through the shared runtime action path.'),
      ],
      examples: [
        {
          userGoal: 'Apply a directly-manipulated runtime selection through the shared action pipeline.',
          params: {
            selection_type: 'category',
            field: 'Origin',
            values: ['USA'],
            predicates: [{ field: 'Origin', op: 'in', value: ['USA'] }],
            count: 1,
            summary: 'Origin: USA',
          },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'widget.clearSelection',
      title: 'Clear current selection',
      description: 'Clear the active selection on the current widget.',
      primitive: 'reset',
      category: 'selection',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: buildSelectionAffectedStatePaths(affectedRefs, widgetRef),
      paramsSchema: {
        type: 'object',
        properties: {},
      },
      postconditions: [
        {
          description: 'The widget should have no active selection.',
        },
      ],
      effects: [
        makeSelectionEffect(widgetRef, 'Clears the active selection on the target widget.'),
      ],
      examples: [
        {
          userGoal: 'Clear the current focus region before starting a new analysis step.',
          params: {},
        },
      ],
      reversible: false,
    }),
    makeActionDescriptor({
      name: 'widget.undoSelection',
      title: 'Undo selection',
      description: 'Revert to the previous selection state in the current workspace.',
      primitive: 'undo',
      category: 'selection',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: buildSelectionAffectedStatePaths(affectedRefs, widgetRef),
      paramsSchema: {
        type: 'object',
        properties: {},
      },
      postconditions: [
        {
          description: 'The previous selection state should be restored if history is available.',
        },
      ],
      preconditions: [
        {
          description: 'A previous selection state exists in workspace history.',
          failureMessage: 'No prior selection state is available to restore.',
        },
      ],
      effects: [
        makeSelectionEffect(widgetRef, 'Restores the previous selection state on the target widget when available.'),
      ],
      reversible: false,
    }),
    makeActionDescriptor({
      name: 'widget.redoSelection',
      title: 'Redo selection',
      description: 'Reapply the next selection state in the current workspace when redo history is available.',
      primitive: 'redo',
      category: 'selection',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: buildSelectionAffectedStatePaths(affectedRefs, widgetRef),
      paramsSchema: {
        type: 'object',
        properties: {},
      },
      postconditions: [
        {
          description: 'The next selection state should be restored if redo history is available.',
        },
      ],
      preconditions: [
        {
          description: 'A redo selection state exists in workspace history.',
          failureMessage: 'No redo selection state is available to restore.',
        },
      ],
      effects: [
        makeSelectionEffect(widgetRef, 'Reapplies the next selection state on the target widget when redo history is available.'),
      ],
      reversible: false,
    }),
    makeActionDescriptor({
      name: 'workspace.resetWorkspace',
      title: 'Reset workspace state',
      description: 'Reset interaction state for the current workspace back to its baseline state.',
      primitive: 'reset',
      category: 'coordination',
      scope: 'workspace',
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: buildWorkspaceAffectedStatePaths('workspace.resetWorkspace', affectedRefs, widgetRef),
      paramsSchema: {
        type: 'object',
        properties: {},
      },
      postconditions: [
        {
          description: 'Selections and derived interaction state should be cleared.',
        },
      ],
      effects: [
        makeSelectionEffect(widgetRef, 'Clears active selections and restores baseline workspace interaction state.'),
      ],
      reversible: false,
    }),
    makeActionDescriptor({
      name: 'workspace.jumpToState',
      title: 'Jump to previous state',
      description: 'Restore the workspace interaction state from a previously recorded state snapshot.',
      primitive: 'undo',
      category: 'coordination',
      scope: 'workspace',
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: buildWorkspaceAffectedStatePaths('workspace.jumpToState', affectedRefs, widgetRef),
      paramsSchema: {
        type: 'object',
        properties: {
          stateId: { type: 'string' },
        },
        required: ['stateId'],
      },
      postconditions: [
        {
          description: 'The workspace interaction state should match the target snapshot as closely as possible.',
        },
      ],
      preconditions: [
        {
          description: 'The referenced state snapshot exists in runtime history.',
          failureMessage: 'The requested stateId is not available in runtime history.',
        },
      ],
      examples: [
        {
          userGoal: 'Return to the state before a failed exploratory branch.',
          params: { stateId: 'main:previous-state' },
        },
      ],
      reversible: false,
    }),
    makeActionDescriptor({
      name: 'workspace.focusWidget',
      title: 'Focus workspace widget',
      description: 'Move the workspace analytical focus to a target widget without changing data selection.',
      primitive: 'navigate',
      category: 'navigation',
      scope: 'workspace',
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: buildWorkspaceAffectedStatePaths('workspace.focusWidget', affectedRefs, widgetRef),
      paramsSchema: {
        type: 'object',
        properties: {},
      },
      postconditions: [
        {
          description: 'The workspace focused widget should match the requested target.',
        },
      ],
      preconditions: [
        {
          description: 'The requested targetRef resolves to a valid widget in the current workspace.',
          failureMessage: 'workspace.focusWidget requires a valid target widget.',
        },
      ],
      examples: [
        {
          userGoal: 'Move analytical attention from the overview chart to the detail table.',
          params: { queryScope: { widgetRef } },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'workspace.addAnnotation',
      title: 'Add workspace annotation',
      description: 'Attach an explicit analysis note to a widget or the workspace for later reasoning and replay.',
      primitive: 'annotate',
      category: 'annotation',
      scope: 'workspace',
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: buildWorkspaceAffectedStatePaths('workspace.addAnnotation', affectedRefs, widgetRef),
      paramsSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          kind: { type: 'string' },
        },
        required: ['text'],
      },
      postconditions: [
        {
          description: 'The workspace annotations list should contain the new note.',
        },
      ],
      preconditions: [
        {
          description: 'If targetRef is provided, it resolves to a valid widget in the current workspace.',
          failureMessage: 'workspace.addAnnotation targetRef must resolve to a valid widget when provided.',
        },
      ],
      examples: [
        {
          userGoal: 'Record a hypothesis about the current cluster before continuing.',
          params: { text: 'Potential high-risk subgroup worth validating.', queryScope: { widgetRef } },
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'workspace.clearAnnotations',
      title: 'Clear workspace annotations',
      description: 'Remove all current workspace annotations.',
      primitive: 'reset',
      category: 'annotation',
      scope: 'workspace',
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: buildWorkspaceAffectedStatePaths('workspace.clearAnnotations', affectedRefs, widgetRef),
      paramsSchema: {
        type: 'object',
        properties: {},
      },
      postconditions: [
        {
          description: 'The workspace annotations list should be empty.',
        },
      ],
      examples: [
        {
          userGoal: 'Clear temporary analysis notes before starting a new line of reasoning.',
          params: {},
        },
      ],
      reversible: false,
    }),
    makeActionDescriptor({
      name: 'workspace.branchFromState',
      title: 'Branch from previous state',
      description: 'Create a new branch from a previously recorded state snapshot and restore that interaction state.',
      primitive: 'undo',
      category: 'coordination',
      scope: 'workspace',
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: buildWorkspaceAffectedStatePaths('workspace.branchFromState', affectedRefs, widgetRef),
      paramsSchema: {
        type: 'object',
        properties: {
          stateId: { type: 'string' },
          branchLabel: { type: 'string' },
        },
        required: ['stateId'],
      },
      postconditions: [
        {
          description: 'A new branch should be created and the workspace interaction state should match the branch origin snapshot.',
        },
      ],
      preconditions: [
        {
          description: 'The referenced state snapshot exists in runtime history.',
          failureMessage: 'The requested branch origin stateId is not available.',
        },
      ],
      reversible: false,
    }),
  ]

  if (widgetSourceKind === 'baseSpec') {
    descriptors.push(
      makeActionDescriptor({
        name: 'widget.highlightValues',
        title: 'Highlight matching values',
        description: 'Highlight rows/items in the target widget that match a categorical field-value set without changing the active selection.',
        primitive: 'highlight',
        category: 'coordination',
        scope,
        supportedWidgetKinds,
        targetRef: widgetRef,
        affectedRefs,
        affectedStatePaths: buildHighlightAffectedStatePaths(affectedRefs),
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
            description: 'The target widget should expose highlight feedback for the requested values.',
          },
          {
            description: 'Matching rows/items should be marked as highlighted in runtime-visible state.',
          },
        ],
        preconditions: [
          {
            description: 'The requested targetRef resolves to a valid widget in the current workspace.',
            failureMessage: 'widget.highlightValues requires a valid target widget.',
          },
          {
            description: 'The target widget is backed by an active base specification that can accept highlight updates.',
            failureMessage: 'No active base spec is available for highlight updates.',
          },
        ],
        effects: [
          makeHighlightEffect(widgetRef, 'Applies direct runtime highlighting to matching values on the target widget.'),
        ],
        examples: [
          {
            userGoal: 'Temporarily highlight records from one category before deciding whether to filter.',
            params: { field: 'Origin', values: ['USA'] },
          },
        ],
        reversible: true,
      }),
      makeActionDescriptor({
        name: 'widget.aggregateData',
        title: 'Aggregate current data view',
        description: 'Apply or replace an aggregate transform on the current base specification to produce grouped summary rows.',
        primitive: 'aggregate',
        category: 'dataTransform',
        scope,
        supportedWidgetKinds,
        targetRef: widgetRef,
        affectedRefs,
        affectedStatePaths: buildDataTransformAffectedStatePaths(affectedRefs),
        paramsSchema: {
          type: 'object',
          properties: {
            groupBy: { type: 'array', items: { type: 'string' }, minItems: 1 },
            measures: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                properties: {
                  op: { type: 'string' },
                  field: { type: 'string' },
                  as: { type: 'string' },
                },
                required: ['op', 'as'],
              },
            },
          },
          required: ['groupBy', 'measures'],
        },
        postconditions: [
          {
            description: 'The target widget spec should include an aggregate transform with the requested groupBy and measure definitions.',
          },
          {
            description: 'The target widget visible rows should represent grouped summary output rather than the raw record set.',
          },
        ],
        preconditions: [
          {
            description: 'The requested targetRef resolves to a valid widget in the current workspace.',
            failureMessage: 'widget.aggregateData requires a valid target widget.',
          },
          {
            description: 'The target widget is backed by an active base specification that can accept aggregate updates.',
            failureMessage: 'No active base spec is available for aggregate updates.',
          },
        ],
        examples: [
          {
            userGoal: 'Roll the current detail view up to counts by category before comparing groups.',
            params: {
              groupBy: ['Origin'],
              measures: [{ op: 'count', as: 'count' }],
            },
          },
        ],
        reversible: true,
      }),
      makeActionDescriptor({
        name: 'widget.filterByValues',
        title: 'Filter by categorical values',
        description: 'Apply or replace a categorical filter transform on the current base specification.',
        primitive: 'filter',
        category: 'dataTransform',
        scope,
        supportedWidgetKinds,
        targetRef: widgetRef,
        affectedRefs,
        affectedStatePaths: buildDataTransformAffectedStatePaths(affectedRefs),
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
            description: 'The target widget spec should include a categorical filter transform for the requested field.',
          },
        ],
        preconditions: [
          {
            description: 'The requested targetRef resolves to a valid widget in the current workspace.',
            failureMessage: 'widget.filterByValues requires a valid target widget.',
          },
          {
            description: 'The target widget is backed by an active base specification that can accept transform updates.',
            failureMessage: 'No active base spec is available for filter updates.',
          },
        ],
        effects: [
          makeFilterEffect(widgetRef, 'Applies a categorical filter transform to the target widget specification.'),
        ],
        examples: [
          {
            userGoal: 'Restrict the chart to records from a small set of categories.',
            params: { field: 'Origin', values: ['Japan', 'USA'] },
          },
        ],
        reversible: true,
      }),
      makeActionDescriptor({
        name: 'widget.filterByRange',
        title: 'Filter by numeric range',
        description: 'Apply or replace a numeric range filter transform on the current base specification.',
        primitive: 'filter',
        category: 'dataTransform',
        scope,
        supportedWidgetKinds,
        targetRef: widgetRef,
        affectedRefs,
        affectedStatePaths: buildDataTransformAffectedStatePaths(affectedRefs),
        paramsSchema: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            range: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
          },
          required: ['field', 'range'],
        },
        postconditions: [
          {
            description: 'The target widget spec should include a range filter transform for the requested field.',
          },
        ],
        preconditions: [
          {
            description: 'The requested targetRef resolves to a valid widget in the current workspace.',
            failureMessage: 'widget.filterByRange requires a valid target widget.',
          },
          {
            description: 'The target widget is backed by an active base specification that can accept transform updates.',
            failureMessage: 'No active base spec is available for filter updates.',
          },
        ],
        effects: [
          makeFilterEffect(widgetRef, 'Applies a numeric range filter transform to the target widget specification.'),
        ],
        examples: [
          {
            userGoal: 'Restrict the chart to a bounded numeric interval.',
            params: { field: 'Horsepower', range: [80, 160] },
          },
        ],
        reversible: true,
      }),
      makeActionDescriptor({
        name: 'widget.sortEncoding',
        title: 'Sort encoded values',
        description: 'Apply a declarative sort rule to a target encoding channel in the current base specification.',
        primitive: 'sort',
        category: 'visualMapping',
        scope,
        supportedWidgetKinds,
        targetRef: widgetRef,
        affectedRefs,
        affectedStatePaths: buildSortAffectedStatePaths(affectedRefs),
        paramsSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            field: { type: 'string' },
            order: { type: 'string' },
            aggregate: { type: 'string' },
          },
          required: ['channel', 'order'],
        },
        postconditions: [
          {
            description: 'The target widget encoding should expose the requested sort rule.',
          },
        ],
        preconditions: [
          {
            description: 'The requested targetRef resolves to a valid widget in the current workspace.',
            failureMessage: 'widget.sortEncoding requires a valid target widget.',
          },
          {
            description: 'The target widget is backed by an active base specification that can accept sort updates.',
            failureMessage: 'No active base spec is available for sort updates.',
          },
          {
            description: 'The requested encoding channel already exists on the active spec.',
            failureMessage: 'The active spec does not define the requested encoding channel.',
          },
        ],
        effects: [
          makeEncodingEffect(widgetRef, 'Updates the target encoding channel sort rule in the base specification.'),
        ],
        examples: [
          {
            userGoal: 'Sort the category axis by descending count.',
            params: { channel: 'x', order: 'descending', aggregate: 'count' },
          },
        ],
        reversible: true,
      }),
      makeActionDescriptor({
        name: 'widget.changeEncoding',
        title: 'Change visual encoding',
        description: 'Rebind a widget encoding channel to a different field in the current base specification.',
        primitive: 'reencode',
        category: 'visualMapping',
        scope,
        supportedWidgetKinds,
        targetRef: widgetRef,
        affectedRefs,
        affectedStatePaths: buildEncodingAffectedStatePaths(affectedRefs),
        paramsSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            field: { type: 'string' },
            type: { type: 'string' },
            aggregate: { type: 'string' },
          },
          required: ['channel', 'field'],
        },
        postconditions: [
          {
            description: 'The target widget encoding should point to the specified field.',
          },
        ],
        preconditions: [
          {
            description: 'The requested targetRef resolves to a valid widget in the current workspace.',
            failureMessage: 'widget.changeEncoding requires a valid target widget.',
          },
          {
            description: 'The target widget is backed by an active base specification that can accept encoding updates.',
            failureMessage: 'No active base spec is available for encoding updates.',
          },
        ],
        effects: [
          makeEncodingEffect(widgetRef, 'Rebinds a visual encoding channel to a new field in the base specification.'),
        ],
        examples: [
          {
            userGoal: 'Switch the y channel to a different measure.',
            params: { channel: 'y', field: 'Miles_per_Gallon', type: 'quantitative' },
          },
        ],
        reversible: true,
      }),
      makeActionDescriptor({
        name: 'widget.zoomDomain',
        title: 'Zoom widget domain',
        description: 'Update the data-space x/y domain of a widget without using pixel coordinates.',
        primitive: 'zoom',
        category: 'viewTransform',
        scope,
        supportedWidgetKinds,
        targetRef: widgetRef,
        affectedRefs,
        affectedStatePaths: buildZoomAffectedStatePaths(affectedRefs),
        paramsSchema: {
          type: 'object',
          properties: {
            xDomain: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
            yDomain: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
          },
        },
        postconditions: [
          {
            description: 'The target widget view domain should match the requested x/y ranges.',
          },
        ],
        preconditions: [
          {
            description: 'The requested targetRef resolves to a valid widget in the current workspace.',
            failureMessage: 'widget.zoomDomain requires a valid target widget.',
          },
          {
            description: 'The target widget is backed by an active base specification that can accept domain updates.',
            failureMessage: 'No active base spec is available for domain updates.',
          },
          {
            description: 'Any requested x/y domain corresponds to an encoding channel present on the active spec.',
            failureMessage: 'The active spec does not define the requested zoom domain channel.',
          },
        ],
        effects: [
          makeDomainEffect(widgetRef, 'Updates the x/y data-space domain of the target widget.'),
        ],
        examples: [
          {
            userGoal: 'Zoom to a narrower value range without using pixel coordinates.',
            params: { xDomain: [0, 50], yDomain: [10, 100] },
          },
        ],
        reversible: true,
      }),
    )
  }

  const familyAdapter = getWidgetFamilyAdapter(widgetKind)
  descriptors.unshift(
    ...familyAdapter.buildActionDescriptors({
      widgetRef,
      selectionRef,
      widgetKind,
      scope,
      affectedRefs,
    }),
  )

  return descriptors
}

export function buildPerceptionDescriptors({
  appId = 'widgetva-app',
  workspaceId = 'main',
  widgetRef,
  dataRef,
  widgetKind,
  widgetDef,
  widgetSpec,
}) {
  const currentViewDataRef = makeCurrentViewDataRef({ appId, workspaceId })
  const currentSelectionDataRef = makeCurrentSelectionDataRef({ appId, workspaceId })
  const sampleSelectionRef = `${widgetRef}/selection/current`
  const descriptors = [
    makePerceptionDescriptor({
      name: 'perception.inspectViewConfig',
      title: 'Inspect current view config',
      description: 'Return encodings, transforms, domains, and selection state for the active widget.',
      category: 'inspect',
      targetRef: widgetRef,
      paramsSchema: {
        type: 'object',
        properties: {},
      },
      sideEffectFree: true,
      evidenceKinds: ['viewState', 'encodingState', 'selectionState'],
      examples: [
        {
          userGoal: 'Check the current encoding and domain before deciding the next action.',
          params: {},
        },
      ],
    }),
    makePerceptionDescriptor({
      name: 'perception.inspectVisibleRows',
      title: 'Inspect visible rows',
      description: 'Return a sampled subset of the rows currently visible in the target widget.',
      category: 'inspect',
      targetRef: currentViewDataRef,
      paramsSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
        },
      },
      sideEffectFree: true,
      evidenceKinds: ['rowSample', 'visibleData'],
      examples: [
        {
          userGoal: 'Look at representative visible records before aggregating.',
          params: { limit: 10 },
        },
        {
          userGoal: 'Inspect rows from the shared current_view data view.',
          params: { queryScope: { dataRef: currentViewDataRef }, limit: 10 },
        },
        {
          userGoal: 'Inspect one specific selection-scoped data view.',
          params: {
            queryScope: {
              dataRef: currentSelectionDataRef,
              selectionRef: sampleSelectionRef,
            },
            limit: 10,
          },
        },
      ],
    }),
    makePerceptionDescriptor({
      name: 'perception.summarizeSelection',
      title: 'Summarize current selection',
      description: 'Return a lightweight summary of the current selection, including the shared current_selection data view when available.',
      category: 'summarize',
      targetRef: currentSelectionDataRef,
      paramsSchema: {
        type: 'object',
        properties: {
          groupBy: { type: 'array', items: { type: 'string' } },
          measures: { type: 'array', items: { type: 'object' } },
          fields: { type: 'array', items: { type: 'string' } },
          metrics: { type: 'array', items: { type: 'string' } },
          sortBy: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              order: { type: 'string', enum: ['ascending', 'descending'] },
            },
          },
          limit: { type: 'integer' },
        },
      },
      sideEffectFree: true,
      evidenceKinds: ['selectionSummary', 'aggregateEvidence'],
      verificationTargets: ['shared.selections.registry'],
      examples: [
        {
          userGoal: 'Quantify the currently selected subset before answering.',
          params: { fields: ['Horsepower'], metrics: ['mean', 'max'], groupBy: ['Origin'] },
        },
        {
          userGoal: 'Summarize one specific selection when multiple active selections are present.',
          params: {
            queryScope: {
              dataRef: currentSelectionDataRef,
              selectionRef: sampleSelectionRef,
            },
            fields: ['Horsepower'],
            metrics: ['mean'],
          },
        },
      ],
    }),
    makePerceptionDescriptor({
      name: 'perception.summarizeVisible',
      title: 'Summarize visible rows',
      description: 'Return grouped or aggregated summaries over the rows currently visible in the target widget.',
      category: 'summarize',
      targetRef: currentViewDataRef,
      paramsSchema: {
        type: 'object',
        properties: {
          groupBy: { type: 'array', items: { type: 'string' } },
          measures: { type: 'array', items: { type: 'object' } },
          fields: { type: 'array', items: { type: 'string' } },
          metrics: { type: 'array', items: { type: 'string' } },
          sortBy: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              order: { type: 'string', enum: ['ascending', 'descending'] },
            },
          },
          limit: { type: 'integer' },
        },
      },
      sideEffectFree: true,
      evidenceKinds: ['aggregateEvidence', 'visibleDataSummary'],
      examples: [
        {
          userGoal: 'Get a grouped summary over the currently visible subset.',
          params: { fields: ['Horsepower'], metrics: ['mean'], groupBy: ['Origin'] },
        },
        {
          userGoal: 'Summarize rows from the shared current_view data view without changing workspace state.',
          params: {
            queryScope: {
              dataRef: currentViewDataRef,
            },
            fields: ['Horsepower'],
            metrics: ['mean'],
          },
        },
        {
          userGoal: 'Summarize rows from the shared current_selection data view without changing workspace state.',
          params: {
            queryScope: {
              dataRef: currentSelectionDataRef,
              selectionRef: sampleSelectionRef,
            },
            fields: ['Horsepower'],
            metrics: ['mean'],
          },
        },
      ],
    }),
    makePerceptionDescriptor({
      name: 'perception.verifyActionEffect',
      title: 'Verify action effect',
      description: 'Check whether a recent action produced the expected state change on the specified refs.',
      category: 'verify',
      targetRef: widgetRef,
      paramsSchema: {
        type: 'object',
        properties: {
          actionName: { type: 'string' },
          stateId: { type: 'string' },
          refs: { type: 'array', items: { type: 'string' } },
        },
      },
      sideEffectFree: true,
      evidenceKinds: ['verificationEvidence', 'stateDelta'],
      verificationTargets: ['statePatch', 'workspaceState'],
      examples: [
        {
          userGoal: 'Verify that a selection or filter changed the intended widgets.',
          params: { actionName: 'scatter.brushRegion' },
        },
      ],
    }),
  ]

  const familyAdapter = getWidgetFamilyAdapter(widgetKind)
  descriptors.push(
    ...familyAdapter.buildPerceptionDescriptors({
      widgetRef,
      dataRef,
      widgetKind,
      widgetDef,
      widgetSpec,
    }),
  )

  return descriptors
}
