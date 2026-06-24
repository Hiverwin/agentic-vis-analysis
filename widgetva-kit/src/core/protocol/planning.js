import { makeWidgetLink, stripWidgetLinkCompatibilityFields } from './widgetLinks.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function makeWorkspacePlanningDataField(field = {}) {
  return {
    name: '',
    type: '',
    ...field,
  }
}

function makeWorkspacePlanningDatasetSchema(schema = {}) {
  return {
    fields: Array.isArray(schema?.fields)
      ? schema.fields.map((field) => makeWorkspacePlanningDataField(field))
      : [],
    ...schema,
    fields: Array.isArray(schema?.fields)
      ? schema.fields.map((field) => makeWorkspacePlanningDataField(field))
      : [],
  }
}

export const WORKSPACE_PLANNING_TOPOLOGIES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']
export const WORKSPACE_PLANNING_BUDGETS = ['minimal', 'standard', 'extended']
export const WORKSPACE_PLANNING_RUN_MODES = ['goal_oriented', 'open_ended', 'autonomous']
export const WORKSPACE_PLANNING_TASK_FAMILIES = [
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
export const WORKSPACE_PLANNING_ANSWER_TYPES = ['exact', 'bounded', 'exploratory']
export const WORKSPACE_PLANNING_INTERACTION_HORIZONS = ['single_step', 'multi_step']
export const WORKSPACE_PLANNING_COORDINATION_SCOPES = ['single_widget', 'multi_widget', 'workspace']
export const WORKSPACE_PLANNING_EVIDENCE_TYPES = ['initial_view', 'interaction_revealed', 'cross_widget']

export const WORKSPACE_PLAN_SOURCES = ['planner', 'runtime_default', 'workspace_spec']
export const WORKSPACE_PLAN_MODES = ['topology_driven', 'minimal_default', 'explicit_spec']

export function makeWorkspacePlanningTask(task = {}) {
  return {
    taskId: null,
    userQuery: null,
    taskMode: null,
    taskFamily: null,
    answerType: null,
    expectedAnswerType: null,
    interactionHorizon: null,
    coordinationScope: null,
    evidenceType: null,
    targetWidgetRefs: [],
    ...task,
  }
}

export function makeWorkspaceWidgetPlanSource(source = {}) {
  return {
    kind: 'baseSpec',
    spec: null,
    title: null,
    ...source,
  }
}

export function makeWorkspaceWidgetPlanMetric(metric = {}) {
  return {
    field: '',
    op: '',
    as: '',
    ...metric,
  }
}

export function makeWorkspaceWidgetPlanSort(sort = {}) {
  return {
    field: '',
    order: 'descending',
    ...sort,
  }
}

export function makeWorkspaceWidgetPlanTransform(transform = {}) {
  return {
    kind: '',
    groupBy: [],
    metrics: [],
    sortBy: null,
    ...transform,
    metrics: Array.isArray(transform?.metrics)
      ? transform.metrics.map((metric) => makeWorkspaceWidgetPlanMetric(metric))
      : [],
    sortBy: transform?.sortBy ? makeWorkspaceWidgetPlanSort(transform.sortBy) : null,
  }
}

export function makeWorkspaceWidgetDataBinding(binding = {}) {
  return {
    sourceWidgetId: null,
    transforms: [],
    ...binding,
    transforms: Array.isArray(binding?.transforms)
      ? binding.transforms.map((transform) => makeWorkspaceWidgetPlanTransform(transform))
      : [],
  }
}

export function makeWorkspaceLinkFieldMapping(mapping = {}) {
  return {
    sourceField: '',
    targetField: '',
    ...mapping,
  }
}

export function makeWorkspaceLinkResponseSpec(responseSpec = {}) {
  return {
    ...responseSpec,
  }
}

export function makeWorkspaceWidgetPlan(plan = {}) {
  return {
    widgetId: '',
    role: '',
    kind: null,
    title: '',
    description: '',
    source: makeWorkspaceWidgetPlanSource(),
    dataBinding: null,
    analyticRoles: [],
    ...plan,
    source: makeWorkspaceWidgetPlanSource(plan?.source),
    dataBinding: plan?.dataBinding ? makeWorkspaceWidgetDataBinding(plan.dataBinding) : null,
    analyticRoles: Array.isArray(plan?.analyticRoles) ? [...plan.analyticRoles] : [],
  }
}

export function makeWorkspaceLinkPlan(plan = {}) {
  const compatibilityInput = plan || {}
  const publicPlan = stripWidgetLinkCompatibilityFields(compatibilityInput)
  const normalizedLink = makeWidgetLink({
    ...compatibilityInput,
    fieldMapping: Array.isArray(plan?.fieldMapping)
      ? plan.fieldMapping.map((mapping) => makeWorkspaceLinkFieldMapping(mapping))
      : [],
  })

  return {
    linkId: '',
    sourceWidgetId: '',
    targetWidgetId: '',
    kind: null,
    primitive: null,
    effect: null,
    activationPolicy: 'automatic',
    effectConstraint: null,
    responseSpec: null,
    description: '',
    fieldMapping: [],
    ...publicPlan,
    kind: normalizedLink.kind,
    primitive: normalizedLink.primitive,
    effect: normalizedLink.effect,
    activationPolicy: normalizedLink.activationPolicy,
    effectConstraint: normalizedLink.effectConstraint,
    responseSpec: normalizedLink.responseSpec ? makeWorkspaceLinkResponseSpec(normalizedLink.responseSpec) : null,
    description: normalizedLink.description,
    fieldMapping: normalizedLink.fieldMapping,
  }
}

export function makeWorkspacePlanningRequest(request) {
  return {
    task: null,
    datasetSchema: null,
    userIntent: null,
    runMode: 'goal_oriented',
    complexityBudget: 'standard',
    preferredTopology: null,
    ...request,
    task: request?.task ? makeWorkspacePlanningTask(request.task) : null,
    datasetSchema: request?.datasetSchema ? makeWorkspacePlanningDatasetSchema(request.datasetSchema) : null,
  }
}

export function makeWorkspacePlanningResult(result) {
  return {
    topology: 'T1',
    widgets: [],
    links: [],
    rationale: [],
    source: 'planner',
    planningMode: 'topology_driven',
    primaryWidgetId: null,
    title: 'Workspace',
    ...result,
    widgets: Array.isArray(result?.widgets)
      ? result.widgets.map((widget) => makeWorkspaceWidgetPlan(widget))
      : [],
    links: Array.isArray(result?.links)
      ? result.links.map((link) => makeWorkspaceLinkPlan(link))
      : [],
  }
}

export function describeWorkspacePlanningTaskSchema() {
  return cloneValue({
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
  })
}

export function describeWorkspaceWidgetPlanSourceSchema() {
  return cloneValue({
    type: 'object',
    required: ['kind'],
    properties: {
      kind: { type: 'string' },
      spec: { type: 'object' },
      title: { type: 'string' },
    },
  })
}

export function describeWorkspaceWidgetPlanMetricSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      field: { type: 'string' },
      op: { type: 'string' },
      as: { type: 'string' },
    },
  })
}

export function describeWorkspaceWidgetPlanSortSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      field: { type: 'string' },
      order: { type: 'string' },
    },
  })
}

export function describeWorkspaceWidgetPlanTransformSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      kind: { type: 'string' },
      groupBy: { type: 'array', items: { type: 'string' } },
      metrics: { type: 'array', items: describeWorkspaceWidgetPlanMetricSchema() },
      sortBy: {
        anyOf: [describeWorkspaceWidgetPlanSortSchema(), { type: 'null' }],
      },
    },
  })
}

export function describeWorkspaceWidgetDataBindingSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      sourceWidgetId: { type: 'string' },
      transforms: {
        type: 'array',
        items: describeWorkspaceWidgetPlanTransformSchema(),
      },
    },
  })
}

export function describeWorkspaceLinkFieldMappingSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      sourceField: { type: 'string' },
      targetField: { type: 'string' },
    },
  })
}

export function describeWorkspaceWidgetPlanSchema() {
  return cloneValue({
    type: 'object',
    required: ['widgetId', 'role', 'source'],
    properties: {
      widgetId: { type: 'string' },
      role: { type: 'string' },
      kind: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      source: describeWorkspaceWidgetPlanSourceSchema(),
      dataBinding: describeWorkspaceWidgetDataBindingSchema(),
      analyticRoles: { type: 'array', items: { type: 'string' } },
    },
  })
}

export function describeWorkspaceLinkPlanSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      linkId: { type: 'string' },
      sourceWidgetId: { type: 'string' },
      targetWidgetId: { type: 'string' },
      kind: { type: ['string', 'null'] },
      primitive: { type: ['string', 'null'] },
      effect: { type: ['string', 'null'] },
      activationPolicy: { type: 'string' },
      effectConstraint: { type: ['string', 'null'] },
      responseSpec: {
        type: 'object',
        properties: {
          kind: { type: 'string' },
          params: { type: 'object' },
          verificationHints: { type: 'object' },
        },
      },
      description: { type: 'string' },
      fieldMapping: {
        type: 'array',
        items: describeWorkspaceLinkFieldMappingSchema(),
      },
    },
  })
}

export function describeWorkspacePlanningRequestSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      task: {
        anyOf: [
          { type: 'null' },
          describeWorkspacePlanningTaskSchema(),
        ],
      },
      datasetSchema: {
        anyOf: [
          { type: 'null' },
          {
            type: 'object',
            properties: {
              fields: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    nullable: { type: 'boolean' },
                    description: { type: 'string' },
                  },
                },
              },
            },
          },
        ],
      },
      userIntent: { type: ['string', 'null'] },
      runMode: { type: 'string', enum: WORKSPACE_PLANNING_RUN_MODES },
      complexityBudget: { type: 'string', enum: WORKSPACE_PLANNING_BUDGETS },
      preferredTopology: { type: ['string', 'null'], enum: [...WORKSPACE_PLANNING_TOPOLOGIES, null] },
    },
  })
}

export function describeWorkspacePlanningResultSchema() {
  return cloneValue({
    type: 'object',
    required: ['topology', 'widgets', 'links', 'rationale', 'source', 'planningMode', 'title'],
    properties: {
      topology: { type: 'string', enum: WORKSPACE_PLANNING_TOPOLOGIES },
      widgets: { type: 'array', items: describeWorkspaceWidgetPlanSchema() },
      links: { type: 'array', items: describeWorkspaceLinkPlanSchema() },
      rationale: { type: 'array', items: { type: 'string' } },
      source: { type: 'string', enum: WORKSPACE_PLAN_SOURCES },
      planningMode: { type: 'string', enum: WORKSPACE_PLAN_MODES },
      primaryWidgetId: { type: ['string', 'null'] },
      title: { type: 'string' },
    },
  })
}
