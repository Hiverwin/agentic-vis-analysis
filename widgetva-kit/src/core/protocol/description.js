import { describeActionDescriptorSchema } from './actions.js'
import { describeDataHandleSchema } from './dataHandles.js'
import { describePerceptionDescriptorSchema } from './perception.js'
import {
  WORKSPACE_PLAN_MODES,
  WORKSPACE_PLAN_SOURCES,
  WORKSPACE_PLANNING_BUDGETS,
  WORKSPACE_PLANNING_RUN_MODES,
  WORKSPACE_PLANNING_TOPOLOGIES,
  makeWorkspacePlanningRequest,
  makeWorkspacePlanningResult,
  describeWorkspacePlanningRequestSchema,
  describeWorkspacePlanningResultSchema,
} from './planning.js'
import { describeRefSchema } from './refs.js'
import { describeWorkspaceTaskContextSchema } from './state.js'
import { describeWidgetAdapterSummarySchema } from './widgetAdapters.js'
import { describeWidgetLinkSchema, describeWorkspaceTopologySummarySchema } from './widgetLinks.js'
import { describeWorkspaceSpecSummarySchema, makeWorkspaceSpecSummary } from './workspaceSpec.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export const WIDGET_KINDS = [
  'bar',
  'line',
  'scatter',
  'heatmap',
  'parallelCoordinates',
  'sankey',
  'map',
  'table',
  'custom',
]

export const WIDGET_ANALYTIC_ROLES = [
  'lookup',
  'compare',
  'rank',
  'correlate',
  'cluster',
  'outlier',
  'trend',
  'distribution',
  'flow',
  'geoPattern',
]

export const WORKSPACE_CAPABILITIES = [
  'singleWidgetAnalysis',
  'multiWidgetCoordination',
  'sharedSelection',
  'crossFilter',
  'domainSync',
  'traceReplay',
]

export const WORKSPACE_TRANSPORT_TOOL_NAMES = [
  'workspace_describe',
  'view_read',
  'action_run',
  'perception_query',
  'interaction_trace_read',
]

export const WORKSPACE_OPTIONAL_TRANSPORT_TOOL_NAMES = [
  'data_query',
  'workspace_plan',
  'agent_loop_describe',
  'trace_graph_read',
  'read_snapshot',
  'state_history_read',
  'branch_list',
  'verified_action_run',
  'jump_to_state',
  'branch_from_state',
  'response_recorder_describe',
  'agent_response_read',
  'agent_response_list',
  'agent_response_record',
]

export const WIDGET_HUMAN_INTERACTION_MODES = ['none', 'brush2d', 'multiBrush', 'categoryClick', 'cellClick', 'rowClick', 'directManipulation']

export function describeWidgetKindSchema() {
  return cloneValue({
    type: 'string',
    enum: WIDGET_KINDS,
  })
}

export function describeWidgetAnalyticRoleSchema() {
  return cloneValue({
    type: 'string',
    enum: WIDGET_ANALYTIC_ROLES,
  })
}

export function describeWorkspaceCapabilitySchema() {
  return cloneValue({
    type: 'string',
    enum: WORKSPACE_CAPABILITIES,
  })
}

export function describeWorkspaceTransportToolNameSchema() {
  return cloneValue({
    type: 'string',
    enum: WORKSPACE_TRANSPORT_TOOL_NAMES,
  })
}

export function describeWorkspaceOptionalTransportToolNameSchema() {
  return cloneValue({
    type: 'string',
    enum: WORKSPACE_OPTIONAL_TRANSPORT_TOOL_NAMES,
  })
}

export function describeWidgetHumanInteractionModeSchema() {
  return cloneValue({
    type: 'string',
    enum: WIDGET_HUMAN_INTERACTION_MODES,
  })
}

export function makeWidgetDescription(description) {
  return {
    title: '',
    description: '',
    analyticRoles: [],
    widgetId: null,
    role: 'primary',
    sourceKind: null,
    supportsSpecMutation: false,
    primaryDataRef: null,
    actionNames: [],
    perceptionQueryNames: [],
    usageNotes: [],
    humanInteraction: {
      mode: 'none',
      actionName: null,
      supportsDirectManipulation: false,
    },
    ...description,
  }
}

export function makeWorkspaceDescription(description) {
  return {
    appId: 'widgetva-app',
    workspaceId: 'main',
    generatedAt: new Date().toISOString(),
    workspaceCapabilities: [],
    transportHints: null,
    runtimeTopology: null,
    taskContext: null,
    widgetAdapters: [],
    __schemas: null,
    widgets: [],
    dataHandles: [],
    links: [],
    actions: [],
    perceptionQueries: [],
    planning: null,
    ...description,
    ...(description?.transportHints
      ? { transportHints: makeWorkspaceTransportHints(description.transportHints) }
      : {}),
    ...(description?.planning
      ? { planning: makeWorkspaceDescriptionPlanning(description.planning) }
      : {}),
  }
}

export function makeWorkspaceTransportHints(transportHints) {
  return {
    recommendedTools: [],
    optionalTools: [],
    note: '',
    ...transportHints,
  }
}

export function makeWorkspaceDescriptionPlanning(planning) {
  return {
    supportedTopologies: [],
    supportedRunModes: [],
    supportedComplexityBudgets: [],
    supportedPlanSources: [],
    supportedPlanningModes: [],
    requestedWorkspaceSpec: null,
    planningRequest: null,
    workspaceSpecStatus: null,
    workspaceSpecIssues: [],
    materializedFromSpec: false,
    materializedFromPlanner: false,
    planner: null,
    ...planning,
    ...(planning?.requestedWorkspaceSpec
      ? {
          requestedWorkspaceSpec: makeWorkspaceSpecSummary(planning.requestedWorkspaceSpec),
        }
      : {}),
    ...(planning?.planningRequest
      ? {
          planningRequest: makeWorkspacePlanningRequest(planning.planningRequest),
        }
      : {}),
    ...(planning?.planner
      ? {
          planner: makeWorkspacePlanningResult(planning.planner),
        }
      : {}),
  }
}

export function describeWidgetDescriptionSchema() {
  return cloneValue({
    type: 'object',
    required: ['title', 'actionNames', 'perceptionQueryNames', 'humanInteraction'],
    properties: {
      ref: describeRefSchema(),
      kind: describeWidgetKindSchema(),
      title: { type: 'string' },
      description: { type: 'string' },
      analyticRoles: { type: 'array', items: describeWidgetAnalyticRoleSchema() },
      widgetId: { type: ['string', 'null'] },
      role: { type: 'string' },
      sourceKind: { type: ['string', 'null'] },
      supportsSpecMutation: { type: 'boolean' },
      primaryDataRef: {
        anyOf: [describeRefSchema(), { type: 'null' }],
      },
      actionNames: { type: 'array', items: { type: 'string' } },
      perceptionQueryNames: { type: 'array', items: { type: 'string' } },
      usageNotes: { type: 'array', items: { type: 'string' } },
      humanInteraction: {
        type: 'object',
        properties: {
          mode: describeWidgetHumanInteractionModeSchema(),
          actionName: { type: ['string', 'null'] },
          supportsDirectManipulation: { type: 'boolean' },
        },
      },
    },
  })
}

export function describeWorkspaceTransportHintsSchema() {
  return cloneValue({
    type: ['object', 'null'],
    properties: {
      recommendedTools: { type: 'array', items: describeWorkspaceTransportToolNameSchema() },
      optionalTools: { type: 'array', items: describeWorkspaceOptionalTransportToolNameSchema() },
      note: { type: 'string' },
    },
  })
}

export function describeWorkspaceDescriptionPlanningSchema() {
  return cloneValue({
    type: ['object', 'null'],
    properties: {
      supportedTopologies: {
        type: 'array',
        items: { type: 'string', enum: WORKSPACE_PLANNING_TOPOLOGIES },
      },
      supportedRunModes: {
        type: 'array',
        items: { type: 'string', enum: WORKSPACE_PLANNING_RUN_MODES },
      },
      supportedComplexityBudgets: {
        type: 'array',
        items: { type: 'string', enum: WORKSPACE_PLANNING_BUDGETS },
      },
      supportedPlanSources: {
        type: 'array',
        items: { type: 'string', enum: WORKSPACE_PLAN_SOURCES },
      },
      supportedPlanningModes: {
        type: 'array',
        items: { type: 'string', enum: WORKSPACE_PLAN_MODES },
      },
      requestedWorkspaceSpec: {
        anyOf: [describeWorkspaceSpecSummarySchema(), { type: 'null' }],
      },
      planningRequest: {
        anyOf: [describeWorkspacePlanningRequestSchema(), { type: 'null' }],
      },
      workspaceSpecStatus: { type: ['string', 'null'] },
      workspaceSpecIssues: { type: 'array', items: { type: 'string' } },
      materializedFromSpec: { type: 'boolean' },
      materializedFromPlanner: { type: 'boolean' },
      planner: {
        anyOf: [describeWorkspacePlanningResultSchema(), { type: 'null' }],
      },
    },
  })
}

export function describeWorkspaceDescriptionSchema() {
  return cloneValue({
    type: 'object',
    required: ['appId', 'workspaceId', 'generatedAt', 'widgets', 'dataHandles', 'links', 'actions', 'perceptionQueries'],
    properties: {
      appId: { type: 'string' },
      workspaceId: { type: 'string' },
      generatedAt: { type: 'string' },
      workspaceCapabilities: { type: 'array', items: describeWorkspaceCapabilitySchema() },
      transportHints: describeWorkspaceTransportHintsSchema(),
      runtimeTopology: {
        anyOf: [describeWorkspaceTopologySummarySchema(), { type: 'null' }],
      },
      taskContext: {
        anyOf: [describeWorkspaceTaskContextSchema(), { type: 'null' }],
      },
      widgets: { type: 'array', items: describeWidgetDescriptionSchema() },
      widgetAdapters: { type: 'array', items: describeWidgetAdapterSummarySchema() },
      dataHandles: { type: 'array', items: describeDataHandleSchema() },
      links: { type: 'array', items: describeWidgetLinkSchema() },
      actions: { type: 'array', items: describeActionDescriptorSchema() },
      perceptionQueries: { type: 'array', items: describePerceptionDescriptorSchema() },
      planning: describeWorkspaceDescriptionPlanningSchema(),
      __schemas: { type: 'object' },
    },
  })
}
