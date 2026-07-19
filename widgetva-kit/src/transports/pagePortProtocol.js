import { ACTION_CALL_SCHEMA } from '../schemas/actions.schema.js'
import { RUNTIME_ACTOR_SCHEMA } from '../schemas/actors.schema.js'
import { DATA_QUERY_CALL_SCHEMA } from '../schemas/data-handles.schema.js'
import { PERCEPTION_QUERY_CALL_SCHEMA } from '../schemas/perception.schema.js'
import { REF_SCHEMA } from '../schemas/refs.schema.js'

export const PAGE_PORT_METHODS = [
  'describePagePort',
  'describeWorkspace',
  'parseRef',
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
  state_read: 'readState',
  view_read: 'readView',
  read_snapshot: 'readSnapshot',
  state_history_read: 'listStateHistory',
  branch_list: 'listBranches',
  action_run: 'executeAction',
  verified_action_run: 'executeVerifiedAction',
  jump_to_state: 'jumpToState',
  branch_from_state: 'branchFromState',
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

export function makePagePortProtocolMethodDescriptor(descriptor) {
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

const BOOLEAN_SCHEMA = { type: 'boolean' }
const STRING_SCHEMA = { type: 'string' }
const REF_ARRAY_SCHEMA = { type: 'array', items: { type: 'string' } }

const STATE_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    refs: REF_ARRAY_SCHEMA,
    deltaSince: STRING_SCHEMA,
  },
}

const TRACE_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 1000 },
    sinceStateId: STRING_SCHEMA,
    actors: { type: 'array', items: RUNTIME_ACTOR_SCHEMA },
  },
}

export const PAGE_PORT_METHOD_DESCRIPTORS = {
  describePagePort: makePagePortProtocolMethodDescriptor({
    description: 'Describe the installed WidgetVA page port, including stable methods, aliases, schemas, and error semantics.',
    returns: {
      kind: 'pagePortDescription',
      description: 'A stable description of the external WidgetVA page API.',
    },
  }),
  describeWorkspace: makePagePortProtocolMethodDescriptor({
    aliases: ['workspace_describe'],
    description: 'Describe the current workspace, widgets, data handles, links, and externally callable action/perception surfaces.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        includeSchemas: BOOLEAN_SCHEMA,
        includeExamples: BOOLEAN_SCHEMA,
      },
    },
    returns: {
      kind: 'workspaceDescription',
      description: 'A workspace-level description for external callers.',
    },
  }),
  parseRef: makePagePortProtocolMethodDescriptor({
    aliases: ['ref_parse'],
    description: 'Parse a WidgetVA ref string into structured ref parts.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ref: REF_SCHEMA,
      },
      required: ['ref'],
    },
    returns: {
      kind: 'refParts',
      description: 'Structured app/workspace/kind/id components parsed from a WidgetVA ref.',
    },
  }),
  readState: makePagePortProtocolMethodDescriptor({
    aliases: ['state_read'],
    description: 'Read the current workspace state or a delta restricted to selected refs.',
    inputSchema: STATE_READ_SCHEMA,
    returns: {
      kind: 'workspaceState',
      description: 'The current workspace state snapshot, optionally scoped by refs and/or delta base.',
    },
  }),
  readView: makePagePortProtocolMethodDescriptor({
    aliases: ['view_read'],
    description: 'Read the current workspace view/state projection.',
    inputSchema: STATE_READ_SCHEMA,
    returns: {
      kind: 'workspaceState',
      description: 'The current workspace state snapshot, optionally scoped by refs and/or delta base.',
    },
  }),
  readSnapshot: makePagePortProtocolMethodDescriptor({
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
      description: 'A historical workspace snapshot.',
    },
  }),
  listStateHistory: makePagePortProtocolMethodDescriptor({
    aliases: ['state_history_read'],
    description: 'List recent runtime state snapshots in reverse chronological order.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 500 },
        sinceStateId: STRING_SCHEMA,
        actors: { type: 'array', items: RUNTIME_ACTOR_SCHEMA },
      },
    },
    returns: {
      kind: 'stateSnapshotMeta[]',
      description: 'Recent state-history entries with branch/transition metadata.',
    },
  }),
  listBranches: makePagePortProtocolMethodDescriptor({
    aliases: ['branch_list'],
    description: 'List known runtime branches and their lineage metadata.',
    returns: {
      kind: 'branchSummary[]',
      description: 'Branch records maintained by the runtime trace store.',
    },
  }),
  executeAction: makePagePortProtocolMethodDescriptor({
    aliases: ['action_run'],
    description: 'Execute a WidgetVA action against a target ref or widget.',
    inputSchema: ACTION_CALL_SCHEMA,
    returns: {
      kind: 'actionResult',
      description: 'An action execution envelope with state, trace, and verification hints.',
    },
    errors: PAGE_PORT_ERROR_CODES.action,
  }),
  executeVerifiedAction: makePagePortProtocolMethodDescriptor({
    aliases: ['verified_action_run'],
    description: 'Execute an action and immediately return runtime verification evidence.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        call: ACTION_CALL_SCHEMA,
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
    },
    errors: PAGE_PORT_ERROR_CODES.action,
  }),
  jumpToState: makePagePortProtocolMethodDescriptor({
    aliases: ['jump_to_state'],
    description: 'Jump the runtime back to a historical state and replay it into the live workspace.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        callId: STRING_SCHEMA,
        actor: RUNTIME_ACTOR_SCHEMA,
        stateId: STRING_SCHEMA,
      },
      required: ['stateId'],
    },
    returns: {
      kind: 'actionResult',
      description: 'A workspace.jumpToState action result.',
    },
    errors: PAGE_PORT_ERROR_CODES.action,
  }),
  branchFromState: makePagePortProtocolMethodDescriptor({
    aliases: ['branch_from_state'],
    description: 'Create and switch to a new runtime branch seeded from a historical state.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        callId: STRING_SCHEMA,
        actor: RUNTIME_ACTOR_SCHEMA,
        stateId: STRING_SCHEMA,
        branchLabel: STRING_SCHEMA,
      },
      required: ['stateId'],
    },
    returns: {
      kind: 'actionResult',
      description: 'A workspace.branchFromState action result.',
    },
    errors: PAGE_PORT_ERROR_CODES.action,
  }),
  queryPerception: makePagePortProtocolMethodDescriptor({
    aliases: ['perception_query'],
    description: 'Execute a WidgetVA perception query against the current view or a target widget/data ref.',
    inputSchema: PERCEPTION_QUERY_CALL_SCHEMA,
    returns: {
      kind: 'perceptionResult',
      description: 'A perception query envelope carrying structured evidence.',
    },
    errors: PAGE_PORT_ERROR_CODES.perception,
  }),
  runDataQuery: makePagePortProtocolMethodDescriptor({
    aliases: ['data_query_run'],
    description: 'Execute a WidgetVA data query against a materialized data handle.',
    inputSchema: DATA_QUERY_CALL_SCHEMA,
    returns: {
      kind: 'dataQueryResult',
      description: 'A data-query envelope with rows, aggregates, or diagnostics depending on query kind.',
    },
    errors: PAGE_PORT_ERROR_CODES.dataQuery,
  }),
  queryData: makePagePortProtocolMethodDescriptor({
    aliases: ['data_query'],
    description: 'Execute a WidgetVA data query against a materialized data handle.',
    inputSchema: DATA_QUERY_CALL_SCHEMA,
    returns: {
      kind: 'dataQueryResult',
      description: 'A data-query envelope with rows, aggregates, or diagnostics depending on query kind.',
    },
    errors: PAGE_PORT_ERROR_CODES.dataQuery,
  }),
  readTrace: makePagePortProtocolMethodDescriptor({
    aliases: ['trace_read'],
    description: 'Read the unified human+agent interaction trace from the runtime store.',
    inputSchema: TRACE_READ_SCHEMA,
    returns: {
      kind: 'interactionTraceRecord[]',
      description: 'Recent runtime interaction trace records.',
    },
  }),
  getInteractionTrace: makePagePortProtocolMethodDescriptor({
    aliases: ['interaction_trace_read'],
    description: 'Read the unified human+agent interaction trace from the runtime store.',
    inputSchema: TRACE_READ_SCHEMA,
    returns: {
      kind: 'interactionTraceRecord[]',
      description: 'Recent runtime interaction trace records.',
    },
  }),
  replay: makePagePortProtocolMethodDescriptor({
    aliases: ['workspace_replay'],
    description: 'Replay a historical state into the live workspace.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        callId: STRING_SCHEMA,
        actor: RUNTIME_ACTOR_SCHEMA,
        stateId: STRING_SCHEMA,
      },
      required: ['stateId'],
    },
    returns: {
      kind: 'actionResult',
      description: 'A workspace.jumpToState action result.',
    },
    errors: PAGE_PORT_ERROR_CODES.action,
  }),
  getTraceGraph: makePagePortProtocolMethodDescriptor({
    aliases: ['trace_graph_read'],
    description: 'Read the runtime trace graph with branch and transition relationships.',
    inputSchema: TRACE_READ_SCHEMA,
    returns: {
      kind: 'traceGraph',
      description: 'A graph-friendly projection of runtime states and transitions.',
    },
  }),
  getLatestAgentResponse: makePagePortProtocolMethodDescriptor({
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
    },
  }),
  listAgentResponses: makePagePortProtocolMethodDescriptor({
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
    },
  }),
  evaluateLinkPropagation: makePagePortProtocolMethodDescriptor({
    aliases: ['link_propagation_evaluate'],
    description: 'Evaluate current propagation consistency for outgoing links from a source ref.',
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
    },
  }),
  recordAgentResponse: makePagePortProtocolMethodDescriptor({
    aliases: ['agent_response_record'],
    description: 'Record a final response for the current workspace for later history and inspection workflows.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['content'],
      properties: {
        responseId: STRING_SCHEMA,
        runId: STRING_SCHEMA,
        sessionId: STRING_SCHEMA,
        actor: RUNTIME_ACTOR_SCHEMA,
        mode: STRING_SCHEMA,
        query: STRING_SCHEMA,
        content: STRING_SCHEMA,
        evidenceRefs: REF_ARRAY_SCHEMA,
      },
    },
    returns: {
      kind: 'agentResponseRecord',
      description: 'The recorded final-response record with runtime lineage metadata.',
    },
  }),
}
