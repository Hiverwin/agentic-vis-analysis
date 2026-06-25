import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveChartCanvasSpec } from './chartCanvasModel.js'

test('resolveChartCanvasSpec falls back to widgetState.rawSpec when no external spec prop is provided', () => {
  const rawSpec = {
    mark: 'point',
    encoding: {
      x: { field: 'a', type: 'quantitative' },
      y: { field: 'b', type: 'quantitative' },
    },
  }

  assert.deepEqual(
    resolveChartCanvasSpec({
      spec: null,
      widgetState: { rawSpec },
    }),
    rawSpec,
  )
})

test('resolveChartCanvasSpec prefers explicit spec prop over widgetState.rawSpec', () => {
  const explicitSpec = { mark: 'bar' }
  const rawSpec = { mark: 'point' }

  assert.deepEqual(
    resolveChartCanvasSpec({
      spec: explicitSpec,
      widgetState: { rawSpec },
    }),
    explicitSpec,
  )
})
