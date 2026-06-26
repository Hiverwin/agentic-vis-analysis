import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeTraceRecorderSummarySchema,
  makeTraceRecorderCapabilities,
  makeTraceRecorderCounters,
  makeTraceRecorderSummary,
} from './traceRecorder.js'

test('describeTraceRecorderSummarySchema admits normalized query and system-transition metadata', () => {
  const schema = describeTraceRecorderSummarySchema()
  const capabilities = schema.properties?.capabilities?.properties || {}
  const counters = schema.properties?.counters?.properties || {}

  assert.equal(capabilities?.recordsPerceptionQueryFailures?.type, 'boolean')
  assert.equal(capabilities?.recordsDataQueryFailures?.type, 'boolean')
  assert.equal(capabilities?.normalizedQueryFamily?.type, 'boolean')
  assert.equal(capabilities?.recordsSystemTransitions?.type, 'boolean')
  assert.equal(counters?.latestEventKind?.type?.[0], 'string')
  assert.equal(counters?.latestEventFamily?.type?.[0], 'string')
  assert.equal(counters?.latestQuerySurface?.type?.[0], 'string')
  assert.equal(counters?.latestOutcome?.type?.[0], 'string')
  assert.equal(schema.properties?.eventFamilies?.items?.type, 'string')
  assert.equal(schema.properties?.querySurfaces?.items?.type, 'string')
})

test('trace-recorder constructors normalize recorder summary contracts', () => {
  const capabilities = makeTraceRecorderCapabilities({
    recordsSystemTransitions: true,
  })
  const counters = makeTraceRecorderCounters({
    traceCount: 3,
    latestEventKind: 'dataQuery',
  })
  const summary = makeTraceRecorderSummary({
    capabilities,
    counters,
    querySurfaces: ['perception', 'data'],
  })

  assert.equal(capabilities.recordsActions, true)
  assert.equal(counters.traceCount, 3)
  assert.equal(counters.latestEventKind, 'dataQuery')
  assert.deepEqual(summary.querySurfaces, ['perception', 'data'])
  assert.deepEqual(summary.eventFamilies, [])
})

test('makeTraceRecorderSummary normalizes nested capability and counter defaults', () => {
  const summary = makeTraceRecorderSummary({
    capabilities: {
      recordsDataQueries: false,
    },
    counters: {
      traceCount: 2,
    },
  })

  assert.equal(summary.capabilities.recordsActions, true)
  assert.equal(summary.capabilities.recordsDataQueries, false)
  assert.equal(summary.capabilities.recordsSystemTransitions, true)
  assert.equal(summary.counters.traceCount, 2)
  assert.equal(summary.counters.latestEventKind, null)
})
