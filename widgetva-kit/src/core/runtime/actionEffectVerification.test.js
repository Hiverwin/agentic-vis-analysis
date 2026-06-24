import test from 'node:test'
import assert from 'node:assert/strict'

import { evaluateActionEffectVerification } from './actionEffectVerification.js'

test('evaluateActionEffectVerification returns runtime verification evidence from trace, state patch, and link propagation', () => {
  const result = evaluateActionEffectVerification({
    store: {
      readTrace() {
        return [
          {
            stateId: 'main:s3',
            action: {
              name: 'scatter.brushRegion',
              targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
            },
            affectedRefs: [
              'wl://widgetva-app/workspace/main/widget/scatter_a',
              'wl://widgetva-app/workspace/main/widget/bar_b',
            ],
          },
        ]
      },
      readSnapshotEntry() {
        return {
          state: { stateId: 'main:s3', widgets: {}, shared: {} },
          replayContext: { runMode: 'benchmark' },
        }
      },
      readState() {
        return { stateId: 'main:s3', widgets: {}, shared: {} }
      },
      replayContext: { runMode: 'benchmark' },
      stateManager: {
        buildStatePatch({ refs }) {
          return {
            refs,
          }
        },
      },
      getActionDescriptor(name) {
        if (name !== 'scatter.brushRegion') return null
        return {
          name,
          postconditions: [
            {
              description: 'The scatter selection should exist.',
            },
          ],
        }
      },
      listActions() {
        return []
      },
    },
    getFinalWorkspaceSnapshot({ stateId, refs, includeMeta }) {
      return {
        stateId,
        refs: refs || null,
        includeMeta,
        shared: {
          selections: {
            registry: {
              'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush_a': {
                kind: 'interval',
              },
            },
            views: {
              primary: null,
              byWidget: {},
            },
          },
        },
      }
    },
    evaluateLinkPropagation({ sourceRef }) {
      return {
        ok: true,
        sourceRef,
        linkCount: 1,
        passedCount: 1,
        consistencyScore: 1,
        results: [],
      }
    },
    actionName: 'scatter.brushRegion',
    stateId: 'main:s3',
    refs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
    targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
  })

  assert.equal(result.verified, true)
  assert.equal(result.matchedActionName, 'scatter.brushRegion')
  assert.equal(result.matchedStateId, 'main:s3')
  assert.deepEqual(result.missingRefs, [])
  assert.deepEqual(result.statePatch, {
    refs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
  })
  assert.equal(result.finalSnapshot?.stateId, 'main:s3')
  assert.equal(result.linkPropagation[0]?.ok, true)
})

test('evaluateActionEffectVerification falls back to readTraceWindow when readTrace is unavailable', () => {
  const result = evaluateActionEffectVerification({
    store: {
      readTraceWindow() {
        return [
          {
            stateId: 'main:s4',
            action: {
              name: 'scatter.brushRegion',
              targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
            },
            affectedRefs: [
              'wl://widgetva-app/workspace/main/widget/scatter_a',
            ],
          },
        ]
      },
      readSnapshotEntry() {
        return {
          state: { stateId: 'main:s4', widgets: {}, shared: {} },
          replayContext: { runMode: 'benchmark' },
        }
      },
      readState() {
        return { stateId: 'main:s4', widgets: {}, shared: {} }
      },
      replayContext: { runMode: 'benchmark' },
      stateManager: {
        buildStatePatch({ refs }) {
          return { refs }
        },
      },
      getActionDescriptor(name) {
        if (name !== 'scatter.brushRegion') return null
        return {
          name,
          postconditions: [
            {
              description: 'The scatter selection should exist.',
            },
          ],
        }
      },
      listActions() {
        return []
      },
    },
    getFinalWorkspaceSnapshot({ stateId, refs, includeMeta }) {
      return {
        stateId,
        refs: refs || null,
        includeMeta,
        shared: {
          selections: {
            registry: {},
            views: {
              primary: null,
              byWidget: {},
            },
          },
        },
      }
    },
    evaluateLinkPropagation() {
      return {
        ok: true,
        linkCount: 0,
        passedCount: 0,
        consistencyScore: 1,
        results: [],
      }
    },
    actionName: 'scatter.brushRegion',
    stateId: 'main:s4',
    refs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
    targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
  })

  assert.equal(result.verified, true)
  assert.equal(result.traceEvidence?.stateId, 'main:s4')
  assert.equal(result.matchedActionName, 'scatter.brushRegion')
})

test('evaluateActionEffectVerification supports plain manual-assembly history facades', () => {
  const result = evaluateActionEffectVerification({
    store: {
      interactionTrace: [
        {
          stateId: 'main:s5',
          action: {
            name: 'scatter.brushRegion',
            targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
          },
          affectedRefs: [
            'wl://widgetva-app/workspace/main/widget/scatter_a',
          ],
        },
      ],
      stateId: 'main:s5',
      stateSnapshots: [
        {
          stateId: 'main:s5',
          replayContext: { runMode: 'benchmark' },
          state: { stateId: 'main:s5', widgets: {}, shared: {} },
        },
      ],
      stateManager: {
        buildStatePatch({ refs }) {
          return { refs }
        },
      },
      getActionDescriptor(name) {
        if (name !== 'scatter.brushRegion') return null
        return {
          name,
          postconditions: [
            {
              description: 'The scatter selection should exist.',
            },
          ],
        }
      },
      listActions() {
        return []
      },
    },
    getFinalWorkspaceSnapshot({ stateId, refs, includeMeta }) {
      return {
        stateId,
        refs: refs || null,
        includeMeta,
        shared: {
          selections: {
            registry: {},
            views: {
              primary: null,
              byWidget: {},
            },
          },
        },
      }
    },
    evaluateLinkPropagation() {
      return {
        ok: true,
        linkCount: 0,
        passedCount: 0,
        consistencyScore: 1,
        results: [],
      }
    },
    actionName: 'scatter.brushRegion',
    stateId: 'main:s5',
    refs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
    targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
  })

  assert.equal(result.verified, true)
  assert.equal(result.traceEvidence?.stateId, 'main:s5')
  assert.deepEqual(result.statePatch, {
    refs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
  })
})
