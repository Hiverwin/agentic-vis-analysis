import test from 'node:test'
import assert from 'node:assert/strict'

import { createVgplotWidgetAdapter } from './VgplotWidgetAdapter.js'
import { executeVgplotAction } from './vgplotActionRouter.js'
import { orchestrateVgplotView } from './vgplotOrchestration.js'
import { resolveVgplotCapabilities } from './vgplotCapabilityResolver.js'
import { queryVgplotPerception } from './vgplotPerceptionQueries.js'
import { buildVgplotVerificationEvidence } from './vgplotVerification.js'
import {
  attachVgplotContextRuntimeMetadata,
  attachVgplotPlotRuntimeMetadata,
  captureVgplotRuntime,
} from './vgplotRuntimeCapture.js'
import { readVgplotState } from './vgplotState.js'
import { buildScatterActionDescriptors } from '../../widgets/families/scatter/actionDescriptors.js'
import { buildBarActionDescriptors } from '../../widgets/families/bar/actionDescriptors.js'
import { buildLineActionDescriptors } from '../../widgets/families/line/actionDescriptors.js'
import { buildHeatmapActionDescriptors } from '../../widgets/families/heatmap/actionDescriptors.js'

function createPlot(initialAttributes = {}) {
  const attributes = new Map(Object.entries(initialAttributes))
  return {
    attributes,
    getAttribute(name) {
      return attributes.get(name)
    },
    setAttribute(name, value) {
      attributes.set(name, value)
    },
  }
}

function attachPlotConfigAction(plot, actionName, handler, { stateKeys = [] } = {}) {
  plot.__widgetvaVgplotMeta = {
    ...(plot.__widgetvaVgplotMeta || {}),
    configStateKeys: [
      ...new Set([
        ...((plot.__widgetvaVgplotMeta && Array.isArray(plot.__widgetvaVgplotMeta.configStateKeys)
          ? plot.__widgetvaVgplotMeta.configStateKeys
          : [])),
        ...(Array.isArray(stateKeys) ? stateKeys : []),
      ]),
    ],
    configActions: {
      ...((plot.__widgetvaVgplotMeta && plot.__widgetvaVgplotMeta.configActions) || {}),
      [actionName]: handler,
    },
  }
  return plot
}

function createRuntimeFixture({
  widgetKind = 'scatter',
  plotAttributes = { xDomain: [0, 10], yDomain: [0, 20] },
  selections = [['brush', { type: 'intervalXY', value: { xDomain: [0, 10], yDomain: [0, 20] } }]],
} = {}) {
  return {
    __widgetvaVgplotRuntime: {
      provider: 'vgplot',
      plots: new Map([['plot_main', { plot: createPlot(plotAttributes), widgetKind }]]),
      selections: new Map(selections),
      params: new Map(),
      context: null,
    },
  }
}

function buildCanonicalActionNames(widgetKind) {
  const params = {
    widgetRef: `wl://demo/workspace/main/widget/${widgetKind}`,
    selectionRef: `wl://demo/workspace/main/selection/${widgetKind}`,
    widgetSpec: null,
    scope: 'local',
    affectedRefs: [`wl://demo/workspace/main/widget/${widgetKind}`],
  }
  switch (widgetKind) {
    case 'scatter':
      return buildScatterActionDescriptors(params).map((descriptor) => descriptor.name)
    case 'bar':
      return buildBarActionDescriptors(params).map((descriptor) => descriptor.name)
    case 'line':
      return buildLineActionDescriptors(params).map((descriptor) => descriptor.name)
    case 'heatmap':
      return buildHeatmapActionDescriptors(params).map((descriptor) => descriptor.name)
    default:
      return []
  }
}

function createCapabilityCompleteFixture(widgetKind) {
  const fixtureByKind = {
    scatter: createRuntimeFixture({
      widgetKind: 'scatter',
      plotAttributes: { xDomain: [0, 10], yDomain: [0, 20] },
      selections: [
        ['brush', { type: 'intervalXY', value: { xDomain: [0, 10], yDomain: [0, 20] } }],
        ['toggle', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }],
      ],
    }),
    bar: createRuntimeFixture({
      widgetKind: 'bar',
      plotAttributes: { xDomain: [0, 3] },
      selections: [
        ['toggle', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }],
      ],
    }),
    line: createRuntimeFixture({
      widgetKind: 'line',
      plotAttributes: { xDomain: ['2024-01-01', '2024-03-01'] },
      selections: [
        ['toggle', { type: 'toggleColor', value: { field: 'series', values: ['A'] } }],
        ['nearest', { type: 'nearestX', value: { field: 'date', value: '2024-01-15' } }],
      ],
    }),
    heatmap: createRuntimeFixture({
      widgetKind: 'heatmap',
      plotAttributes: { xDomain: [0, 3], yDomain: [0, 4] },
      selections: [
        ['cell', { type: 'toggle', value: { xField: 'Origin', yField: 'Cylinders', xValue: 'USA', yValue: '8' } }],
        ['region', { type: 'intervalXY', value: { xDomain: [0, 2], yDomain: [1, 3] } }],
      ],
    }),
  }
  const view = fixtureByKind[widgetKind]
  const actionNames = buildCanonicalActionNames(widgetKind)
  const plot = view?.__widgetvaVgplotRuntime?.plots?.get('plot_main')?.plot || null
  for (const actionName of actionNames) {
    attachPlotConfigAction(plot, actionName, () => true)
  }
  return view
}

test('resolveVgplotCapabilities advertises only the native-capable scatter actions', () => {
  const view = createRuntimeFixture()
  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'scatter',
    view,
  })

  assert.equal(capabilities.supported, true)
  assert.deepEqual(capabilities.supportedActionNames, [
    'scatter.brushRegion',
    'scatter.selectRegion',
    'scatter.zoomDomain',
  ])
})

test('resolveVgplotCapabilities covers the full canonical action set for phase-one vgplot widget kinds when native/config handlers are attached', () => {
  for (const widgetKind of ['scatter', 'bar', 'line', 'heatmap']) {
    const view = createCapabilityCompleteFixture(widgetKind)
    const capabilities = resolveVgplotCapabilities({
      widgetKind,
      view,
    })
    assert.deepEqual(
      capabilities.supportedActionNames.sort(),
      buildCanonicalActionNames(widgetKind).sort(),
      `vgplot capability coverage drifted for ${widgetKind}`,
    )
  }
})

test('createVgplotWidgetAdapter does not expose widget-family descriptor or runtime registration hooks', () => {
  const adapter = createVgplotWidgetAdapter({
    kind: 'scatter',
    buildActionDescriptors() {
      return [{ name: 'scatter.brushRegion' }]
    },
    buildPerceptionDescriptors() {
      return [{ name: 'perception.computeCorrelation' }]
    },
    registerActions() {},
    registerPerceptionQueries() {},
  })

  assert.equal(adapter.kind, 'scatter')
  assert.equal(typeof adapter.buildActionDescriptors, 'undefined')
  assert.equal(typeof adapter.buildPerceptionDescriptors, 'undefined')
  assert.equal(typeof adapter.registerActions, 'undefined')
  assert.equal(typeof adapter.registerPerceptionQueries, 'undefined')
})

test('executeVgplotAction routes scatter zoomDomain and selectRegion into provider-native state updates', () => {
  const view = createRuntimeFixture()

  assert.equal(
    executeVgplotAction({
      widgetKind: 'scatter',
      actionName: 'scatter.zoomDomain',
      params: { xDomain: [2, 6], yDomain: [4, 12] },
      view,
    }),
    true,
  )

  assert.equal(
    executeVgplotAction({
      widgetKind: 'scatter',
      actionName: 'scatter.selectRegion',
      params: { xRange: [2, 6], yRange: [4, 12] },
      view,
    }),
    true,
  )

  const state = readVgplotState({ view })
  assert.deepEqual(state.viewport, {
    xDomain: [2, 6],
    yDomain: [4, 12],
  })
  assert.deepEqual(state.selection, {
    type: 'intervalXY',
    value: {
      xDomain: [2, 6],
      yDomain: [4, 12],
    },
  })
})

test('resolveVgplotCapabilities advertises scatter.filterCategorical when a native toggle selection exists', () => {
  const view = createRuntimeFixture({
    widgetKind: 'scatter',
    plotAttributes: { xDomain: [0, 10], yDomain: [0, 20] },
    selections: [['category_toggle', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }]],
  })

  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'scatter',
    view,
  })

  assert.equal(capabilities.supported, true)
  assert.equal(capabilities.supportedActionNames.includes('scatter.filterCategorical'), true)
})

test('executeVgplotAction routes scatter.filterCategorical into the native toggle selection path', () => {
  const view = createRuntimeFixture({
    widgetKind: 'scatter',
    plotAttributes: { xDomain: [0, 10], yDomain: [0, 20] },
    selections: [['category_toggle', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }]],
  })

  assert.equal(
    executeVgplotAction({
      widgetKind: 'scatter',
      actionName: 'scatter.filterCategorical',
      params: { field: 'Origin', categoriesToRemove: ['Japan'] },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).selection, {
    type: 'toggleColor',
    value: {
      field: 'Origin',
      values: ['Japan'],
    },
  })
})

test('resolveVgplotCapabilities rejects unsupported widget kinds even when runtime objects exist', () => {
  const view = createRuntimeFixture({ widgetKind: 'parallelCoordinates' })
  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'parallelCoordinates',
    view,
  })

  assert.equal(capabilities.supported, false)
  assert.deepEqual(capabilities.supportedActionNames, [])
})

test('executeVgplotAction maps line zoomXRegion start/end params into a provider-native xDomain update', () => {
  const view = createRuntimeFixture({
    widgetKind: 'line',
    plotAttributes: { xDomain: ['2024-01-01', '2024-03-01'] },
    selections: [['nearest', { type: 'nearestX', value: { field: 'date', value: '2024-01-15' } }]],
  })

  assert.equal(
    executeVgplotAction({
      widgetKind: 'line',
      actionName: 'line.zoomXRegion',
      params: { start: '2024-02-01', end: '2024-02-15' },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).viewport, {
    xDomain: ['2024-02-01', '2024-02-15'],
  })
})

test('executeVgplotAction preserves canonical bar and heatmap params inside provider-native selection payloads', () => {
  const barView = createRuntimeFixture({
    widgetKind: 'bar',
    plotAttributes: { xDomain: [0, 3] },
    selections: [['click', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }]],
  })

  assert.equal(
    executeVgplotAction({
      widgetKind: 'bar',
      actionName: 'bar.filterCategories',
      params: { field: 'Origin', categories: ['Japan', 'USA'] },
      view: barView,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view: barView }).selection, {
    type: 'toggleColor',
    value: {
      field: 'Origin',
      values: ['Japan', 'USA'],
    },
  })

  const heatmapView = createRuntimeFixture({
    widgetKind: 'heatmap',
    plotAttributes: { xDomain: [0, 2], yDomain: [0, 2] },
    selections: [['cell', { type: 'toggle', value: { xField: 'Origin', yField: 'Cylinders', xValue: 'USA', yValue: '8' } }]],
  })

  assert.equal(
    executeVgplotAction({
      widgetKind: 'heatmap',
      actionName: 'heatmap.filterCells',
      params: { xField: 'Origin', yField: 'Cylinders', xValue: 'Japan', yValue: '4' },
      view: heatmapView,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view: heatmapView }).selection, {
    type: 'toggle',
    value: {
      xField: 'Origin',
      yField: 'Cylinders',
      xValue: 'Japan',
      yValue: '4',
    },
  })
})

test('resolveVgplotCapabilities advertises viewport actions from panZoom params when plot domains are not directly writable', () => {
  const view = createRuntimeFixture({
    widgetKind: 'line',
    plotAttributes: {},
    selections: [['nearest', { type: 'nearestX', value: { field: 'date', value: '2024-01-15' } }]],
  })
  view.__widgetvaVgplotRuntime.params.set('zoom_x', {
    type: 'panZoomX',
    value: {
      xDomain: ['2024-01-01', '2024-03-01'],
    },
  })

  const lineCapabilities = resolveVgplotCapabilities({
    widgetKind: 'line',
    view,
  })

  assert.equal(lineCapabilities.supported, true)
  assert.equal(lineCapabilities.supportedActionNames.includes('line.zoomXRegion'), true)
})

test('executeVgplotAction routes viewport updates into panZoom params when no plot domains are writable', () => {
  const view = createRuntimeFixture({
    widgetKind: 'scatter',
    plotAttributes: {},
    selections: [['brush', { type: 'intervalXY', value: { xDomain: [0, 10], yDomain: [0, 20] } }]],
  })
  view.__widgetvaVgplotRuntime.params.set('zoom_xy', {
    type: 'panZoom',
    value: {
      xDomain: [0, 10],
      yDomain: [0, 20],
    },
  })

  assert.equal(
    executeVgplotAction({
      widgetKind: 'scatter',
      actionName: 'scatter.zoomDomain',
      params: { xDomain: [2, 6], yDomain: [4, 12] },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).viewport, {
    xDomain: [2, 6],
    yDomain: [4, 12],
  })
})

test('executeVgplotAction preserves existing yDomain when line zoom updates only xDomain through panZoom params', () => {
  const view = createRuntimeFixture({
    widgetKind: 'line',
    plotAttributes: {},
    selections: [['nearest', { type: 'nearestX', value: { field: 'date', value: '2024-01-15' } }]],
  })
  view.__widgetvaVgplotRuntime.params.set('zoom_xy', {
    type: 'panZoom',
    value: {
      xDomain: ['2024-01-01', '2024-03-01'],
      yDomain: [5, 40],
    },
  })

  assert.equal(
    executeVgplotAction({
      widgetKind: 'line',
      actionName: 'line.zoomXRegion',
      params: { start: '2024-02-01', end: '2024-02-15' },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).viewport, {
    xDomain: ['2024-02-01', '2024-02-15'],
    yDomain: [5, 40],
  })
})

test('executeVgplotAction chooses the native toggle variant actually present on the runtime', () => {
  const view = createRuntimeFixture({
    widgetKind: 'bar',
    plotAttributes: { xDomain: [0, 3] },
    selections: [['category_toggle', { type: 'toggleX', value: { field: 'Origin', values: ['USA'] } }]],
  })

  assert.equal(
    executeVgplotAction({
      widgetKind: 'bar',
      actionName: 'bar.selectCategory',
      params: { field: 'Origin', values: ['Japan'] },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).selection, {
    type: 'toggleX',
    value: {
      field: 'Origin',
      values: ['Japan'],
    },
  })
})

test('executeVgplotAction supports bar category actions across native toggle variants', () => {
  for (const toggleType of ['toggleColor', 'toggleX', 'toggleY', 'toggle']) {
    const view = createRuntimeFixture({
      widgetKind: 'bar',
      plotAttributes: { xDomain: [0, 3] },
      selections: [['category_toggle', { type: toggleType, value: { field: 'Origin', values: ['USA'] } }]],
    })

    assert.equal(
      executeVgplotAction({
        widgetKind: 'bar',
        actionName: 'bar.selectCategory',
        params: { field: 'Origin', values: ['Japan'] },
        view,
      }),
      true,
      `bar.selectCategory should execute through ${toggleType}`,
    )

    assert.deepEqual(
      readVgplotState({ view }).selection,
      {
        type: toggleType,
        value: {
          field: 'Origin',
          values: ['Japan'],
        },
      },
      `bar.selectCategory should preserve ${toggleType} semantics`,
    )
  }
})

test('executeVgplotAction supports line.selectSeries across native toggle variants', () => {
  for (const toggleType of ['toggleColor', 'toggle', 'toggleY', 'toggleX']) {
    const view = createRuntimeFixture({
      widgetKind: 'line',
      plotAttributes: { xDomain: ['2024-01-01', '2024-03-01'] },
      selections: [['series_toggle', { type: toggleType, value: { field: 'series', values: ['A'] } }]],
    })

    assert.equal(
      executeVgplotAction({
        widgetKind: 'line',
        actionName: 'line.selectSeries',
        params: { field: 'series', values: ['B'] },
        view,
      }),
      true,
      `line.selectSeries should execute through ${toggleType}`,
    )

    assert.deepEqual(
      readVgplotState({ view }).selection,
      {
        type: toggleType,
        value: {
          field: 'series',
          values: ['B'],
        },
      },
      `line.selectSeries should preserve ${toggleType} semantics`,
    )
  }
})

test('resolveVgplotCapabilities advertises bar.toggleStackMode when the runtime exposes a native config action', () => {
  const plot = attachPlotConfigAction(
    createPlot({ xDomain: [0, 3], stackMode: 'stacked' }),
    'bar.toggleStackMode',
    ({ plot: targetPlot, params }) => {
      targetPlot.setAttribute('stackMode', params?.mode || null)
      return true
    },
  )
  const view = {
    __widgetvaVgplotRuntime: {
      provider: 'vgplot',
      plots: new Map([['plot_main', { plot, widgetKind: 'bar' }]]),
      selections: new Map([['category_toggle', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }]]),
      params: new Map(),
      context: null,
    },
  }

  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'bar',
    view,
  })

  assert.equal(capabilities.supported, true)
  assert.equal(capabilities.supportedActionNames.includes('bar.toggleStackMode'), true)
})

test('executeVgplotAction routes bar.toggleStackMode into a provider-native config action and exposes config readback', () => {
  const plot = attachPlotConfigAction(
    createPlot({ xDomain: [0, 3], stackMode: 'stacked' }),
    'bar.toggleStackMode',
    ({ plot: targetPlot, params }) => {
      targetPlot.setAttribute('stackMode', params?.mode || null)
      targetPlot.setAttribute('xOffsetMode', params?.mode === 'grouped' ? 'enabled' : 'disabled')
      return true
    },
  )
  const view = {
    __widgetvaVgplotRuntime: {
      provider: 'vgplot',
      plots: new Map([['plot_main', { plot, widgetKind: 'bar' }]]),
      selections: new Map([['category_toggle', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }]]),
      params: new Map(),
      context: null,
    },
  }

  assert.equal(
    executeVgplotAction({
      widgetKind: 'bar',
      actionName: 'bar.toggleStackMode',
      params: { mode: 'grouped' },
      view,
    }),
    true,
  )

  assert.equal(plot.getAttribute('stackMode'), 'grouped')
  assert.equal(plot.getAttribute('xOffsetMode'), 'enabled')
  assert.deepEqual(readVgplotState({ view }).config, {
    stackMode: 'grouped',
    xOffsetMode: 'enabled',
  })
})

test('executeVgplotAction routes bar.sortBars into a provider-native config action and exposes sort-mode readback', () => {
  const plot = attachPlotConfigAction(
    createPlot({ xDomain: [0, 3], sortMode: 'none' }),
    'bar.sortBars',
    ({ plot: targetPlot, params }) => {
      targetPlot.setAttribute('sortMode', `${params?.channel || 'x'}:${params?.order || 'ascending'}`)
      return true
    },
  )
  const view = {
    __widgetvaVgplotRuntime: {
      provider: 'vgplot',
      plots: new Map([['plot_main', { plot, widgetKind: 'bar' }]]),
      selections: new Map([['category_toggle', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }]]),
      params: new Map(),
      context: null,
    },
  }

  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'bar',
    view,
  })

  assert.equal(capabilities.supportedActionNames.includes('bar.sortBars'), true)
  assert.equal(
    executeVgplotAction({
      widgetKind: 'bar',
      actionName: 'bar.sortBars',
      params: { channel: 'x', order: 'descending' },
      view,
    }),
    true,
  )

  assert.equal(plot.getAttribute('sortMode'), 'x:descending')
  assert.deepEqual(readVgplotState({ view }).config, {
    sortMode: 'x:descending',
  })
})

test('executeVgplotAction routes bar.expandStack into a provider-native config action and exposes expansion readback', () => {
  const plot = attachPlotConfigAction(
    createPlot({ xDomain: [0, 3] }),
    'bar.expandStack',
    ({ plot: targetPlot, params }) => {
      targetPlot.setAttribute('expandStackCategory', params?.category ?? null)
      targetPlot.setAttribute('expandStackGroupField', 'segment')
      return true
    },
  )
  const view = {
    __widgetvaVgplotRuntime: {
      provider: 'vgplot',
      plots: new Map([['plot_main', { plot, widgetKind: 'bar' }]]),
      selections: new Map([['category_toggle', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }]]),
      params: new Map(),
      context: null,
    },
  }

  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'bar',
    view,
  })

  assert.equal(capabilities.supportedActionNames.includes('bar.expandStack'), true)
  assert.equal(
    executeVgplotAction({
      widgetKind: 'bar',
      actionName: 'bar.expandStack',
      params: { category: 'USA' },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).config, {
    expandStackCategory: 'USA',
    expandStackGroupField: 'segment',
  })
})

test('resolveVgplotCapabilities advertises line.selectSeries for any native toggle variant, not only plain toggle', () => {
  const view = createRuntimeFixture({
    widgetKind: 'line',
    plotAttributes: { xDomain: ['2024-01-01', '2024-03-01'] },
    selections: [['series_toggle', { type: 'toggleColor', value: { field: 'series', values: ['A'] } }]],
  })

  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'line',
    view,
  })

  assert.equal(capabilities.supported, true)
  assert.equal(capabilities.supportedActionNames.includes('line.selectSeries'), true)
  assert.equal(capabilities.supportedActionNames.includes('line.focusLines'), true)
})

test('executeVgplotAction routes line.focusLines into the native toggle selection path', () => {
  const view = createRuntimeFixture({
    widgetKind: 'line',
    plotAttributes: { xDomain: ['2024-01-01', '2024-03-01'] },
    selections: [['series_toggle', { type: 'toggleColor', value: { field: 'series', values: ['A'] } }]],
  })

  assert.equal(
    executeVgplotAction({
      widgetKind: 'line',
      actionName: 'line.focusLines',
      params: { lineField: 'series', lineIds: ['B'] },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).selection, {
    type: 'toggleColor',
    value: {
      field: 'series',
      values: ['B'],
    },
  })
})

test('executeVgplotAction routes line.highlightTrend into a provider-native config action and exposes trend readback', () => {
  const plot = attachPlotConfigAction(
    createPlot({ xDomain: ['2024-01-01', '2024-03-01'] }),
    'line.highlightTrend',
    ({ plot: targetPlot }) => {
      targetPlot.setAttribute('trendMode', 'regression-overlay')
      return true
    },
  )
  const view = {
    __widgetvaVgplotRuntime: {
      provider: 'vgplot',
      plots: new Map([['plot_main', { plot, widgetKind: 'line' }]]),
      selections: new Map([['series_toggle', { type: 'toggleColor', value: { field: 'series', values: ['A'] } }]]),
      params: new Map(),
      context: null,
    },
  }

  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'line',
    view,
  })

  assert.equal(capabilities.supportedActionNames.includes('line.highlightTrend'), true)
  assert.equal(
    executeVgplotAction({
      widgetKind: 'line',
      actionName: 'line.highlightTrend',
      params: {},
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).config, {
    trendMode: 'regression-overlay',
  })
})

test('executeVgplotAction routes line.showMovingAverage into a provider-native config action and exposes moving-average readback', () => {
  const plot = attachPlotConfigAction(
    createPlot({ xDomain: ['2024-01-01', '2024-03-01'] }),
    'line.showMovingAverage',
    ({ plot: targetPlot, params }) => {
      targetPlot.setAttribute('movingAverageWindow', params?.window ?? 7)
      return true
    },
  )
  const view = {
    __widgetvaVgplotRuntime: {
      provider: 'vgplot',
      plots: new Map([['plot_main', { plot, widgetKind: 'line' }]]),
      selections: new Map([['series_toggle', { type: 'toggleColor', value: { field: 'series', values: ['A'] } }]]),
      params: new Map(),
      context: null,
    },
  }

  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'line',
    view,
  })

  assert.equal(capabilities.supportedActionNames.includes('line.showMovingAverage'), true)
  assert.equal(
    executeVgplotAction({
      widgetKind: 'line',
      actionName: 'line.showMovingAverage',
      params: { window: 14 },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).config, {
    movingAverageWindow: 14,
  })
})

test('executeVgplotAction routes heatmap.adjustColorScale into a provider-native config action and exposes color-scale readback', () => {
  const plot = attachPlotConfigAction(
    createPlot({ xDomain: [0, 3], yDomain: [0, 4] }),
    'heatmap.adjustColorScale',
    ({ plot: targetPlot, params }) => {
      targetPlot.setAttribute('colorScaleScheme', params?.scheme ?? null)
      targetPlot.setAttribute('colorScaleDomain', Array.isArray(params?.domain) ? params.domain : null)
      return true
    },
  )
  const view = {
    __widgetvaVgplotRuntime: {
      provider: 'vgplot',
      plots: new Map([['plot_main', { plot, widgetKind: 'heatmap' }]]),
      selections: new Map([['matrix', { type: 'intervalXY', value: { xValues: ['USA'], yValues: ['4'] } }]]),
      params: new Map(),
      context: null,
    },
  }

  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'heatmap',
    view,
  })

  assert.equal(capabilities.supportedActionNames.includes('heatmap.adjustColorScale'), true)
  assert.equal(
    executeVgplotAction({
      widgetKind: 'heatmap',
      actionName: 'heatmap.adjustColorScale',
      params: { scheme: 'reds', domain: [0, 5] },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).config, {
    colorScaleScheme: 'reds',
    colorScaleDomain: [0, 5],
  })
})

test('executeVgplotAction routes heatmap.transpose into a provider-native config action and exposes transpose readback', () => {
  const plot = attachPlotConfigAction(
    createPlot({ xDomain: [0, 3], yDomain: [0, 4] }),
    'heatmap.transpose',
    ({ plot: targetPlot }) => {
      targetPlot.setAttribute('transposeMode', 'xy-swapped')
      return true
    },
  )
  const view = {
    __widgetvaVgplotRuntime: {
      provider: 'vgplot',
      plots: new Map([['plot_main', { plot, widgetKind: 'heatmap' }]]),
      selections: new Map([['matrix', { type: 'intervalXY', value: { xValues: ['USA'], yValues: ['4'] } }]]),
      params: new Map(),
      context: null,
    },
  }

  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'heatmap',
    view,
  })

  assert.equal(capabilities.supportedActionNames.includes('heatmap.transpose'), true)
  assert.equal(
    executeVgplotAction({
      widgetKind: 'heatmap',
      actionName: 'heatmap.transpose',
      params: {},
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).config, {
    transposeMode: 'xy-swapped',
  })
})

test('resolveVgplotCapabilities advertises heatmap.highlightRegion when interval or region native selections exist', () => {
  const view = createRuntimeFixture({
    widgetKind: 'heatmap',
    plotAttributes: { xDomain: [0, 2], yDomain: [0, 2] },
    selections: [['matrix', { type: 'intervalXY', value: { xValues: ['USA'], yValues: ['4'] } }]],
  })

  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'heatmap',
    view,
  })

  assert.equal(capabilities.supported, true)
  assert.equal(capabilities.supportedActionNames.includes('heatmap.highlightRegion'), true)
})

test('executeVgplotAction routes heatmap.highlightRegion into the native interval/region selection path', () => {
  const view = createRuntimeFixture({
    widgetKind: 'heatmap',
    plotAttributes: { xDomain: [0, 2], yDomain: [0, 2] },
    selections: [['matrix', { type: 'intervalXY', value: { xValues: ['USA'], yValues: ['4'] } }]],
  })

  assert.equal(
    executeVgplotAction({
      widgetKind: 'heatmap',
      actionName: 'heatmap.highlightRegion',
      params: { xValues: ['Japan'], yValues: ['6'] },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).selection, {
    type: 'intervalXY',
    value: {
      xValues: ['Japan'],
      yValues: ['6'],
    },
  })
})

test('executeVgplotAction routes heatmap.highlightRegionByValue into a provider-native config action and exposes value-range readback', () => {
  const plot = attachPlotConfigAction(
    createPlot({ xDomain: [0, 2], yDomain: [0, 2] }),
    'heatmap.highlightRegionByValue',
    ({ plot: targetPlot, params }) => {
      targetPlot.setAttribute('highlightValueRange', {
        minValue: params?.minValue ?? null,
        maxValue: params?.maxValue ?? null,
      })
      return true
    },
  )
  const view = {
    __widgetvaVgplotRuntime: {
      provider: 'vgplot',
      plots: new Map([['plot_main', { plot, widgetKind: 'heatmap' }]]),
      selections: new Map([['matrix', { type: 'intervalXY', value: { xValues: ['USA'], yValues: ['4'] } }]]),
      params: new Map(),
      context: null,
    },
  }

  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'heatmap',
    view,
  })

  assert.equal(capabilities.supportedActionNames.includes('heatmap.highlightRegionByValue'), true)
  assert.equal(
    executeVgplotAction({
      widgetKind: 'heatmap',
      actionName: 'heatmap.highlightRegionByValue',
      params: { minValue: 2, maxValue: 5 },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).config, {
    highlightValueRange: { minValue: 2, maxValue: 5 },
  })
})

test('executeVgplotAction routes heatmap.drilldownAxis into a provider-native config action and exposes drilldown readback', () => {
  const plot = attachPlotConfigAction(
    createPlot({ xDomain: [0, 2], yDomain: [0, 2] }),
    'heatmap.drilldownAxis',
    ({ plot: targetPlot, params }) => {
      targetPlot.setAttribute('drilldownLevel', params?.level ?? null)
      targetPlot.setAttribute('drilldownValue', params?.value ?? null)
      return true
    },
  )
  const view = {
    __widgetvaVgplotRuntime: {
      provider: 'vgplot',
      plots: new Map([['plot_main', { plot, widgetKind: 'heatmap' }]]),
      selections: new Map([['matrix', { type: 'intervalXY', value: { xValues: ['USA'], yValues: ['4'] } }]]),
      params: new Map(),
      context: null,
    },
  }

  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'heatmap',
    view,
  })

  assert.equal(capabilities.supportedActionNames.includes('heatmap.drilldownAxis'), true)
  assert.equal(
    executeVgplotAction({
      widgetKind: 'heatmap',
      actionName: 'heatmap.drilldownAxis',
      params: { level: 'month', value: 7 },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).config, {
    drilldownLevel: 'month',
    drilldownValue: 7,
  })
})

test('executeVgplotAction supports the remaining obvious config-backed vgplot actions through provider-native handlers', () => {
  const cases = [
    {
      widgetKind: 'scatter',
      actionName: 'scatter.showRegression',
      params: {},
      selection: ['brush', { type: 'intervalXY', value: { xDomain: [0, 10], yDomain: [0, 20] } }],
      stateKeys: ['regressionMode'],
      handler({ plot }) {
        plot.setAttribute('regressionMode', 'linear-fit')
        return true
      },
      expectedConfig: { regressionMode: 'linear-fit' },
    },
    {
      widgetKind: 'scatter',
      actionName: 'scatter.identifyClusters',
      params: {},
      selection: ['brush', { type: 'intervalXY', value: { xDomain: [0, 10], yDomain: [0, 20] } }],
      stateKeys: ['clusterMode'],
      handler({ plot }) {
        plot.setAttribute('clusterMode', 'kmeans')
        return true
      },
      expectedConfig: { clusterMode: 'kmeans' },
    },
    {
      widgetKind: 'bar',
      actionName: 'bar.highlightTopN',
      params: { n: 3, order: 'descending' },
      selection: ['category_toggle', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }],
      stateKeys: ['topNHighlight'],
      handler({ plot, params }) {
        plot.setAttribute('topNHighlight', { n: params?.n ?? null, order: params?.order ?? null })
        return true
      },
      expectedConfig: { topNHighlight: { n: 3, order: 'descending' } },
    },
    {
      widgetKind: 'bar',
      actionName: 'bar.filterSubcategories',
      params: { subcategoriesToRemove: ['s2'] },
      selection: ['category_toggle', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }],
      stateKeys: ['filteredSubcategories'],
      handler({ plot, params }) {
        plot.setAttribute('filteredSubcategories', params?.subcategoriesToRemove ?? [])
        return true
      },
      expectedConfig: { filteredSubcategories: ['s2'] },
    },
    {
      widgetKind: 'bar',
      actionName: 'bar.addBars',
      params: { values: ['B', 'C'] },
      selection: ['category_toggle', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }],
      stateKeys: ['visibleBars'],
      handler({ plot, params }) {
        plot.setAttribute('visibleBars', params?.values ?? [])
        return true
      },
      expectedConfig: { visibleBars: ['B', 'C'] },
    },
    {
      widgetKind: 'bar',
      actionName: 'bar.removeBars',
      params: { values: ['D'] },
      selection: ['category_toggle', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }],
      stateKeys: ['hiddenBars'],
      handler({ plot, params }) {
        plot.setAttribute('hiddenBars', params?.values ?? [])
        return true
      },
      expectedConfig: { hiddenBars: ['D'] },
    },
    {
      widgetKind: 'bar',
      actionName: 'bar.addBarItems',
      params: { items: [{ x: 'A', sub: 's1' }, { x: 'B', sub: 's2' }] },
      selection: ['category_toggle', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }],
      stateKeys: ['visibleBarItems'],
      handler({ plot, params }) {
        plot.setAttribute('visibleBarItems', params?.items ?? [])
        return true
      },
      expectedConfig: { visibleBarItems: [{ x: 'A', sub: 's1' }, { x: 'B', sub: 's2' }] },
    },
    {
      widgetKind: 'bar',
      actionName: 'bar.removeBarItems',
      params: { items: [{ x: 'C', sub: 's3' }] },
      selection: ['category_toggle', { type: 'toggleColor', value: { field: 'Origin', values: ['USA'] } }],
      stateKeys: ['hiddenBarItems'],
      handler({ plot, params }) {
        plot.setAttribute('hiddenBarItems', params?.items ?? [])
        return true
      },
      expectedConfig: { hiddenBarItems: [{ x: 'C', sub: 's3' }] },
    },
    {
      widgetKind: 'line',
      actionName: 'line.boldLines',
      params: { lineIds: ['A', 'B'] },
      selection: ['series_toggle', { type: 'toggleColor', value: { field: 'series', values: ['A'] } }],
      stateKeys: ['boldLineIds'],
      handler({ plot, params }) {
        plot.setAttribute('boldLineIds', params?.lineIds ?? [])
        return true
      },
      expectedConfig: { boldLineIds: ['A', 'B'] },
    },
    {
      widgetKind: 'line',
      actionName: 'line.filterLines',
      params: { values: ['A'] },
      selection: ['series_toggle', { type: 'toggleColor', value: { field: 'series', values: ['A'] } }],
      stateKeys: ['filteredLineIds'],
      handler({ plot, params }) {
        plot.setAttribute('filteredLineIds', params?.values ?? [])
        return true
      },
      expectedConfig: { filteredLineIds: ['A'] },
    },
    {
      widgetKind: 'line',
      actionName: 'line.drillDownXAxis',
      params: { level: 'month', value: 7 },
      selection: ['series_toggle', { type: 'toggleColor', value: { field: 'series', values: ['A'] } }],
      stateKeys: ['xDrilldownLevel', 'xDrilldownValue'],
      handler({ plot, params }) {
        plot.setAttribute('xDrilldownLevel', params?.level ?? null)
        plot.setAttribute('xDrilldownValue', params?.value ?? null)
        return true
      },
      expectedConfig: { xDrilldownLevel: 'month', xDrilldownValue: 7 },
    },
    {
      widgetKind: 'line',
      actionName: 'line.resetDrilldownXAxis',
      params: {},
      selection: ['series_toggle', { type: 'toggleColor', value: { field: 'series', values: ['A'] } }],
      stateKeys: ['xDrilldownLevel'],
      handler({ plot }) {
        plot.setAttribute('xDrilldownLevel', 'root')
        return true
      },
      expectedConfig: { xDrilldownLevel: 'root' },
    },
    {
      widgetKind: 'line',
      actionName: 'line.resampleXAxis',
      params: { interval: 'week' },
      selection: ['series_toggle', { type: 'toggleColor', value: { field: 'series', values: ['A'] } }],
      stateKeys: ['xResampleInterval'],
      handler({ plot, params }) {
        plot.setAttribute('xResampleInterval', params?.interval ?? null)
        return true
      },
      expectedConfig: { xResampleInterval: 'week' },
    },
    {
      widgetKind: 'line',
      actionName: 'line.resetResampleXAxis',
      params: {},
      selection: ['series_toggle', { type: 'toggleColor', value: { field: 'series', values: ['A'] } }],
      stateKeys: ['xResampleInterval'],
      handler({ plot }) {
        plot.setAttribute('xResampleInterval', 'raw')
        return true
      },
      expectedConfig: { xResampleInterval: 'raw' },
    },
    {
      widgetKind: 'heatmap',
      actionName: 'heatmap.resetDrilldown',
      params: {},
      selection: ['matrix', { type: 'intervalXY', value: { xValues: ['USA'], yValues: ['4'] } }],
      stateKeys: ['drilldownLevel'],
      handler({ plot }) {
        plot.setAttribute('drilldownLevel', 'root')
        return true
      },
      expectedConfig: { drilldownLevel: 'root' },
    },
    {
      widgetKind: 'heatmap',
      actionName: 'heatmap.addMarginalBars',
      params: {},
      selection: ['matrix', { type: 'intervalXY', value: { xValues: ['USA'], yValues: ['4'] } }],
      stateKeys: ['marginalBarsMode'],
      handler({ plot }) {
        plot.setAttribute('marginalBarsMode', 'enabled')
        return true
      },
      expectedConfig: { marginalBarsMode: 'enabled' },
    },
    {
      widgetKind: 'heatmap',
      actionName: 'heatmap.thresholdMask',
      params: { minValue: 2 },
      selection: ['matrix', { type: 'intervalXY', value: { xValues: ['USA'], yValues: ['4'] } }],
      stateKeys: ['thresholdMask'],
      handler({ plot, params }) {
        plot.setAttribute('thresholdMask', { minValue: params?.minValue ?? null, maxValue: params?.maxValue ?? null })
        return true
      },
      expectedConfig: { thresholdMask: { minValue: 2, maxValue: null } },
    },
    {
      widgetKind: 'heatmap',
      actionName: 'heatmap.clusterRowsCols',
      params: {},
      selection: ['matrix', { type: 'intervalXY', value: { xValues: ['USA'], yValues: ['4'] } }],
      stateKeys: ['clusterRowsColsMode'],
      handler({ plot }) {
        plot.setAttribute('clusterRowsColsMode', 'enabled')
        return true
      },
      expectedConfig: { clusterRowsColsMode: 'enabled' },
    },
  ]

  for (const testCase of cases) {
    const plot = attachPlotConfigAction(
      createPlot({}),
      testCase.actionName,
      testCase.handler,
      { stateKeys: testCase.stateKeys },
    )
    const view = {
      __widgetvaVgplotRuntime: {
        provider: 'vgplot',
        plots: new Map([['plot_main', { plot, widgetKind: testCase.widgetKind }]]),
        selections: new Map([testCase.selection]),
        params: new Map(),
        context: null,
      },
    }

    const capabilities = resolveVgplotCapabilities({
      widgetKind: testCase.widgetKind,
      view,
    })

    assert.equal(
      capabilities.supportedActionNames.includes(testCase.actionName),
      true,
      `${testCase.actionName} should be advertised when a native config handler is present`,
    )
    assert.equal(
      executeVgplotAction({
        widgetKind: testCase.widgetKind,
        actionName: testCase.actionName,
        params: testCase.params,
        view,
      }),
      true,
      `${testCase.actionName} should execute through the provider-native config path`,
    )
    assert.deepEqual(
      readVgplotState({ view }).config,
      testCase.expectedConfig,
      `${testCase.actionName} should expose config readback`,
    )
  }
})

test('executeVgplotAction falls back from intervalXY to region when only region is available', () => {
  const view = createRuntimeFixture({
    widgetKind: 'scatter',
    plotAttributes: { xDomain: [0, 10], yDomain: [0, 20] },
    selections: [['region_selection', { type: 'region', value: { xDomain: [0, 10], yDomain: [0, 20] } }]],
  })

  assert.equal(
    executeVgplotAction({
      widgetKind: 'scatter',
      actionName: 'scatter.selectRegion',
      params: { xRange: [1, 5], yRange: [6, 9] },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).selection, {
    type: 'region',
    value: {
      xDomain: [1, 5],
      yDomain: [6, 9],
    },
  })
})

test('resolveVgplotCapabilities advertises scatter region actions when only a native intervalX selection exists', () => {
  const view = createRuntimeFixture({
    widgetKind: 'scatter',
    plotAttributes: { xDomain: [0, 10], yDomain: [0, 20] },
    selections: [['brush_x', { type: 'intervalX', value: { xDomain: [0, 10] } }]],
  })

  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'scatter',
    view,
  })

  assert.equal(capabilities.supportedActionNames.includes('scatter.brushRegion'), true)
  assert.equal(capabilities.supportedActionNames.includes('scatter.selectRegion'), true)
})

test('executeVgplotAction routes scatter.selectRegion through native intervalX when only an x-axis interval exists', () => {
  const view = createRuntimeFixture({
    widgetKind: 'scatter',
    plotAttributes: { xDomain: [0, 10], yDomain: [0, 20] },
    selections: [['brush_x', { type: 'intervalX', value: { xDomain: [0, 10] } }]],
  })

  assert.equal(
    executeVgplotAction({
      widgetKind: 'scatter',
      actionName: 'scatter.selectRegion',
      params: { xRange: [2, 6] },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).selection, {
    type: 'intervalX',
    value: {
      xDomain: [2, 6],
    },
  })
})

test('resolveVgplotCapabilities advertises heatmap region actions when only a native intervalY selection exists', () => {
  const view = createRuntimeFixture({
    widgetKind: 'heatmap',
    plotAttributes: { xDomain: [0, 3], yDomain: [0, 4] },
    selections: [['matrix_y', { type: 'intervalY', value: { yValues: ['4'] } }]],
  })

  const capabilities = resolveVgplotCapabilities({
    widgetKind: 'heatmap',
    view,
  })

  assert.equal(capabilities.supportedActionNames.includes('heatmap.selectSubmatrix'), true)
  assert.equal(capabilities.supportedActionNames.includes('heatmap.filterCellsByRegion'), true)
  assert.equal(capabilities.supportedActionNames.includes('heatmap.highlightRegion'), true)
})

test('executeVgplotAction routes heatmap.highlightRegion through native intervalY when only a y-axis interval exists', () => {
  const view = createRuntimeFixture({
    widgetKind: 'heatmap',
    plotAttributes: { xDomain: [0, 3], yDomain: [0, 4] },
    selections: [['matrix_y', { type: 'intervalY', value: { yValues: ['4'] } }]],
  })

  assert.equal(
    executeVgplotAction({
      widgetKind: 'heatmap',
      actionName: 'heatmap.highlightRegion',
      params: { yValues: ['6', '8'] },
      view,
    }),
    true,
  )

  assert.deepEqual(readVgplotState({ view }).selection, {
    type: 'intervalY',
    value: {
      yValues: ['6', '8'],
    },
  })
})

test('queryVgplotPerception exposes readable provider-level summaries for selection and viewport state', () => {
  const view = createRuntimeFixture({
    widgetKind: 'scatter',
    plotAttributes: { xDomain: [10, 20], yDomain: [30, 40] },
    selections: [['brush', { type: 'intervalXY', value: { xDomain: [10, 20], yDomain: [30, 40] } }]],
  })

  const selectionResult = queryVgplotPerception({
    perceptionName: 'provider.inspectSelection',
    view,
  })
  const viewportResult = queryVgplotPerception({
    perceptionName: 'provider.inspectViewport',
    view,
  })

  assert.equal(selectionResult?.summary?.includes('intervalXY'), true)
  assert.deepEqual(selectionResult?.result?.selection, {
    type: 'intervalXY',
    value: { xDomain: [10, 20], yDomain: [30, 40] },
  })
  assert.equal(viewportResult?.summary?.includes('xDomain'), true)
  assert.deepEqual(viewportResult?.result?.viewport, {
    xDomain: [10, 20],
    yDomain: [30, 40],
  })
})

test('readVgplotState exposes provider-native driver diagnostics for verification consumers', () => {
  const view = createRuntimeFixture({
    widgetKind: 'scatter',
    plotAttributes: { xDomain: [10, 20], yDomain: [30, 40] },
    selections: [['brush', { type: 'intervalXY', value: { xDomain: [10, 20], yDomain: [30, 40] } }]],
  })
  view.__widgetvaVgplotRuntime.params.set('zoom_xy', {
    type: 'panZoom',
    value: { xDomain: [10, 20], yDomain: [30, 40] },
  })

  const state = readVgplotState({ view })

  assert.deepEqual(state.providerState.selectionTypes, ['intervalXY'])
  assert.deepEqual(state.providerState.paramTypes, ['panZoom'])
  assert.deepEqual(state.providerState.viewportDrivers, [
    'plotAttribute.xDomain',
    'plotAttribute.yDomain',
    'param.panZoom',
  ])
})

test('buildVgplotVerificationEvidence maps provider-native runtime deltas into canonical verification-shaped fields', () => {
  const beforeState = {
    selection: null,
    viewport: { xDomain: [0, 10], yDomain: [0, 20] },
    config: null,
    providerState: {
      viewportDrivers: ['plotAttribute.xDomain', 'plotAttribute.yDomain'],
    },
  }
  const afterState = {
    selection: {
      type: 'intervalX',
      value: {
        xDomain: [2, 6],
      },
    },
    viewport: { xDomain: [0, 10], yDomain: [0, 20] },
    config: null,
    providerState: {
      viewportDrivers: ['plotAttribute.xDomain', 'plotAttribute.yDomain'],
    },
  }

  const verification = buildVgplotVerificationEvidence({
    actionName: 'scatter.selectRegion',
    beforeState,
    afterState,
  })

  assert.equal(verification.ok, true)
  assert.equal(verification.checks.providerNativePath.path, 'selection.intervalX')
  assert.equal(verification.checks.stateChange.ok, true)
  assert.deepEqual(verification.stateChange.changedKinds, ['selection'])
  assert.equal(verification.visualChange.primarySurface, 'selection')
})

test('queryVgplotPerception can return canonical verification-shaped provider evidence without changing top-level verify fields', () => {
  const view = createRuntimeFixture({
    widgetKind: 'scatter',
    plotAttributes: { xDomain: [0, 10], yDomain: [0, 20] },
    selections: [['brush_x', { type: 'intervalX', value: { xDomain: [2, 6] } }]],
  })

  const result = queryVgplotPerception({
    perceptionName: 'provider.inspectVerification',
    actionName: 'scatter.selectRegion',
    beforeState: {
      selection: null,
      viewport: { xDomain: [0, 10], yDomain: [0, 20] },
      config: null,
      providerState: {
        viewportDrivers: ['plotAttribute.xDomain', 'plotAttribute.yDomain'],
      },
    },
    view,
  })

  assert.equal(result?.ok, true)
  assert.equal(typeof result?.summary, 'string')
  assert.equal(result?.result?.ok, true)
  assert.equal(result?.result?.checks?.providerNativePath?.path, 'selection.intervalX')
  assert.equal(result?.result?.checks?.stateChange?.ok, true)
})

test('orchestrateVgplotView attaches runtime capture and widget/data binding metadata onto the view', () => {
  const view = {}
  const orchestration = orchestrateVgplotView({
    view,
    widgetKind: 'scatter',
    runtimeCapture: {
      provider: 'vgplot',
      plots: new Map([['plot_main', { plot: createPlot({ xDomain: [0, 10], yDomain: [0, 20] }), widgetKind: 'scatter' }]]),
      selections: new Map([['brush', { type: 'intervalXY', value: { xDomain: [0, 10], yDomain: [0, 20] } }]]),
      params: new Map(),
      context: null,
    },
    binding: {
      widgetRef: 'wl://demo/workspace/main/widget/vgplot_scatter',
      dataRef: 'wl://demo/workspace/main/data/cars',
      widgetKind: 'scatter',
      fields: ['Horsepower', 'Miles_per_Gallon', 'Origin'],
      plotBindings: [
        {
          plotId: 'plot_main',
          role: 'primary',
          xField: 'Horsepower',
          yField: 'Miles_per_Gallon',
          colorField: 'Origin',
        },
      ],
    },
  })

  assert.deepEqual(orchestration.runtimeCapture, {
    provider: 'vgplot',
    plotIds: ['plot_main'],
    selectionNames: ['brush'],
    paramNames: [],
  })
  assert.equal(orchestration.capabilities.supported, true)
  assert.equal(view.__widgetvaVgplotRuntime?.binding?.widgetKind, 'scatter')
  assert.equal(view.__widgetvaVgplotBinding?.dataRef, 'wl://demo/workspace/main/data/cars')
})

test('queryVgplotPerception returns binding-aware summaries when metadata is attached', () => {
  const view = {}
  orchestrateVgplotView({
    view,
    widgetKind: 'scatter',
    runtimeCapture: {
      provider: 'vgplot',
      plots: new Map([['plot_main', { plot: createPlot({ xDomain: [5, 15], yDomain: [10, 25] }), widgetKind: 'scatter' }]]),
      selections: new Map(),
      params: new Map(),
      context: null,
    },
    binding: {
      widgetRef: 'wl://demo/workspace/main/widget/vgplot_scatter',
      dataRef: 'wl://demo/workspace/main/data/cars',
      widgetKind: 'scatter',
      fields: ['Horsepower', 'Miles_per_Gallon'],
    },
  })

  const bindingResult = queryVgplotPerception({
    perceptionName: 'provider.inspectBinding',
    view,
  })

  assert.equal(bindingResult?.summary?.includes('widgetKind=scatter'), true)
  assert.deepEqual(bindingResult?.result?.binding, {
    widgetRef: 'wl://demo/workspace/main/widget/vgplot_scatter',
    dataRef: 'wl://demo/workspace/main/data/cars',
    widgetKind: 'scatter',
    selectionNames: [],
    paramNames: [],
    plotBindings: [],
    fields: ['Horsepower', 'Miles_per_Gallon'],
  })
})

test('captureVgplotRuntime discovers plots, selections, and params from a real context-like namedPlots entry', () => {
  const plot = createPlot({ xDomain: [0, 10], yDomain: [0, 20] })
  attachVgplotPlotRuntimeMetadata(plot, {
    widgetKind: 'scatter',
    selections: [
      ['brush', { type: 'intervalXY', value: { xDomain: [0, 10], yDomain: [0, 20] } }],
    ],
    params: [
      ['zoom_xy', { type: 'panZoom', value: { xDomain: [0, 10], yDomain: [0, 20] } }],
    ],
  })
  const context = {
    namedPlots: new Map([['scatter_main', plot]]),
  }
  attachVgplotContextRuntimeMetadata(context, {
    paramsByName: new Map([
      ['zoom_xy', { type: 'panZoom', value: { xDomain: [0, 10], yDomain: [0, 20] } }],
    ]),
  })

  const runtime = captureVgplotRuntime({
    view: {
      context,
    },
  })

  assert.deepEqual([...runtime.plots.keys()], ['scatter_main'])
  assert.deepEqual([...runtime.selections.keys()], ['brush'])
  assert.deepEqual([...runtime.params.keys()], ['zoom_xy'])
  assert.equal(runtime.plots.get('scatter_main')?.widgetKind, 'scatter')
})

test('orchestrateVgplotView captures runtime from context namedPlots when no explicit runtimeCapture is provided', () => {
  const plot = createPlot({ xDomain: [1, 9], yDomain: [2, 8] })
  attachVgplotPlotRuntimeMetadata(plot, {
    widgetKind: 'scatter',
    selections: [
      ['brush', { type: 'intervalXY', value: { xDomain: [1, 9], yDomain: [2, 8] } }],
    ],
    params: [
      ['zoom_xy', { type: 'panZoom', value: { xDomain: [1, 9], yDomain: [2, 8] } }],
    ],
  })
  const view = {
    context: {
      namedPlots: new Map([['scatter_main', plot]]),
    },
  }

  const orchestration = orchestrateVgplotView({
    view,
    widgetKind: 'scatter',
  })

  assert.deepEqual(orchestration.runtimeCapture, {
    provider: 'vgplot',
    plotIds: ['scatter_main'],
    selectionNames: ['brush'],
    paramNames: ['zoom_xy'],
  })
  assert.equal(orchestration.capabilities.supportedActionNames.includes('scatter.zoomDomain'), true)
  assert.equal(view.__widgetvaVgplotRuntime?.plots.get('scatter_main')?.widgetKind, 'scatter')
})
