import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeInteractionTraceRecordSummarySchema,
  describeInteractionTraceRecordSchema,
  getInteractionTraceEventFamily,
  getInteractionTraceQuerySurface,
  makeInteractionTraceRecord,
  makeInteractionTraceRecordSummary,
} from './interactionTrace.js'

test('makeInteractionTraceRecord derives normalized query family and surface for data queries', () => {
  const record = makeInteractionTraceRecord({
    eventKind: 'dataQuery',
    query: {
      dataRef: 'wl://widgetva-app/workspace/main/data/current_view',
      query: { kind: 'summary', spec: {} },
    },
  })

  assert.equal(record.eventFamily, 'query')
  assert.equal(record.querySurface, 'data')
})

test('interaction trace schema admits normalized eventFamily and querySurface fields', () => {
  const schema = describeInteractionTraceRecordSchema()

  assert.ok(schema.required.includes('eventFamily'))
  assert.equal(schema.properties.eventFamily.enum.includes('query'), true)
  assert.equal(schema.properties.querySurface.anyOf[1].enum.includes('perception'), true)
  assert.equal(getInteractionTraceEventFamily('perceptionQuery'), 'query')
  assert.equal(getInteractionTraceQuerySurface('dataQuery'), 'data')
})

test('makeInteractionTraceRecordSummary defaults normalized trace summary fields', () => {
  const summary = makeInteractionTraceRecordSummary({
    displayName: 'data.summary',
    actor: 'human',
    querySurface: 'data',
  })
  const schema = describeInteractionTraceRecordSummarySchema()

  assert.equal(summary.eventFamily, 'action')
  assert.equal(summary.displayName, 'data.summary')
  assert.equal(summary.actor, 'human')
  assert.equal(summary.querySurface, 'data')
  assert.equal(summary.stateId, null)
  assert.equal(summary.parentStateId, null)
  assert.equal(summary.branchId, 'main')
  assert.equal(summary.primitive, null)
  assert.deepEqual(summary.affectedRefs, [])
  assert.equal(summary.outcome, 'success')
  assert.equal(summary.errorCode, null)
  assert.equal(summary.errorMessage, null)
  assert.equal(summary.details, null)
  assert.equal(summary.userVisibleSummary, null)
  assert.equal(summary.rationale, null)
  assert.equal(summary.verification, null)
  assert.deepEqual(summary.recoveryHints, [])
  assert.equal(schema.properties?.displayName?.type, 'string')
  assert.equal(schema.properties?.userVisibleSummary?.type?.includes?.('null') ?? false, true)
  assert.equal(schema.properties?.recoveryHints?.items?.type, 'string')
})
