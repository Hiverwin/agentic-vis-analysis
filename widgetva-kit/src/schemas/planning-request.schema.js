import {
  WORKSPACE_PLANNING_BUDGETS,
  WORKSPACE_PLANNING_RUN_MODES,
  WORKSPACE_PLANNING_TOPOLOGIES,
} from './planning-constants.schema.js'

const WORKSPACE_PLANNING_TASK_FAMILIES = [
  'lookup',
  'filter',
  'compare',
  'rank',
  'distribution',
  'correlation',
  'outlier',
  'cluster',
  'trend',
  'flow',
  'multiViewCoordination',
  'drillDown',
]

const WORKSPACE_PLANNING_ANSWER_TYPES = ['exact', 'bounded', 'exploratory']
const WORKSPACE_PLANNING_INTERACTION_HORIZONS = ['single_step', 'multi_step']
const WORKSPACE_PLANNING_COORDINATION_SCOPES = ['single_widget', 'multi_widget', 'workspace']
const WORKSPACE_PLANNING_EVIDENCE_TYPES = ['initial_view', 'interaction_revealed', 'cross_widget']

const WORKSPACE_PLANNING_DATA_FIELD_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    type: { type: 'string' },
    nullable: { type: 'boolean' },
    description: { type: 'string' },
  },
}

const WORKSPACE_PLANNING_DATASET_SCHEMA = {
  type: 'object',
  properties: {
    fields: {
      type: 'array',
      items: WORKSPACE_PLANNING_DATA_FIELD_SCHEMA,
    },
  },
}

const WORKSPACE_PLANNING_TASK_SCHEMA = {
  type: 'object',
  properties: {
    taskId: { type: 'string' },
    userQuery: { type: 'string' },
    taskMode: { type: 'string' },
    taskFamily: { type: 'string', enum: WORKSPACE_PLANNING_TASK_FAMILIES },
    answerType: { type: 'string', enum: WORKSPACE_PLANNING_ANSWER_TYPES },
    expectedAnswerType: { type: 'string', enum: WORKSPACE_PLANNING_ANSWER_TYPES },
    interactionHorizon: { type: 'string', enum: WORKSPACE_PLANNING_INTERACTION_HORIZONS },
    coordinationScope: { type: 'string', enum: WORKSPACE_PLANNING_COORDINATION_SCOPES },
    evidenceType: { type: 'string', enum: WORKSPACE_PLANNING_EVIDENCE_TYPES },
    targetWidgetRefs: { type: 'array', items: { type: 'string' } },
  },
}

const WORKSPACE_WIDGET_PLAN_SOURCE_SCHEMA = {
  type: 'object',
  required: ['kind'],
  properties: {
    kind: { type: 'string' },
    spec: { type: 'object' },
    title: { type: 'string' },
  },
}

const WORKSPACE_WIDGET_PLAN_METRIC_SCHEMA = {
  type: 'object',
  properties: {
    field: { type: 'string' },
    op: { type: 'string' },
    as: { type: 'string' },
  },
}

const WORKSPACE_WIDGET_PLAN_SORT_SCHEMA = {
  type: 'object',
  properties: {
    field: { type: 'string' },
    order: { type: 'string' },
  },
}

const WORKSPACE_WIDGET_PLAN_TRANSFORM_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string' },
    groupBy: { type: 'array', items: { type: 'string' } },
    metrics: { type: 'array', items: WORKSPACE_WIDGET_PLAN_METRIC_SCHEMA },
    sortBy: {
      anyOf: [WORKSPACE_WIDGET_PLAN_SORT_SCHEMA, { type: 'null' }],
    },
  },
}

const WORKSPACE_WIDGET_DATA_BINDING_SCHEMA = {
  type: 'object',
  properties: {
    sourceWidgetId: { type: 'string' },
    transforms: {
      type: 'array',
      items: WORKSPACE_WIDGET_PLAN_TRANSFORM_SCHEMA,
    },
  },
}

const WORKSPACE_LINK_FIELD_MAPPING_SCHEMA = {
  type: 'object',
  properties: {
    sourceField: { type: 'string' },
    targetField: { type: 'string' },
  },
}

const WORKSPACE_WIDGET_PLAN_SCHEMA = {
  type: 'object',
  required: ['widgetId', 'role', 'source'],
  properties: {
    widgetId: { type: 'string' },
    role: { type: 'string' },
    kind: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    source: WORKSPACE_WIDGET_PLAN_SOURCE_SCHEMA,
    dataBinding: WORKSPACE_WIDGET_DATA_BINDING_SCHEMA,
    analyticRoles: { type: 'array', items: { type: 'string' } },
  },
}

const WORKSPACE_LINK_RESPONSE_SPEC_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string' },
    params: { type: 'object' },
    verificationHints: { type: 'object' },
  },
}

const WORKSPACE_LINK_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    linkId: { type: 'string' },
    sourceWidgetId: { type: 'string' },
    targetWidgetId: { type: 'string' },
    kind: { type: ['string', 'null'] },
    effect: { type: ['string', 'null'] },
    activationPolicy: { type: 'string' },
    effectConstraint: { type: ['string', 'null'] },
    responseSpec: WORKSPACE_LINK_RESPONSE_SPEC_SCHEMA,
    description: { type: 'string' },
    fieldMapping: {
      type: 'array',
      items: WORKSPACE_LINK_FIELD_MAPPING_SCHEMA,
    },
  },
}

export const WORKSPACE_PLANNING_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    task: {
      anyOf: [
        { type: 'null' },
        WORKSPACE_PLANNING_TASK_SCHEMA,
      ],
    },
    datasetSchema: {
      anyOf: [
        { type: 'null' },
        WORKSPACE_PLANNING_DATASET_SCHEMA,
      ],
    },
    userIntent: { type: ['string', 'null'] },
    runMode: { type: 'string', enum: WORKSPACE_PLANNING_RUN_MODES },
    complexityBudget: { type: 'string', enum: WORKSPACE_PLANNING_BUDGETS },
    preferredTopology: { type: ['string', 'null'], enum: [...WORKSPACE_PLANNING_TOPOLOGIES, null] },
  },
}
