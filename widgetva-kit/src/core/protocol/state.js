import { describeRuntimeActorSchema } from './actors.js'
import { describeRefSchema } from './refs.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export const SELECTION_KINDS = ['interval', 'point', 'category', 'cell']
export const ENCODING_TYPES = ['quantitative', 'nominal', 'ordinal', 'temporal', 'geo']
export const TRANSFORM_KINDS = ['filter', 'sort', 'aggregate', 'derive', 'sample', 'syncDomain', 'highlight']
export const SELECTION_PREDICATE_OPERATIONS = ['equals', 'in', 'between']

export function makeFieldEncoding(encoding) {
  return {
    field: '',
    type: 'nominal',
    aggregate: undefined,
    bin: undefined,
    scale: undefined,
    ...encoding,
  }
}

export function makeTransformState(transform) {
  return {
    kind: 'derive',
    source: undefined,
    sourceWidgetId: undefined,
    sourceSelectionRef: undefined,
    linkId: undefined,
    spec: {},
    ...transform,
  }
}

export function makeViewTransformState(view) {
  return {
    xDomain: undefined,
    yDomain: undefined,
    zoom: undefined,
    sort: undefined,
    highlight: undefined,
    drillDown: undefined,
    aggregate: undefined,
    reencode: undefined,
    annotate: undefined,
    addRemove: undefined,
    navigate: undefined,
    ...view,
  }
}

export function makeViewportState(viewport) {
  return {
    sourceWidgetRef: null,
    xDomain: null,
    yDomain: null,
    zoom: null,
    ...viewport,
  }
}

export function makeFocusState(focus) {
  return {
    widgetRef: null,
    widgetId: null,
    source: 'workspace',
    ...focus,
  }
}

export function makeHighlightState(highlight) {
  return {
    entries: [],
    activeWidgetRefs: [],
    ...highlight,
  }
}

export function makeSelectionState(selection) {
  return {
    selectionRef: null,
    selectionId: null,
    kind: 'interval',
    sourceWidgetRef: null,
    sourceWidgetId: null,
    scope: 'local',
    selectionDataRef: null,
    fields: [],
    value: {},
    domain: null,
    predicates: [],
    summary: '',
    aggregateName: null,
    ...selection,
  }
}

export function makeInteractionFeedbackState(feedback) {
  return {
    hoveredItem: undefined,
    highlightedKeys: [],
    tooltip: undefined,
    inboundLinkIds: [],
    highlightLinkIds: [],
    linkedSourceRefs: [],
    sharedSelectionSourceWidgetId: undefined,
    ...feedback,
  }
}

export function makeWorkspaceAnnotation(annotation) {
  return {
    annotationId: '',
    targetRef: undefined,
    kind: 'note',
    text: '',
    actor: 'agent',
    createdAt: new Date().toISOString(),
    ...annotation,
  }
}

export function makeWidgetState(state) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    ...state,
    data: {
      sourceDataRef: null,
      currentDataRef: null,
      rowCount: 0,
      visibleCount: 0,
      selectedCount: 0,
      ...(state?.data || {}),
    },
    encodings: { ...(state?.encodings || {}) },
    transforms: Array.isArray(state?.transforms) ? state.transforms.map((item) => makeTransformState(item)) : [],
    view: makeViewTransformState(state?.view),
    selections: Object.fromEntries(
      Object.entries(state?.selections || {}).map(([ref, selection]) => [ref, makeSelectionState(selection)]),
    ),
    feedback: makeInteractionFeedbackState(state?.feedback),
    humanInteraction: state?.humanInteraction || undefined,
  }
}

export function makeWorkspaceState(state) {
  return {
    stateId: 'main:empty',
    createdAt: new Date().toISOString(),
    widgets: {},
    shared: {
      selections: {
        registry: {},
        views: {
          primary: null,
          byWidget: {},
        },
      },
      focus: null,
      highlight: null,
      viewport: null,
      globalFilters: {},
      focusedWidget: undefined,
      annotations: [],
      links: {
        definitions: [],
        topology: {},
      },
      ...(state?.shared || {}),
    },
    taskContext: state?.taskContext || undefined,
    replayContext: state?.replayContext || undefined,
    delta: state?.delta || undefined,
    ...state,
  }
}

export function describeFieldEncodingSchema() {
  return cloneValue({
    type: 'object',
    required: ['field', 'type'],
    properties: {
      field: { type: 'string' },
      type: { type: 'string', enum: ENCODING_TYPES },
      aggregate: { type: ['string', 'null'] },
      bin: { type: ['boolean', 'null'] },
      scale: {
        anyOf: [describeFieldScaleSchema(), { type: 'null' }],
      },
    },
  })
}

export function describeFieldScaleSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      domain: {},
      range: {},
      clamp: { type: 'boolean' },
      nice: { type: 'boolean' },
      zero: { type: 'boolean' },
      type: { type: 'string' },
    },
  })
}

export function describeSelectionDomainAxisSchema() {
  return cloneValue({
    type: 'array',
    minItems: 2,
    maxItems: 2,
    items: {
      anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }],
    },
  })
}

export function describeViewportStateSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      sourceWidgetRef: { type: ['string', 'null'] },
      xDomain: {
        anyOf: [describeSelectionDomainAxisSchema(), { type: 'null' }],
      },
      yDomain: {
        anyOf: [describeSelectionDomainAxisSchema(), { type: 'null' }],
      },
      zoom: {
        anyOf: [{
          type: 'object',
          properties: {
            level: { type: 'number' },
            center: {
              type: 'array',
              items: { type: 'number' },
            },
          },
        }, { type: 'null' }],
      },
    },
  })
}

export function describeFocusStateSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      widgetRef: { type: ['string', 'null'] },
      widgetId: { type: ['string', 'null'] },
      source: { type: 'string' },
    },
  })
}

export function describeHighlightStateSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            widgetRef: { type: ['string', 'null'] },
            widgetId: { type: ['string', 'null'] },
            highlightedKeys: { type: 'array', items: {} },
            inboundLinkIds: { type: 'array', items: { type: 'string' } },
            highlightLinkIds: { type: 'array', items: { type: 'string' } },
            linkedSourceRefs: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      activeWidgetRefs: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  })
}

export function describeSelectionDomainSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      xDomain: describeSelectionDomainAxisSchema(),
      yDomain: describeSelectionDomainAxisSchema(),
    },
  })
}

export function describeSelectionPredicateSchema() {
  return cloneValue({
    type: 'object',
    required: ['field', 'op'],
    properties: {
      field: { type: 'string' },
      op: { type: 'string', enum: SELECTION_PREDICATE_OPERATIONS },
      value: {},
    },
  })
}

export function describeSelectionValueSchema() {
  return cloneValue({
    type: 'object',
  })
}

export function describeTransformStateSchema() {
  return cloneValue({
    type: 'object',
    required: ['kind', 'spec'],
    properties: {
      kind: { type: 'string', enum: TRANSFORM_KINDS },
      source: { type: ['string', 'null'] },
      sourceWidgetId: { type: ['string', 'null'] },
      sourceSelectionRef: { type: ['string', 'null'] },
      linkId: { type: ['string', 'null'] },
      spec: { type: 'object' },
    },
  })
}

export function describeViewZoomSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      level: { type: 'number' },
      center: {
        type: 'array',
        minItems: 2,
        maxItems: 2,
        items: { type: 'number' },
      },
    },
  })
}

export function describeViewSortSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      field: { type: 'string' },
      order: { type: 'string', enum: ['ascending', 'descending'] },
    },
  })
}

export function describeViewTransformStateSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      xDomain: {
        anyOf: [
          describeSelectionDomainAxisSchema(),
          {
            type: 'array',
            items: {
              anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }],
            },
          },
          { type: 'null' },
        ],
      },
      yDomain: {
        anyOf: [
          describeSelectionDomainAxisSchema(),
          {
            type: 'array',
            items: {
              anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }],
            },
          },
          { type: 'null' },
        ],
      },
      zoom: {
        anyOf: [describeViewZoomSchema(), { type: 'null' }],
      },
      sort: {
        anyOf: [describeViewSortSchema(), { type: 'null' }],
      },
    },
  })
}

export function describeSelectionStateSchema() {
  return cloneValue({
    type: 'object',
    required: ['kind'],
    properties: {
      selectionRef: { type: ['string', 'null'] },
      selectionId: { type: ['string', 'null'] },
      kind: { type: 'string', enum: SELECTION_KINDS },
      sourceWidgetRef: { type: ['string', 'null'] },
      sourceWidgetId: { type: ['string', 'null'] },
      scope: { type: 'string' },
      selectionDataRef: { type: ['string', 'null'] },
      fields: { type: 'array', items: { type: 'string' } },
      value: describeSelectionValueSchema(),
      domain: {
        anyOf: [describeSelectionDomainSchema(), { type: 'null' }],
      },
      predicates: { type: 'array', items: describeSelectionPredicateSchema() },
      summary: { type: 'string' },
      keyField: { type: 'string' },
      keys: { type: 'array', items: { type: ['string', 'number'] } },
      field: { type: 'string' },
      values: { type: 'array', items: { type: ['string', 'number'] } },
    },
  })
}

export function describeInteractionTooltipSchema() {
  return cloneValue({
    type: ['object', 'null'],
  })
}

export function describeInteractionHoveredItemSchema() {
  return cloneValue({
    type: ['object', 'null'],
  })
}

export function describeInteractionFeedbackStateSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      hoveredItem: describeInteractionHoveredItemSchema(),
      highlightedKeys: { type: 'array', items: { type: ['string', 'number'] } },
      tooltip: describeInteractionTooltipSchema(),
      inboundLinkIds: { type: 'array', items: { type: 'string' } },
      highlightLinkIds: { type: 'array', items: { type: 'string' } },
      linkedSourceRefs: { type: 'array', items: { type: 'string' } },
      sharedSelectionSourceWidgetId: { type: ['string', 'null'] },
    },
  })
}

export function describeWidgetHumanInteractionStateSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      mode: { type: 'string' },
      actionName: { type: ['string', 'null'] },
      supportsDirectManipulation: { type: 'boolean' },
    },
  })
}

export function describeWidgetDataStateSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      sourceDataRef: { type: ['string', 'null'] },
      currentDataRef: { type: ['string', 'null'] },
      rowCount: { type: 'number' },
      visibleCount: { type: 'number' },
      selectedCount: { type: 'number' },
    },
  })
}

export function describeWorkspaceAnnotationSchema() {
  return cloneValue({
    type: 'object',
    required: ['annotationId', 'kind', 'text', 'actor', 'createdAt'],
    properties: {
      annotationId: { type: 'string' },
      targetRef: { type: ['string', 'null'] },
      kind: { type: 'string' },
      text: { type: 'string' },
      actor: describeRuntimeActorSchema(),
      createdAt: { type: 'string' },
    },
  })
}

export function describeWidgetEncodingsStateSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: describeFieldEncodingSchema(),
  })
}

export function describeWidgetSelectionsStateSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: describeSelectionStateSchema(),
  })
}

export function describeWidgetStateSchema() {
  return cloneValue({
    type: 'object',
    required: ['version', 'updatedAt', 'data', 'encodings', 'transforms', 'view', 'selections'],
    properties: {
      ref: { type: 'string' },
      widgetId: { type: 'string' },
      kind: { type: 'string' },
      role: { type: 'string' },
      version: { type: 'integer' },
      updatedAt: { type: 'string' },
      data: describeWidgetDataStateSchema(),
      encodings: describeWidgetEncodingsStateSchema(),
      transforms: {
        type: 'array',
        items: describeTransformStateSchema(),
      },
      view: describeViewTransformStateSchema(),
      selections: describeWidgetSelectionsStateSchema(),
      feedback: describeInteractionFeedbackStateSchema(),
      humanInteraction: {
        anyOf: [describeWidgetHumanInteractionStateSchema(), { type: 'null' }],
      },
      rawSpec: { type: ['object', 'null'] },
    },
  })
}

export function describeWorkspaceTaskContextSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      userQuery: { type: 'string' },
      taskMode: { type: 'string' },
      runMode: { type: 'string' },
      coordinationScope: { type: 'string' },
      expectedAnswerType: { type: 'string' },
      interactionHorizon: { type: 'string' },
      evidenceType: { type: 'string' },
      complexityBudget: { type: 'string' },
      targetWidgetRefs: { type: 'array', items: describeRefSchema() },
    },
  })
}

export function describeWorkspaceReplayContextSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      baselineSpec: { type: ['object', 'null'] },
      currentSpec: { type: ['object', 'null'] },
      workspaceSpec: { type: ['object', 'null'] },
      planningRequest: { type: ['object', 'null'] },
      userIntent: { type: ['string', 'null'] },
      runMode: { type: ['string', 'null'] },
    },
  })
}

export function describeWorkspaceDeltaSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      baseStateId: { type: 'string' },
      changedRefs: { type: 'array', items: { type: 'string' } },
      removedRefs: { type: 'array', items: { type: 'string' } },
    },
  })
}

export function describeWorkspaceSharedStateSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      selections: {
        type: 'object',
        properties: {
          registry: {
            type: 'object',
            additionalProperties: describeSelectionStateSchema(),
          },
          views: {
            type: 'object',
            properties: {
              primary: {
                anyOf: [describeSelectionStateSchema(), { type: 'null' }],
              },
              byWidget: {
                type: 'object',
                additionalProperties: describeSelectionStateSchema(),
              },
            },
          },
        },
      },
      globalFilters: {
        type: 'object',
        additionalProperties: {
          type: 'array',
          items: describeSelectionPredicateSchema(),
        },
      },
      viewport: {
        anyOf: [describeViewportStateSchema(), { type: 'null' }],
      },
      focus: {
        anyOf: [describeFocusStateSchema(), { type: 'null' }],
      },
      highlight: {
        anyOf: [describeHighlightStateSchema(), { type: 'null' }],
      },
      focusedWidget: {
        anyOf: [describeRefSchema(), { type: 'null' }],
      },
      annotations: { type: 'array', items: describeWorkspaceAnnotationSchema() },
      links: {
        type: 'object',
        properties: {
          definitions: {
            type: 'array',
            items: { type: 'object' },
          },
          topology: {
            type: 'object',
          },
        },
      },
    },
  })
}

export function describeWorkspaceStateSchema() {
  return cloneValue({
    type: 'object',
    required: ['stateId', 'createdAt', 'widgets', 'shared'],
    properties: {
      stateId: { type: 'string' },
      createdAt: { type: 'string' },
      widgets: {
        type: 'object',
        additionalProperties: describeWidgetStateSchema(),
      },
      shared: describeWorkspaceSharedStateSchema(),
      taskContext: {
        anyOf: [describeWorkspaceTaskContextSchema(), { type: 'null' }],
      },
      replayContext: {
        anyOf: [describeWorkspaceReplayContextSchema(), { type: 'null' }],
      },
      delta: {
        anyOf: [describeWorkspaceDeltaSchema(), { type: 'null' }],
      },
    },
  })
}
