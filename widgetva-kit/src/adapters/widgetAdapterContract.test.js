import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createWidgetAdapterContract,
  createWidgetAdapterDefinition,
  createWidgetAdapterInstance,
  instantiateWidgetAdapter,
} from './index.js'

test('createWidgetAdapterContract is the stable alias for adapter definitions', () => {
  const contract = createWidgetAdapterContract({
    kind: 'custom',
  })

  assert.equal(contract.kind, 'custom')
  assert.equal(typeof contract.createInstance, 'function')
  assert.equal(typeof createWidgetAdapterDefinition, 'function')
})

test('instantiateWidgetAdapter requires description and state readers and returns the normalized adapter instance', () => {
  const definition = createWidgetAdapterContract({
    kind: 'scatter',
    buildActionDescriptors() {
      return [{ name: 'widget.updateSelection' }]
    },
  })

  const adapter = instantiateWidgetAdapter({
    definition,
    widgetRef: 'wl://demo/workspace/main/widget/scatter_a',
    dataRef: 'wl://demo/workspace/main/data/current_view',
    getDescription() {
      return { ref: 'wl://demo/workspace/main/widget/scatter_a', kind: 'scatter' }
    },
    getState() {
      return { ref: 'wl://demo/workspace/main/widget/scatter_a', kind: 'scatter', view: {} }
    },
  })

  assert.equal(adapter.kind, 'scatter')
  assert.equal(adapter.widgetRef, 'wl://demo/workspace/main/widget/scatter_a')
  assert.equal(Array.isArray(adapter.buildActionDescriptors()), true)
  assert.equal(typeof adapter.mount, 'function')
  assert.equal(typeof adapter.update, 'function')
  assert.equal(typeof adapter.dispose, 'function')
  assert.equal(typeof adapter.readSelection, 'function')
  assert.equal(typeof adapter.readViewport, 'function')
  assert.equal(adapter.describeCapabilities()?.provider, 'custom')
  assert.equal(typeof createWidgetAdapterInstance, 'function')
})

test('createWidgetAdapterContract rejects invalid hook shapes', () => {
  assert.throws(
    () => createWidgetAdapterContract({ kind: 'scatter', applyState: true }),
    /must be a function/,
  )
  assert.throws(
    () => instantiateWidgetAdapter({ definition: createWidgetAdapterContract({ kind: 'scatter' }) }),
    /getDescription/,
  )
})
