import test from 'node:test'
import assert from 'node:assert/strict'

import { summarizeRuntimeLinkMap, summarizeRuntimeWidgetLink } from './runtimeLinkSummary.js'

test('summarizeRuntimeWidgetLink preserves trigger/effect/automatic contract for display', () => {
  const summary = summarizeRuntimeWidgetLink({
    ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
    primitive: 'filter',
    sourceWidgetId: 'scatter',
    targetWidgetId: 'bar',
    trigger: 'selectionChanged',
    effect: 'applyFilter',
    propagationPolicy: 'automatic',
    automatic: true,
    fieldMapping: [
      { sourceField: 'Origin', targetField: 'Origin' },
    ],
    description: 'Scatter selection filters the origin bar.',
  })

  assert.equal(summary.kind, 'filter')
  assert.equal(summary.source, 'scatter')
  assert.equal(summary.target, 'bar')
  assert.equal(summary.trigger, 'selectionChanged')
  assert.equal(summary.effect, 'applyFilter')
  assert.equal(summary.automatic, true)
  assert.deepEqual(summary.fieldMappings, ['Origin->Origin'])
})

test('summarizeRuntimeLinkMap exposes coordination and manual/automatic link counts', () => {
  const summary = summarizeRuntimeLinkMap({
    workspace: {
      links: [
        {
          ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
          primitive: 'filter',
          sourceWidgetId: 'scatter',
          targetWidgetId: 'bar',
          trigger: 'selectionChanged',
          effect: 'applyFilter',
          propagationPolicy: 'automatic',
          automatic: true,
        },
        {
          ref: 'wl://widgetva-app/workspace/main/link/bar_uses_data',
          primitive: 'usesData',
          sourceWidgetId: 'bar',
          targetWidgetId: 'bar_data',
          propagationPolicy: 'manual',
          automatic: false,
        },
      ],
    },
    engine: {
      primitives: [{ name: 'filter' }, { name: 'usesData' }],
      topology: {
        topology: 'T2',
        topologyLabel: 'Coordinated Pair',
        linkDensity: 0.5,
      },
      coordinationLinkCount: 1,
      structuralLinkCount: 1,
      automaticLinkCount: 1,
      manualLinkCount: 1,
    },
  })

  assert.equal(summary.linkCount, 2)
  assert.deepEqual(summary.primitiveNames, ['filter', 'usesData'])
  assert.equal(summary.coordinationLinkCount, 1)
  assert.equal(summary.structuralLinkCount, 1)
  assert.equal(summary.automaticLinkCount, 1)
  assert.equal(summary.manualLinkCount, 1)
  assert.equal(summary.links[0].effect, 'applyFilter')
  assert.equal(summary.links[1].automatic, false)
})
