import test from 'node:test'
import assert from 'node:assert/strict'

import { buildBarCategorySelectionPatch } from './bar/semanticPatches.js'
import {
  buildLineSeriesSelectionPatch,
  buildLineZoomXRegionPatch,
} from './line/semanticPatches.js'
import {
  buildScatterCategoricalFilterPatch,
  buildScatterRegionSelectionPatch,
  buildScatterZoomDomainPatch,
} from './scatter/semanticPatches.js'

function makeWidget(kind = 'scatter') {
  return {
    ref: `wl://widgetva-app/workspace/main/widget/${kind}_a`,
    widgetId: `${kind}_a`,
    kind,
    view: {},
    data: {},
  }
}

test('scatter state reducers build canonical selection, zoom, and filter patches', () => {
  const targetWidget = makeWidget('scatter')
  const currentState = { widgets: { [targetWidget.ref]: targetWidget }, shared: {} }

  const selectionPatch = buildScatterRegionSelectionPatch({
    targetWidget,
    currentState,
    selectionId: 'brush',
    xField: 'Horsepower',
    yField: 'Miles_per_Gallon',
    xRange: [80, 140],
    yRange: [20, 35],
    selectedCount: 12,
  })
  const selection = selectionPatch[targetWidget.ref].selections[`${targetWidget.ref}/selection/brush`]
  assert.equal(selection.kind, 'interval')
  assert.equal(selection.id, 'brush')
  assert.deepEqual(selection.channels.x.domain, [80, 140])
  assert.deepEqual(selection.channels.y.domain, [20, 35])

  const zoomPatch = buildScatterZoomDomainPatch({
    targetWidget,
    xDomain: [80, 140],
    yDomain: [20, 35],
  })
  assert.deepEqual(zoomPatch[targetWidget.ref].view.xDomain, [80, 140])
  assert.deepEqual(zoomPatch[targetWidget.ref].view.yDomain, [20, 35])

  const filterPatch = buildScatterCategoricalFilterPatch({
    targetWidget,
    currentState,
    field: 'Origin',
    categoriesToRemove: ['USA'],
    visibleCount: 24,
  })
  const [transform] = filterPatch[targetWidget.ref].transforms
  assert.equal(transform.kind, 'filter')
  assert.equal(transform.source, 'action')
  assert.deepEqual(transform.predicate, { field: 'Origin', op: 'notIn', value: ['USA'] })
  assert.equal(filterPatch[targetWidget.ref].data.visibleCount, 24)
})

test('bar and line state reducers build canonical selection and view patches', () => {
  const barWidget = makeWidget('bar')
  const lineWidget = makeWidget('line')
  const currentState = { widgets: { [barWidget.ref]: barWidget, [lineWidget.ref]: lineWidget }, shared: {} }

  const barPatch = buildBarCategorySelectionPatch({
    targetWidget: barWidget,
    currentState,
    actionName: 'bar.selectCategory',
    field: 'Origin',
    values: ['Europe'],
    selectedCount: 4,
  })
  const barSelectionRef = Object.keys(barPatch[barWidget.ref].selections)[0]
  const barSelection = barPatch[barWidget.ref].selections[barSelectionRef]
  assert.equal(barSelection.kind, 'predicate')
  assert.equal(barSelection.field, 'Origin')
  assert.deepEqual(barSelection.values, ['Europe'])
  assert.deepEqual(barSelection.predicates, [{ field: 'Origin', op: 'in', value: ['Europe'] }])

  const linePatch = buildLineSeriesSelectionPatch({
    targetWidget: lineWidget,
    currentState,
    field: 'symbol',
    values: ['AAPL'],
    selectedCount: 18,
    selectionId: 'series',
  })
  const lineSelection = linePatch[lineWidget.ref].selections[`${lineWidget.ref}/selection/series`]
  assert.equal(lineSelection.kind, 'predicate')
  assert.equal(lineSelection.field, 'symbol')
  assert.deepEqual(lineSelection.values, ['AAPL'])
  assert.deepEqual(lineSelection.predicates, [{ field: 'symbol', op: 'in', value: ['AAPL'] }])

  const lineZoomPatch = buildLineZoomXRegionPatch({
    targetWidget: lineWidget,
    start: '2012-01-01',
    end: '2012-03-01',
  })
  assert.deepEqual(lineZoomPatch[lineWidget.ref].view.xDomain, ['2012-01-01', '2012-03-01'])
})
