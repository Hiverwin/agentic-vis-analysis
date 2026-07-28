import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCoordinationResult } from './coordinationOperationResult.js'

test('buildCoordinationResult packages activated targets, skipped targets, and verification results', () => {
  const result = buildCoordinationResult({
    state: {
      shared: {
        selections: {
          registry: {
            'selection://widgetva-system/scatter/brush': {
              selectionRef: 'selection://widgetva-system/scatter/brush',
              sourceWidgetId: 'scatter',
              summary: 'Origin: Europe',
              predicates: [{ field: 'origin', op: 'equals', value: 'Europe' }],
            },
          },
          views: {
            primary: {
              selectionRef: 'selection://widgetva-system/scatter/brush',
              sourceWidgetId: 'scatter',
              summary: 'Origin: Europe',
              predicates: [{ field: 'origin', op: 'equals', value: 'Europe' }],
            },
            byWidget: {},
          },
        },
      },
    },
    description: {
      runtimeTopology: { topology: 'T2' },
      widgets: [
        { ref: 'wl://widgetva-app/workspace/main/widget/scatter_a', widgetId: 'scatter', kind: 'scatter' },
        { ref: 'wl://widgetva-app/workspace/main/widget/bar_b', widgetId: 'bar', kind: 'bar' },
      ],
    },
    coordinationEngine: {
      describeEngine() {
        return { topology: { topology: 'T2' } }
      },
      describePropagation() {
        return [
          {
            linkRef: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
            linkKind: 'filter',
            declaredEffect: 'applyFilter',
            appliedEffect: 'applyHighlight',
            targetRef: 'wl://widgetva-app/workspace/main/widget/bar_b',
            activationPolicy: 'automatic',
            effectConstraint: 'highlightOnly',
            sourceSelectionRef: 'selection://widgetva-system/scatter/brush',
            sourceWidgetId: 'scatter',
            canApply: true,
          },
          {
            linkRef: 'wl://widgetva-app/workspace/main/link/scatter_filters_detail',
            linkKind: 'filter',
            declaredEffect: 'applyFilter',
            appliedEffect: 'applyFilter',
            targetRef: 'wl://widgetva-app/workspace/main/widget/detail_c',
            activationPolicy: 'manual',
            effectConstraint: null,
            sourceSelectionRef: 'selection://widgetva-system/scatter/brush',
            sourceWidgetId: 'scatter',
            canApply: false,
            skippedReason: 'manual_activation_policy',
          },
        ]
      },
      evaluatePropagation() {
        return { results: [] }
      },
    },
    store: {
      getResolvedWidgetForTarget(ref) {
        if (ref !== 'wl://widgetva-app/workspace/main/widget/bar_b') return null
        return {
          readVerificationState() {
            return {
              feedback: {
                highlightKeyCount: 1,
              },
            }
          },
        }
      },
    },
  })

  assert.equal(result.propagationSummary.active, true)
  assert.equal(result.propagationSummary.sourceWidgetId, 'scatter')
  assert.equal(result.propagationSummary.activatedLinks[0]?.appliedEffect, 'applyHighlight')
  assert.equal(result.propagationSummary.affectedTargets[0]?.verificationGuidance?.verificationType, 'highlight')
  assert.equal(result.propagationSummary.verificationSteps[0]?.readMethod, 'readVerificationState')
  assert.equal(result.propagationSummary.skippedTargets[0]?.reason, 'manualLink')
  assert.equal(result.verificationResults[0]?.ok, true)
  assert.equal(result.verificationResults[0]?.checks['feedback.highlightKeyCount'], 1)
  assert.equal(result.verification.status, 'verified')
})

test('buildCoordinationResult explains non-target widgets with noApplicableLink', () => {
  const result = buildCoordinationResult({
    state: {
      shared: {
        selections: {
          registry: {
            'selection://widgetva-system/scatter/brush': {
              selectionRef: 'selection://widgetva-system/scatter/brush',
              sourceWidgetId: 'scatter',
              summary: 'Origin: Europe',
              predicates: [{ field: 'origin', op: 'equals', value: 'Europe' }],
            },
          },
          views: {
            primary: {
              selectionRef: 'selection://widgetva-system/scatter/brush',
              sourceWidgetId: 'scatter',
              summary: 'Origin: Europe',
              predicates: [{ field: 'origin', op: 'equals', value: 'Europe' }],
            },
            byWidget: {},
          },
        },
      },
    },
    description: {
      widgets: [
        { ref: 'wl://widgetva-app/workspace/main/widget/scatter_a', widgetId: 'scatter', kind: 'scatter' },
        { ref: 'wl://widgetva-app/workspace/main/widget/bar_b', widgetId: 'bar', kind: 'bar' },
        { ref: 'wl://widgetva-app/workspace/main/widget/line_c', widgetId: 'line', kind: 'line' },
      ],
    },
    coordinationEngine: {
      describeEngine() {
        return { topology: { topology: 'T2' } }
      },
      describePropagation() {
        return [
          {
            linkRef: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
            linkKind: 'filter',
            declaredEffect: 'applyFilter',
            appliedEffect: 'applyFilter',
            targetRef: 'wl://widgetva-app/workspace/main/widget/bar_b',
            activationPolicy: 'automatic',
            effectConstraint: null,
            sourceSelectionRef: 'selection://widgetva-system/scatter/brush',
            sourceWidgetId: 'scatter',
            canApply: true,
          },
        ]
      },
      evaluatePropagation() {
        return { results: [] }
      },
    },
  })

  assert.equal(result.propagationSummary.skippedTargets.some((target) => target.targetWidgetId === 'line' && target.reason === 'noApplicableLink'), true)
})

test('buildCoordinationResult carries advanced response guidance into affected targets and verification steps', () => {
  const result = buildCoordinationResult({
    state: {
      shared: {
        selections: {
          registry: {
            'selection://widgetva-system/bar/year': {
              selectionRef: 'selection://widgetva-system/bar/year',
              sourceWidgetId: 'bar',
              summary: 'Year: 1970',
              predicates: [{ field: 'year', op: 'equals', value: 1970 }],
            },
          },
          views: {
            primary: {
              selectionRef: 'selection://widgetva-system/bar/year',
              sourceWidgetId: 'bar',
              summary: 'Year: 1970',
              predicates: [{ field: 'year', op: 'equals', value: 1970 }],
            },
            byWidget: {},
          },
        },
      },
    },
    description: {
      widgets: [
        { ref: 'wl://widgetva-app/workspace/main/widget/bar_a', widgetId: 'bar', kind: 'bar' },
        { ref: 'wl://widgetva-app/workspace/main/widget/line_b', widgetId: 'line', kind: 'line' },
      ],
    },
    coordinationEngine: {
      describeEngine() {
        return { topology: { topology: 'T2' } }
      },
      describePropagation() {
        return [
          {
            linkRef: 'wl://widgetva-app/workspace/main/link/bar_drill_line',
            linkKind: 'drillDown',
            declaredEffect: 'transformView',
            appliedEffect: 'transformView',
            targetRef: 'wl://widgetva-app/workspace/main/widget/line_b',
            activationPolicy: 'automatic',
            effectConstraint: null,
            responseSpec: {
              kind: 'drillDown',
              params: {
                fromLevel: 'year',
                toLevel: 'month',
              },
              verificationHints: {
                preferredReadMethod: 'readVerificationState',
                checks: ['view.drilldownLevel', 'metadata.title'],
              },
            },
            sourceSelectionRef: 'selection://widgetva-system/bar/year',
            sourceWidgetId: 'bar',
            canApply: true,
          },
        ]
      },
      evaluatePropagation() {
        return { results: [] }
      },
    },
    store: {
      getResolvedWidgetForTarget(ref) {
        if (ref !== 'wl://widgetva-app/workspace/main/widget/line_b') return null
        return {
          readVerificationState() {
            return {
              view: {
                drilldownLevel: 'month',
              },
              metadata: {
                title: '1970 monthly trend',
              },
            }
          },
        }
      },
    },
  })

  assert.equal(result.propagationSummary.affectedTargets[0]?.effect, 'transformView')
  assert.equal(result.propagationSummary.affectedTargets[0]?.responseSpec?.kind, 'drillDown')
  assert.equal(result.propagationSummary.affectedTargets[0]?.verificationGuidance?.verificationType, 'drillDown')
  assert.equal(result.propagationSummary.affectedTargets[0]?.verificationGuidance?.preferredReadMethod, 'readVerificationState')
  assert.deepEqual(result.propagationSummary.verificationSteps[0]?.checks, ['view.drilldownLevel', 'metadata.title'])
  assert.equal(result.verificationResults[0]?.checks['view.drilldownLevel'], 'month')
  assert.equal(result.verification.status, 'verified')
})
