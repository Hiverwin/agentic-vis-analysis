import test from 'node:test'
import assert from 'node:assert/strict'

import {
  attachWidgetVAToVegaLiteExample,
  attachWidgetVAToCurrentVegaLiteExamplePage,
  attachWidgetVAToCapturedVegaLiteExample,
  bootstrapCurrentVegaLiteExamplePage,
  extractVegaLiteExampleSpecFromHtml,
  extractVegaLiteExampleSpecFromText,
  inferWidgetKindFromVegaLiteSpec,
  isVegaLiteExamplesPage,
  normalizeVegaLiteExampleSpec,
  readVegaLiteExampleIntegrationInput,
  waitForCapturedVegaLiteExample,
} from './vegaLiteExamples.js'
import { installVegaEmbedCapture } from './vegaEmbedCapture.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

test('isVegaLiteExamplesPage recognizes official Vega-Lite example pages', () => {
  assert.equal(isVegaLiteExamplesPage('https://vega.github.io/vega-lite/examples/point_2d.html'), true)
  assert.equal(isVegaLiteExamplesPage('https://vega.github.io/vega-lite/examples/bar.html'), true)
  assert.equal(isVegaLiteExamplesPage('https://vega.github.io/vega/examples/bar-chart.vg.json'), false)
  assert.equal(isVegaLiteExamplesPage('https://observablehq.com/@d3/scatterplot'), false)
})

test('extractVegaLiteExampleSpecFromHtml parses encoded JSON code blocks', () => {
  const html = `
    <html>
      <body>
        <pre><code class="language-json">{
  &quot;$schema&quot;: &quot;https://vega.github.io/schema/vega-lite/v6.json&quot;,
  &quot;data&quot;: {&quot;url&quot;: &quot;data/cars.json&quot;},
  &quot;mark&quot;: &quot;point&quot;,
  &quot;encoding&quot;: {
    &quot;x&quot;: {&quot;field&quot;: &quot;Horsepower&quot;, &quot;type&quot;: &quot;quantitative&quot;},
    &quot;y&quot;: {&quot;field&quot;: &quot;Miles_per_Gallon&quot;, &quot;type&quot;: &quot;quantitative&quot;}
  }
}</code></pre>
      </body>
    </html>
  `

  const spec = extractVegaLiteExampleSpecFromHtml(html)
  assert.equal(spec?.mark, 'point')
  assert.equal(spec?.data?.url, 'data/cars.json')
})

test('extractVegaLiteExampleSpecFromText parses plain-text Vega-Lite specification blocks', () => {
  const text = `
Vega-Lite JSON Specification
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {"url": "data/seattle-weather.csv"},
  "mark": "bar",
  "encoding": {
    "x": {"timeUnit": "month", "field": "date", "type": "ordinal"},
    "y": {"aggregate": "sum", "field": "precipitation", "type": "quantitative"}
  }
}
View Source
  `

  const spec = extractVegaLiteExampleSpecFromText(text)
  assert.equal(spec?.mark, 'bar')
  assert.equal(spec?.data?.url, 'data/seattle-weather.csv')
})

test('normalizeVegaLiteExampleSpec absolutizes relative data urls against the official example page', () => {
  const normalized = normalizeVegaLiteExampleSpec(
    {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      data: {
        url: 'data/cars.json',
      },
      mark: 'point',
    },
    'https://vega.github.io/vega-lite/examples/point_2d.html',
  )

  assert.equal(normalized.data.url, 'https://vega.github.io/vega-lite/examples/data/cars.json')
})

test('readVegaLiteExampleIntegrationInput returns WidgetVA-ready provider, kind, and normalized spec', () => {
  const input = readVegaLiteExampleIntegrationInput({
    html: `
      <pre><code>{
        "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
        "data": {"url": "data/stocks.csv"},
        "mark": "line",
        "encoding": {
          "x": {"field": "date", "type": "temporal"},
          "y": {"field": "price", "type": "quantitative"}
        }
      }</code></pre>
    `,
    pageUrl: 'https://vega.github.io/vega-lite/examples/line.html',
  })

  assert.equal(input.provider, 'vega-lite')
  assert.equal(input.kind, 'line')
  assert.equal(input.spec.data.url, 'https://vega.github.io/vega-lite/examples/data/stocks.csv')
})

test('inferWidgetKindFromVegaLiteSpec maps common Vega-Lite examples onto existing widget families', () => {
  assert.equal(inferWidgetKindFromVegaLiteSpec({ mark: 'point' }), 'scatter')
  assert.equal(inferWidgetKindFromVegaLiteSpec({ mark: 'bar' }), 'bar')
  assert.equal(inferWidgetKindFromVegaLiteSpec({ mark: 'line' }), 'line')
  assert.equal(inferWidgetKindFromVegaLiteSpec({ mark: 'rect' }), 'heatmap')
})

test('attachWidgetVAToVegaLiteExample mounts a WidgetInstance over an official Vega-Lite example view', async () => {
  const previousWindow = globalThis.window
  try {
    globalThis.window = {
      addEventListener() {},
      removeEventListener() {},
    }

    const signalCalls = []
    const signals = new Map()
    const view = {
      signal(name, value) {
        if (arguments.length === 1) {
          return signals.get(name)
        }
        signalCalls.push([name, value])
        signals.set(name, value)
        return view
      },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }

    const controller = await attachWidgetVAToVegaLiteExample({
      html: `
        <pre><code>{
          "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
          "data": {"url": "data/cars.json"},
          "mark": "point",
          "encoding": {
            "x": {"field": "Horsepower", "type": "quantitative"},
            "y": {"field": "Miles_per_Gallon", "type": "quantitative"}
          }
        }</code></pre>
      `,
      pageUrl: 'https://vega.github.io/vega-lite/examples/point_2d.html',
      view,
      sessionId: 'vega-example-test',
    })

    assert.equal(controller.provider, 'vega-lite')
    assert.equal(controller.kind, 'scatter')
    assert.equal(controller.spec.data.url, 'https://vega.github.io/vega-lite/examples/data/cars.json')
    assert.equal(controller.describeAgentContract().widget.kind, 'scatter')
    assert.equal(controller.getCurrentSpec().mark, 'point')
    assert.equal(signalCalls.some(([name]) => name === 'widgetva_selectedCount'), true)
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToCapturedVegaLiteExample reuses the page-captured vegaEmbed view', async () => {
  const previousWindow = globalThis.window
  try {
    const signals = new Map()
    const root = {
      location: {
        href: 'https://vega.github.io/vega-lite/examples/point_2d.html',
      },
      document: {
        documentElement: {
          outerHTML: `
            <pre><code>{
              "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
              "data": {"url": "data/cars.json"},
              "mark": "point",
              "encoding": {
                "x": {"field": "Horsepower", "type": "quantitative"},
                "y": {"field": "Miles_per_Gallon", "type": "quantitative"}
              }
            }</code></pre>
          `,
        },
        body: {
          innerText: 'Vega-Lite JSON Specification',
        },
      },
      addEventListener() {},
      removeEventListener() {},
    }
    globalThis.window = root

    const fakeView = {
      signal(name, value) {
        if (arguments.length === 1) return signals.get(name)
        signals.set(name, value)
        return fakeView
      },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }

    installVegaEmbedCapture(root)
    root.vegaEmbed = async () => ({ view: fakeView })
    await root.vegaEmbed('#vis', { mark: 'point' })

    const controller = await attachWidgetVAToCapturedVegaLiteExample({ root })
    assert.equal(controller.kind, 'scatter')
    assert.equal(controller.getCurrentSpec().data.url, 'https://vega.github.io/vega-lite/examples/data/cars.json')
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToCapturedVegaLiteExample rematerializes an embedExample page when zoom updates the spec', async () => {
  const previousWindow = globalThis.window
  try {
    const firstView = {
      signal() { return firstView },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }
    const secondView = {
      signal() { return secondView },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }

    const embedCalls = []
    const root = {
      location: {
        href: 'https://vega.github.io/vega-lite/examples/point_2d.html',
      },
      document: {
        documentElement: {
          outerHTML: `
            <pre><code>{
              "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
              "data": {"url": "data/cars.json"},
              "mark": "point",
              "encoding": {
                "x": {"field": "Horsepower", "type": "quantitative"},
                "y": {"field": "Miles_per_Gallon", "type": "quantitative"}
              }
            }</code></pre>
          `,
        },
        body: {
          innerText: 'Vega-Lite JSON Specification',
        },
      },
      addEventListener() {},
      removeEventListener() {},
      async embedExample(target, spec, options) {
        embedCalls.push({ target, spec: clone(spec), options })
        return embedCalls.length === 1 ? firstView : secondView
      },
    }
    globalThis.window = root

    installVegaEmbedCapture(root)
    await root.embedExample('#point_2d', {
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative' },
        y: { field: 'Miles_per_Gallon', type: 'quantitative' },
      },
    }, false)

    const controller = await attachWidgetVAToCapturedVegaLiteExample({ root })
    const widgetRef = controller.describeAgentContract().widget.ref

    const result = await controller.widget.executeVerifiedAction({
      callId: 'acceptance_zoom_materialize',
      name: 'scatter.zoomDomain',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        xDomain: [60, 160],
        yDomain: [10, 35],
      },
    })

    assert.equal(result.ok, true)
    assert.equal(embedCalls.length, 2)
    assert.deepEqual(embedCalls[1].spec.encoding.x.scale.domain, [60, 160])
    assert.deepEqual(embedCalls[1].spec.encoding.y.scale.domain, [10, 35])
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToCapturedVegaLiteExample rematerializes an official bar example when categorical selection changes local emphasis', async () => {
  const previousWindow = globalThis.window
  try {
    const firstView = {
      signal() { return firstView },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }
    const secondView = {
      signal() { return secondView },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }

    const embedCalls = []
    const root = {
      location: {
        href: 'https://vega.github.io/vega-lite/examples/bar.html',
      },
      document: {
        documentElement: {
          outerHTML: `
            <pre><code>{
              "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
              "description": "A bar chart encodes quantitative values as the extent of rectangular bars.",
              "data": {
                "values": [
                  {"a":"A","b":28},{"a":"B","b":55},{"a":"C","b":43},{"a":"D","b":91},{"a":"E","b":81},
                  {"a":"F","b":53},{"a":"G","b":19},{"a":"H","b":87},{"a":"I","b":52}
                ]
              },
              "mark": "bar",
              "encoding": {
                "x": {"field": "a", "type": "ordinal"},
                "y": {"field": "b", "type": "quantitative"}
              }
            }</code></pre>
          `,
        },
        body: {
          innerText: 'Vega-Lite JSON Specification',
        },
      },
      addEventListener() {},
      removeEventListener() {},
      async embedExample(target, spec, options) {
        embedCalls.push({ target, spec: clone(spec), options })
        return embedCalls.length === 1 ? firstView : secondView
      },
    }
    globalThis.window = root

    installVegaEmbedCapture(root)
    await root.embedExample('#bar', {
      data: {
        values: [
          { a: 'A', b: 28 },
          { a: 'B', b: 55 },
          { a: 'C', b: 43 },
          { a: 'D', b: 91 },
          { a: 'E', b: 81 },
          { a: 'F', b: 53 },
          { a: 'G', b: 19 },
          { a: 'H', b: 87 },
          { a: 'I', b: 52 },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'a', type: 'ordinal' },
        y: { field: 'b', type: 'quantitative' },
      },
    }, false)

    const controller = await attachWidgetVAToCapturedVegaLiteExample({ root })
    const widgetRef = controller.describeAgentContract().widget.ref

    const result = await controller.widget.executeVerifiedAction({
      callId: 'acceptance_bar_select_materialize',
      name: 'bar.selectCategory',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        field: 'a',
        values: ['A', 'B'],
      },
    })

    assert.equal(result.ok, true)
    assert.equal(embedCalls.length, 2)
    assert.equal(Array.isArray(embedCalls[1].spec.data.values), true)
    assert.equal(embedCalls[1].spec.data.values.filter((row) => row?.__widgetva_selected === true).length, 2)
    assert.equal(embedCalls[1].spec.encoding.opacity.condition.test, 'datum.__widgetva_selected === true')
    assert.equal(embedCalls[1].spec.encoding.opacity.value, 0.22)
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToCapturedVegaLiteExample rematerializes an official scatter example when interval brushing changes local emphasis', async () => {
  const previousWindow = globalThis.window
  try {
    const firstView = {
      signal() { return firstView },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }
    const secondView = {
      signal() { return secondView },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }

    const embedCalls = []
    const root = {
      location: {
        href: 'https://vega.github.io/vega-lite/examples/point_2d.html',
      },
      document: {
        documentElement: {
          outerHTML: `
            <pre><code>{
              "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
              "data": {"values": [
                {"Horsepower": 70, "Miles_per_Gallon": 30},
                {"Horsepower": 90, "Miles_per_Gallon": 24},
                {"Horsepower": 150, "Miles_per_Gallon": 14},
                {"Horsepower": 180, "Miles_per_Gallon": 12}
              ]},
              "mark": "point",
              "encoding": {
                "x": {"field": "Horsepower", "type": "quantitative"},
                "y": {"field": "Miles_per_Gallon", "type": "quantitative"}
              }
            }</code></pre>
          `,
        },
        body: {
          innerText: 'Vega-Lite JSON Specification',
        },
      },
      addEventListener() {},
      removeEventListener() {},
      async embedExample(target, spec, options) {
        embedCalls.push({ target, spec: clone(spec), options })
        return embedCalls.length === 1 ? firstView : secondView
      },
    }
    globalThis.window = root

    installVegaEmbedCapture(root)
    await root.embedExample('#point_2d', {
      data: {
        values: [
          { Horsepower: 70, Miles_per_Gallon: 30 },
          { Horsepower: 90, Miles_per_Gallon: 24 },
          { Horsepower: 150, Miles_per_Gallon: 14 },
          { Horsepower: 180, Miles_per_Gallon: 12 },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative' },
        y: { field: 'Miles_per_Gallon', type: 'quantitative' },
      },
    }, false)

    const controller = await attachWidgetVAToCapturedVegaLiteExample({ root })
    const widgetRef = controller.describeAgentContract().widget.ref

    const result = await controller.widget.executeVerifiedAction({
      callId: 'acceptance_scatter_brush_materialize',
      name: 'scatter.brushRegion',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        xField: 'Horsepower',
        yField: 'Miles_per_Gallon',
        xRange: [60, 120],
        yRange: [20, 35],
      },
    })

    assert.equal(result.ok, true)
    assert.equal(embedCalls.length, 2)
    assert.equal(Array.isArray(embedCalls[1].spec.data.values), true)
    assert.equal(embedCalls[1].spec.data.values.filter((row) => row?.__widgetva_selected === true).length, 2)
    assert.equal(embedCalls[1].spec.encoding.opacity.condition.test, 'datum.__widgetva_selected === true')
    assert.equal(embedCalls[1].spec.encoding.opacity.value, 0.22)
    assert.equal(embedCalls[1].spec.encoding.strokeOpacity.condition.test, 'datum.__widgetva_selected === true')
    assert.equal(embedCalls[1].spec.encoding.strokeOpacity.value, 0.12)
    assert.equal(embedCalls[1].spec.encoding.strokeWidth.condition.test, 'datum.__widgetva_selected === true')
    assert.equal(embedCalls[1].spec.encoding.fillOpacity.condition.test, 'datum.__widgetva_selected === true')
    assert.equal(embedCalls[1].spec.encoding.fillOpacity.value, 0.04)
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToCapturedVegaLiteExample rematerializes an official line example when series selection changes local emphasis', async () => {
  const previousWindow = globalThis.window
  try {
    const firstView = {
      signal() { return firstView },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }
    const secondView = {
      signal() { return secondView },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }

    const embedCalls = []
    const root = {
      location: {
        href: 'https://vega.github.io/vega-lite/examples/line.html',
      },
      document: {
        documentElement: {
          outerHTML: `
            <pre><code>{
              "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
              "data": {"values": [
                {"date": "2024-01-01", "series": "A", "value": 10},
                {"date": "2024-02-01", "series": "A", "value": 15},
                {"date": "2024-01-01", "series": "B", "value": 18},
                {"date": "2024-02-01", "series": "B", "value": 12}
              ]},
              "mark": "line",
              "encoding": {
                "x": {"field": "date", "type": "temporal"},
                "y": {"field": "value", "type": "quantitative"},
                "color": {"field": "series", "type": "nominal"}
              }
            }</code></pre>
          `,
        },
        body: {
          innerText: 'Vega-Lite JSON Specification',
        },
      },
      addEventListener() {},
      removeEventListener() {},
      async embedExample(target, spec, options) {
        embedCalls.push({ target, spec: clone(spec), options })
        return embedCalls.length === 1 ? firstView : secondView
      },
    }
    globalThis.window = root

    installVegaEmbedCapture(root)
    await root.embedExample('#line', {
      data: {
        values: [
          { date: '2024-01-01', series: 'A', value: 10 },
          { date: '2024-02-01', series: 'A', value: 15 },
          { date: '2024-01-01', series: 'B', value: 18 },
          { date: '2024-02-01', series: 'B', value: 12 },
        ],
      },
      mark: 'line',
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    }, false)

    const controller = await attachWidgetVAToCapturedVegaLiteExample({ root })
    const widgetRef = controller.describeAgentContract().widget.ref

    const result = await controller.widget.executeVerifiedAction({
      callId: 'acceptance_line_select_materialize',
      name: 'line.selectSeries',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        field: 'series',
        values: ['A'],
      },
    })

    assert.equal(result.ok, true)
    assert.equal(embedCalls.length, 2)
    assert.equal(embedCalls[1].spec.data.values.filter((row) => row?.__widgetva_selected === true).length, 2)
    assert.equal(embedCalls[1].spec.encoding.opacity.condition.test, 'datum.__widgetva_selected === true')
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToCapturedVegaLiteExample rematerializes an official line example when x-value selection changes local emphasis', async () => {
  const previousWindow = globalThis.window
  try {
    const firstView = {
      signal() { return firstView },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }
    const secondView = {
      signal() { return secondView },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }

    const embedCalls = []
    const root = {
      location: {
        href: 'https://vega.github.io/vega-lite/examples/line.html',
      },
      document: {
        documentElement: {
          outerHTML: `
            <pre><code>{
              "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
              "data": {"values": [
                {"date": "2024-01-01", "series": "A", "value": 10},
                {"date": "2024-02-01", "series": "A", "value": 15},
                {"date": "2024-01-01", "series": "B", "value": 18},
                {"date": "2024-02-01", "series": "B", "value": 12}
              ]},
              "mark": "line",
              "encoding": {
                "x": {"field": "date", "type": "temporal"},
                "y": {"field": "value", "type": "quantitative"},
                "color": {"field": "series", "type": "nominal"}
              }
            }</code></pre>
          `,
        },
        body: {
          innerText: 'Vega-Lite JSON Specification',
        },
      },
      addEventListener() {},
      removeEventListener() {},
      async embedExample(target, spec, options) {
        embedCalls.push({ target, spec: clone(spec), options })
        return embedCalls.length === 1 ? firstView : secondView
      },
    }
    globalThis.window = root

    installVegaEmbedCapture(root)
    await root.embedExample('#line', {
      data: {
        values: [
          { date: '2024-01-01', series: 'A', value: 10 },
          { date: '2024-02-01', series: 'A', value: 15 },
          { date: '2024-01-01', series: 'B', value: 18 },
          { date: '2024-02-01', series: 'B', value: 12 },
        ],
      },
      mark: 'line',
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    }, false)

    const controller = await attachWidgetVAToCapturedVegaLiteExample({ root })
    const widgetRef = controller.describeAgentContract().widget.ref

    const result = await controller.widget.executeVerifiedAction({
      callId: 'acceptance_line_xvalue_materialize',
      name: 'line.selectXValue',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        field: 'date',
        value: '2024-01-01',
      },
    })

    assert.equal(result.ok, true)
    assert.equal(embedCalls.length, 2)
    assert.equal(embedCalls[1].spec.data.values.filter((row) => row?.__widgetva_selected === true).length, 2)
    assert.equal(embedCalls[1].spec.encoding.opacity.condition.test, 'datum.__widgetva_selected === true')
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToCapturedVegaLiteExample rematerializes an official heatmap example when cell selection changes local emphasis', async () => {
  const previousWindow = globalThis.window
  try {
    const firstView = {
      signal() { return firstView },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }
    const secondView = {
      signal() { return secondView },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }

    const embedCalls = []
    const root = {
      location: {
        href: 'https://vega.github.io/vega-lite/examples/rect_heatmap.html',
      },
      document: {
        documentElement: {
          outerHTML: `
            <pre><code>{
              "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
              "data": {"values": [
                {"x": "Q1", "y": "A", "value": 10},
                {"x": "Q2", "y": "A", "value": 20},
                {"x": "Q1", "y": "B", "value": 30},
                {"x": "Q2", "y": "B", "value": 40}
              ]},
              "mark": "rect",
              "encoding": {
                "x": {"field": "x", "type": "nominal"},
                "y": {"field": "y", "type": "nominal"},
                "color": {"field": "value", "type": "quantitative"}
              }
            }</code></pre>
          `,
        },
        body: {
          innerText: 'Vega-Lite JSON Specification',
        },
      },
      addEventListener() {},
      removeEventListener() {},
      async embedExample(target, spec, options) {
        embedCalls.push({ target, spec: clone(spec), options })
        return embedCalls.length === 1 ? firstView : secondView
      },
    }
    globalThis.window = root

    installVegaEmbedCapture(root)
    await root.embedExample('#heatmap', {
      data: {
        values: [
          { x: 'Q1', y: 'A', value: 10 },
          { x: 'Q2', y: 'A', value: 20 },
          { x: 'Q1', y: 'B', value: 30 },
          { x: 'Q2', y: 'B', value: 40 },
        ],
      },
      mark: 'rect',
      encoding: {
        x: { field: 'x', type: 'nominal' },
        y: { field: 'y', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    }, false)

    const controller = await attachWidgetVAToCapturedVegaLiteExample({ root })
    const widgetRef = controller.describeAgentContract().widget.ref

    const result = await controller.widget.executeVerifiedAction({
      callId: 'acceptance_heatmap_select_materialize',
      name: 'heatmap.selectCell',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        xField: 'x',
        yField: 'y',
        xValue: 'Q1',
        yValue: 'A',
      },
    })

    assert.equal(result.ok, true)
    assert.equal(embedCalls.length, 2)
    assert.equal(embedCalls[1].spec.data.values.filter((row) => row?.__widgetva_selected === true).length, 1)
    assert.equal(embedCalls[1].spec.encoding.opacity.condition.test, 'datum.__widgetva_selected === true')
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('attachWidgetVAToCapturedVegaLiteExample rematerializes an official heatmap example when submatrix selection changes local emphasis', async () => {
  const previousWindow = globalThis.window
  try {
    const firstView = {
      signal() { return firstView },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }
    const secondView = {
      signal() { return secondView },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }

    const embedCalls = []
    const root = {
      location: {
        href: 'https://vega.github.io/vega-lite/examples/rect_heatmap.html',
      },
      document: {
        documentElement: {
          outerHTML: `
            <pre><code>{
              "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
              "data": {"values": [
                {"x": "Q1", "y": "A", "value": 10},
                {"x": "Q2", "y": "A", "value": 20},
                {"x": "Q1", "y": "B", "value": 30},
                {"x": "Q2", "y": "B", "value": 40}
              ]},
              "mark": "rect",
              "encoding": {
                "x": {"field": "x", "type": "nominal"},
                "y": {"field": "y", "type": "nominal"},
                "color": {"field": "value", "type": "quantitative"}
              }
            }</code></pre>
          `,
        },
        body: {
          innerText: 'Vega-Lite JSON Specification',
        },
      },
      addEventListener() {},
      removeEventListener() {},
      async embedExample(target, spec, options) {
        embedCalls.push({ target, spec: clone(spec), options })
        return embedCalls.length === 1 ? firstView : secondView
      },
    }
    globalThis.window = root

    installVegaEmbedCapture(root)
    await root.embedExample('#heatmap', {
      data: {
        values: [
          { x: 'Q1', y: 'A', value: 10 },
          { x: 'Q2', y: 'A', value: 20 },
          { x: 'Q1', y: 'B', value: 30 },
          { x: 'Q2', y: 'B', value: 40 },
        ],
      },
      mark: 'rect',
      encoding: {
        x: { field: 'x', type: 'nominal' },
        y: { field: 'y', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    }, false)

    const controller = await attachWidgetVAToCapturedVegaLiteExample({ root })
    const widgetRef = controller.describeAgentContract().widget.ref

    const result = await controller.widget.executeVerifiedAction({
      callId: 'acceptance_heatmap_submatrix_materialize',
      name: 'heatmap.selectSubmatrix',
      actor: 'agent',
      queryScope: { widgetRef },
      params: {
        xValues: ['Q1', 'Q2'],
        yValues: ['A'],
      },
    })

    assert.equal(result.ok, true)
    assert.equal(embedCalls.length, 2)
    assert.equal(embedCalls[1].spec.data.values.filter((row) => row?.__widgetva_selected === true).length, 2)
    assert.equal(embedCalls[1].spec.encoding.opacity.condition.test, 'datum.__widgetva_selected === true')
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('waitForCapturedVegaLiteExample resolves after the page later captures a vegaEmbed view', async () => {
  const root = {}
  installVegaEmbedCapture(root)
  const fakeView = { id: 'late_view' }

  setTimeout(() => {
    root.vegaEmbed = async () => ({ view: fakeView })
    root.vegaEmbed('#vis', { mark: 'point' })
  }, 10)

  const capture = await waitForCapturedVegaLiteExample({
    root,
    timeoutMs: 500,
    pollMs: 5,
  })

  assert.equal(capture.view, fakeView)
})

test('attachWidgetVAToCurrentVegaLiteExamplePage waits for capture and then attaches WidgetVA', async () => {
  const previousWindow = globalThis.window
  try {
    const root = {
      location: {
        href: 'https://vega.github.io/vega-lite/examples/bar.html',
      },
      document: {
        documentElement: {
          outerHTML: `
            <pre><code>{
              "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
              "data": {"url": "data/seattle-weather.csv"},
              "mark": "bar",
              "encoding": {
                "x": {"timeUnit": "month", "field": "date", "type": "ordinal"},
                "y": {"aggregate": "sum", "field": "precipitation", "type": "quantitative"}
              }
            }</code></pre>
          `,
        },
        body: {
          innerText: 'Vega-Lite JSON Specification',
        },
      },
      addEventListener() {},
      removeEventListener() {},
    }
    globalThis.window = root

    const fakeView = {
      signal() {
        return fakeView
      },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }

    setTimeout(() => {
      root.vegaEmbed = async () => ({ view: fakeView })
      root.vegaEmbed('#vis', { mark: 'bar' })
    }, 10)

    const controller = await attachWidgetVAToCurrentVegaLiteExamplePage({
      root,
      timeoutMs: 500,
      pollMs: 5,
    })

    assert.equal(controller.kind, 'bar')
    assert.equal(controller.spec.data.url, 'https://vega.github.io/vega-lite/examples/data/seattle-weather.csv')
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('bootstrapCurrentVegaLiteExamplePage returns the page port and optional extension bridge lifecycle', async () => {
  const previousWindow = globalThis.window
  try {
    const root = {
      location: {
        href: 'https://vega.github.io/vega-lite/examples/point_2d.html',
      },
      document: {
        documentElement: {
          outerHTML: `
            <pre><code>{
              "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
              "data": {"url": "data/cars.json"},
              "mark": "point",
              "encoding": {
                "x": {"field": "Horsepower", "type": "quantitative"},
                "y": {"field": "Miles_per_Gallon", "type": "quantitative"}
              }
            }</code></pre>
          `,
        },
        body: {
          innerText: 'Vega-Lite JSON Specification',
        },
      },
      addEventListener() {},
      removeEventListener() {},
    }
    globalThis.window = root

    const fakeView = {
      signal() {
        return fakeView
      },
      async runAsync() {},
      addSignalListener() {},
      removeSignalListener() {},
      addEventListener() {},
      removeEventListener() {},
      finalize() {},
    }

    setTimeout(() => {
      root.vegaEmbed = async () => ({ view: fakeView })
      root.vegaEmbed('#vis', { mark: 'point' })
    }, 10)

    const controller = await bootstrapCurrentVegaLiteExamplePage({
      root,
      timeoutMs: 500,
      pollMs: 5,
      enableExtensionBridge: false,
    })

    assert.equal(controller.kind, 'scatter')
    assert.equal(typeof controller.pagePort?.describeWorkspace, 'function')
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})
