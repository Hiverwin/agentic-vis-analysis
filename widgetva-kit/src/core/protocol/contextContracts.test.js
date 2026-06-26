import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeActionContextSummarySchema,
  makeActionContextCapabilities,
  makeActionContextIntegrations,
  makeActionContextSummary,
} from './actionContext.js'
import {
  describePerceptionContextSummarySchema,
  makePerceptionContextCapabilities,
  makePerceptionContextIntegrations,
  makePerceptionContextSummary,
} from './perceptionContext.js'
import {
  describeDataQueryContextSummarySchema,
  makeDataQueryContextCapabilities,
  makeDataQueryContextIntegrations,
  makeDataQueryContextSummary,
} from './dataQueryContext.js'

test('context summary schemas admit the richer runtime capabilities', () => {
  const actionSchema = describeActionContextSummarySchema()
  const perceptionSchema = describePerceptionContextSummarySchema()
  const dataQuerySchema = describeDataQueryContextSummarySchema()

  assert.equal(actionSchema.properties?.capabilities?.properties?.runtimeDataWrite?.type, 'boolean')
  assert.equal(perceptionSchema.properties?.capabilities?.properties?.dataHandleResolution?.type, 'boolean')
  assert.equal(perceptionSchema.properties?.capabilities?.properties?.selectionScopedQueries?.type, 'boolean')
  assert.equal(dataQuerySchema.properties?.capabilities?.properties?.widgetTargetResolution?.type, 'boolean')
  assert.equal(dataQuerySchema.properties?.capabilities?.properties?.selectionTargetResolution?.type, 'boolean')
  assert.equal(dataQuerySchema.properties?.capabilities?.properties?.explicitTargetValidation?.type, 'boolean')
  assert.equal(dataQuerySchema.properties?.capabilities?.properties?.selectionScopedQueries?.type, 'boolean')
})

test('context summary constructors normalize runtime context contracts', () => {
  const action = makeActionContextSummary({
    methods: ['patchWidget'],
    capabilities: makeActionContextCapabilities({ workspaceWrite: true }),
    integrations: makeActionContextIntegrations({ store: true }),
  })
  const perception = makePerceptionContextSummary({
    methods: ['recordQuery'],
    capabilities: makePerceptionContextCapabilities({ traceRecording: true }),
    integrations: makePerceptionContextIntegrations({ traceRecorder: true }),
  })
  const dataQuery = makeDataQueryContextSummary({
    methods: ['recordDataQuery'],
    capabilities: makeDataQueryContextCapabilities({ explicitTargetValidation: true }),
    integrations: makeDataQueryContextIntegrations({ store: true }),
  })

  assert.equal(action.capabilities.workspaceWrite, true)
  assert.equal(action.integrations.store, true)
  assert.equal(perception.capabilities.traceRecording, true)
  assert.equal(perception.integrations.traceRecorder, true)
  assert.equal(dataQuery.capabilities.explicitTargetValidation, true)
  assert.equal(dataQuery.integrations.store, true)
})
