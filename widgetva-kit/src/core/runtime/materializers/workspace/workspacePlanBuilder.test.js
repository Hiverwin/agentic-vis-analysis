import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeWorkspacePlan } from './workspacePlanBuilder.js'

test('normalizeWorkspacePlan accepts state-to-state coordination relations', () => {
  const sourceStateRef = 'wl://widgetva-app/workspace/demo/widget/w_bar/selection/region'
  const targetStateRef = 'wl://widgetva-app/workspace/demo/widget/w_scatter/transform/region-filter'

  const result = normalizeWorkspacePlan({
    sessionId: 'demo',
    spec: { title: 'Primary' },
    workspaceSpec: {
      topology: 'T2',
      widgets: [
        { widgetId: 'w_bar', kind: 'bar', source: { kind: 'nativeArtifact' } },
        { widgetId: 'w_scatter', kind: 'scatter', source: { kind: 'nativeArtifact' } },
      ],
      links: [
        {
          ref: 'wl://widgetva-app/workspace/demo/coordination/bar-region-to-scatter-filter',
          sourceStateRef,
          targetStateRef,
          relation: 'controls',
          transform: {
            kind: 'selectionToFilter',
            fieldMapping: [{ sourceField: 'region', targetField: 'region' }],
          },
          activation: 'automatic',
        },
      ],
    },
  })

  assert.equal(result.validation.ok, true)
  assert.equal(result.materializedFromSpec, true)
  assert.equal(result.plan.widgets.length, 2)
  assert.equal(result.plan.links.length, 1)
  assert.equal(result.plan.links[0].sourceStateRef, sourceStateRef)
  assert.equal(result.plan.links[0].targetStateRef, targetStateRef)
})
