import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describePerceptionRegistrySummarySchema,
  makePerceptionRegistryCapabilities,
  makePerceptionRegistryCounts,
  makePerceptionRegistryQueryEntry,
  makePerceptionRegistrySummary,
} from './perceptionRegistry.js'

test('describePerceptionRegistrySummarySchema admits verification and evidence metadata per query', () => {
  const schema = describePerceptionRegistrySummarySchema()
  const queryEntrySchema = schema.properties?.queries?.items
  const capabilitiesSchema = schema.properties?.capabilities?.properties

  assert.equal(capabilitiesSchema?.returnsValidation?.type, 'boolean')
  assert.equal(queryEntrySchema?.properties?.handlerVariantCount?.type, 'integer')
  assert.equal(queryEntrySchema?.properties?.sideEffectFree?.type, 'boolean')
  assert.equal(queryEntrySchema?.properties?.evidenceKinds?.type, 'array')
  assert.equal(queryEntrySchema?.properties?.evidenceKinds?.items?.type, 'string')
  assert.equal(queryEntrySchema?.properties?.verificationTargets?.type, 'array')
  assert.equal(queryEntrySchema?.properties?.verificationTargets?.items?.type, 'string')
  assert.equal(queryEntrySchema?.properties?.supportedWidgetKinds?.anyOf?.[1]?.items?.type, 'string')
})

test('perception-registry constructors normalize registry summary contracts', () => {
  const counts = makePerceptionRegistryCounts({
    descriptorCount: 1,
  })
  const capabilities = makePerceptionRegistryCapabilities({
    returnsValidation: true,
  })
  const query = makePerceptionRegistryQueryEntry({
    name: 'perception.inspectViewConfig',
  })
  const summary = makePerceptionRegistrySummary({
    counts,
    capabilities,
    queries: [query],
  })

  assert.equal(counts.descriptorCount, 1)
  assert.equal(capabilities.returnsValidation, true)
  assert.equal(query.name, 'perception.inspectViewConfig')
  assert.equal(summary.queries[0]?.sideEffectFree, true)
})

test('makePerceptionRegistrySummary normalizes nested summary defaults', () => {
  const summary = makePerceptionRegistrySummary({
    counts: {
      descriptorCount: 1,
    },
    capabilities: {
      returnsValidation: false,
    },
    queries: [
      {
        name: 'perception.inspectViewConfig',
      },
    ],
  })

  assert.equal(summary.counts.descriptorCount, 1)
  assert.equal(summary.counts.handlerEntryCount, 0)
  assert.equal(summary.capabilities.returnsValidation, false)
  assert.equal(summary.capabilities.traceRecording, false)
  assert.equal(summary.queries[0]?.name, 'perception.inspectViewConfig')
  assert.equal(summary.queries[0]?.sideEffectFree, true)
})
