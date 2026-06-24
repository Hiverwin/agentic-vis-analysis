import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ALL_WIDGET_KINDS,
  SEMANTIC_CAPABILITIES,
  describeWidgetSemanticSurface,
  getSemanticCapability,
  listSemanticCapabilities,
  resolveAdvancedResponseCapabilities,
  resolveSemanticCapabilityBindings,
  supportsAdvancedResponseCapability,
} from '../capabilities.js'

test('semantic capability registry exposes stable lookup and filtering helpers', () => {
  assert.deepEqual(ALL_WIDGET_KINDS, [
    'bar',
    'line',
    'scatter',
    'parallelCoordinates',
    'sankey',
    'heatmap',
  ])
  assert.ok(Array.isArray(SEMANTIC_CAPABILITIES))
  assert.ok(SEMANTIC_CAPABILITIES.length >= 20)

  const capability = getSemanticCapability('analysis.correlation.compute')
  assert.equal(capability?.semanticKind, 'perception')
  assert.equal(capability?.id, 'analysis.correlation.compute')

  const aliasHit = getSemanticCapability('correlation.compute')
  assert.equal(aliasHit?.id, 'analysis.correlation.compute')

  const scatterCaps = listSemanticCapabilities({ widgetKind: 'scatter' })
  assert.ok(scatterCaps.some((entry) => entry.id === 'selection.region.set'))
  assert.ok(scatterCaps.some((entry) => entry.id === 'analysis.regression.show'))
  const parallelPointCaps = listSemanticCapabilities({ widgetKind: 'parallelCoordinates' })
  assert.ok(parallelPointCaps.some((entry) => entry.id === 'selection.point.set'))

  const bindings = resolveSemanticCapabilityBindings({
    semanticId: 'selection.region.set',
    widgetKind: 'scatter',
    bindingKind: 'action',
  })
  assert.deepEqual(
    bindings.map((entry) => entry.name),
    ['scatter.brushRegion', 'widget.updateSelection'],
  )

  const drillDownCaps = resolveAdvancedResponseCapabilities({
    widgetKind: 'line',
    responseKind: 'drillDown',
  })
  assert.ok(drillDownCaps.some((entry) => entry.id === 'axis.x.drilldown'))
  assert.equal(supportsAdvancedResponseCapability({ widgetKind: 'line', responseKind: 'drillDown' }), true)
  assert.equal(supportsAdvancedResponseCapability({ widgetKind: 'bar', responseKind: 'drillDown' }), false)
  assert.equal(supportsAdvancedResponseCapability({ widgetKind: 'sankey', responseKind: 'collapse' }), true)
  assert.equal(supportsAdvancedResponseCapability({ widgetKind: 'sankey', responseKind: 'expand' }), true)
  assert.equal(supportsAdvancedResponseCapability({ widgetKind: 'line', responseKind: 'collapse' }), false)
})

test('widget semantic surface only returns bindings valid for the requested widget kind', () => {
  const surface = describeWidgetSemanticSurface('line')
  const lineFocus = surface.capabilities.find((entry) => entry.id === 'line.series.focus')
  assert.ok(lineFocus)
  assert.deepEqual(
    lineFocus.bindings.map((entry) => entry.name),
    ['line.focusLines', 'line.boldLines', 'line.selectSeries', 'line.selectXValue'],
  )

  const noSankeyOnlyBindings = surface.capabilities
    .flatMap((entry) => entry.bindings)
    .filter((binding) => binding.name === 'sankey.filterFlow')
  assert.deepEqual(noSankeyOnlyBindings, [])
})
