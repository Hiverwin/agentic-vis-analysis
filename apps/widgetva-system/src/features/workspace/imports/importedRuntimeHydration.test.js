import test from 'node:test'
import assert from 'node:assert/strict'

import {
  hydrateImportedRuntimeWidget,
  hydrateImportedRuntimeWidgets,
} from './importedRuntimeHydration.js'

test('hydrateImportedRuntimeWidget applies a kit-produced Vega-Lite render payload', () => {
  const widget = {
    id: 'w_imported_primary',
    provider: 'vega-lite',
    widgetKind: 'scatter',
    source: {
      providerSpec: {
        provider: 'vega-lite',
        spec: { mark: 'point' },
      },
    },
  }

  const hydrated = hydrateImportedRuntimeWidget(
    widget,
    {
      widgetId: 'w_imported_primary',
      provider: 'vega-lite',
      kind: 'scatter',
      providerSpec: {
        provider: 'vega-lite',
        spec: {
          mark: 'point',
          transform: [{ filter: { field: 'region', oneOf: ['Central'] } }],
        },
      },
    },
    {
      widgetId: 'w_imported_primary',
      provider: 'vega-lite',
      kind: 'scatter',
      recognizedKinds: ['scatter'],
      actionNames: ['scatter.filterCategorical'],
    },
  )

  assert.deepEqual(hydrated.providerSpec.spec.transform, [{ filter: { field: 'region', oneOf: ['Central'] } }])
  assert.deepEqual(hydrated.source.providerSpec.spec.transform, [{ filter: { field: 'region', oneOf: ['Central'] } }])
  assert.deepEqual(hydrated.runtimeSource.providerSpec.spec.transform, [{ filter: { field: 'region', oneOf: ['Central'] } }])
  assert.deepEqual(hydrated.recognizedKinds, ['scatter'])
  assert.deepEqual(hydrated.actionNames, ['scatter.filterCategorical'])
})

test('hydrateImportedRuntimeWidgets reads render payloads without inspecting runtime state', () => {
  const widgets = [{
    id: 'w_imported_primary',
    provider: 'vega-lite',
    widgetKind: 'line',
    source: {
      providerSpec: {
        provider: 'vega-lite',
        spec: { mark: 'line' },
      },
    },
  }]

  const hydrated = hydrateImportedRuntimeWidgets(widgets, {
    readWidgetRenderPayload: (widgetId) => (
      widgetId === 'w_imported_primary'
        ? {
            widgetId,
            provider: 'vega-lite',
            kind: 'line',
            providerSpec: {
              provider: 'vega-lite',
              spec: {
                mark: 'line',
                encoding: {
                  opacity: { value: 0.2 },
                },
              },
            },
          }
        : null
    ),
    describeWorkspace: () => ({
      widgets: [{
        widgetId: 'w_imported_primary',
        provider: 'vega-lite',
        kind: 'line',
        actionNames: ['line.boldLines'],
      }],
    }),
  })

  assert.equal(hydrated.length, 1)
  assert.deepEqual(hydrated[0].source.providerSpec.spec.encoding.opacity, { value: 0.2 })
  assert.deepEqual(hydrated[0].actionNames, ['line.boldLines'])
})
