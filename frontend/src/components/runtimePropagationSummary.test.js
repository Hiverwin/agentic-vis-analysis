import test from 'node:test'
import assert from 'node:assert/strict'

import { summarizeRuntimePropagation } from './runtimePropagationSummary.js'

test('summarizeRuntimePropagation derives live propagation sources and target refs from snapshot state', () => {
  const summary = summarizeRuntimePropagation({
    snapshot: {
      stateId: 'main:s2',
      shared: {
        activeSelections: {
          'wl://widgetva-app/workspace/main/selection/primary': {
            selectedCount: 4,
            summary: 'Origin in {USA, Japan}',
          },
          'wl://widgetva-app/workspace/main/selection/secondary': {
            keys: ['ford pinto'],
          },
        },
      },
    },
    evaluations: [
      {
        passedCount: 2,
        linkCount: 2,
        results: [
          {
            primitive: 'filter',
            targetRef: 'wl://widgetva-app/workspace/main/widget/bar',
            ok: true,
          },
          {
            primitive: 'highlight',
            targetRef: 'wl://widgetva-app/workspace/main/widget/table',
            ok: false,
            reason: 'missing highlight feedback',
          },
        ],
      },
    ],
  })

  assert.equal(summary.stateId, 'main:s2')
  assert.equal(summary.sourceCount, 2)
  assert.deepEqual(summary.sources[0], {
    sourceRef: 'wl://widgetva-app/workspace/main/selection/primary',
    selectionCount: 4,
    summary: 'Origin in {USA, Japan}',
  })
  assert.deepEqual(summary.sources[1], {
    sourceRef: 'wl://widgetva-app/workspace/main/selection/secondary',
    selectionCount: 1,
    summary: '1 keys',
  })
  assert.deepEqual(summary.targetRefs, [
    'wl://widgetva-app/workspace/main/widget/bar',
    'wl://widgetva-app/workspace/main/widget/table',
  ])
  assert.equal(summary.propagation.linkCount, 2)
  assert.equal(summary.propagation.passedCount, 2)
  assert.equal(summary.propagation.ok, false)
  assert.deepEqual(summary.propagation.primitives, ['filter', 'highlight'])
})
