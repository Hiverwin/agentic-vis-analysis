import assert from 'node:assert/strict'
import test from 'node:test'

import {
  executeVegaSankeyHighlightPath,
  executeVegaSankeyTraceNode,
} from './sankeySpecActions.js'

function sankeySpec() {
  return {
    data: [
      {
        name: 'rawLinks',
        values: [
          { source: 'Awareness', target: 'Visit', value: 30 },
          { source: 'Visit', target: 'Checkout', value: 12 },
          { source: 'Search', target: 'Compare', value: 8 },
        ],
      },
      {
        name: 'nodes',
        values: [
          { name: 'Awareness' },
          { name: 'Visit' },
          { name: 'Checkout' },
          { name: 'Search' },
          { name: 'Compare' },
        ],
      },
    ],
    marks: [
      { name: 'edgeMark', type: 'path', from: { data: 'rawLinks' } },
      { name: 'nodeMark', type: 'symbol', from: { data: 'nodes' } },
    ],
  }
}

test('executeVegaSankeyHighlightPath accepts path and injects visible mark emphasis', () => {
  const nextSpec = executeVegaSankeyHighlightPath(sankeySpec(), {
    path: ['Awareness', 'Visit', 'Checkout'],
  })

  assert.deepEqual(nextSpec._sankey_highlight_state, {
    nodes: ['Awareness', 'Visit', 'Checkout'],
    links: [],
  })
  assert.match(nextSpec.marks[0].encode.update.opacity.signal, /datum\.source/)
  assert.match(nextSpec.marks[0].encode.update.fillOpacity.signal, /datum\.source/)
  assert.match(nextSpec.marks[1].encode.update.opacity.signal, /datum\.name/)
})

test('executeVegaSankeyHighlightPath supports transformed link endpoint shapes', () => {
  const nextSpec = executeVegaSankeyHighlightPath({
    data: [],
    marks: [
      {
        name: 'edgeMark',
        type: 'path',
        from: { data: 'edges' },
        encode: {
          update: {
            fillOpacity: { value: 0.3 },
          },
        },
      },
    ],
  }, {
    links: [
      {
        source: 'Landing Page',
        target: 'Product Detail',
      },
    ],
  })

  const signal = nextSpec.marks[0].encode.update.fillOpacity.signal
  assert.match(signal, /source\.data\.name/)
  assert.match(signal, /target\.data\.name/)
  assert.match(signal, /Landing Page/)
  assert.match(signal, /Product Detail/)
})

test('executeVegaSankeyTraceNode injects emphasis for directly connected flows', () => {
  const nextSpec = executeVegaSankeyTraceNode(sankeySpec(), {
    nodeName: 'Visit',
  })

  assert.equal(nextSpec._sankey_trace_state.node, 'Visit')
  assert.equal(nextSpec._sankey_trace_state.links.length, 2)
  assert.match(nextSpec.marks[0].encode.update.opacity.signal, /Visit/)
  assert.match(nextSpec.marks[1].encode.update.opacity.signal, /Visit/)
})
