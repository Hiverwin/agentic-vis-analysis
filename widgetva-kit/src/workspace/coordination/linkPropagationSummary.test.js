import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPropagationSummary } from './linkPropagationSummary.js'

test('buildPropagationSummary strips propagationPolicy from agent-facing outputs', () => {
  const summary = buildPropagationSummary({
    state: {
      shared: {
        focusedWidget: 'wl://widgetva-app/workspace/main/widget/scatter_a',
      },
    },
    description: {
      runtimeTopology: { topology: 'T2' },
    },
    coordinationEngine: {
      describeEngine() {
        return {
          topology: { topology: 'T2' },
          links: [
            {
              sourceRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
              targetRef: 'wl://widgetva-app/workspace/main/widget/bar_b',
              activationPolicy: 'automatic',
              effectConstraint: null,
              responseSpec: {
                kind: 'drillDown',
                params: {
                  dimension: 'time',
                },
              },
              propagationPolicy: 'automatic',
              automatic: true,
              trigger: 'selectionChanged',
            },
          ],
        }
      },
      describePropagation() {
        return [
          {
            sourceRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
            targetRef: 'wl://widgetva-app/workspace/main/widget/bar_b',
            activationPolicy: 'automatic',
            effectConstraint: 'highlightOnly',
            skippedReason: 'manual_activation_policy',
            propagationPolicy: 'highlightOnly',
            automatic: true,
            trigger: 'selectionChanged',
          },
        ]
      },
      evaluatePropagation() {
        return {
          results: [
            {
              targetRef: 'wl://widgetva-app/workspace/main/widget/bar_b',
              activationPolicy: 'automatic',
              effectConstraint: 'highlightOnly',
              reason: 'manual_activation_policy',
              propagationPolicy: 'highlightOnly',
              automatic: true,
              trigger: 'selectionChanged',
            },
          ],
        }
      },
    },
  })

  assert.equal(summary.linkSummary.links[0].activationPolicy, 'automatic')
  assert.equal(summary.linkSummary.links[0].effectConstraint, null)
  assert.equal(summary.linkSummary.links[0].responseSpec?.kind, 'drillDown')
  assert.equal(Object.hasOwn(summary.linkSummary.links[0], 'propagationPolicy'), false)
  assert.equal(Object.hasOwn(summary.linkSummary.links[0], 'automatic'), false)
  assert.equal(Object.hasOwn(summary.linkSummary.links[0], 'trigger'), false)
  assert.equal(summary.propagation[0].effectConstraint, 'highlightOnly')
  assert.equal(Object.hasOwn(summary.propagation[0], 'responseSpec'), false)
  assert.equal(Object.hasOwn(summary.propagation[0], 'propagationPolicy'), false)
  assert.equal(Object.hasOwn(summary.propagation[0], 'automatic'), false)
  assert.equal(Object.hasOwn(summary.propagation[0], 'trigger'), false)
  assert.equal(summary.propagation[0].skippedReason, 'manualLink')
  assert.equal(summary.evaluation.results[0].effectConstraint, 'highlightOnly')
  assert.equal(Object.hasOwn(summary.evaluation.results[0], 'responseSpec'), false)
  assert.equal(Object.hasOwn(summary.evaluation.results[0], 'propagationPolicy'), false)
  assert.equal(Object.hasOwn(summary.evaluation.results[0], 'automatic'), false)
  assert.equal(Object.hasOwn(summary.evaluation.results[0], 'trigger'), false)
  assert.equal(summary.evaluation.results[0].reason, 'manualLink')
})
