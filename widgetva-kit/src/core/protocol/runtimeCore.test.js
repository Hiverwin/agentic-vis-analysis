import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeRuntimeCoreSummarySchema,
  makeRuntimeCoreCapabilities,
  makeRuntimeCoreComponents,
  makeRuntimeCoreRegistries,
  makeRuntimeCoreSummary,
} from './runtimeCore.js'

test('describeRuntimeCoreSummarySchema admits richer runtime-core component and capability metadata', () => {
  const schema = describeRuntimeCoreSummarySchema()
  const components = schema.properties?.components?.properties || {}
  const registries = schema.properties?.registries?.properties || {}
  const capabilities = schema.properties?.capabilities?.properties || {}

  assert.equal(components?.interactionTraceRecorder?.type, 'boolean')
  assert.equal(components?.responseRecorder?.type, 'boolean')
  assert.equal(registries?.traceRecordCount?.type, 'integer')
  assert.equal(registries?.responseCount?.type, 'integer')
  assert.equal(capabilities?.traceRecording?.type, 'boolean')
  assert.equal(capabilities?.responseHistoryRead?.type, 'boolean')
  assert.equal(capabilities?.linkPropagationEvaluation?.type, 'boolean')
})

test('runtime-core constructors normalize runtime-core summary contracts', () => {
  const components = makeRuntimeCoreComponents({
    widgetRegistry: true,
  })
  const registries = makeRuntimeCoreRegistries({
    widgetCount: 2,
  })
  const capabilities = makeRuntimeCoreCapabilities({
    traceRecording: true,
  })
  const summary = makeRuntimeCoreSummary({
    components,
    registries,
    capabilities,
  })

  assert.equal(components.widgetRegistry, true)
  assert.equal(registries.widgetCount, 2)
  assert.equal(capabilities.traceRecording, true)
  assert.equal(summary.capabilities.traceRecording, true)
})

test('makeRuntimeCoreSummary normalizes nested summary defaults', () => {
  const summary = makeRuntimeCoreSummary({
    components: {
      widgetRegistry: true,
    },
    registries: {
      widgetCount: 2,
    },
    capabilities: {
      traceRecording: true,
    },
  })

  assert.equal(summary.components.widgetRegistry, true)
  assert.equal(summary.components.actionExecutor, false)
  assert.equal(summary.registries.widgetCount, 2)
  assert.equal(summary.registries.responseCount, 0)
  assert.equal(summary.capabilities.traceRecording, true)
  assert.equal(summary.capabilities.protocolIntrospection, false)
})
