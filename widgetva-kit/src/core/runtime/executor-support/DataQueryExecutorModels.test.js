import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DataQueryHandlerContext,
  buildDataQueryTraceNotes,
  buildSupportedQueryDescriptors,
  makeDataQueryExecutorSummary,
} from './DataQueryExecutorModels.js'

test('data query executor model helpers summarize supported queries with stable defaults', () => {
  const summary = makeDataQueryExecutorSummary({
    engine: { kind: 'manual' },
    counts: { supportedQueryKindCount: 2 },
    capabilities: { runtimeDataReads: true },
    supportedQueryKinds: ['summary', 'sampleRows'],
  })

  assert.equal(summary.engine.kind, 'manual')
  assert.equal(summary.engine.className, null)
  assert.equal(summary.counts.supportedQueryKindCount, 2)
  assert.equal(summary.counts.supportedQueryDescriptorCount, 0)
  assert.equal(summary.capabilities.schemaValidation, true)
  assert.equal(summary.capabilities.returnsValidation, true)
  assert.equal(summary.capabilities.runtimeDataReads, true)
  assert.deepEqual(summary.supportedQueryKinds, ['summary', 'sampleRows'])
})

test('buildSupportedQueryDescriptors preserves known descriptor templates and fallback schemas', () => {
  const descriptors = buildSupportedQueryDescriptors(['summary', 'customQuery'])

  assert.equal(descriptors[0].name, 'summary')
  assert.equal(descriptors[0].inputSchema.type, 'object')
  assert.equal(descriptors[1].name, 'customQuery')
  assert.deepEqual(descriptors[1].inputSchema, {
    type: 'object',
    additionalProperties: true,
    properties: {},
  })
})

test('DataQueryHandlerContext.describeContract exposes the stable context surface', () => {
  const summary = DataQueryHandlerContext.describeContract()

  assert.equal(summary.capabilities.workspaceRead, true)
  assert.equal(summary.capabilities.selectionScopedQueries, true)
  assert.equal(summary.integrations.store, true)
  assert.ok(summary.methods.includes('resolveRows'))
  assert.ok(summary.methods.includes('recordDataQuery'))
})

test('buildDataQueryTraceNotes includes scope and runtime evidence when available', () => {
  assert.deepEqual(
    buildDataQueryTraceNotes({
      kind: 'summary',
      selectionRef: 'selection-a',
      dataRef: 'data-a',
      rowCount: 1,
    }),
    {
      userVisibleSummary: 'Data query: summary scoped to selection-a over 1 row',
      rationale: 'A selection-scoped data query was requested for the current runtime data view.',
      verification: 'Query executed against data-a.',
    },
  )
})
