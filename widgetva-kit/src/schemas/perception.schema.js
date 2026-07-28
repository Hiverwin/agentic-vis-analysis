import { RUNTIME_ACTOR_SCHEMA } from './actors.schema.js'
import {
  DATA_QUERY_RESULT_SCHEMAS,
} from './data-handles.schema.js'
import { QUERY_SCOPE_SCHEMA } from './query-scope.schema.js'

const PERCEPTION_TARGET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['widgetRef'],
  properties: {
    widgetRef: { type: 'string' },
  },
}

const ENCODING_TYPES = ['quantitative', 'nominal', 'ordinal', 'temporal', 'geo']
const TRANSFORM_KINDS = ['filter', 'sort', 'aggregate', 'derive', 'sample', 'syncDomain', 'highlight']
const SELECTION_KINDS = ['interval', 'point', 'category', 'cell']
const SELECTION_PREDICATE_OPERATIONS = ['equals', 'in', 'between']

const PERCEPTION_FIELD_SCALE_SCHEMA = {
  type: 'object',
  properties: {
    domain: {},
    range: {},
    clamp: { type: 'boolean' },
    nice: { type: 'boolean' },
    zero: { type: 'boolean' },
    type: { type: 'string' },
  },
}

const FIELD_ENCODING_SCHEMA = {
  type: 'object',
  required: ['field', 'type'],
  properties: {
    field: { type: 'string' },
    type: { type: 'string', enum: ENCODING_TYPES },
    aggregate: { type: ['string', 'null'] },
    bin: { type: ['boolean', 'null'] },
    scale: {
      anyOf: [PERCEPTION_FIELD_SCALE_SCHEMA, { type: 'null' }],
    },
  },
}

const PERCEPTION_SELECTION_DOMAIN_AXIS_SCHEMA = {
  type: 'array',
  minItems: 2,
  maxItems: 2,
  items: {
    anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }],
  },
}

const PERCEPTION_SELECTION_DOMAIN_SCHEMA = {
  type: 'object',
  properties: {
    xDomain: PERCEPTION_SELECTION_DOMAIN_AXIS_SCHEMA,
    yDomain: PERCEPTION_SELECTION_DOMAIN_AXIS_SCHEMA,
  },
}

const PERCEPTION_SELECTION_PREDICATE_SCHEMA = {
  type: 'object',
  required: ['field', 'op'],
  properties: {
    field: { type: 'string' },
    op: { type: 'string', enum: SELECTION_PREDICATE_OPERATIONS },
    value: {},
  },
}

const TRANSFORM_STATE_SCHEMA = {
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
}

const PERCEPTION_VIEW_ZOOM_SCHEMA = {
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
}

const PERCEPTION_VIEW_SORT_SCHEMA = {
  type: 'object',
  properties: {
    field: { type: 'string' },
    order: { type: 'string', enum: ['ascending', 'descending'] },
  },
}

const VIEW_TRANSFORM_STATE_SCHEMA = {
  type: 'object',
  properties: {
    xDomain: {
      anyOf: [
        PERCEPTION_SELECTION_DOMAIN_AXIS_SCHEMA,
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
        PERCEPTION_SELECTION_DOMAIN_AXIS_SCHEMA,
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
      anyOf: [PERCEPTION_VIEW_ZOOM_SCHEMA, { type: 'null' }],
    },
    sort: {
      anyOf: [PERCEPTION_VIEW_SORT_SCHEMA, { type: 'null' }],
    },
  },
}

const SELECTION_STATE_SCHEMA = {
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
    value: { type: 'object' },
    domain: {
      anyOf: [PERCEPTION_SELECTION_DOMAIN_SCHEMA, { type: 'null' }],
    },
    predicates: { type: 'array', items: PERCEPTION_SELECTION_PREDICATE_SCHEMA },
    summary: { type: 'string' },
    keyField: { type: 'string' },
    keys: { type: 'array', items: { type: ['string', 'number'] } },
    field: { type: 'string' },
    values: { type: 'array', items: { type: ['string', 'number'] } },
  },
}

const INTERACTION_FEEDBACK_STATE_SCHEMA = {
  type: 'object',
  properties: {
    hoveredItem: { type: ['object', 'null'] },
    highlightedKeys: { type: 'array', items: { type: ['string', 'number'] } },
    tooltip: { type: ['object', 'null'] },
    inboundLinkIds: { type: 'array', items: { type: 'string' } },
    highlightLinkIds: { type: 'array', items: { type: 'string' } },
    linkedSourceRefs: { type: 'array', items: { type: 'string' } },
    sharedSelectionSourceWidgetId: { type: ['string', 'null'] },
  },
}

const PERCEPTION_CATEGORIES = [
  'inspect',
  'summarize',
  'compute',
  'verify',
  'explain',
]

const PERCEPTION_CATEGORY_SCHEMA = {
  type: 'string',
  enum: PERCEPTION_CATEGORIES,
}

const PERCEPTION_INSPECT_VIEW_CONFIG_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    ref: { type: ['string', 'null'] },
    kind: { type: ['string', 'null'] },
    encodings: { type: 'object', additionalProperties: FIELD_ENCODING_SCHEMA },
    transforms: { type: 'array', items: TRANSFORM_STATE_SCHEMA },
    view: VIEW_TRANSFORM_STATE_SCHEMA,
    selections: { type: 'object', additionalProperties: SELECTION_STATE_SCHEMA },
    feedback: {
      anyOf: [INTERACTION_FEEDBACK_STATE_SCHEMA, { type: 'null' }],
    },
  },
}

const PERCEPTION_INSPECT_VISIBLE_ROWS_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    ref: { type: ['string', 'null'] },
    dataRef: { type: ['string', 'null'] },
    visibleCount: { type: 'integer' },
    rows: DATA_QUERY_RESULT_SCHEMAS.sampleRows,
  },
}

const PERCEPTION_SUMMARY_GROUPS_SCHEMA = {
  type: 'array',
  items: DATA_QUERY_RESULT_SCHEMAS.summary.properties.rows.items,
}

const PERCEPTION_SUMMARIZE_SELECTION_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    hasSelection: { type: 'boolean' },
    selectionCount: { type: 'integer' },
    selectionRefs: { type: 'array', items: { type: 'string' } },
    dataRef: { type: ['string', 'null'] },
    selectedCount: { type: 'integer' },
    summary: { type: 'string' },
    selectionSummaries: { type: 'array', items: { type: 'string' } },
    groups: PERCEPTION_SUMMARY_GROUPS_SCHEMA,
    aggregates: PERCEPTION_SUMMARY_GROUPS_SCHEMA,
    predicates: { type: 'array', items: { type: 'object' } },
    selectionPredicates: {
      type: 'array',
      items: {
        type: 'array',
        items: { type: 'object' },
      },
    },
  },
}

const PERCEPTION_SUMMARIZE_VISIBLE_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    dataRef: { type: ['string', 'null'] },
    rowCount: { type: 'integer' },
    groups: PERCEPTION_SUMMARY_GROUPS_SCHEMA,
    aggregates: PERCEPTION_SUMMARY_GROUPS_SCHEMA,
    summary: { type: ['string', 'null'] },
  },
}

const PERCEPTION_VERIFY_ACTION_EFFECT_PARAMS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    actionName: { type: 'string' },
    stateId: { type: 'string' },
    refs: { type: 'array', items: { type: 'string' } },
  },
}

const PERCEPTION_VERIFY_ACTION_EFFECT_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    verified: { type: 'boolean' },
    matchedStateId: { type: ['string', 'null'] },
    matchedActionName: { type: ['string', 'null'] },
    affectedRefs: { type: 'array', items: { type: 'string' } },
    missingRefs: { type: 'array', items: { type: 'string' } },
    expectedPostconditions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          checkHint: { type: 'string' },
          failureMessage: { type: 'string' },
        },
      },
    },
    verificationHints: { type: 'array', items: { type: 'string' } },
    traceEvidence: {
      anyOf: [
        { type: 'null' },
        { type: 'object' },
      ],
    },
    statePatch: { type: ['object', 'null'] },
    finalSnapshot: {
      anyOf: [
        { type: 'null' },
        { type: 'object' },
      ],
    },
    linkPropagation: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          sourceRef: { type: ['string', 'null'] },
          linkCount: { type: 'integer' },
          passedCount: { type: 'integer' },
          consistencyScore: { type: 'number' },
          results: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
    },
    semanticVerification: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            kind: { type: 'string' },
            summary: { type: 'string' },
            expected: { type: 'object', additionalProperties: true },
            actual: {
              anyOf: [
                { type: 'null' },
                { type: 'object', additionalProperties: true },
              ],
            },
          },
        },
      ],
    },
  },
}

const PERCEPTION_RETURN_SCHEMAS = {
  'perception.inspectViewConfig': PERCEPTION_INSPECT_VIEW_CONFIG_RESULT_SCHEMA,
  'perception.inspectVisibleRows': PERCEPTION_INSPECT_VISIBLE_ROWS_RESULT_SCHEMA,
  'perception.summarizeSelection': PERCEPTION_SUMMARIZE_SELECTION_RESULT_SCHEMA,
  'perception.summarizeVisible': PERCEPTION_SUMMARIZE_VISIBLE_RESULT_SCHEMA,
  'perception.verifyActionEffect': PERCEPTION_VERIFY_ACTION_EFFECT_RESULT_SCHEMA,
  'perception.computeCorrelation': {
    type: 'object',
    properties: {
      dataRef: { type: ['string', 'null'] },
      xField: { type: 'string' },
      yField: { type: 'string' },
      correlation: { type: ['number', 'null'] },
      sampleSize: { type: 'integer' },
    },
  },
  'perception.findExtremes': {
    type: 'object',
    properties: {
      dataRef: { type: ['string', 'null'] },
      field: { type: ['string', 'null'] },
      direction: { type: 'string' },
      rows: DATA_QUERY_RESULT_SCHEMAS.sampleRows,
    },
  },
  'perception.findOutliers': {
    type: 'object',
    properties: {
      dataRef: { type: ['string', 'null'] },
      field: { type: ['string', 'null'] },
      method: { type: 'string' },
      rows: DATA_QUERY_RESULT_SCHEMAS.sampleRows,
    },
  },
  'perception.compareGroups': {
    type: 'object',
    properties: {
      dataRef: { type: ['string', 'null'] },
      groupField: { type: ['string', 'null'] },
      valueField: { type: ['string', 'null'] },
      groups: DATA_QUERY_RESULT_SCHEMAS.compareGroups.properties.groups,
      comparison: DATA_QUERY_RESULT_SCHEMAS.compareGroups.properties.comparison,
    },
  },
}

export function readPerceptionParamsSchema(queryName) {
  if (queryName === 'perception.verifyActionEffect') {
    return PERCEPTION_VERIFY_ACTION_EFFECT_PARAMS_SCHEMA
  }
  return undefined
}

export function readPerceptionReturnsSchema(queryName) {
  return queryName ? PERCEPTION_RETURN_SCHEMAS[queryName] : undefined
}

const PERCEPTION_EXAMPLE_SCHEMA = {
  type: 'object',
  properties: {
    userGoal: { type: 'string' },
    params: { type: 'object' },
  },
}

const PERCEPTION_DESCRIPTOR_SCHEMA = {
  type: 'object',
  required: ['name', 'title', 'description', 'category'],
  properties: {
    name: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    category: PERCEPTION_CATEGORY_SCHEMA,
    targetRef: { type: ['string', 'null'] },
    paramsSchema: { type: 'object' },
    returnsSchema: { type: ['object', 'null'] },
    sideEffectFree: { type: 'boolean' },
    evidenceKinds: { type: 'array', items: { type: 'string' } },
    verificationTargets: { type: 'array', items: { type: 'string' } },
    examples: { type: 'array', items: PERCEPTION_EXAMPLE_SCHEMA },
  },
}

export const PERCEPTION_QUERY_CALL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    callId: { type: 'string' },
    name: { type: 'string' },
    actor: RUNTIME_ACTOR_SCHEMA,
    target: PERCEPTION_TARGET_SCHEMA,
    queryScope: QUERY_SCOPE_SCHEMA,
    params: { type: 'object' },
  },
}
