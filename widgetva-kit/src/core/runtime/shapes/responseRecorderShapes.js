export function makeAgentResponseUsage(usage = {}) {
  return {
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    tokenCost: null,
    tokenCostUnit: null,
    ...usage,
  }
}

export function makeAgentResponseRecord(record = {}) {
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

export function makeResponseRecorderCapabilities(capabilities = {}) {
  return {
    recordsFinalResponses: true,
    latestResponseRead: true,
    responseHistoryRead: true,
    workspaceScopedReads: true,
    lineageTracking: true,
    ...capabilities,
  }
}

export function makeResponseRecorderCounters(counters = {}) {
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

export function makeResponseRecorderSummary(summary = {}) {
  return {
    ...summary,
    capabilities: makeResponseRecorderCapabilities(summary?.capabilities),
    counters: makeResponseRecorderCounters(summary?.counters),
  }
}
