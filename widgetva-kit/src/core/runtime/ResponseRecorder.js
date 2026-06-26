import {
  makeAgentResponseRecord,
  makeResponseRecorderCapabilities,
  makeResponseRecorderCounters,
  makeResponseRecorderSummary,
} from '../protocol/responses.js'

export class ResponseRecorder {
  constructor({ store }) {
    this.store = store
  }

  recordResponse({
    responseId,
    runId = null,
    sessionId = null,
    actor = 'agent',
    mode = null,
    query = null,
    content,
    evidenceRefs = [],
    usage = null,
  } = {}) {
    const safeContent = String(content || '').trim()
    if (!safeContent) {
      throw new Error('ResponseRecorder.recordResponse requires non-empty content.')
    }
    const state = this.store.readState()
    const record = makeAgentResponseRecord({
      responseId: responseId || `response_${Date.now()}`,
      runId: runId || null,
      sessionId: sessionId || this.store.workspaceId || null,
      workspaceId: this.store.workspaceId || null,
      actor,
      mode: mode || null,
      query: query ? String(query) : null,
      content: safeContent,
      stateId: state?.stateId || null,
      branchId: this.store.currentBranchId || null,
      evidenceRefs: Array.isArray(evidenceRefs) ? [...evidenceRefs] : [],
      usage: usage && typeof usage === 'object' ? usage : null,
      createdAt: new Date().toISOString(),
    })
    this.store.appendResponse(record)
    return record
  }

  readLatestResponse(options = {}) {
    return this.store.readLatestResponse(options)
  }

  listResponses(limit = 20, options = {}) {
    return this.store.listResponses(limit, options)
  }

  describeRecorder() {
    const workspaceId = this.store.workspaceId || null
    const latest = this.store.readLatestResponse({ workspaceId }) || null
    const responses = Array.isArray(this.store?.responseHistory)
      ? this.store.responseHistory.filter((record) => {
          if (!workspaceId) return true
          return record?.workspaceId === workspaceId
        })
      : []
    return makeResponseRecorderSummary({
      capabilities: makeResponseRecorderCapabilities({
        recordsFinalResponses: true,
        latestResponseRead: true,
        responseHistoryRead: true,
        workspaceScopedReads: true,
        lineageTracking: true,
      }),
      counters: makeResponseRecorderCounters({
        workspaceId,
        responseCount: responses.length,
        latestResponseId: latest?.responseId || null,
        latestRunId: latest?.runId || null,
        latestStateId: latest?.stateId || null,
        latestBranchId: latest?.branchId || null,
        latestActor: latest?.actor || null,
        latestMode: latest?.mode || null,
        latestQuery: latest?.query || null,
        latestEvidenceRefCount: Array.isArray(latest?.evidenceRefs) ? latest.evidenceRefs.length : 0,
      }),
    })
  }
}
