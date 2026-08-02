import {
  makeActionDescriptor,
  makeEncodingEffect,
  makeSelectionEffect,
} from '../../../../contracts/action-contracts.js'
import { makePerceptionDescriptor } from '../../../../contracts/perception-contracts.js'
import { createDataQueryEngine } from '../../../data/index.js'
import {
  DATA_QUERY_SCHEMAS,
  makeDataHandle,
  makeDataQueryDescriptor,
} from '../../../../contracts/data-contracts.js'
import { makeCurrentSelectionDataRef, makeCurrentViewDataRef } from '../../../../contracts/refs-contracts.js'
import { DATA_QUERY_DESCRIPTOR_TEMPLATES } from '../../../data/dataQueryDescriptorTemplates.js'
import {
  buildWidgetFamilyActionDescriptors,
  buildWidgetFamilyPerceptionDescriptors,
} from '../../../../widgets/families/index.js'

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

function buildDataTransformAffectedStatePaths(affectedRefs) {
  return affectedRefs.flatMap(() => ['transforms', 'data.currentDataRef', 'data.visibleCount', 'data.selectedCount'])
}

function buildEncodingAffectedStatePaths(affectedRefs) {
  return affectedRefs.map(() => 'encodings')
}

function buildWorkspaceAffectedStatePaths(actionName, affectedRefs, widgetRef) {
  if (actionName === 'workspace.focusWidget') {
    return ['shared.focusedWidget']
  }
  if (actionName === 'workspace.jumpToState' || actionName === 'workspace.branchFromState') {
    return ['widgets', 'shared', 'replayContext']
  }
  if (actionName === 'workspace.resetWorkspace') {
    return ['widgets', 'shared.selections.registry', 'shared.globalFilters']
  }
  return affectedRefs.map((ref) => (ref === widgetRef ? 'selections' : 'transforms'))
}

function uniqueKinds(kinds = []) {
  return [...new Set(
    (Array.isArray(kinds) ? kinds : [])
      .filter((kind) => typeof kind === 'string' && kind.length > 0),
  )]
}

function mergeDescriptorsByName(descriptors = []) {
  const merged = []
  const seen = new Set()
  for (const descriptor of descriptors) {
    const name = descriptor?.name
    if (typeof name !== 'string' || name.length === 0 || seen.has(name)) continue
    seen.add(name)
    merged.push(descriptor)
  }
  return merged
}

function readAllowedDescriptorNames(widgetDef = null, keys = []) {
  if (!widgetDef || typeof widgetDef !== 'object' || Array.isArray(widgetDef)) return null
  for (const key of keys) {
    const names = widgetDef?.[key]
    if (Array.isArray(names)) {
      const filteredNames = names.filter((name) => typeof name === 'string' && name.length > 0)
      if (filteredNames.length > 0) return new Set(filteredNames)
    }
  }
  return null
}

function filterDescriptorsByAllowedNames(descriptors = [], allowedNames = null) {
  if (!(allowedNames instanceof Set)) return descriptors
  return descriptors.filter((descriptor) => allowedNames.has(descriptor?.name))
}

function readCapabilityKinds(widgetKind, widgetSpec = null, widgetDef = null) {
  const specKinds = uniqueKinds(
    widgetSpec?.__widgetvaRecognizedKinds
    || widgetSpec?.recognizedKinds
    || widgetSpec?.__widgetvaCandidateKinds
    || widgetSpec?.candidateKinds
    || widgetDef?.recognizedKinds
    || widgetDef?.candidateKinds,
  )
  if (widgetKind !== 'custom' || specKinds.length === 0) {
    return typeof widgetKind === 'string' && widgetKind.length > 0 ? [widgetKind] : []
  }
  // Composite/custom widgets keep their root identity. recognized/candidate kinds
  // only expose borrowed capability descriptors; they are not representative child specs.
  return specKinds.filter((kind) => kind !== 'custom')
}

function withSupportedWidgetKinds(descriptor, supportedWidgetKinds) {
  if (!descriptor || !Array.isArray(supportedWidgetKinds) || supportedWidgetKinds.length === 0) {
    return descriptor
  }
  return Array.isArray(descriptor.supportedWidgetKinds) && descriptor.supportedWidgetKinds.length > 0
    ? descriptor
    : {
        ...descriptor,
        supportedWidgetKinds,
      }
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

function buildFamilyActionDescriptors(kind, args) {
  return buildWidgetFamilyActionDescriptors(kind, args)
}

function buildFamilyPerceptionDescriptors(kind, args) {
  return buildWidgetFamilyPerceptionDescriptors(kind, args)
}

export function buildActionDescriptors({
  widgetRef,
  selectionRef,
  widgetKind,
  widgetSourceKind,
  widgetSpec = null,
  widgetDef = null,
  scope = 'local',
  affectedRefs = [widgetRef],
}) {
  const supportedWidgetKinds = typeof widgetKind === 'string' ? [widgetKind] : null
  const descriptors = [
    makeActionDescriptor({
      name: 'widget.updateSelection',
      title: 'Update widget selection',
      description: 'Apply a runtime selection payload to the current widget through the shared action pipeline.',
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
      name: 'widget.resetView',
      title: 'Reset widget view',
      description: 'Reset the target widget view state to its baseline, clearing local view transforms, selections, and visual emphasis.',
      category: 'view',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.flatMap(() => ['view', 'transforms', 'selections', 'feedback']),
      paramsSchema: {
        type: 'object',
        properties: {},
      },
      postconditions: [
        {
          description: 'The target widget should render without runtime view projections.',
        },
      ],
      effects: [
        makeEncodingEffect(widgetRef, 'Restores the target widget view state to baseline.'),
      ],
      examples: [
        {
          userGoal: 'Reset this chart after zooming or filtering the visible view.',
          params: {},
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'widget.undoView',
      title: 'Undo widget view',
      description: 'Restore the target widget view from the previous runtime state snapshot.',
      category: 'view',
      scope,
      supportedWidgetKinds,
      targetRef: widgetRef,
      affectedRefs,
      affectedStatePaths: affectedRefs.flatMap(() => ['view', 'transforms', 'selections', 'feedback']),
      paramsSchema: {
        type: 'object',
        properties: {},
      },
      postconditions: [
        {
          description: 'The target widget should render using the previous runtime view state.',
        },
      ],
      preconditions: [
        {
          description: 'A previous runtime state snapshot exists.',
          failureMessage: 'No prior runtime state is available to restore.',
        },
      ],
      effects: [
        makeEncodingEffect(widgetRef, 'Restores the target widget view state from runtime history.'),
      ],
      examples: [
        {
          userGoal: 'Undo the last zoom or view change on this widget.',
          params: {},
        },
      ],
      reversible: false,
    }),
    makeActionDescriptor({
      name: 'workspace.jumpToState',
      title: 'Jump to previous state',
      description: 'Restore the workspace interaction state from a previously recorded state snapshot.',
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
          userGoal: 'Move analytical attention from the overview chart to the focused detail view.',
          params: {},
        },
      ],
      reversible: true,
    }),
    makeActionDescriptor({
      name: 'workspace.branchFromState',
      title: 'Branch from previous state',
      description: 'Create a new branch from a previously recorded state snapshot and restore that interaction state.',
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
        name: 'widget.aggregateData',
        title: 'Aggregate current data view',
        description: 'Apply or replace an aggregate transform on the current base specification to produce grouped summary rows.',
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
        name: 'widget.changeEncoding',
        title: 'Change visual encoding',
        description: 'Rebind a widget encoding channel to a different field in the current base specification.',
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
    )
  }

  const capabilityKinds = readCapabilityKinds(widgetKind, widgetSpec, widgetDef)
  const familyDescriptors = capabilityKinds.length > 1
    ? mergeDescriptorsByName(capabilityKinds.flatMap((kind) => {
        return buildFamilyActionDescriptors(kind, {
          widgetRef,
          selectionRef,
          widgetSpec,
          widgetKind: kind,
          scope,
          affectedRefs,
        })
      }))
    : buildFamilyActionDescriptors(capabilityKinds[0] || widgetKind, {
        widgetRef,
        selectionRef,
        widgetSpec,
        widgetKind: capabilityKinds[0] || widgetKind,
        scope,
        affectedRefs,
      })

  descriptors.unshift(...familyDescriptors.map((descriptor) => withSupportedWidgetKinds(descriptor, supportedWidgetKinds)))

  return filterDescriptorsByAllowedNames(
    descriptors,
    readAllowedDescriptorNames(widgetDef, ['exposedActionNames']),
  )
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
      name: 'perception.inspectSelection',
      title: 'Inspect current selection',
      description: 'Return the active selection payload, predicates, and selected-row count for the current widget or shared current_selection view.',
      category: 'inspect',
      targetRef: currentSelectionDataRef,
      paramsSchema: {
        type: 'object',
        properties: {},
      },
      sideEffectFree: true,
      evidenceKinds: ['selectionState', 'selectionPredicates', 'selectionRows'],
      verificationTargets: ['shared.selections.registry'],
      examples: [
        {
          userGoal: 'Inspect which selection is currently active before deciding the next action.',
          params: {},
        },
        {
          userGoal: 'Inspect one specific selection when multiple active selections are present.',
          params: {
            queryScope: {
              dataRef: currentSelectionDataRef,
              selectionRef: sampleSelectionRef,
            },
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

  const capabilityKinds = readCapabilityKinds(widgetKind, widgetSpec, widgetDef)
  const familyPerceptions = capabilityKinds.length > 1
    ? mergeDescriptorsByName(capabilityKinds.flatMap((kind) => {
        return buildFamilyPerceptionDescriptors(kind, {
          widgetRef,
          dataRef,
          widgetKind: kind,
          widgetDef,
          widgetSpec,
        })
      }))
    : buildFamilyPerceptionDescriptors(capabilityKinds[0] || widgetKind, {
        widgetRef,
        dataRef,
        widgetKind: capabilityKinds[0] || widgetKind,
        widgetDef,
        widgetSpec,
      })

  descriptors.push(...familyPerceptions)

  return filterDescriptorsByAllowedNames(
    descriptors,
    readAllowedDescriptorNames(widgetDef, ['exposedPerceptionNames']),
  )
}
