import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildObservableD3NativeContract,
  findObservableD3NativeBrushBinding,
  readObservableD3NativeBrushBindings,
} from './observableD3NativeContract.js'

test('D3 native contract exposes no brush action without captured native brush bindings', () => {
  const contract = buildObservableD3NativeContract({ brushBindings: [] })

  assert.equal(contract.provider, 'd3')
  assert.deepEqual(contract.actions, [])
  assert.deepEqual(contract.perceptions.map((entry) => entry.name), [
    'perception.inspectViewConfig',
    'perception.summarizeSelection',
    'perception.summarizeVisible',
  ])
})

test('D3 native contract maps captured brush bindings to executable scatter brush actions', () => {
  const contract = buildObservableD3NativeContract({
    brushBindings: [
      {
        bindingId: 'brush_1',
        targetRef: 'wl://observable-d3/scatter/cell/flipper-body-mass',
        kind: 'scatter',
        fields: { x: 'flipper_length_mm', y: 'body_mass_g' },
        domain: { x: [170, 235], y: [2700, 6500] },
      },
    ],
  })

  assert.deepEqual(contract.actions, [
    {
      name: 'scatter.brushRegion',
      targetRef: 'wl://observable-d3/scatter/cell/flipper-body-mass',
      native: {
        provider: 'd3',
        kind: 'brush',
        bindingId: 'brush_1',
      },
      paramsSchema: {
        type: 'object',
        required: ['xField', 'yField', 'xRange', 'yRange'],
        properties: {
          xField: { type: 'string' },
          yField: { type: 'string' },
          xRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
          yRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
        },
      },
    },
  ])
  assert.deepEqual(contract.native.brushBindings[0], {
    bindingId: 'brush_1',
    targetRef: 'wl://observable-d3/scatter/cell/flipper-body-mass',
    kind: 'scatter',
    interaction: 'brush',
    fields: { x: 'flipper_length_mm', y: 'body_mass_g' },
    domain: { x: [170, 235], y: [2700, 6500] },
  })
})

test('D3 native contract ignores incomplete native brush bindings', () => {
  assert.deepEqual(
    readObservableD3NativeBrushBindings({
      brushBindings: [
        { bindingId: 'brush_without_target' },
        { targetRef: 'target_without_binding' },
        { bindingId: 'brush_2', targetRef: 'target_2' },
      ],
    }),
    [{
      bindingId: 'brush_2',
      targetRef: 'target_2',
      kind: 'scatter',
      interaction: 'brush',
      fields: {},
      domain: {},
    }],
  )
})

test('D3 native contract can resolve the native brush binding for a target ref', () => {
  const contract = buildObservableD3NativeContract({
    brushBindings: [
      { bindingId: 'brush_a', targetRef: 'target_a' },
      { bindingId: 'brush_b', targetRef: 'target_b' },
    ],
  })

  assert.deepEqual(findObservableD3NativeBrushBinding(contract, 'target_b'), {
    bindingId: 'brush_b',
    targetRef: 'target_b',
    kind: 'scatter',
    interaction: 'brush',
    fields: {},
    domain: {},
  })
  assert.equal(findObservableD3NativeBrushBinding(contract, 'missing'), null)
})
