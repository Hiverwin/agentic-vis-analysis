import test from 'node:test'
import assert from 'node:assert/strict'

import { buildImportedVisualizationCase } from './importedArtifactLoader.js'
import { createSystemRuntimeSession as createRuntimeSession } from '../vaHost/systemRuntimeSession.js'

test('createRuntimeSession mounts an imported single-widget Vega-Lite case without remapping its source spec', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const caseDef = buildImportedVisualizationCase({
    caseId: 'imported-line-session',
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Imported runtime line",
      "data": { "values": [{ "date": "2024-01-01", "value": 1 }] },
      "mark": "line",
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "value", "type": "quantitative" }
      }
    })`,
  })
  const session = createRuntimeSession(caseDef)

  try {
    assert.equal(session.widgets.length, 1)
    assert.equal(session.workspaceSpec?.widgets?.length, 1)
    assert.equal(session.workspaceSpec?.widgets?.[0]?.kind, 'line')
    assert.equal(session.workspaceSpec?.widgets?.[0]?.provider, 'vega-lite')
    assert.equal(session.workspaceSpec?.widgets?.[0]?.source?.spec?.mark, 'line')
    assert.equal(session.workspaceSpec?.widgets?.[0]?.source?.providerSpec?.spec?.mark, 'line')
    assert.equal('providerCapabilities' in session.workspaceSpec?.widgets?.[0]?.source, false)
  } finally {
    session.dispose?.()
    globalThis.window = previousWindow
  }
})

test('createRuntimeSession preserves external Vega-Lite data urls for imported multi-view specs', () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const caseDef = buildImportedVisualizationCase({
    caseId: 'imported-seattle-session',
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Seattle Weather, 2012-2015",
      "data": { "url": "data/seattle-weather.csv" },
      "vconcat": [
        {
          "mark": "point",
          "encoding": {
            "x": { "field": "date", "type": "temporal" },
            "y": { "field": "temp_max", "type": "quantitative" }
          }
        },
        {
          "mark": "bar",
          "encoding": {
            "x": { "aggregate": "count" },
            "y": { "field": "weather", "type": "nominal" }
          }
        }
      ]
    })`,
  })
  const session = createRuntimeSession(caseDef)

  try {
    const widget = session.workspace.getWidget('w_imported_primary')
    const widgetState = widget?.readState?.() || null
    const widgetDescription = session.runtime.describeWorkspace()?.widgets?.[0] || null
    assert.equal(session.workspaceSpec?.widgets?.[0]?.kind, 'custom')
    assert.deepEqual(session.workspaceSpec?.widgets?.[0]?.recognizedKinds, ['scatter', 'bar'])
    assert.equal(widgetState?.rawSpec?.data?.url, 'data/seattle-weather.csv')
    assert.equal('values' in (widgetState?.rawSpec?.data || {}), false)
    assert.deepEqual(widgetDescription?.recognizedKinds, ['scatter', 'bar'])
  } finally {
    session.dispose?.()
    globalThis.window = previousWindow
  }
})
