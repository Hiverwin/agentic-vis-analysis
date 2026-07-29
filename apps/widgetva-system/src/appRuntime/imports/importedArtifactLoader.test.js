import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildVisualizationPreview,
  buildImportedVisualizationCase,
  detectVisualizationProvider,
  inferWidgetKindFromEChartsOption,
  inferWidgetKindFromVgplotScript,
  inferWidgetKindFromVegaLiteSpec,
  parseVisualizationArtifactScript,
} from './importedArtifactLoader.js'

test('parseVisualizationArtifactScript parses a bare object literal spec', () => {
  const artifact = parseVisualizationArtifactScript(`({
    "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
    "mark": "line",
    "encoding": {
      "x": { "field": "date", "type": "temporal" },
      "y": { "field": "value", "type": "quantitative" }
    }
  })`)

  assert.equal(artifact?.mark, 'line')
})

test('parseVisualizationArtifactScript parses export default payloads', () => {
  const artifact = parseVisualizationArtifactScript(`
    export default {
      title: "Test chart",
      spec: {
        "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
        mark: "bar"
      }
    }
  `)

  assert.equal(artifact?.title, 'Test chart')
  assert.equal(artifact?.spec?.mark, 'bar')
})

test('parseVisualizationArtifactScript parses export default vgplot factories', () => {
  const artifact = parseVisualizationArtifactScript(`
    export default (wg) => wg.plot(
      wg.line(
        [
          { x: 1, y: 2 },
          { x: 2, y: 5 }
        ],
        { x: 'x', y: 'y' }
      )
    )
  `)

  assert.equal(typeof artifact, 'function')
})

test('inferWidgetKindFromVegaLiteSpec infers supported single-widget kinds', () => {
  assert.equal(inferWidgetKindFromVegaLiteSpec({ mark: 'point' }), 'scatter')
  assert.equal(inferWidgetKindFromVegaLiteSpec({ mark: 'bar' }), 'bar')
  assert.equal(inferWidgetKindFromVegaLiteSpec({ mark: 'line' }), 'line')
  assert.equal(inferWidgetKindFromVegaLiteSpec({ mark: 'rect' }), 'heatmap')
})

test('inferWidgetKindFromVegaLiteSpec honors explicit semantic kind hints before mark type', () => {
  assert.equal(inferWidgetKindFromVegaLiteSpec({
    title: 'Acceptance Parallel Coordinates: Museum Operating Metrics',
    mark: 'line',
  }), 'parallelCoordinates')
  assert.equal(inferWidgetKindFromVegaLiteSpec({
    usermeta: { widgetva: { widgetKind: 'sankey' } },
    mark: 'bar',
  }), 'sankey')
})

test('inferWidgetKindFromVegaLiteSpec walks layered and concatenated specs without rejecting them', () => {
  assert.equal(
    inferWidgetKindFromVegaLiteSpec({
      vconcat: [
        {
          layer: [
            { mark: 'rect' },
            { mark: 'point' },
          ],
        },
        { mark: 'bar' },
      ],
    }),
    'custom',
  )
})

test('inferWidgetKindFromEChartsOption infers supported single-widget kinds', () => {
  assert.equal(inferWidgetKindFromEChartsOption({
    series: [{ type: 'scatter' }],
  }), 'scatter')
  assert.equal(inferWidgetKindFromEChartsOption({
    series: [{ type: 'bar' }],
  }), 'bar')
  assert.equal(inferWidgetKindFromEChartsOption({
    series: [{ type: 'line' }],
  }), 'line')
  assert.equal(inferWidgetKindFromEChartsOption({
    series: [{ type: 'heatmap' }],
  }), 'heatmap')
})

test('inferWidgetKindFromVgplotScript infers supported canonical kinds from source text', () => {
  assert.equal(inferWidgetKindFromVgplotScript('export default (wg) => wg.plot(wg.dot([], { x: "x", y: "y" }))'), 'scatter')
  assert.equal(inferWidgetKindFromVgplotScript('export default (wg) => wg.plot(wg.line([], { x: "x", y: "y" }))'), 'line')
  assert.equal(inferWidgetKindFromVgplotScript('export default (wg) => wg.plot(wg.barX([], { x: "value", y: "label" }))'), 'bar')
})

test('detectVisualizationProvider auto-detects vega-lite, echarts, and vgplot artifacts', () => {
  assert.equal(detectVisualizationProvider({
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    mark: 'line',
  }), 'vega-lite')
  assert.equal(detectVisualizationProvider({
    $schema: 'https://vega.github.io/schema/vega/v6.json',
    marks: [{ type: 'rect' }],
  }), 'vega')
  assert.equal(detectVisualizationProvider({
    xAxis: { type: 'category', data: ['Jan', 'Feb'] },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data: [1, 2] }],
  }), 'echarts')
  assert.equal(
    detectVisualizationProvider(
      parseVisualizationArtifactScript('export default (wg) => wg.plot(wg.line([], { x: "x", y: "y" }))'),
      { sourceText: 'export default (wg) => wg.plot(wg.line([], { x: "x", y: "y" }))' },
    ),
    'vgplot',
  )
})

test('buildImportedVisualizationCase builds an imported single-widget case from a bare spec', () => {
  const caseDef = buildImportedVisualizationCase({
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Imported line",
      "data": { "values": [{ "date": "2024-01-01", "value": 1 }] },
      "mark": "line",
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "value", "type": "quantitative" }
      }
    })`,
  })

  assert.equal(caseDef.sourceType, 'importedSpec')
  assert.equal(caseDef.widgets.length, 1)
  assert.equal(caseDef.dataset.rows, 1)
  assert.equal(caseDef.dataset.fields, 2)
  assert.deepEqual(caseDef.dataset.rowsData, [{ date: '2024-01-01', value: 1 }])
  assert.equal(caseDef.widgets[0].widgetKind, 'line')
  assert.equal(caseDef.widgets[0].type, 'line-vega')
  assert.equal(caseDef.widgets[0].source?.kind, 'templateSpec')
  assert.equal(caseDef.widgets[0].source?.providerSpec?.provider, 'vega-lite')
  assert.equal('hostInteractionEnabled' in caseDef.widgets[0], false)
  assert.equal('interactionConfig' in caseDef.widgets[0].source, false)
  assert.equal('providerCapabilities' in caseDef.widgets[0].source, false)
})

test('buildImportedVisualizationCase builds a pure Vega Sankey case without dropping the renderable spec', () => {
  const caseDef = buildImportedVisualizationCase({
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega/v6.json",
      "title": "Sankey E-commerce Conversion Funnel",
      "data": [
        { "name": "nodes", "values": [{ "name": "Landing Page" }] }
      ],
      "marks": [
        { "name": "nodeMark", "type": "rect", "from": { "data": "nodes" } }
      ]
    })`,
  })

  assert.equal(caseDef.widgets[0].provider, 'vega')
  assert.equal(caseDef.widgets[0].widgetKind, 'sankey')
  assert.equal(caseDef.widgets[0].type, 'sankey-vega')
  assert.equal(caseDef.widgets[0].source?.providerSpec?.provider, 'vega')
  assert.equal(caseDef.widgets[0].source?.providerSpec?.spec?.marks?.[0]?.name, 'nodeMark')
})

test('buildImportedVisualizationCase exposes parallel coordinates family from title hint', () => {
  const caseDef = buildImportedVisualizationCase({
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Acceptance Parallel Coordinates: Museum Operating Metrics",
      "data": { "values": [
        { "record": "a", "dimension": "spend", "value": 100 },
        { "record": "a", "dimension": "visitors", "value": 250 }
      ] },
      "mark": "line",
      "encoding": {
        "x": { "field": "dimension", "type": "nominal" },
        "y": { "field": "value", "type": "quantitative" },
        "detail": { "field": "record" }
      }
    })`,
  })

  assert.equal(caseDef.widgets[0].widgetKind, 'parallelCoordinates')
  assert.equal(caseDef.widgets[0].type, 'parallel-vega')
  assert.deepEqual(caseDef.widgets[0].recognizedKinds, ['parallelCoordinates'])
})

test('buildImportedVisualizationCase preserves explicitly declared coordination links from imported artifacts', () => {
  const sourceStateRef = 'wl://widgetva-app/workspace/imported_spec/widget/w_scatter/view/zoom'
  const targetStateRef = 'wl://widgetva-app/workspace/imported_spec/widget/w_bar/transform/spend-filter'
  const caseDef = buildImportedVisualizationCase({
    caseId: 'imported_spec',
    widgetId: 'w_scatter',
    scriptText: `({
      title: "Imported scatter",
      spec: {
        "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
        data: { values: [{ spend: 4200, visitors: 9800 }] },
        mark: "point",
        encoding: {
          x: { field: "spend", type: "quantitative" },
          y: { field: "visitors", type: "quantitative" }
        }
      },
      coordinationLinks: [{
        ref: "wl://widgetva-app/workspace/imported_spec/coordination/scatter-zoom-to-bar-filter",
        sourceStateRef: "${sourceStateRef}",
        targetStateRef: "${targetStateRef}",
        relation: "controls",
        transform: {
          kind: "domainToFilter",
          channelMapping: [{ sourceChannel: "x", targetField: "marketing_spend" }]
        },
        activation: "automatic"
      }]
    })`,
  })

  assert.equal(caseDef.coordinationLinks.length, 1)
  assert.equal(caseDef.coordinationLinks[0].sourceStateRef, sourceStateRef)
  assert.equal(caseDef.coordinationLinks[0].targetStateRef, targetStateRef)
  assert.equal(caseDef.coordinationLinks[0].transform.kind, 'domainToFilter')
})

test('buildImportedVisualizationCase resolves named datasets referenced through data.name', () => {
  const caseDef = buildImportedVisualizationCase({
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Named dataset line",
      "datasets": {
        "series_rows": [
          { "year": 2020, "value": 1 },
          { "year": 2021, "value": 3 }
        ]
      },
      "data": { "name": "series_rows" },
      "mark": "line",
      "encoding": {
        "x": { "field": "year", "type": "quantitative" },
        "y": { "field": "value", "type": "quantitative" }
      }
    })`,
  })

  assert.equal(caseDef.dataset.rows, 2)
  assert.equal(caseDef.dataset.fields, 2)
  assert.deepEqual(caseDef.dataset.rowsData, [
    { year: 2020, value: 1 },
    { year: 2021, value: 3 },
  ])
})

test('buildImportedVisualizationCase accepts official multi-view specs and preserves relative example data urls', () => {
  const caseDef = buildImportedVisualizationCase({
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "data": { "url": "data/movies.json" },
      "vconcat": [
        {
          "layer": [
            { "mark": "rect" },
            { "mark": "point" }
          ]
        },
        {
          "mark": "bar"
        }
      ]
    })`,
  })

  assert.equal(caseDef.sourceType, 'importedSpec')
  assert.equal(caseDef.widgets.length, 1)
  assert.equal(caseDef.widgets[0].provider, 'vega-lite')
  assert.equal(caseDef.widgets[0].widgetKind, 'custom')
  assert.deepEqual(caseDef.widgets[0].recognizedKinds, ['heatmap', 'scatter', 'bar'])
  assert.equal('hostInteractionEnabled' in caseDef.widgets[0], false)
  assert.equal('interactionConfig' in caseDef.widgets[0].source, false)
  assert.equal(caseDef.widgets[0].source?.providerSpec?.spec?.data?.url, 'data/movies.json')
})

test('buildImportedVisualizationCase preserves top-level repeat specs instead of unwrapping nested spec payloads', () => {
  const caseDef = buildImportedVisualizationCase({
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "repeat": {
        "row": ["Metric_A", "Metric_B", "Metric_C"],
        "column": ["Metric_C", "Metric_B", "Metric_A"]
      },
      "spec": {
        "data": { "url": "data/example.json" },
        "mark": "point",
        "encoding": {
          "x": { "field": { "repeat": "column" }, "type": "quantitative" },
          "y": { "field": { "repeat": "row" }, "type": "quantitative" }
        }
      }
    })`,
  })

  const storedSpec = caseDef.widgets[0].source?.providerSpec?.spec
  assert.deepEqual(storedSpec?.repeat?.row, ['Metric_A', 'Metric_B', 'Metric_C'])
  assert.equal(storedSpec?.spec?.mark, 'point')
  assert.equal(storedSpec?.spec?.data?.url, 'data/example.json')
})

test('buildImportedVisualizationCase falls back to custom widget kind when no supported canonical mark is found', () => {
  const caseDef = buildImportedVisualizationCase({
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "mark": { "type": "geoshape" }
    })`,
  })

  assert.equal(caseDef.widgets[0].widgetKind, 'custom')
  assert.equal(caseDef.widgets[0].type, null)
})

test('buildImportedVisualizationCase builds an imported ECharts case when preferred provider is echarts', () => {
  const caseDef = buildImportedVisualizationCase({
    preferredProvider: 'echarts',
    scriptText: `({
      "title": { "text": "Imported ECharts line" },
      "xAxis": { "type": "category", "data": ["Jan", "Feb"] },
      "yAxis": { "type": "value" },
      "series": [{ "type": "line", "data": [3, 6] }]
    })`,
  })

  assert.equal(caseDef.workspaceProviderEnvironment, 'echarts')
  assert.equal(caseDef.widgets[0].provider, 'echarts')
  assert.equal(caseDef.widgets[0].widgetKind, 'line')
  assert.equal(caseDef.widgets[0].type, 'line-echarts')
  assert.equal(caseDef.widgets[0].source?.kind, 'nativeArtifact')
  assert.equal(caseDef.widgets[0].source?.providerSpec?.option?.series?.[0]?.type, 'line')
})

test('buildImportedVisualizationCase builds an imported vgplot case from a factory script', () => {
  const caseDef = buildImportedVisualizationCase({
    preferredProvider: 'vgplot',
    scriptText: `
      export default (wg) => wg.plot(
        wg.line(
          [
            { month: 'Jan', value: 2 },
            { month: 'Feb', value: 5 }
          ],
          { x: 'month', y: 'value' }
        ),
        wg.width(420),
        wg.height(240)
      )
    `,
  })

  assert.equal(caseDef.workspaceProviderEnvironment, 'vgplot')
  assert.equal(caseDef.widgets[0].provider, 'vgplot')
  assert.equal(caseDef.widgets[0].widgetKind, 'line')
  assert.equal(caseDef.widgets[0].type, 'line-vgplot')
  assert.equal(caseDef.widgets[0].source?.kind, 'nativeArtifact')
  assert.equal(caseDef.widgets[0].source?.providerSpec?.provider, 'vgplot')
  assert.match(caseDef.widgets[0].source?.providerSpec?.scriptText || '', /wg\.plot/)
})

test('buildVisualizationPreview returns a render-only preview for a bare Vega-Lite spec', () => {
  const preview = buildVisualizationPreview({
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Preview line",
      "data": { "values": [{ "date": "2024-01-01", "value": 1 }] },
      "mark": "line",
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "value", "type": "quantitative" }
      }
    })`,
  })

  assert.equal(preview.provider, 'vega-lite')
  assert.equal(preview.title, 'Preview line')
  assert.equal(preview.widgetKind, 'line')
  assert.equal(preview.widget.id, 'w_loaded_preview')
  assert.equal(preview.widget.sourceType, 'loadedPreview')
  assert.equal(preview.widget.provider, 'vega-lite')
  assert.equal(preview.widget.source?.providerSpec?.spec?.mark, 'line')
})

test('buildVisualizationPreview preserves official repeat specs as renderable Vega-Lite specs', () => {
  const preview = buildVisualizationPreview({
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "repeat": {
        "row": ["Metric_A", "Metric_B", "Metric_C"],
        "column": ["Metric_C", "Metric_B", "Metric_A"]
      },
      "spec": {
        "data": { "url": "data/example.json" },
        "mark": "point",
        "encoding": {
          "x": { "field": { "repeat": "column" }, "type": "quantitative" },
          "y": { "field": { "repeat": "row" }, "type": "quantitative" }
        }
      }
    })`,
  })

  const storedSpec = preview.widget.source?.providerSpec?.spec
  assert.equal(preview.provider, 'vega-lite')
  assert.deepEqual(storedSpec?.repeat?.column, ['Metric_C', 'Metric_B', 'Metric_A'])
  assert.equal(storedSpec?.spec?.mark, 'point')
})
