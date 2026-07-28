import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeBenchmarkSpec } from './benchmark_spec_normalization.mjs'

test('unwraps a legacy benchmark { spec, meta } envelope', () => {
  const inner = { $schema: 'https://vega.github.io/schema/vega-lite/v5.json', mark: 'bar' }

  assert.equal(
    normalizeBenchmarkSpec({ spec: inner, meta: { title: 'Sales' } }),
    inner,
  )
})

test('does not unwrap a native Vega-Lite composition that uses spec', () => {
  const composition = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    facet: { field: 'category', type: 'nominal' },
    spec: { mark: 'bar' },
  }

  assert.equal(normalizeBenchmarkSpec(composition), composition)
})
