import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTraceItemsFromAgentResponses } from './runtimeResponseTrace.js'

test('buildTraceItemsFromAgentResponses scopes runtime response history to the active session and reconstructs chat order', () => {
  const traceItems = buildTraceItemsFromAgentResponses([
    {
      responseId: 'response_2',
      sessionId: 'session_b',
      actor: 'agent',
      query: 'Should not appear',
      content: 'From another session',
      createdAt: '2026-01-01T00:00:02.000Z',
    },
    {
      responseId: 'response_1',
      sessionId: 'session_a',
      actor: 'agent',
      query: 'Summarize the visible outliers',
      content: 'There are two visible outliers.',
      createdAt: '2026-01-01T00:00:01.000Z',
    },
    {
      responseId: 'response_3',
      sessionId: null,
      actor: 'system',
      query: '',
      content: 'Legacy runtime note',
      createdAt: '2026-01-01T00:00:03.000Z',
    },
  ], {
    sessionId: 'session_a',
  })

  assert.deepEqual(traceItems, [
    {
      id: 'runtime-query-response_1',
      type: 'user',
      role: 'user',
      content: 'Summarize the visible outliers',
      source: 'runtime_response',
      responseId: 'response_1',
    },
    {
      id: 'runtime-response-response_1',
      type: 'assistant',
      role: 'assistant',
      content: 'There are two visible outliers.',
      source: 'runtime_response',
      responseId: 'response_1',
    },
    {
      id: 'runtime-response-response_3',
      type: 'system',
      role: 'system',
      content: 'Legacy runtime note',
      source: 'runtime_response',
      responseId: 'response_3',
    },
  ])
})
