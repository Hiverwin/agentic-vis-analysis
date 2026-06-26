import test from 'node:test'
import assert from 'node:assert/strict'

import * as adapterWidgetModules from './index.js'

test('first-class adapter widget modules expose binding/apply responsibilities without semantic action/perception exports', () => {
  const firstClassModules = [
    ['scatter', adapterWidgetModules.scatterWidgetModules, 'getScatterHumanInteractionConfig', 'applyScatterState'],
    ['bar', adapterWidgetModules.barWidgetModules, 'getBarHumanInteractionConfig', 'applyBarState'],
    ['line', adapterWidgetModules.lineWidgetModules, 'getLineHumanInteractionConfig', 'applyLineState'],
    ['heatmap', adapterWidgetModules.heatmapWidgetModules, 'getHeatmapHumanInteractionConfig', 'applyHeatmapState'],
    ['parallelCoordinates', adapterWidgetModules.parallelCoordinatesWidgetModules, 'getParallelCoordinatesHumanInteractionConfig', 'applyParallelCoordinatesState'],
    ['sankey', adapterWidgetModules.sankeyWidgetModules, 'getSankeyHumanInteractionConfig', 'applySankeyState'],
  ]

  for (const [kind, widgetModule, humanKey, applyKey] of firstClassModules) {
    assert.equal(typeof widgetModule[humanKey], 'function', `${kind} adapter module should expose ${humanKey}`)
    assert.equal(typeof widgetModule[applyKey], 'function', `${kind} adapter module should expose ${applyKey}`)
    assert.equal(
      Object.keys(widgetModule).some((key) => key.startsWith('build') || key.startsWith('register')),
      false,
      `${kind} adapter module should not expose semantic build/register helpers`,
    )
  }
})
