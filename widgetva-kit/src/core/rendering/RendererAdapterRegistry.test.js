import test from 'node:test'
import assert from 'node:assert/strict'

import { createRendererAdapterRegistry } from './RendererAdapterRegistry.js'

test('RendererAdapterRegistry registers providers and resolves adapter factories by provider id', () => {
  const registry = createRendererAdapterRegistry()
  const marker = { provider: 'vega-lite-adapter' }

  registry.register({
    provider: 'vega-lite',
    supportedWidgetKinds: ['scatter', 'bar'],
    createAdapter() {
      return marker
    },
  })

  assert.equal(registry.has('vega-lite'), true)
  assert.equal(registry.supportsWidgetKind('vega-lite', 'scatter'), true)
  assert.equal(registry.supportsWidgetKind('vega-lite', 'line'), false)
  assert.equal(registry.createAdapter('vega-lite'), marker)
  assert.deepEqual(registry.list(), [
    {
      provider: 'vega-lite',
      supportedWidgetKinds: ['scatter', 'bar'],
      metadata: {},
    },
  ])
})

test('RendererAdapterRegistry treats empty supportedWidgetKinds as provider-wide compatibility', () => {
  const registry = createRendererAdapterRegistry([
    {
      provider: 'custom',
      createAdapter() {
        return { provider: 'custom' }
      },
    },
  ])

  assert.equal(registry.supportsWidgetKind('custom', 'scatter'), true)
  assert.equal(registry.supportsWidgetKind('custom', 'sankey'), true)
})

test('RendererAdapterRegistry rejects invalid registrations and unresolved providers', () => {
  const registry = createRendererAdapterRegistry()

  assert.throws(
    () => registry.register({ provider: '', createAdapter() {} }),
    /require a non-empty provider string/,
  )
  assert.throws(
    () => registry.register({ provider: 'd3' }),
    /requires createAdapter\(\)/,
  )
  assert.throws(
    () => registry.createAdapter('missing'),
    /is not registered/,
  )
})

