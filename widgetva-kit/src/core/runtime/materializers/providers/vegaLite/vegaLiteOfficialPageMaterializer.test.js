import test from 'node:test'
import assert from 'node:assert/strict'

import { buildVegaLiteRenderSpecFromRuntimeState } from './vegaLiteOfficialPageMaterializer.js'

test('buildVegaLiteRenderSpecFromRuntimeState projects scatter filter and zoom state through Vega-Lite spec actions', () => {
  const spec = {
    data: {
      values: [
        { region: 'Downtown', spend: 4200, visitors: 9800 },
        { region: 'Harbor', spend: 2800, visitors: 6400 },
      ],
    },
    mark: 'point',
    encoding: {
      x: { field: 'spend', type: 'quantitative', scale: { domain: [2000, 5000] } },
      y: { field: 'visitors', type: 'quantitative', scale: { domain: [0, 12000] } },
      color: { field: 'region', type: 'nominal' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [
        {
          kind: 'filter',
          source: 'action',
          spec: {
            actionName: 'scatter.filterCategorical',
            field: 'region',
            values: ['Harbor'],
            predicates: [{ field: 'region', op: 'notIn', value: ['Harbor'] }],
          },
        },
      ],
      view: {
        xDomain: [3500, 4500],
        yDomain: [9000, 11000],
      },
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.encoding.x.scale.domain, [3500, 4500])
  assert.deepEqual(renderSpec.encoding.y.scale.domain, [9000, 11000])
  assert.deepEqual(renderSpec.mark, { type: 'point', clip: true })
  assert.deepEqual(renderSpec.transform, [
    {
      filter: { not: { field: 'region', oneOf: ['Harbor'] } },
      _widgetvaTag: 'scatter.filterCategorical',
    },
  ])
})

test('buildVegaLiteRenderSpecFromRuntimeState resolves open scatter zoom domains without corrupting the opposite axis', () => {
  const spec = {
    data: {
      values: [
        { region: 'Downtown', spend: 4200, visitors: 9800 },
        { region: 'Harbor', spend: 2800, visitors: 6400 },
      ],
    },
    mark: 'point',
    encoding: {
      x: { field: 'spend', type: 'quantitative', scale: { domain: [2000, 5000] } },
      y: { field: 'visitors', type: 'quantitative', scale: { domain: [0, 12000] } },
      color: { field: 'region', type: 'nominal' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {
        xDomain: [3500, null],
        yDomain: [null, null],
      },
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.encoding.x.scale.domain, [3500, 5000])
  assert.deepEqual(renderSpec.encoding.y.scale.domain, [0, 12000])
})

test('buildVegaLiteRenderSpecFromRuntimeState projects canonical coordination filter predicates', () => {
  const spec = {
    data: {
      values: [
        { region: 'Downtown', visitors: 10 },
        { region: 'Harbor', visitors: 8 },
      ],
    },
    mark: 'line',
    encoding: {
      x: { field: 'region', type: 'nominal' },
      y: { field: 'visitors', type: 'quantitative' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [
        {
          ref: 'wl://widgetva-app/workspace/demo/widget/w_line/transform/region-filter',
          kind: 'filter',
          source: 'coordination',
          sourceRef: 'wl://widgetva-app/workspace/demo/widget/w_bar/selection/region',
          predicate: { field: 'region', op: 'in', value: ['Downtown'] },
        },
      ],
      view: {},
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.transform, [
    {
      _widgetvaRuntimeTransform: true,
      _widgetvaTag: 'wl://widgetva-app/workspace/demo/widget/w_bar/selection/region',
      filter: { field: 'region', oneOf: ['Downtown'] },
    },
  ])
})

test('buildVegaLiteRenderSpecFromRuntimeState projects line resample and bold state through Vega-Lite spec actions', () => {
  const spec = {
    data: {
      values: [
        { t: '2024-01-01', value: 10, series: 'A' },
        { t: '2024-01-15', value: 14, series: 'A' },
        { t: '2024-01-01', value: 7, series: 'B' },
      ],
    },
    mark: 'line',
    encoding: {
      x: { field: 't', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {
        reencode: {
          mode: 'resample',
          sourceAction: 'line.resampleXAxis',
          granularity: 'month',
          agg: 'mean',
        },
        highlight: {
          mode: 'seriesEmphasis',
          sourceAction: 'line.boldLines',
          lineField: 'series',
          lineNames: ['A'],
          boldWidth: 5,
          baseWidth: 1,
        },
      },
      selections: {},
    },
  })

  assert.equal(renderSpec.encoding.x.field, 'month_t')
  assert.equal(renderSpec.encoding.y.field, 'mean_value')
  assert.deepEqual(renderSpec.transform.map((transform) => transform._widgetvaTag), [
    'line.resampleXAxis',
    'line.resampleXAxis.aggregate',
  ])
  assert.deepEqual(renderSpec.encoding.strokeWidth, {
    condition: { test: 'indexof(["A"], datum[\'series\']) >= 0', value: 5 },
    value: 1,
  })
})

test('buildVegaLiteRenderSpecFromRuntimeState projects coordination selection reencode as focus context emphasis', () => {
  const spec = {
    data: {
      values: [
        { region: 'Central', spend: 3600, visitors: 7800 },
        { region: 'Harbor', spend: 4200, visitors: 9100 },
      ],
    },
    mark: 'point',
    encoding: {
      x: { field: 'spend', type: 'quantitative' },
      y: { field: 'visitors', type: 'quantitative' },
      color: { field: 'region', type: 'nominal' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {
        reencode: {
          sourceAction: 'coordination.selectionToReencode',
          channel: 'color',
          mode: 'emphasizeSelection',
          sourceSelection: {
            predicates: [{ field: 'region', op: 'in', value: ['Central'] }],
          },
        },
      },
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.encoding.opacity, {
    condition: { test: 'indexof(["Central"], datum[\'region\']) >= 0', value: 0.98 },
    value: 0.18,
  })
  assert.deepEqual(renderSpec.encoding.strokeWidth, {
    condition: { test: 'indexof(["Central"], datum[\'region\']) >= 0', value: 3.5 },
    value: 1.2,
  })
})

test('buildVegaLiteRenderSpecFromRuntimeState projects coordination domain reencode as focus context emphasis', () => {
  const spec = {
    data: {
      values: [
        { region: 'Central', spend: 3600, visitors: 7800 },
        { region: 'Harbor', spend: 4200, visitors: 9100 },
      ],
    },
    mark: 'bar',
    encoding: {
      x: { field: 'region', type: 'nominal' },
      y: { field: 'visitors', type: 'quantitative' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {
        reencode: {
          sourceAction: 'coordination.domainToReencode',
          channel: 'opacity',
          mode: 'emphasizeDomain',
          sourcePredicate: { field: 'spend', op: 'between', value: [3500, 4500] },
        },
      },
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.encoding.opacity, {
    condition: { test: 'datum[\'spend\'] >= 3500 && datum[\'spend\'] <= 4500', value: 0.98 },
    value: 0.18,
  })
  assert.deepEqual(renderSpec.encoding.strokeWidth, {
    condition: { test: 'datum[\'spend\'] >= 3500 && datum[\'spend\'] <= 4500', value: 3.5 },
    value: 1.2,
  })
})

test('buildVegaLiteRenderSpecFromRuntimeState projects coordination sort-order reencode onto target categorical channels', () => {
  const spec = {
    data: {
      values: [
        { region: 'Central', month: 'Jan', visitors: 7800 },
        { region: 'Harbor', month: 'Jan', visitors: 9100 },
      ],
    },
    mark: 'rect',
    encoding: {
      x: { field: 'month', type: 'nominal' },
      y: { field: 'region', type: 'nominal' },
      color: { field: 'visitors', type: 'quantitative' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {
        reencode: {
          sourceAction: 'coordination.reencodeToReencode',
          mode: 'alignSortOrder',
          sourceSlot: 'view.sort',
          field: 'region',
          order: 'descending',
          aggregate: 'sum',
        },
      },
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.encoding.y.sort, {
    field: 'region',
    order: 'descending',
    op: 'sum',
  })
})

test('buildVegaLiteRenderSpecFromRuntimeState projects coordination grouping reencode as target category emphasis', () => {
  const spec = {
    data: {
      values: [
        { region: 'Central', visitors: 7800 },
        { region: 'Harbor', visitors: 9100 },
        { region: 'Other', visitors: 4300 },
      ],
    },
    mark: 'bar',
    encoding: {
      x: { field: 'region', type: 'nominal' },
      y: { field: 'visitors', type: 'quantitative' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {
        reencode: {
          sourceAction: 'coordination.reencodeToReencode',
          mode: 'projectGrouping',
          sourceSlot: 'view.addRemove',
          channel: 'color',
          field: 'region',
          nodes: ['Central', 'Harbor'],
          aggregateName: 'Other',
        },
      },
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.encoding.color, {
    condition: {
      test: 'indexof(["Central", "Harbor", "Other"], datum[\'region\']) >= 0',
      value: '#2f5f9e',
    },
    value: '#d7dee8',
  })
  assert.deepEqual(renderSpec.encoding.strokeWidth, {
    condition: {
      test: 'indexof(["Central", "Harbor", "Other"], datum[\'region\']) >= 0',
      value: 1.8,
    },
    value: 0,
  })
})

test('buildVegaLiteRenderSpecFromRuntimeState projects bar sort highlight and visibility state through Vega-Lite spec actions', () => {
  const spec = {
    data: {
      values: [
        { region: 'Downtown', visitors: 420 },
        { region: 'Harbor', visitors: 120 },
        { region: 'Valley', visitors: 260 },
      ],
    },
    mark: 'bar',
    encoding: {
      x: { field: 'region', type: 'nominal' },
      y: { field: 'visitors', type: 'quantitative' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {
        sort: {
          sourceAction: 'bar.sortBars',
          channel: 'x',
          order: 'descending',
          field: 'visitors',
        },
        highlight: {
          sourceAction: 'bar.highlightTopN',
          n: 1,
          order: 'descending',
          categoryField: 'region',
          measureField: 'visitors',
        },
        addRemove: {
          sourceAction: 'bar.removeBars',
          field: 'region',
          visibleValues: ['Downtown', 'Valley'],
          changedValues: ['Harbor'],
        },
      },
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.encoding.x.sort, ['Downtown', 'Valley', 'Harbor'])
  assert.deepEqual(renderSpec.transform, [
    {
      filter: { field: 'region', oneOf: ['Downtown', 'Valley'] },
      _widgetvaTag: 'bar.addBars',
    },
  ])
  assert.deepEqual(renderSpec.encoding.opacity, {
    condition: { test: 'indexof(["Downtown"], datum[\'region\']) >= 0', value: 1 },
    value: 0.28,
  })
})

test('buildVegaLiteRenderSpecFromRuntimeState projects bar sort after runtime rows are available', () => {
  const spec = {
    data: { url: 'runtime://visitors-by-region' },
    mark: 'bar',
    encoding: {
      x: { field: 'region', type: 'nominal' },
      y: { field: 'visitors', type: 'quantitative' },
    },
  }
  const runtime = {
    store: {
      readRuntimeData(ref) {
        if (ref !== 'runtime://visible') return null
        return {
          rows: [
            { region: 'Central', visitors: 25 },
            { region: 'Downtown', visitors: 57 },
            { region: 'Harbor', visitors: 42 },
            { region: 'Valley', visitors: 28 },
          ],
        }
      },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime,
    state: {
      data: {
        sourceDataRef: 'runtime://source',
        currentDataRef: 'runtime://visible',
        visibleCount: 4,
      },
      transforms: [],
      view: {
        sort: {
          sourceAction: 'bar.sortBars',
          channel: 'x',
          order: 'descending',
        },
      },
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.data.values.map((row) => row.region), ['Central', 'Downtown', 'Harbor', 'Valley'])
  assert.deepEqual(renderSpec.encoding.x.sort, ['Downtown', 'Harbor', 'Valley', 'Central'])
})

test('buildVegaLiteRenderSpecFromRuntimeState projects line moving-average add/remove state through Vega-Lite spec actions', () => {
  const spec = {
    data: {
      values: [
        { t: '2024-01-01', value: 10, series: 'A' },
        { t: '2024-02-01', value: 14, series: 'A' },
        { t: '2024-03-01', value: 12, series: 'A' },
      ],
    },
    mark: 'line',
    encoding: {
      x: { field: 't', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {
        addRemove: {
          sourceAction: 'line.showMovingAverage',
          windowSize: 3,
        },
      },
      selections: {},
    },
  })

  assert.equal(renderSpec.layer.some((layer) => layer._widgetvaTag === 'line.showMovingAverage'), true)
})

test('buildVegaLiteRenderSpecFromRuntimeState projects line focus state through Vega-Lite spec actions', () => {
  const spec = {
    data: {
      values: [
        { t: '2024-01-01', value: 10, series: 'A' },
        { t: '2024-01-01', value: 7, series: 'B' },
      ],
    },
    mark: 'line',
    encoding: {
      x: { field: 't', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {
        highlight: {
          sourceAction: 'line.focusLines',
          lineField: 'series',
          lines: ['A'],
          dimOpacity: 0.08,
        },
      },
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.encoding.opacity, {
    condition: { test: 'indexof(["A"], datum[\'series\']) >= 0', value: 1 },
    value: 0.08,
  })
})

test('buildVegaLiteRenderSpecFromRuntimeState projects bar category selection into visible bar emphasis', () => {
  const spec = {
    data: {
      values: [
        { region: 'Downtown', visitors: 420 },
        { region: 'Harbor', visitors: 120 },
      ],
    },
    mark: 'bar',
    encoding: {
      x: { field: 'region', type: 'nominal' },
      y: { field: 'visitors', type: 'quantitative' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {},
      selections: {
        s1: {
          selectionId: 's1',
          selection_type: 'category',
          field: 'region',
          values: ['Downtown'],
          predicates: [{ field: 'region', op: 'in', value: ['Downtown'] }],
        },
      },
    },
  })

  assert.equal(renderSpec.data.values[0].__widgetva_selected, true)
  assert.equal(renderSpec.data.values[1].__widgetva_selected, false)
  assert.deepEqual(renderSpec.encoding.opacity, {
    condition: { test: `(indexof(["Downtown"], datum['region']) >= 0)`, value: 0.98 },
    value: 0.22,
  })
  assert.deepEqual(renderSpec.encoding.strokeWidth, {
    condition: { test: `(indexof(["Downtown"], datum['region']) >= 0)`, value: 2 },
    value: 0,
  })
})

test('buildVegaLiteRenderSpecFromRuntimeState projects line series selection into whole-series emphasis', () => {
  const spec = {
    data: {
      values: [
        { month: 'Jan', visitors: 10, region: 'Downtown' },
        { month: 'Feb', visitors: 12, region: 'Downtown' },
        { month: 'Jan', visitors: 8, region: 'Harbor' },
      ],
    },
    mark: 'line',
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: { field: 'visitors', type: 'quantitative' },
      color: { field: 'region', type: 'nominal' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {},
      selections: {
        s1: {
          selectionId: 's1',
          selection_type: 'category',
          field: 'region',
          values: ['Downtown'],
          predicates: [{ field: 'region', op: 'in', value: ['Downtown'] }],
        },
      },
    },
  })

  assert.deepEqual(renderSpec.encoding.opacity, {
    condition: { test: '(indexof(["Downtown"], datum[\'region\']) >= 0)', value: 0.98 },
    value: 0.18,
  })
  assert.deepEqual(renderSpec.encoding.strokeWidth, {
    condition: { test: '(indexof(["Downtown"], datum[\'region\']) >= 0)', value: 3.5 },
    value: 1.2,
  })
})

test('buildVegaLiteRenderSpecFromRuntimeState lets explicit line focus override prior series selection styling', () => {
  const spec = {
    data: {
      values: [
        { month: 'Jan', visitors: 10, region: 'Downtown' },
        { month: 'Feb', visitors: 12, region: 'Downtown' },
        { month: 'Jan', visitors: 8, region: 'Harbor' },
        { month: 'Feb', visitors: 9, region: 'Harbor' },
      ],
    },
    mark: 'line',
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: { field: 'visitors', type: 'quantitative' },
      color: { field: 'region', type: 'nominal' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {
        highlight: {
          sourceAction: 'line.focusLines',
          lineField: 'region',
          lines: ['Downtown', 'Harbor'],
          dimOpacity: 0.08,
        },
      },
      selections: {
        s1: {
          selectionId: 's1',
          selection_type: 'category',
          field: 'region',
          values: ['Downtown'],
          predicates: [{ field: 'region', op: 'in', value: ['Downtown'] }],
        },
      },
    },
  })

  assert.deepEqual(renderSpec.encoding.opacity, {
    condition: { test: 'indexof(["Downtown","Harbor"], datum[\'region\']) >= 0', value: 1 },
    value: 0.08,
  })
})

test('buildVegaLiteRenderSpecFromRuntimeState projects line x-region zoom through line provider action', () => {
  const spec = {
    data: {
      values: [
        { month: '2024-01-01', visitors: 10, region: 'Downtown' },
        { month: '2024-02-01', visitors: 12, region: 'Downtown' },
      ],
    },
    mark: 'line',
    encoding: {
      x: { field: 'month', type: 'temporal' },
      y: { field: 'visitors', type: 'quantitative' },
      color: { field: 'region', type: 'nominal' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {
        xDomain: ['2024-01-01', '2024-03-01'],
        zoom: {
          sourceAction: 'line.zoomXRegion',
          start: '2024-01-01',
          end: '2024-03-01',
        },
      },
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.encoding.x.scale.domain, ['2024-01-01', '2024-03-01'])
  assert.deepEqual(renderSpec.mark, { type: 'line', clip: true })
  assert.deepEqual(renderSpec._line_zoom_state, { start: '2024-01-01', end: '2024-03-01' })
})

test('buildVegaLiteRenderSpecFromRuntimeState projects heatmap reencode and marginal state through Vega-Lite spec actions', () => {
  const spec = {
    data: {
      values: [
        { region: 'Downtown', month: 'Jan', visitors: 100 },
        { region: 'Downtown', month: 'Feb', visitors: 140 },
        { region: 'Harbor', month: 'Jan', visitors: 80 },
      ],
    },
    mark: 'rect',
    encoding: {
      x: { field: 'month', type: 'nominal' },
      y: { field: 'region', type: 'nominal' },
      color: { field: 'visitors', type: 'quantitative' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {
        reencode: {
          sourceAction: 'heatmap.adjustColorScale',
          scheme: 'viridis',
          domain: [50, 150],
        },
        addRemove: {
          sourceAction: 'heatmap.addMarginalBars',
          op: 'sum',
          showTop: true,
          showRight: true,
        },
      },
      selections: {},
    },
  })

  assert.equal(Array.isArray(renderSpec.vconcat), true)
  assert.equal(renderSpec.vconcat[0]._widgetvaTag, 'heatmap.addMarginalBars.top')
  const heatmapBody = renderSpec.vconcat[1].hconcat[0]
  assert.deepEqual(heatmapBody.encoding.color.scale, { domain: [50, 150], scheme: 'viridis' })
})

test('buildVegaLiteRenderSpecFromRuntimeState projects heatmap value-range highlight state through Vega-Lite spec actions', () => {
  const spec = {
    data: {
      values: [
        { region: 'Downtown', month: 'Jan', visitors: 100 },
        { region: 'Downtown', month: 'Feb', visitors: 140 },
        { region: 'Harbor', month: 'Jan', visitors: 80 },
      ],
    },
    mark: 'rect',
    encoding: {
      x: { field: 'month', type: 'nominal' },
      y: { field: 'region', type: 'nominal' },
      color: { field: 'visitors', type: 'quantitative' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [
        {
          kind: 'derive',
          source: 'action',
          spec: {
            actionName: 'heatmap.highlightRegionByValue',
            minValue: 90,
            maxValue: 130,
            outsideOpacity: 0.18,
          },
        },
      ],
      view: {
        highlight: {
          sourceAction: 'heatmap.highlightRegionByValue',
          minValue: 90,
          maxValue: 130,
          outsideOpacity: 0.18,
        },
      },
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.encoding.opacity, {
    condition: { test: 'datum[\'visitors\'] >= 90 && datum[\'visitors\'] <= 130', value: 1 },
    value: 0.18,
  })
})

test('buildVegaLiteRenderSpecFromRuntimeState projects heatmap cell filter state through Vega-Lite spec actions', () => {
  const spec = {
    data: {
      values: [
        { region: 'Downtown', month: 'Jan', visitors: 100 },
        { region: 'Downtown', month: 'Feb', visitors: 140 },
        { region: 'Harbor', month: 'Jan', visitors: 80 },
      ],
    },
    mark: 'rect',
    encoding: {
      x: { field: 'month', type: 'nominal' },
      y: { field: 'region', type: 'nominal' },
      color: { field: 'visitors', type: 'quantitative' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [
        {
          kind: 'filter',
          source: 'action',
          spec: {
            actionName: 'heatmap.filterCellsByRegion',
            fields: ['month', 'region'],
            value: {
              month: ['Jan'],
              region: ['Downtown'],
            },
            predicates: [
              { field: 'month', op: 'in', value: ['Jan'] },
              { field: 'region', op: 'in', value: ['Downtown'] },
            ],
          },
        },
      ],
      view: {},
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.transform, [
    { filter: { field: 'month', oneOf: ['Jan'] }, _widgetvaTag: 'heatmap.filterCells' },
    { filter: { field: 'region', oneOf: ['Downtown'] }, _widgetvaTag: 'heatmap.filterCells' },
  ])
})

test('buildVegaLiteRenderSpecFromRuntimeState projects heatmap scalar cell filters without dropping values', () => {
  const spec = {
    data: {
      values: [
        { region: 'Downtown', month: '2024-02-01', visitors: 100 },
        { region: 'Harbor', month: '2024-02-01', visitors: 80 },
      ],
    },
    mark: 'rect',
    encoding: {
      x: { field: 'month', type: 'temporal' },
      y: { field: 'region', type: 'nominal' },
      color: { field: 'visitors', type: 'quantitative' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [
        {
          kind: 'filter',
          source: 'action',
          spec: {
            actionName: 'heatmap.filterCells',
            fields: ['month', 'region'],
            value: {
              month: '2024-02-01',
              region: 'Downtown',
            },
            predicates: [
              { field: 'month', op: 'equals', value: '2024-02-01' },
              { field: 'region', op: 'equals', value: 'Downtown' },
            ],
          },
        },
      ],
      view: {},
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.transform, [
    { filter: { field: 'month', oneOf: ['2024-02-01'] }, _widgetvaTag: 'heatmap.filterCells' },
    { filter: { field: 'region', oneOf: ['Downtown'] }, _widgetvaTag: 'heatmap.filterCells' },
  ])
})

test('buildVegaLiteRenderSpecFromRuntimeState keeps scatter color encoding when brushing points', () => {
  const spec = {
    data: {
      values: [
        { region: 'Downtown', spend: 4200, visitors: 9800 },
        { region: 'Harbor', spend: 2800, visitors: 6400 },
      ],
    },
    mark: 'point',
    encoding: {
      x: { field: 'spend', type: 'quantitative' },
      y: { field: 'visitors', type: 'quantitative' },
      color: { field: 'region', type: 'nominal' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {},
      selections: {
        brush: {
          selection_id: 'brush',
          selection_type: 'interval',
          fields: ['spend', 'visitors'],
          predicates: [
            { field: 'spend', op: 'between', value: [3000, 4500] },
            { field: 'visitors', op: 'between', value: [9000, 11000] },
          ],
        },
      },
    },
  })

  assert.deepEqual(renderSpec.encoding.color, { field: 'region', type: 'nominal' })
  assert.equal(renderSpec.encoding.fill, undefined)
})

test('buildVegaLiteRenderSpecFromRuntimeState projects scatter analysis state through Vega-Lite spec actions', () => {
  const spec = {
    data: {
      values: [
        { spend: 100, visitors: 110 },
        { spend: 120, visitors: 130 },
        { spend: 500, visitors: 520 },
        { spend: 530, visitors: 540 },
      ],
    },
    mark: 'point',
    encoding: {
      x: { field: 'spend', type: 'quantitative' },
      y: { field: 'visitors', type: 'quantitative' },
    },
  }

  const clusteredSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [
        {
          kind: 'derive',
          source: 'action',
          spec: {
            actionName: 'scatter.identifyClusters',
            method: 'kmeans',
            nClusters: 2,
          },
        },
      ],
      view: {},
      selections: {},
    },
  })

  assert.equal(clusteredSpec.encoding.color.field, '__widgetva_cluster')
  assert.equal(clusteredSpec.data.values.every((row) => Number.isInteger(row.__widgetva_cluster)), true)

  const regressionSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [
        {
          kind: 'derive',
          source: 'action',
          spec: {
            actionName: 'scatter.showRegression',
            method: 'linear',
          },
        },
      ],
      view: {},
      selections: {},
    },
  })

  assert.equal(regressionSpec.layer.some((layer) => layer._widgetvaTag === 'scatter.showRegression'), true)
})

test('buildVegaLiteRenderSpecFromRuntimeState projects parallel coordinates state through Vega-Lite spec actions', () => {
  const spec = {
    kind: 'parallelCoordinates',
    data: {
      values: [
        { id: 'a', dimension: 'speed', value: 10, segment: 'core' },
        { id: 'a', dimension: 'cost', value: 20, segment: 'core' },
        { id: 'b', dimension: 'speed', value: 30, segment: 'edge' },
        { id: 'b', dimension: 'cost', value: 40, segment: 'edge' },
      ],
    },
    mark: 'line',
    encoding: {
      x: { field: 'dimension', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
      detail: { field: 'id' },
      color: { field: 'segment', type: 'nominal' },
    },
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [
        {
          kind: 'filter',
          source: 'action',
          spec: {
            actionName: 'parallelCoordinates.filterByCategory',
            field: 'segment',
            values: ['edge'],
            predicates: [{ field: 'segment', op: 'notIn', value: ['edge'] }],
          },
        },
      ],
      view: {
        reencode: {
          sourceAction: 'parallelCoordinates.reorderDimensions',
          dimensionOrder: ['cost', 'speed'],
        },
        highlight: {
          sourceAction: 'parallelCoordinates.highlightCategory',
          field: 'segment',
          values: ['core'],
        },
      },
      selections: {},
    },
  })

  assert.deepEqual(renderSpec.encoding.x.sort, ['cost', 'speed'])
  assert.deepEqual(renderSpec.encoding.x.scale.domain, ['cost', 'speed'])
  assert.deepEqual(renderSpec.transform, [
    {
      filter: { not: { field: 'segment', oneOf: ['edge'] } },
      _widgetvaTag: 'parallelCoordinates.filterByCategory',
    },
  ])
  assert.deepEqual(renderSpec.encoding.opacity, {
    condition: { test: 'indexof(["core"], datum[\'segment\']) >= 0', value: 1 },
    value: 0.1,
  })
})

test('buildVegaLiteRenderSpecFromRuntimeState projects sankey path highlight into provider nodes', () => {
  const spec = {
    kind: 'sankey',
    data: [
      {
        name: 'rawLinks',
        values: [
          { source: 'Awareness', target: 'Visit', value: 30 },
          { source: 'Visit', target: 'Checkout', value: 12 },
        ],
      },
    ],
    marks: [
      { name: 'edgeMark', type: 'path' },
    ],
  }

  const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
    semanticSpec: spec,
    runtime: null,
    state: {
      transforms: [],
      view: {
        highlight: {
          sourceAction: 'sankey.highlightPath',
          mode: 'pathHighlight',
          path: ['Awareness', 'Visit', 'Checkout'],
        },
      },
      selections: {},
    },
  })

  assert.deepEqual(renderSpec._sankey_highlight_state, {
    nodes: ['Awareness', 'Visit', 'Checkout'],
    links: [],
  })
})
