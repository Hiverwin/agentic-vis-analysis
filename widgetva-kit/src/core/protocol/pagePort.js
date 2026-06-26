import { describeRuntimeActorSchema } from './actors.js'
import {
  describeInteractionTraceActorSchema,
  describeInteractionTraceEventKindSchema,
  describeInteractionTraceRecordSchema,
} from './interactionTrace.js'
import {
  describeActionCallSchema,
  describeActionCategorySchema,
  describeActionDescriptorSchema,
  describeActionEffectKindSchema,
  describeActionPrimitiveSchema,
} from './actions.js'
import {
  describeActionResultSchema,
  describeBranchSummarySchema,
  describeDataQueryResultSchema,
  describeLinkPropagationCheckSchema,
  describeLinkPropagationEvaluationSchema,
  describeLinkPropagationResultSchema,
  describePerceptionResultSchema,
  describeResultErrorSchema,
  describeStateSnapshotMetaSchema,
  describeTraceGraphEdgeSchema,
  describeTraceGraphNodeSchema,
  describeTraceGraphSchema,
  describeWorkspaceReplayContextSchema,
  describeWorkspaceSnapshotMetaSchema,
  describeWorkspaceSnapshotSchema,
} from './results.js'
import {
  describeActionExecutorActionEntrySchema,
  describeActionExecutorCapabilitiesSchema,
  describeActionExecutorCountsSchema,
  describeActionExecutorSummarySchema,
} from './actionExecutor.js'
import { describeActionContextSummarySchema } from './actionContext.js'
import {
  describeActionUsageEntrySchema,
  describeActionUsageFieldCandidatesSchema,
  describeActionUsageFieldExplanationSchema,
  describeActionUsageFieldRoleMapSchema,
  describeActionUsageFieldRolesSchema,
  describeActionUsageParamRoleSchema,
  describeActionUsageParamRolesSchema,
  describeActionUsageRequestSchema,
  describeActionUsageSpecContextSchema,
  describeActionUsageSummarySchema,
} from './actionUsage.js'
import {
  describeAgentResponseRecordSchema,
  describeResponseRecorderCapabilitiesSchema,
  describeResponseRecorderCountersSchema,
  describeResponseRecorderSummarySchema,
} from './responses.js'
import { describePerceptionContextSummarySchema } from './perceptionContext.js'
import { describeDataQueryContextSummarySchema } from './dataQueryContext.js'
import { describeDataQueryEngineSummarySchema } from './dataQueryEngine.js'
import {
  describeRuntimeCoreCapabilitiesSchema,
  describeRuntimeCoreComponentsSchema,
  describeRuntimeCoreRegistriesSchema,
  describeRuntimeCoreSummarySchema,
} from './runtimeCore.js'
import {
  describeRuntimeStoreCapabilitiesSchema,
  describeRuntimeStoreHistorySchema,
  describeRuntimeStoreIdentitySchema,
  describeRuntimeStoreIndexesSchema,
  describeRuntimeStoreRetentionSchema,
  describeRuntimeStoreStateSummarySchema,
  describeRuntimeStoreSummarySchema,
} from './runtimeStore.js'
import {
  describeWidgetRegistryCountsSchema,
  describeWidgetRegistryRefsSchema,
  describeWidgetRegistrySummarySchema,
} from './widgetRegistry.js'
import {
  describePerceptionRegistryCapabilitiesSchema,
  describePerceptionRegistryCountsSchema,
  describePerceptionRegistryQueryEntrySchema,
  describePerceptionRegistrySummarySchema,
} from './perceptionRegistry.js'
import {
  describeDataQueryExecutorCapabilitiesSchema,
  describeDataQueryExecutorCountsSchema,
  describeDataQueryExecutorEngineSummarySchema,
  describeDataQueryExecutorSummarySchema,
} from './dataQueryExecutor.js'
import {
  describeStateManagerCapabilitiesSchema,
  describeStateManagerCountersSchema,
  describeStateManagerSummarySchema,
} from './stateManager.js'
import {
  describeTraceRecorderCapabilitiesSchema,
  describeTraceRecorderCountersSchema,
  describeTraceRecorderEventKindsSchema,
  describeTraceRecorderSummarySchema,
} from './traceRecorder.js'
import {
  describeAgentLoopContextSchema,
  describeAgentLoopHintsSchema,
  describeVerifiedActionEvidenceSchema,
  describeVerifiedActionResultSchema,
} from './agentLoop.js'
import {
  describeWorkspaceCapabilitySchema,
  describeWorkspaceDescriptionPlanningSchema,
  describeWorkspaceDescriptionSchema,
  describeWorkspaceTransportHintsSchema,
  describeWidgetAnalyticRoleSchema,
  describeWidgetDescriptionSchema,
  describeWidgetHumanInteractionModeSchema,
  describeWidgetKindSchema,
} from './description.js'
import {
  describeDataQueryAggregateSpecSchema,
  describeDataQueryCallQuerySchema,
  describeDataQueryCompareGroupsSpecSchema,
  describeDataQueryCorrelationSpecSchema,
  describeDataHandleSchema,
  describeDataGroupComparisonResultSchema,
  describeDataQueryCallSchema,
  describeDataQueryDescriptorSchema,
  describeDataQueryExtremesSpecSchema,
  describeDataQueryMeasureSchema,
  describeDataQueryOutliersSpecSchema,
  describeDataQueryPredicateSchema,
  describeDataRecordSchema,
  describeDataRowsResultSchema,
  describeDataSchemaResultSchema,
  describeDataQuerySqlSpecSchema,
  describeDataQuerySummarySpecSchema,
  describeDataSummaryRowSchema,
  describeDataSummaryTableSchema,
} from './dataHandles.js'
import {
  describePerceptionCategorySchema,
  describePerceptionDescriptorSchema,
  describePerceptionInspectViewConfigResultSchema,
  describePerceptionInspectVisibleRowsResultSchema,
  describePerceptionQueryCallSchema,
  describePerceptionSummarizeSelectionResultSchema,
  describePerceptionSummarizeVisibleResultSchema,
  describePerceptionSummaryGroupsSchema,
  describePerceptionVerifyActionEffectParamsSchema,
  describePerceptionVerifyActionEffectResultSchema,
} from './perception.js'
import {
  describeWorkspaceLinkFieldMappingSchema,
  describeWorkspacePlanningTaskSchema,
  describeWorkspacePlanningRequestSchema,
  describeWorkspacePlanningResultSchema,
  describeWorkspaceWidgetDataBindingSchema,
  describeWorkspaceWidgetPlanMetricSchema,
  describeWorkspaceWidgetPlanSortSchema,
  describeWorkspaceWidgetPlanSourceSchema,
  describeWorkspaceWidgetPlanTransformSchema,
} from './planning.js'
import {
  describeFieldEncodingSchema,
  describeFieldScaleSchema,
  describeInteractionFeedbackStateSchema,
  describeInteractionHoveredItemSchema,
  describeInteractionTooltipSchema,
  describeSelectionDomainSchema,
  describeSelectionPredicateSchema,
  describeSelectionStateSchema,
  describeSelectionValueSchema,
  describeTransformStateSchema,
  describeViewTransformStateSchema,
  describeWidgetEncodingsStateSchema,
  describeWidgetSelectionsStateSchema,
  describeWidgetStateSchema,
  describeWidgetDataStateSchema,
  describeWorkspaceAnnotationSchema,
  describeWorkspaceDeltaSchema,
  describeWorkspaceSharedStateSchema,
  describeWorkspaceStateSchema,
  describeWorkspaceTaskContextSchema,
} from './state.js'
import { describeWorkspaceSpecSchema } from './workspaceSpec.js'
import {
  describeLinkEngineSummarySchema,
  describeWidgetLinkEffectSchema,
  describeWidgetLinkKindSchema,
  describeWidgetLinkSchema,
} from './widgetLinks.js'
import { describeRefPartsSchema, describeRefSchema } from './refs.js'
import {
  describeWidgetAdapterCapabilitiesSchema,
  describeWidgetAdapterHumanInteractionSchema,
  describeWidgetAdapterProviderCapabilitiesSchema,
  describeWidgetAdapterSummarySchema,
} from './widgetAdapters.js'

const BOOLEAN_SCHEMA = { type: 'boolean' }
const STRING_SCHEMA = { type: 'string' }
const REF_ARRAY_SCHEMA = { type: 'array', items: { type: 'string' } }

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function makeMethodDescriptor(descriptor) {
  return {
    stability: 'stable',
    aliases: [],
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {},
    },
    returns: {
      kind: 'result',
      description: '',
    },
    errors: [],
    ...descriptor,
  }
}

function describePagePortAliasMapSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: { type: 'string' },
  })
}

function describePagePortErrorDescriptorSchema() {
  return cloneValue({
    type: 'object',
    required: ['code', 'description'],
    properties: {
      code: { type: 'string' },
      description: { type: 'string' },
    },
  })
}

function describePagePortErrorCatalogSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: describePagePortErrorDescriptorSchema(),
    },
  })
}

function describePagePortMethodReturnSchema() {
  return cloneValue({
    type: ['object', 'null'],
    properties: {
      kind: { type: 'string' },
      description: { type: 'string' },
      schema: {},
    },
  })
}

function describePagePortMethodExampleSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      input: {},
      output: {},
      note: { type: 'string' },
    },
  })
}

function describePagePortMethodDescriptorSchema() {
  return cloneValue({
    type: 'object',
    required: ['stability', 'aliases', 'inputSchema', 'returns', 'errors'],
    properties: {
      stability: { type: 'string' },
      aliases: { type: 'array', items: { type: 'string' } },
      inputSchema: { type: ['object', 'null'] },
      returns: describePagePortMethodReturnSchema(),
      errors: {
        type: 'array',
        items: describePagePortErrorDescriptorSchema(),
      },
      description: { type: 'string' },
      examples: { type: 'array', items: describePagePortMethodExampleSchema() },
    },
  })
}

function describePagePortMethodDescriptorMapSchema() {
  return cloneValue({
    type: 'object',
    additionalProperties: describePagePortMethodDescriptorSchema(),
  })
}

export function makePagePortTransportHints(transportHints) {
  return {
    recommendedTools: ['workspace_describe', 'view_read', 'action_run', 'perception_query', 'interaction_trace_read'],
    optionalTools: [
      'data_query',
      'workspace_plan',
      'agent_loop_describe',
      'action_usage_describe',
      'trace_graph_read',
      'read_snapshot',
      'state_history_read',
      'branch_list',
      'verified_action_run',
      'jump_to_state',
      'branch_from_state',
      'link_propagation_evaluate',
      'response_recorder_describe',
      'agent_response_read',
      'agent_response_list',
      'agent_response_record',
    ],
    note: 'External transports should prefer the stable workspace/view/action/perception/trace surface.',
    ...transportHints,
  }
}

export function makePagePortMethodDescriptor(descriptor) {
  return {
    stability: 'stable',
    aliases: [],
    inputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {},
    },
    returns: {
      kind: 'result',
      description: '',
    },
    errors: [],
    ...descriptor,
    aliases: Array.isArray(descriptor?.aliases) ? cloneValue(descriptor.aliases) : [],
    inputSchema: descriptor?.inputSchema
      ? cloneValue(descriptor.inputSchema)
      : {
          type: 'object',
          additionalProperties: true,
          properties: {},
        },
    returns: descriptor?.returns
      ? cloneValue(descriptor.returns)
      : {
          kind: 'result',
          description: '',
        },
    errors: Array.isArray(descriptor?.errors) ? cloneValue(descriptor.errors) : [],
  }
}

export function makePagePortDescription(description = {}) {
  return {
    version: '1.0.0',
    methods: [...PAGE_PORT_METHODS],
    aliases: cloneValue(PAGE_PORT_ALIASES),
    transportHints: makePagePortTransportHints(),
    methodDescriptors: Object.fromEntries(
      PAGE_PORT_METHODS.map((name) => [
        name,
        makePagePortMethodDescriptor(PAGE_PORT_METHOD_DESCRIPTORS[name]),
      ]),
    ),
    errorCatalog: cloneValue(PAGE_PORT_ERROR_CODES),
    schemas: describePagePortSchemasForMethods(PAGE_PORT_METHODS),
    ...description,
    ...(description?.transportHints
      ? { transportHints: makePagePortTransportHints(description.transportHints) }
      : {}),
    ...(description?.methodDescriptors
      ? {
          methodDescriptors: Object.fromEntries(
            Object.entries(description.methodDescriptors).map(([name, descriptor]) => [
              name,
              makePagePortMethodDescriptor(descriptor),
            ]),
          ),
        }
      : {}),
  }
}

function describePagePortDescriptionSchema() {
  return cloneValue({
    type: 'object',
    required: ['version', 'methods', 'aliases', 'methodDescriptors', 'errorCatalog', 'schemas', 'transportHints'],
    properties: {
      version: { type: 'string' },
      methods: { type: 'array', items: { type: 'string' } },
      aliases: describePagePortAliasMapSchema(),
      methodDescriptors: describePagePortMethodDescriptorMapSchema(),
      errorCatalog: describePagePortErrorCatalogSchema(),
      transportHints: describeWorkspaceTransportHintsSchema(),
      schemas: {
        type: 'object',
        additionalProperties: {},
      },
      widgetAdapterIntrospection: { type: 'boolean' },
      runtimeCoreIntrospection: { type: 'boolean' },
      planner: { type: 'boolean' },
      agentLoop: { type: 'boolean' },
    },
  })
}

export const PAGE_PORT_METHODS = [
  'describePagePort',
  'describeWorkspace',
  'parseRef',
  'describeRuntimeCore',
  'describeRuntimeStore',
  'describeWidgetRegistry',
  'describeActionExecutor',
  'describeActionContext',
  'describeActionUsage',
  'describePerceptionRegistry',
  'describePerceptionContext',
  'describeDataQueryExecutor',
  'describeDataQueryContext',
  'describeDataQueryEngine',
  'describeStateManager',
  'describeTraceRecorder',
  'describeResponseRecorder',
  'describeLinkEngine',
  'planWorkspace',
  'describeAgentLoop',
  'listWidgetAdapters',
  'readObservation',
  'readCoordinationState',
  'readPropagationSummary',
  'readLatestCoordinationResult',
  'listAvailableActions',
  'listAvailablePerceptions',
  'readState',
  'readView',
  'readSnapshot',
  'listStateHistory',
  'listBranches',
  'executeAction',
  'executeVerifiedAction',
  'jumpToState',
  'branchFromState',
  'queryPerception',
  'runDataQuery',
  'queryData',
  'readTrace',
  'getInteractionTrace',
  'replay',
  'getTraceGraph',
  'getLatestAgentResponse',
  'listAgentResponses',
  'evaluateLinkPropagation',
  'recordAgentResponse',
]

export const PAGE_PORT_ALIASES = {
  page_port_describe: 'describePagePort',
  workspace_describe: 'describeWorkspace',
  ref_parse: 'parseRef',
  runtime_core_describe: 'describeRuntimeCore',
  runtime_store_describe: 'describeRuntimeStore',
  widget_registry_describe: 'describeWidgetRegistry',
  action_executor_describe: 'describeActionExecutor',
  action_context_describe: 'describeActionContext',
  action_usage_describe: 'describeActionUsage',
  perception_registry_describe: 'describePerceptionRegistry',
  perception_context_describe: 'describePerceptionContext',
  data_query_executor_describe: 'describeDataQueryExecutor',
  data_query_context_describe: 'describeDataQueryContext',
  data_query_engine_describe: 'describeDataQueryEngine',
  state_manager_describe: 'describeStateManager',
  trace_recorder_describe: 'describeTraceRecorder',
  response_recorder_describe: 'describeResponseRecorder',
  link_engine_describe: 'describeLinkEngine',
  workspace_plan: 'planWorkspace',
  agent_loop_describe: 'describeAgentLoop',
  widget_adapter_list: 'listWidgetAdapters',
  observation_read: 'readObservation',
  coordination_state_read: 'readCoordinationState',
  propagation_summary_read: 'readPropagationSummary',
  latest_coordination_result_read: 'readLatestCoordinationResult',
  available_actions_list: 'listAvailableActions',
  available_perceptions_list: 'listAvailablePerceptions',
  state_read: 'readState',
  view_read: 'readView',
  read_snapshot: 'readSnapshot',
  state_history_read: 'listStateHistory',
  branch_list: 'listBranches',
  action_run: 'executeAction',
  jump_to_state: 'jumpToState',
  branch_from_state: 'branchFromState',
  verified_action_run: 'executeVerifiedAction',
  perception_query: 'queryPerception',
  data_query_run: 'runDataQuery',
  data_query: 'queryData',
  trace_read: 'readTrace',
  interaction_trace_read: 'getInteractionTrace',
  workspace_replay: 'replay',
  trace_graph_read: 'getTraceGraph',
  agent_response_read: 'getLatestAgentResponse',
  agent_response_list: 'listAgentResponses',
  link_propagation_evaluate: 'evaluateLinkPropagation',
  agent_response_record: 'recordAgentResponse',
}

export const PAGE_PORT_ERROR_CODES = {
  pagePort: [
    {
      code: 'METHOD_NOT_INSTALLED',
      description: 'The requested page-port method is unavailable on the current page runtime.',
    },
  ],
  action: [
    {
      code: 'UNKNOWN_OPERATION',
      description: 'The requested WidgetVA action name is not registered in the current runtime.',
    },
    {
      code: 'UNSUPPORTED_TARGET',
      description: 'The requested action exists but is not declared for the target widget or ref.',
    },
    {
      code: 'INVALID_PARAMS',
      description: 'The action call failed params-schema validation before execution.',
    },
    {
      code: 'PRECONDITION_FAILED',
      description: 'The action is declared, but the current runtime state does not satisfy its documented preconditions.',
    },
    {
      code: 'RUNTIME_ERROR',
      description: 'The action handler threw during execution.',
    },
  ],
  perception: [
    {
      code: 'UNKNOWN_QUERY',
      description: 'The requested perception query name is not registered in the current runtime.',
    },
    {
      code: 'INVALID_PARAMS',
      description: 'The perception query failed params-schema validation before execution.',
    },
    {
      code: 'RUNTIME_ERROR',
      description: 'The perception handler threw during execution.',
    },
  ],
  dataQuery: [
    {
      code: 'UNSUPPORTED_TARGET',
      description: 'The requested data-query target ref does not resolve to a materialized widget or data handle.',
    },
    {
      code: 'UNKNOWN_DATA_REF',
      description: 'The requested data ref is not materialized in the current runtime store.',
    },
    {
      code: 'UNKNOWN_QUERY_KIND',
      description: 'The requested data query kind is unsupported by WidgetVA.',
    },
    {
      code: 'UNSUPPORTED_QUERY_KIND',
      description: 'The requested data query kind is valid globally but not exposed by the current data handle.',
    },
    {
      code: 'INVALID_QUERY_SPEC',
      description: 'The data query spec failed schema validation before execution.',
    },
  ],
}

export const PAGE_PORT_METHOD_DESCRIPTORS = {
  describePagePort: makeMethodDescriptor({
    description: 'Describe the installed WidgetVA page port, including method catalog, aliases, schemas, and error semantics.',
    returns: {
      kind: 'pagePortDescription',
      description: 'A stable description of the external WidgetVA page API.',
      schema: describePagePortDescriptionSchema(),
    },
    examples: [
      {
        userGoal: 'Discover the stable WidgetVA page-port surface before connecting an external agent.',
        input: {},
      },
    ],
  }),
  describeWorkspace: makeMethodDescriptor({
    aliases: ['workspace_describe'],
    description: 'Describe the current workspace including widgets, data handles, links, actions, and perception queries.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        includeSchemas: BOOLEAN_SCHEMA,
        includeExamples: BOOLEAN_SCHEMA,
        includeProtocolSchemas: BOOLEAN_SCHEMA,
      },
    },
    returns: {
      kind: 'workspaceDescription',
      description: 'A workspace-level capability description with widget and runtime metadata.',
      schema: describeWorkspaceDescriptionSchema(),
    },
  }),
  parseRef: makeMethodDescriptor({
    aliases: ['ref_parse'],
    description: 'Parse a WidgetVA ref string into structured ref parts.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ref: describeRefSchema(),
      },
      required: ['ref'],
    },
    returns: {
      kind: 'refParts',
      description: 'Structured app/workspace/kind/id components parsed from a WidgetVA ref.',
      schema: {
        anyOf: [describeRefPartsSchema(), { type: 'null' }],
      },
    },
  }),
  describeRuntimeCore: makeMethodDescriptor({
    aliases: ['runtime_core_describe'],
    description: 'Describe the installed WidgetVA runtime core components, handler registries, and protocol-level execution capabilities.',
    returns: {
      kind: 'runtimeCoreSummary',
      description: 'A compact summary of the runtime core component graph and registered execution/query/link capabilities.',
      schema: describeRuntimeCoreSummarySchema(),
    },
  }),
  describeRuntimeStore: makeMethodDescriptor({
    aliases: ['runtime_store_describe'],
    description: 'Describe the current runtime-store indexes, history buffers, and replay capabilities.',
    returns: {
      kind: 'runtimeStoreSummary',
      description: 'A compact summary of runtime store state, registries, and replay/trace capacities.',
      schema: describeRuntimeStoreSummarySchema(),
    },
  }),
  describeWidgetRegistry: makeMethodDescriptor({
    aliases: ['widget_registry_describe'],
    description: 'Describe the materialized widget/data/link/adapter registry maintained by the runtime core.',
    returns: {
      kind: 'widgetRegistrySummary',
      description: 'A compact registry summary covering widget refs, data refs, link refs, and per-widget registry entries.',
      schema: describeWidgetRegistrySummarySchema(),
    },
  }),
  describeActionExecutor: makeMethodDescriptor({
    aliases: ['action_executor_describe'],
    description: 'Describe the installed ActionExecutor, including registered actions, handlers, and precondition coverage.',
    returns: {
      kind: 'actionExecutorSummary',
      description: 'A compact summary of ActionExecutor registrations, capabilities, and action surface.',
      schema: describeActionExecutorSummarySchema(),
    },
  }),
  describeActionContext: makeMethodDescriptor({
    aliases: ['action_context_describe'],
    description: 'Describe the ActionContext contract that action handlers receive at runtime.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    returns: {
      kind: 'actionContextSummary',
      description: 'A stable summary of ActionContext methods, capabilities, and integrations.',
      schema: describeActionContextSummarySchema(),
    },
  }),
  describeActionUsage: makeMethodDescriptor({
    aliases: ['action_usage_describe'],
    description: 'Describe how one action should be used on the current widget, including inferred fields, recommended params, and diagnostic guidance.',
    inputSchema: describeActionUsageRequestSchema(),
    returns: {
      kind: 'actionUsageSummary',
      description: 'Widget-scoped action-usage guidance with inferred field roles, recommended params, and diagnostics.',
      schema: describeActionUsageSummarySchema(),
    },
  }),
  describePerceptionRegistry: makeMethodDescriptor({
    aliases: ['perception_registry_describe'],
    description: 'Describe the installed PerceptionQueryRegistry, including registered query handlers and supported widget-kind routing.',
    returns: {
      kind: 'perceptionRegistrySummary',
      description: 'A compact summary of perception-query registrations and evidence capabilities.',
      schema: describePerceptionRegistrySummarySchema(),
    },
  }),
  describePerceptionContext: makeMethodDescriptor({
    aliases: ['perception_context_describe'],
    description: 'Describe the PerceptionContext contract that perception-query handlers receive at runtime.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    returns: {
      kind: 'perceptionContextSummary',
      description: 'A stable summary of PerceptionContext methods, capabilities, and integrations.',
      schema: describePerceptionContextSummarySchema(),
    },
  }),
  describeDataQueryExecutor: makeMethodDescriptor({
    aliases: ['data_query_executor_describe'],
    description: 'Describe the installed DataQueryExecutor and its backing query-engine surface.',
    returns: {
      kind: 'dataQueryExecutorSummary',
      description: 'A compact summary of supported data-query kinds and query-engine capabilities.',
      schema: describeDataQueryExecutorSummarySchema(),
    },
  }),
  describeDataQueryContext: makeMethodDescriptor({
    aliases: ['data_query_context_describe'],
    description: 'Describe the DataQueryContext contract that data-query executions receive at runtime.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    returns: {
      kind: 'dataQueryContextSummary',
      description: 'A stable summary of DataQueryContext methods, capabilities, and integrations.',
      schema: describeDataQueryContextSummarySchema(),
    },
  }),
  describeDataQueryEngine: makeMethodDescriptor({
    aliases: ['data_query_engine_describe'],
    description: 'Describe the backing DataQueryEngine implementation and its supported query capabilities.',
    returns: {
      kind: 'dataQueryEngineSummary',
      description: 'A compact summary of the underlying data query engine implementation, supported query kinds, and execution capabilities.',
      schema: describeDataQueryEngineSummarySchema(),
    },
  }),
  describeStateManager: makeMethodDescriptor({
    aliases: ['state_manager_describe'],
    description: 'Describe the installed StateManager capabilities and state-id generation counters.',
    returns: {
      kind: 'stateManagerSummary',
      description: 'A compact summary of StateManager responsibilities and generated state-id counters.',
      schema: describeStateManagerSummarySchema(),
    },
  }),
  describeTraceRecorder: makeMethodDescriptor({
    aliases: ['trace_recorder_describe'],
    description: 'Describe the installed InteractionTraceRecorder capabilities and current trace counters.',
    returns: {
      kind: 'traceRecorderSummary',
      description: 'A compact summary of unified trace-recording capabilities and current interaction-trace counts.',
      schema: describeTraceRecorderSummarySchema(),
    },
  }),
  describeResponseRecorder: makeMethodDescriptor({
    aliases: ['response_recorder_describe'],
    description: 'Describe the runtime response recorder used for final-answer capture and retrieval.',
    returns: {
      kind: 'responseRecorderSummary',
      description: 'Summary of final-response recording capabilities and counters.',
      schema: describeResponseRecorderSummarySchema(),
    },
  }),
  describeLinkEngine: makeMethodDescriptor({
    aliases: ['link_engine_describe'],
    description: 'Describe the current LinkEngine primitive registry and materialized workspace link counts.',
    returns: {
      kind: 'linkEngineSummary',
      description: 'A compact summary of available link primitives and current workspace link topology size.',
      schema: describeLinkEngineSummarySchema(),
    },
  }),
  planWorkspace: makeMethodDescriptor({
    aliases: ['workspace_plan'],
    description: 'Generate a workspace topology plan for the current specification and task context.',
    inputSchema: describeWorkspacePlanningRequestSchema(),
    returns: {
      kind: 'workspacePlanningResult',
      description: 'A planner-generated workspace topology with widgets, links, and rationale.',
      schema: describeWorkspacePlanningResultSchema(),
    },
  }),
  describeAgentLoop: makeMethodDescriptor({
    aliases: ['agent_loop_describe'],
    description: 'Read a runtime-prepared observe-plan-act-verify-reason context bundle.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        viewOptions: {
          type: 'object',
          additionalProperties: false,
          properties: {
            refs: REF_ARRAY_SCHEMA,
            deltaSince: STRING_SCHEMA,
          },
        },
      },
    },
    returns: {
      kind: 'agentLoopContext',
      description: 'A structured runtime bundle for closed-loop action planning and verification.',
      schema: describeAgentLoopContextSchema(),
    },
  }),
  listWidgetAdapters: makeMethodDescriptor({
    aliases: ['widget_adapter_list'],
    description: 'List materialized widget adapter instances and their provider/human-interaction capabilities.',
    returns: {
      kind: 'widgetAdapterSummary[]',
      description: 'Per-widget adapter metadata for runtime introspection.',
      schema: {
        type: 'array',
        items: describeWidgetAdapterSummarySchema(),
      },
    },
  }),
  readObservation: makeMethodDescriptor({
    aliases: ['observation_read'],
    description: 'Read a workspace-level observation envelope with workspace description, current state, coordination state, action/perception surfaces, and propagation summary.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        readStateOptions: {
          type: 'object',
          additionalProperties: false,
          properties: {
            refs: REF_ARRAY_SCHEMA,
            deltaSince: STRING_SCHEMA,
          },
        },
        propagationOptions: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sourceRef: STRING_SCHEMA,
          },
        },
      },
    },
    returns: {
      kind: 'runtimeObservation',
      description: 'A workspace-level observation bundle for agent-facing environment reads.',
      schema: { type: 'object', additionalProperties: true },
    },
  }),
  readCoordinationState: makeMethodDescriptor({
    aliases: ['coordination_state_read'],
    description: 'Read the current shared coordination state including focus, selections, highlight, viewport, filters, and annotations.',
    returns: {
      kind: 'coordinationState',
      description: 'A shared coordination-state projection derived from the runtime workspace state.',
      schema: { type: 'object', additionalProperties: true },
    },
  }),
  readPropagationSummary: makeMethodDescriptor({
    aliases: ['propagation_summary_read'],
    description: 'Read a propagation summary over workspace links, optionally centered on one source ref.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceRef: STRING_SCHEMA,
      },
    },
    returns: {
      kind: 'propagationSummary',
      description: 'A propagation summary bundle including candidate source refs, outgoing propagation entries, and optional evaluation results.',
      schema: { type: 'object', additionalProperties: true },
    },
  }),
  readLatestCoordinationResult: makeMethodDescriptor({
    aliases: ['latest_coordination_result_read'],
    description: 'Read the most recent coordination-driving runtime result bundle, including propagation and verification summaries when available.',
    returns: {
      kind: 'latestCoordinationResult',
      description: 'An ephemeral runtime result bundle for the most recent coordination-driving interaction.',
      schema: { type: ['object', 'null'], additionalProperties: true },
    },
  }),
  listAvailableActions: makeMethodDescriptor({
    aliases: ['available_actions_list'],
    description: 'List the currently available workspace and widget action descriptors.',
    returns: {
      kind: 'actionDescriptor[]',
      description: 'Available action descriptors exposed by the current runtime workspace.',
      schema: {
        type: 'array',
        items: describeActionDescriptorSchema(),
      },
    },
  }),
  listAvailablePerceptions: makeMethodDescriptor({
    aliases: ['available_perceptions_list'],
    description: 'List the currently available perception-query descriptors.',
    returns: {
      kind: 'perceptionDescriptor[]',
      description: 'Available perception descriptors exposed by the current runtime workspace.',
      schema: {
        type: 'array',
        items: describePerceptionDescriptorSchema(),
      },
    },
  }),
  readState: makeMethodDescriptor({
    aliases: ['state_read'],
    description: 'Read the current workspace state or a delta restricted to selected refs using the stable agent-facing state surface.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        refs: REF_ARRAY_SCHEMA,
        deltaSince: STRING_SCHEMA,
      },
    },
    returns: {
      kind: 'workspaceState',
      description: 'The current workspace state snapshot, optionally scoped by refs and/or delta base.',
      schema: describeWorkspaceStateSchema(),
    },
  }),
  readView: makeMethodDescriptor({
    aliases: ['view_read'],
    description: 'Read the current workspace state or a delta restricted to selected refs.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        refs: REF_ARRAY_SCHEMA,
        deltaSince: STRING_SCHEMA,
      },
    },
    returns: {
      kind: 'workspaceState',
      description: 'The current workspace state snapshot, optionally scoped by refs and/or delta base.',
      schema: describeWorkspaceStateSchema(),
    },
  }),
  readSnapshot: makeMethodDescriptor({
    aliases: ['read_snapshot'],
    description: 'Read a historical workspace snapshot by stateId, optionally scoped to refs and enriched with metadata.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        stateId: STRING_SCHEMA,
        refs: REF_ARRAY_SCHEMA,
        includeMeta: BOOLEAN_SCHEMA,
      },
      required: ['stateId'],
    },
    returns: {
      kind: 'workspaceSnapshot',
      description: 'A historical workspace snapshot, optionally annotated with branch and transition metadata.',
      schema: describeWorkspaceSnapshotSchema(),
    },
  }),
  listStateHistory: makeMethodDescriptor({
    aliases: ['state_history_read'],
    description: 'List recent runtime state snapshots in reverse chronological order.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 500 },
        sinceStateId: STRING_SCHEMA,
        actors: { type: 'array', items: describeRuntimeActorSchema() },
      },
    },
    returns: {
      kind: 'stateSnapshotMeta[]',
      description: 'Recent state-history entries with branch/transition metadata.',
      schema: {
        type: 'array',
        items: describeStateSnapshotMetaSchema(),
      },
    },
  }),
  listBranches: makeMethodDescriptor({
    aliases: ['branch_list'],
    description: 'List known runtime branches and their lineage metadata.',
    returns: {
      kind: 'branchSummary[]',
      description: 'Branch records maintained by the runtime trace store.',
      schema: {
        type: 'array',
        items: describeBranchSummarySchema(),
      },
    },
  }),
  getFinalWorkspaceSnapshot: makeMethodDescriptor({
    aliases: ['workspace_snapshot_read'],
    description: 'Read the latest workspace snapshot for replay, inspection, or runtime history workflows.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        refs: REF_ARRAY_SCHEMA,
      },
    },
    returns: {
      kind: 'workspaceSnapshot',
      description: 'The latest workspace snapshot after current runtime state synchronization.',
      schema: describeWorkspaceSnapshotSchema(),
    },
  }),
  executeAction: makeMethodDescriptor({
    aliases: ['action_run'],
    description: 'Execute an intent-level WidgetVA action against a target ref or widget.',
    inputSchema: describeActionCallSchema(),
    returns: {
      kind: 'actionResult',
      description: 'An action execution envelope with updated refs, state patch, result payload, and verification hints.',
      schema: describeActionResultSchema(),
    },
    errors: PAGE_PORT_ERROR_CODES.action,
  }),
  executeVerifiedAction: makeMethodDescriptor({
    aliases: ['verified_action_run'],
    description: 'Execute an action and immediately return runtime verification evidence.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        call: describeActionCallSchema(),
        options: {
          type: 'object',
          additionalProperties: false,
          properties: {
            verify: BOOLEAN_SCHEMA,
            includeDeltaSince: BOOLEAN_SCHEMA,
            includeFinalSnapshotRefs: BOOLEAN_SCHEMA,
          },
        },
      },
      required: ['call'],
    },
    returns: {
      kind: 'verifiedActionResult',
      description: 'An action execution envelope augmented with post-action verification evidence.',
      schema: describeVerifiedActionResultSchema(),
    },
    errors: PAGE_PORT_ERROR_CODES.action,
  }),
  jumpToState: makeMethodDescriptor({
    aliases: ['jump_to_state'],
    description: 'Jump the runtime back to a historical state and replay it into the live workspace.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        callId: STRING_SCHEMA,
        actor: describeRuntimeActorSchema(),
        stateId: STRING_SCHEMA,
      },
      required: ['stateId'],
    },
    returns: {
      kind: 'actionResult',
      description: 'A workspace.jumpToState action result.',
      schema: describeActionResultSchema(),
    },
    errors: PAGE_PORT_ERROR_CODES.action,
  }),
  branchFromState: makeMethodDescriptor({
    aliases: ['branch_from_state'],
    description: 'Create and switch to a new runtime branch seeded from a historical state.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        callId: STRING_SCHEMA,
        actor: describeRuntimeActorSchema(),
        stateId: STRING_SCHEMA,
        branchLabel: STRING_SCHEMA,
      },
      required: ['stateId'],
    },
    returns: {
      kind: 'actionResult',
      description: 'A workspace.branchFromState action result.',
      schema: describeActionResultSchema(),
    },
    errors: PAGE_PORT_ERROR_CODES.action,
  }),
  queryPerception: makeMethodDescriptor({
    aliases: ['perception_query'],
    description: 'Execute a WidgetVA perception query against the current view or a target widget/data ref.',
    inputSchema: describePerceptionQueryCallSchema(),
    returns: {
      kind: 'perceptionResult',
      description: 'A perception query envelope carrying structured evidence.',
      schema: describePerceptionResultSchema(),
    },
    errors: PAGE_PORT_ERROR_CODES.perception,
  }),
  runDataQuery: makeMethodDescriptor({
    aliases: ['data_query_run'],
    description: 'Execute a lower-level WidgetVA data query against a materialized data handle using the stable agent-facing act surface.',
    inputSchema: describeDataQueryCallSchema(),
    returns: {
      kind: 'dataQueryResult',
      description: 'A data-query envelope with rows, aggregates, or diagnostics depending on query kind.',
      schema: describeDataQueryResultSchema(),
    },
    errors: PAGE_PORT_ERROR_CODES.dataQuery,
  }),
  queryData: makeMethodDescriptor({
    aliases: ['data_query'],
    description: 'Execute a lower-level WidgetVA data query against a materialized data handle.',
    inputSchema: describeDataQueryCallSchema(),
    returns: {
      kind: 'dataQueryResult',
      description: 'A data-query envelope with rows, aggregates, or diagnostics depending on query kind.',
      schema: describeDataQueryResultSchema(),
    },
    errors: PAGE_PORT_ERROR_CODES.dataQuery,
  }),
  readTrace: makeMethodDescriptor({
    aliases: ['trace_read'],
    description: 'Read the unified human+agent interaction trace from the runtime store using the stable verification surface.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 1000 },
        sinceStateId: STRING_SCHEMA,
        actors: { type: 'array', items: describeRuntimeActorSchema() },
      },
    },
    returns: {
      kind: 'interactionTraceRecord[]',
      description: 'Recent runtime interaction trace records.',
      schema: {
        type: 'array',
        items: describeInteractionTraceRecordSchema(),
      },
    },
  }),
  getInteractionTrace: makeMethodDescriptor({
    aliases: ['interaction_trace_read'],
    description: 'Read the unified human+agent interaction trace from the runtime store.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 1000 },
        sinceStateId: STRING_SCHEMA,
        actors: { type: 'array', items: describeRuntimeActorSchema() },
      },
    },
    returns: {
      kind: 'interactionTraceRecord[]',
      description: 'Recent runtime interaction trace records.',
      schema: {
        type: 'array',
        items: describeInteractionTraceRecordSchema(),
      },
    },
  }),
  replay: makeMethodDescriptor({
    aliases: ['workspace_replay'],
    description: 'Replay a historical state into the live workspace using the stable replay surface.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        callId: STRING_SCHEMA,
        actor: describeRuntimeActorSchema(),
        stateId: STRING_SCHEMA,
      },
      required: ['stateId'],
    },
    returns: {
      kind: 'actionResult',
      description: 'A workspace.jumpToState action result returned through the stable replay surface.',
      schema: describeActionResultSchema(),
    },
    errors: PAGE_PORT_ERROR_CODES.action,
  }),
  getTraceGraph: makeMethodDescriptor({
    aliases: ['trace_graph_read'],
    description: 'Read the runtime trace graph with branch and transition relationships.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 1000 },
        sinceStateId: STRING_SCHEMA,
        actors: { type: 'array', items: describeRuntimeActorSchema() },
      },
    },
    returns: {
      kind: 'traceGraph',
      description: 'A graph-friendly projection of runtime states and transitions.',
      schema: describeTraceGraphSchema(),
    },
  }),
  getLatestAgentResponse: makeMethodDescriptor({
    aliases: ['agent_response_read'],
    description: 'Read the latest recorded final response for the current or specified workspace.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        workspaceId: STRING_SCHEMA,
      },
    },
    returns: {
      kind: 'agentResponseRecord',
      description: 'Latest recorded final response, if available.',
      schema: {
        anyOf: [
          describeAgentResponseRecordSchema(),
          { type: 'null' },
        ],
      },
    },
  }),
  listAgentResponses: makeMethodDescriptor({
    aliases: ['agent_response_list'],
    description: 'List recent recorded final responses for the current or specified workspace.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 1000 },
        workspaceId: STRING_SCHEMA,
      },
    },
    returns: {
      kind: 'agentResponseRecord[]',
      description: 'Recent recorded final responses for the current or specified workspace.',
      schema: {
        type: 'array',
        items: describeAgentResponseRecordSchema(),
      },
    },
  }),
  evaluateLinkPropagation: makeMethodDescriptor({
    aliases: ['link_propagation_evaluate'],
    description: 'Evaluate the current propagation consistency for all outgoing links from a given source ref.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceRef: STRING_SCHEMA,
      },
      required: ['sourceRef'],
    },
    returns: {
      kind: 'linkPropagationEvaluation',
      description: 'Per-link consistency checks for runtime propagation semantics.',
      schema: describeLinkPropagationEvaluationSchema(),
    },
  }),
  recordAgentResponse: makeMethodDescriptor({
    aliases: ['agent_response_record'],
    description: 'Record a final response for the current workspace, produced by the agent or another runtime actor, for later history and inspection workflows.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['content'],
      properties: {
        responseId: STRING_SCHEMA,
        runId: STRING_SCHEMA,
        sessionId: STRING_SCHEMA,
        actor: describeRuntimeActorSchema(),
        mode: STRING_SCHEMA,
        query: STRING_SCHEMA,
        content: STRING_SCHEMA,
        evidenceRefs: REF_ARRAY_SCHEMA,
      },
    },
    returns: {
      kind: 'agentResponseRecord',
      description: 'The recorded final-response record with runtime lineage metadata.',
      schema: describeAgentResponseRecordSchema(),
    },
  }),
}

export const PAGE_PORT_METHOD_SCHEMA_KEYS = {
  describePagePort: ['pagePortDescription'],
  describeWorkspace: ['workspaceDescription'],
  parseRef: ['refParts'],
  describeRuntimeCore: ['runtimeCoreSummary'],
  describeRuntimeStore: ['runtimeStoreSummary'],
  describeWidgetRegistry: ['widgetRegistrySummary'],
  describeActionExecutor: ['actionExecutorSummary'],
  describeActionContext: ['actionContextSummary'],
  describeActionUsage: [
    'actionUsageSummary',
    'actionUsageSpecContext',
    'actionUsageFieldRoles',
    'actionUsageFieldRoleMap',
    'actionUsageFieldCandidates',
    'actionUsageFieldExplanation',
    'actionUsageParamRole',
    'actionUsageParamRoles',
    'actionUsageEntry',
  ],
  describePerceptionRegistry: ['perceptionRegistrySummary'],
  describePerceptionContext: ['perceptionContextSummary'],
  describeDataQueryExecutor: ['dataQueryExecutorSummary'],
  describeDataQueryContext: ['dataQueryContextSummary'],
  describeDataQueryEngine: ['dataQueryEngineSummary'],
  describeStateManager: ['stateManagerSummary'],
  describeTraceRecorder: ['traceRecorderSummary'],
  describeResponseRecorder: ['responseRecorderSummary'],
  describeLinkEngine: ['linkEngineSummary'],
  planWorkspace: ['workspacePlanningRequest', 'workspacePlanningResult'],
  describeAgentLoop: ['agentLoopContext'],
  listWidgetAdapters: ['widgetAdapterSummary'],
  readObservation: [],
  readCoordinationState: [],
  readPropagationSummary: [],
  readLatestCoordinationResult: [],
  listAvailableActions: ['actionDescriptor'],
  listAvailablePerceptions: ['perceptionDescriptor'],
  readState: ['workspaceState'],
  readView: ['workspaceState'],
  readSnapshot: ['workspaceSnapshot'],
  listStateHistory: ['stateSnapshotMeta'],
  listBranches: ['branchSummary'],
  getFinalWorkspaceSnapshot: ['workspaceSnapshot'],
  executeAction: ['actionCall', 'actionResult'],
  executeVerifiedAction: ['verifiedActionResult'],
  jumpToState: ['actionResult'],
  branchFromState: ['actionResult'],
  queryPerception: ['perceptionQueryCall', 'perceptionResult'],
  runDataQuery: ['dataQueryCall', 'dataQueryResult'],
  queryData: ['dataQueryCall', 'dataQueryResult'],
  readTrace: ['interactionTraceRecord'],
  getInteractionTrace: ['interactionTraceRecord'],
  replay: ['actionResult'],
  getTraceGraph: ['traceGraph'],
  getLatestAgentResponse: ['agentResponseRecord'],
  listAgentResponses: ['agentResponseRecord'],
  evaluateLinkPropagation: ['linkPropagationEvaluation'],
  recordAgentResponse: ['agentResponseRecord'],
}

export function describePagePortSchemas() {
  return cloneValue({
    pagePortDescription: describePagePortDescriptionSchema(),
    pagePortErrorDescriptor: describePagePortErrorDescriptorSchema(),
    pagePortMethodReturn: describePagePortMethodReturnSchema(),
    pagePortMethodExample: describePagePortMethodExampleSchema(),
    pagePortMethodDescriptor: describePagePortMethodDescriptorSchema(),
    pagePortMethodDescriptorMap: describePagePortMethodDescriptorMapSchema(),
    pagePortAliasMap: describePagePortAliasMapSchema(),
    pagePortErrorCatalog: describePagePortErrorCatalogSchema(),
    runtimeActor: describeRuntimeActorSchema(),
    widgetDescription: describeWidgetDescriptionSchema(),
    widgetKind: describeWidgetKindSchema(),
    widgetAnalyticRole: describeWidgetAnalyticRoleSchema(),
    widgetHumanInteractionMode: describeWidgetHumanInteractionModeSchema(),
    workspaceDescription: describeWorkspaceDescriptionSchema(),
    workspaceCapability: describeWorkspaceCapabilitySchema(),
    workspaceTransportHints: describeWorkspaceTransportHintsSchema(),
    workspaceDescriptionPlanning: describeWorkspaceDescriptionPlanningSchema(),
    actionDescriptor: describeActionDescriptorSchema(),
    actionPrimitive: describeActionPrimitiveSchema(),
    actionCategory: describeActionCategorySchema(),
    actionEffectKind: describeActionEffectKindSchema(),
    actionCall: describeActionCallSchema(),
    perceptionDescriptor: describePerceptionDescriptorSchema(),
    perceptionCategory: describePerceptionCategorySchema(),
    perceptionSummaryGroups: describePerceptionSummaryGroupsSchema(),
    perceptionInspectViewConfigResult: describePerceptionInspectViewConfigResultSchema(),
    perceptionInspectVisibleRowsResult: describePerceptionInspectVisibleRowsResultSchema(),
    perceptionSummarizeSelectionResult: describePerceptionSummarizeSelectionResultSchema(),
    perceptionSummarizeVisibleResult: describePerceptionSummarizeVisibleResultSchema(),
    perceptionVerifyActionEffectParams: describePerceptionVerifyActionEffectParamsSchema(),
    perceptionVerifyActionEffectResult: describePerceptionVerifyActionEffectResultSchema(),
    perceptionQueryCall: describePerceptionQueryCallSchema(),
    dataHandle: describeDataHandleSchema(),
    dataRecord: describeDataRecordSchema(),
    dataSummaryRow: describeDataSummaryRowSchema(),
    dataSchemaResult: describeDataSchemaResultSchema(),
    dataRowsResult: describeDataRowsResultSchema(),
    dataSummaryTable: describeDataSummaryTableSchema(),
    dataGroupComparisonResult: describeDataGroupComparisonResultSchema(),
    dataQueryPredicate: describeDataQueryPredicateSchema(),
    dataQueryMeasure: describeDataQueryMeasureSchema(),
    dataQuerySqlSpec: describeDataQuerySqlSpecSchema(),
    dataQuerySummarySpec: describeDataQuerySummarySpecSchema(),
    dataQueryCorrelationSpec: describeDataQueryCorrelationSpecSchema(),
    dataQueryExtremesSpec: describeDataQueryExtremesSpecSchema(),
    dataQueryOutliersSpec: describeDataQueryOutliersSpecSchema(),
    dataQueryCompareGroupsSpec: describeDataQueryCompareGroupsSpecSchema(),
    dataQueryAggregateSpec: describeDataQueryAggregateSpecSchema(),
    dataQueryCallQuery: describeDataQueryCallQuerySchema(),
    dataQueryDescriptor: describeDataQueryDescriptorSchema(),
    dataQueryCall: describeDataQueryCallSchema(),
    runtimeCoreSummary: describeRuntimeCoreSummarySchema(),
    runtimeCoreComponents: describeRuntimeCoreComponentsSchema(),
    runtimeCoreRegistries: describeRuntimeCoreRegistriesSchema(),
    runtimeCoreCapabilities: describeRuntimeCoreCapabilitiesSchema(),
    runtimeStoreSummary: describeRuntimeStoreSummarySchema(),
    runtimeStoreIdentity: describeRuntimeStoreIdentitySchema(),
    runtimeStoreStateSummary: describeRuntimeStoreStateSummarySchema(),
    runtimeStoreIndexes: describeRuntimeStoreIndexesSchema(),
    runtimeStoreHistory: describeRuntimeStoreHistorySchema(),
    runtimeStoreRetention: describeRuntimeStoreRetentionSchema(),
    runtimeStoreCapabilities: describeRuntimeStoreCapabilitiesSchema(),
    widgetRegistrySummary: describeWidgetRegistrySummarySchema(),
    widgetRegistryCounts: describeWidgetRegistryCountsSchema(),
    widgetRegistryRefs: describeWidgetRegistryRefsSchema(),
    actionExecutorSummary: describeActionExecutorSummarySchema(),
    actionExecutorCounts: describeActionExecutorCountsSchema(),
    actionExecutorCapabilities: describeActionExecutorCapabilitiesSchema(),
    actionExecutorActionEntry: describeActionExecutorActionEntrySchema(),
    actionContextSummary: describeActionContextSummarySchema(),
    actionUsageSummary: describeActionUsageSummarySchema(),
    actionUsageSpecContext: describeActionUsageSpecContextSchema(),
    actionUsageFieldRoles: describeActionUsageFieldRolesSchema(),
    actionUsageFieldRoleMap: describeActionUsageFieldRoleMapSchema(),
    actionUsageFieldCandidates: describeActionUsageFieldCandidatesSchema(),
    actionUsageFieldExplanation: describeActionUsageFieldExplanationSchema(),
    actionUsageParamRole: describeActionUsageParamRoleSchema(),
    actionUsageParamRoles: describeActionUsageParamRolesSchema(),
    actionUsageEntry: describeActionUsageEntrySchema(),
    perceptionRegistrySummary: describePerceptionRegistrySummarySchema(),
    perceptionContextSummary: describePerceptionContextSummarySchema(),
    perceptionRegistryCounts: describePerceptionRegistryCountsSchema(),
    perceptionRegistryCapabilities: describePerceptionRegistryCapabilitiesSchema(),
    perceptionRegistryQueryEntry: describePerceptionRegistryQueryEntrySchema(),
    dataQueryExecutorSummary: describeDataQueryExecutorSummarySchema(),
    dataQueryContextSummary: describeDataQueryContextSummarySchema(),
    dataQueryExecutorEngineSummary: describeDataQueryExecutorEngineSummarySchema(),
    dataQueryExecutorCounts: describeDataQueryExecutorCountsSchema(),
    dataQueryExecutorCapabilities: describeDataQueryExecutorCapabilitiesSchema(),
    dataQueryEngineSummary: describeDataQueryEngineSummarySchema(),
    stateManagerSummary: describeStateManagerSummarySchema(),
    stateManagerCapabilities: describeStateManagerCapabilitiesSchema(),
    stateManagerCounters: describeStateManagerCountersSchema(),
    traceRecorderSummary: describeTraceRecorderSummarySchema(),
    traceRecorderCapabilities: describeTraceRecorderCapabilitiesSchema(),
    traceRecorderCounters: describeTraceRecorderCountersSchema(),
    traceRecorderEventKinds: describeTraceRecorderEventKindsSchema(),
    responseRecorderSummary: describeResponseRecorderSummarySchema(),
    responseRecorderCapabilities: describeResponseRecorderCapabilitiesSchema(),
    responseRecorderCounters: describeResponseRecorderCountersSchema(),
    agentResponseRecord: describeAgentResponseRecordSchema(),
    linkEngineSummary: describeLinkEngineSummarySchema(),
    workspaceSpec: describeWorkspaceSpecSchema(),
    ref: describeRefSchema(),
    refParts: describeRefPartsSchema(),
    fieldEncoding: describeFieldEncodingSchema(),
    fieldScale: describeFieldScaleSchema(),
    transformState: describeTransformStateSchema(),
    selectionDomain: describeSelectionDomainSchema(),
    selectionPredicate: describeSelectionPredicateSchema(),
    selectionValue: describeSelectionValueSchema(),
    selectionState: describeSelectionStateSchema(),
    interactionHoveredItem: describeInteractionHoveredItemSchema(),
    interactionTooltip: describeInteractionTooltipSchema(),
    interactionFeedbackState: describeInteractionFeedbackStateSchema(),
    widgetDataState: describeWidgetDataStateSchema(),
    widgetEncodingsState: describeWidgetEncodingsStateSchema(),
    widgetSelectionsState: describeWidgetSelectionsStateSchema(),
    viewTransformState: describeViewTransformStateSchema(),
    workspaceAnnotation: describeWorkspaceAnnotationSchema(),
    widgetState: describeWidgetStateSchema(),
    workspaceSharedState: describeWorkspaceSharedStateSchema(),
    workspaceTaskContext: describeWorkspaceTaskContextSchema(),
    workspaceDelta: describeWorkspaceDeltaSchema(),
    workspaceState: describeWorkspaceStateSchema(),
    widgetLink: describeWidgetLinkSchema(),
    widgetLinkKind: describeWidgetLinkKindSchema(),
    widgetLinkEffect: describeWidgetLinkEffectSchema(),
    workspacePlanningTask: describeWorkspacePlanningTaskSchema(),
    workspaceWidgetPlanSource: describeWorkspaceWidgetPlanSourceSchema(),
    workspaceWidgetPlanMetric: describeWorkspaceWidgetPlanMetricSchema(),
    workspaceWidgetPlanSort: describeWorkspaceWidgetPlanSortSchema(),
    workspaceWidgetPlanTransform: describeWorkspaceWidgetPlanTransformSchema(),
    workspaceWidgetDataBinding: describeWorkspaceWidgetDataBindingSchema(),
    workspaceLinkFieldMapping: describeWorkspaceLinkFieldMappingSchema(),
    workspacePlanningRequest: describeWorkspacePlanningRequestSchema(),
    workspacePlanningResult: describeWorkspacePlanningResultSchema(),
    agentLoopContext: describeAgentLoopContextSchema(),
    agentLoopHints: describeAgentLoopHintsSchema(),
    verifiedActionEvidence: describeVerifiedActionEvidenceSchema(),
    verifiedActionResult: describeVerifiedActionResultSchema(),
    resultError: describeResultErrorSchema(),
    actionResult: describeActionResultSchema(),
    perceptionResult: describePerceptionResultSchema(),
    dataQueryResult: describeDataQueryResultSchema(),
    stateSnapshotMeta: describeStateSnapshotMetaSchema(),
    workspaceSnapshot: describeWorkspaceSnapshotSchema(),
    workspaceSnapshotMeta: describeWorkspaceSnapshotMetaSchema(),
    workspaceReplayContext: describeWorkspaceReplayContextSchema(),
    branchSummary: describeBranchSummarySchema(),
    traceGraph: describeTraceGraphSchema(),
    traceGraphNode: describeTraceGraphNodeSchema(),
    traceGraphEdge: describeTraceGraphEdgeSchema(),
    linkPropagationCheck: describeLinkPropagationCheckSchema(),
    linkPropagationResult: describeLinkPropagationResultSchema(),
    linkPropagationEvaluation: describeLinkPropagationEvaluationSchema(),
    widgetAdapterSummary: describeWidgetAdapterSummarySchema(),
    widgetAdapterProviderCapabilities: describeWidgetAdapterProviderCapabilitiesSchema(),
    widgetAdapterHumanInteraction: describeWidgetAdapterHumanInteractionSchema(),
    widgetAdapterCapabilities: describeWidgetAdapterCapabilitiesSchema(),
    interactionTraceActor: describeInteractionTraceActorSchema(),
    interactionTraceEventKind: describeInteractionTraceEventKindSchema(),
    interactionTraceRecord: describeInteractionTraceRecordSchema(),
  })
}

export function describePagePortSchemasForMethods(methods = PAGE_PORT_METHODS) {
  const allSchemas = describePagePortSchemas()
  const selectedKeys = new Set(
    (Array.isArray(methods) ? methods : [])
      .flatMap((methodName) => PAGE_PORT_METHOD_SCHEMA_KEYS[methodName] || []),
  )
  return Object.fromEntries(
    Object.entries(allSchemas).filter(([schemaKey]) => selectedKeys.has(schemaKey)),
  )
}

export function describePagePortCapabilities(overrides = {}) {
  return makePagePortDescription(overrides)
}
