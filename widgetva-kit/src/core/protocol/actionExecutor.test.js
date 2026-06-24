import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeActionExecutorSummarySchema,
  makeActionExecutorActionEntry,
  makeActionExecutorCapabilities,
  makeActionExecutorCounts,
  makeActionExecutorSummary,
} from './actionExecutor.js'

test('describeActionExecutorSummarySchema admits widget binding summaries', () => {
  const schema = describeActionExecutorSummarySchema()
  const actionEntry = schema.properties?.actions?.items

  assert.equal(actionEntry?.properties?.affectedRefs?.type, 'array')
  assert.equal(actionEntry?.properties?.affectedRefs?.items?.type, 'string')
  assert.equal(actionEntry?.properties?.affectedStatePaths?.type, 'array')
  assert.equal(actionEntry?.properties?.affectedStatePaths?.items?.type, 'string')
  assert.equal(actionEntry?.properties?.supportedWidgetKinds?.anyOf?.[0]?.type, 'null')
  assert.equal(actionEntry?.properties?.supportedWidgetKinds?.anyOf?.[1]?.items?.type, 'string')
  assert.equal(actionEntry?.properties?.reversible?.type, 'boolean')
  assert.equal(actionEntry?.properties?.preconditionDescriptorCount?.type, 'integer')
  assert.equal(actionEntry?.properties?.preconditionHandlerRegistered?.type, 'boolean')
  assert.equal(actionEntry?.properties?.postconditionCount?.type, 'integer')
  assert.equal(actionEntry?.properties?.effectCount?.type, 'integer')
  assert.equal(actionEntry?.properties?.effectKinds?.type, 'array')
  assert.equal(actionEntry?.properties?.effectKinds?.items?.type, 'string')
})

test('action-executor constructors normalize runtime action summary contracts', () => {
  const counts = makeActionExecutorCounts({
    descriptorCount: 2,
    handlerCount: 2,
    preconditionCount: 1,
  })
  const capabilities = makeActionExecutorCapabilities({
    paramsValidation: true,
    preconditionValidation: true,
    stateSync: true,
    traceRecording: false,
    linkPropagation: true,
  })
  const action = makeActionExecutorActionEntry({
    name: 'scatter.brushRegion',
    primitive: 'select',
    category: 'selection',
    targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    affectedRefs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
    affectedStatePaths: ['selections'],
    supportedWidgetKinds: ['scatter'],
    hasPreconditions: true,
    preconditionDescriptorCount: 1,
    preconditionHandlerRegistered: true,
    postconditionCount: 1,
    reversible: true,
    effectCount: 1,
    effectKinds: ['updatesSelection'],
  })
  const summary = makeActionExecutorSummary({
    counts,
    capabilities,
    actions: [action],
  })

  assert.deepEqual(summary, {
    counts: {
      descriptorCount: 2,
      handlerCount: 2,
      preconditionCount: 1,
    },
    capabilities: {
      paramsValidation: true,
      preconditionValidation: true,
      stateSync: true,
      traceRecording: false,
      linkPropagation: true,
    },
    actions: [
      {
        name: 'scatter.brushRegion',
        primitive: 'select',
        category: 'selection',
        targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
        affectedRefs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
        affectedStatePaths: ['selections'],
        supportedWidgetKinds: ['scatter'],
        hasPreconditions: true,
        preconditionDescriptorCount: 1,
        preconditionHandlerRegistered: true,
        postconditionCount: 1,
        reversible: true,
        effectCount: 1,
        effectKinds: ['updatesSelection'],
      },
    ],
  })
})
