import assert from 'node:assert/strict'
import test from 'node:test'

import { buildWidgetRenderPayload } from './providerRenderPayload.js'

test('buildWidgetRenderPayload projects Vega Sankey state into provider spec', () => {
  const spec = {
    $schema: 'https://vega.github.io/schema/vega/v6.json',
    data: [
      {
        name: 'rawLinks',
        values: [
          { source: 'Landing Page', target: 'Product Detail', value: 10 },
        ],
      },
      {
        name: 'nodePositions',
        values: [
          { node: 'Landing Page' },
          { node: 'Product Detail' },
        ],
      },
    ],
    marks: [
      { name: 'edgeMark', type: 'path', from: { data: 'rawLinks' } },
      { name: 'nodeMark', type: 'rect', from: { data: 'nodePositions' } },
    ],
  }

  const payload = buildWidgetRenderPayload({
    widgetDescription: {
      widgetId: 'w_sankey',
      ref: 'wl://workspace/widget/w_sankey',
      kind: 'sankey',
      provider: 'vega',
      source: {
        providerSpec: {
          provider: 'vega',
          spec,
        },
      },
    },
    widgetState: {
      widgetId: 'w_sankey',
      ref: 'wl://workspace/widget/w_sankey',
      kind: 'sankey',
      provider: 'vega',
      currentSpec: spec,
      data: {
        sourceDataRef: 'wl://workspace/data/source',
        currentDataRef: 'wl://workspace/data/visible',
      },
      view: {
        highlight: {
          sourceAction: 'sankey.highlightPath',
          path: ['Landing Page', 'Product Detail'],
        },
      },
    },
    runtime: {
      store: {
        readRuntimeData() {
          return {
            rows: [
              { source: 'Other', target: 'Other', value: 1 },
            ],
          }
        },
      },
    },
  })

  assert.equal(payload.provider, 'vega')
  assert.equal(payload.providerSpec.provider, 'vega')
  assert.equal(Array.isArray(payload.providerSpec.spec.data), true)
  assert.deepEqual(payload.providerSpec.spec.data.map((dataset) => dataset.name), ['rawLinks', 'nodePositions'])
  assert.equal(payload.providerSpec.spec.marks[1].from.data, 'nodePositions')
  assert.deepEqual(payload.providerSpec.spec._sankey_highlight_state, {
    nodes: ['Landing Page', 'Product Detail'],
    links: [],
  })
  assert.match(payload.providerSpec.spec.marks[0].encode.update.opacity.signal, /Landing Page/)
})
