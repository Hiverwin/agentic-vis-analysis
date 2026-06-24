import { describeRuntimeActorSchema } from './actors.js'
import { describeRefSchema } from './refs.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function makeAgentResponseUsage(usage) {
  return {
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    tokenCost: null,
    tokenCostUnit: null,
    ...usage,
  }
}

export function makeAgentResponseRecord(record) {
  return {
    responseId: '',
    runId: null,
    sessionId: null,
    workspaceId: null,
    actor: 'agent',
    mode: null,
    query: null,
    content: '',
    stateId: null,
    branchId: null,
    evidenceRefs: [],
    coordinationEvidence: null,
    usage: makeAgentResponseUsage(),
    createdAt: new Date().toISOString(),
    ...record,
    usage: record?.usage ? makeAgentResponseUsage(record.usage) : makeAgentResponseUsage(),
  }
}

export function makeResponseRecorderCapabilities(capabilities) {
  return {
    recordsFinalResponses: true,
    latestResponseRead: true,
    responseHistoryRead: true,
    workspaceScopedReads: true,
    lineageTracking: true,
    ...capabilities,
  }
}

export function makeResponseRecorderCounters(counters) {
  return {
    workspaceId: null,
    responseCount: 0,
    latestResponseId: null,
    latestRunId: null,
    latestStateId: null,
    latestBranchId: null,
    latestActor: null,
    latestMode: null,
    latestQuery: null,
    latestEvidenceRefCount: 0,
    ...counters,
  }
}

export function makeResponseRecorderSummary(summary) {
  return {
    ...summary,
    capabilities: makeResponseRecorderCapabilities(summary?.capabilities),
    counters: makeResponseRecorderCounters(summary?.counters),
  }
}

export function describeAgentResponseRecordSchema() {
  return cloneValue({
    type: 'object',
    required: ['responseId', 'actor', 'content', 'createdAt'],
    properties: {
      responseId: { type: 'string' },
      runId: { type: ['string', 'null'] },
      sessionId: { type: ['string', 'null'] },
      workspaceId: { type: ['string', 'null'] },
      actor: describeRuntimeActorSchema(),
      mode: { type: ['string', 'null'] },
      query: { type: ['string', 'null'] },
      content: { type: 'string' },
      stateId: { type: ['string', 'null'] },
      branchId: { type: ['string', 'null'] },
      evidenceRefs: { type: 'array', items: describeRefSchema() },
      coordinationEvidence: {
        anyOf: [
          { type: 'null' },
          { type: 'object', additionalProperties: true },
        ],
      },
      usage: {
        type: 'object',
        properties: {
          promptTokens: { type: ['number', 'null'] },
          completionTokens: { type: ['number', 'null'] },
          totalTokens: { type: ['number', 'null'] },
          tokenCost: { type: ['number', 'null'] },
          tokenCostUnit: { type: ['string', 'null'] },
        },
      },
      createdAt: { type: 'string' },
    },
  })
}

export function describeResponseRecorderCapabilitiesSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      recordsFinalResponses: { type: 'boolean' },
      latestResponseRead: { type: 'boolean' },
      responseHistoryRead: { type: 'boolean' },
      workspaceScopedReads: { type: 'boolean' },
      lineageTracking: { type: 'boolean' },
    },
  })
}

export function describeResponseRecorderCountersSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      workspaceId: { type: ['string', 'null'] },
      responseCount: { type: 'integer' },
      latestResponseId: { type: ['string', 'null'] },
      latestRunId: { type: ['string', 'null'] },
      latestStateId: { type: ['string', 'null'] },
      latestBranchId: { type: ['string', 'null'] },
      latestActor: {
        anyOf: [describeRuntimeActorSchema(), { type: 'null' }],
      },
      latestMode: { type: ['string', 'null'] },
      latestQuery: { type: ['string', 'null'] },
      latestEvidenceRefCount: { type: 'integer' },
    },
  })
}

export function describeResponseRecorderSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['capabilities', 'counters'],
    properties: {
      capabilities: describeResponseRecorderCapabilitiesSchema(),
      counters: describeResponseRecorderCountersSchema(),
    },
  })
}
