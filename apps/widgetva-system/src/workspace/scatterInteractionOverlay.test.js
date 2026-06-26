import test from 'node:test'
import assert from 'node:assert/strict'

import { buildScatterBrushFromDrag } from './scatterInteractionOverlay.js'

test('buildScatterBrushFromDrag converts a pixel drag rectangle into scatter data ranges', () => {
  const brush = buildScatterBrushFromDrag({
    dragRect: {
      left: 20,
      right: 120,
      top: 30,
      bottom: 130,
    },
    bounds: {
      left: 0,
      top: 0,
      width: 200,
      height: 200,
    },
    xDomain: [40, 240],
    yDomain: [10, 50],
  })

  assert.deepEqual(brush, {
    horsepower: [60, 160],
    mpg: [24, 44],
  })
})

test('buildScatterBrushFromDrag ignores tiny drags', () => {
  const brush = buildScatterBrushFromDrag({
    dragRect: {
      left: 10,
      right: 12,
      top: 20,
      bottom: 22,
    },
    bounds: {
      left: 0,
      top: 0,
      width: 200,
      height: 200,
    },
    xDomain: [40, 240],
    yDomain: [10, 50],
  })

  assert.equal(brush, null)
})
