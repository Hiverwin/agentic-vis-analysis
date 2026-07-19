import { makeWidgetLink, stripWidgetLinkCompatibilityFields } from '../../../contracts/widget-links-contracts.js'

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
    effect: null,
    activationPolicy: 'automatic',
    effectConstraint: null,
    responseSpec: null,
    description: '',
    fieldMapping: [],
    ...publicPlan,
    kind: normalizedLink.kind,
    effect: normalizedLink.effect,
    activationPolicy: normalizedLink.activationPolicy,
    effectConstraint: normalizedLink.effectConstraint,
    responseSpec: normalizedLink.responseSpec ? makeWorkspaceLinkResponseSpec(normalizedLink.responseSpec) : null,
    description: normalizedLink.description,
    fieldMapping: normalizedLink.fieldMapping,
  }
}

export function makeWorkspacePlanningRequest(request = {}) {
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

export function makeWorkspacePlanningResult(result = {}) {
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
