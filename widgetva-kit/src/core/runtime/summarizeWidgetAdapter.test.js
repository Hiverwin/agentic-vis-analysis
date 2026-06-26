import test from 'node:test'
import assert from 'node:assert/strict'

import { summarizeWidgetAdapter } from './summarizeWidgetAdapter.js'

test('summarizeWidgetAdapter preserves widget description context for adapter introspection', () => {
  const summary = summarizeWidgetAdapter({
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    dataRef: 'wl://widgetva-app/workspace/main/data/current_view',
    kind: 'scatter',
    provider: 'vega-lite',
    providerCapabilities: {
      renderStrategy: 'vega-view',
      stateApplyStrategy: 'signals',
      interactionBindingStrategy: 'signals',
      supportsSignalPatching: true,
      supportsOptionMerging: false,
      supportsImperativeRender: true,
    },
    metadata: {},
    getDescription() {
      return {
        kind: 'scatter',
        title: 'Risk Scatterplot',
        description: 'Shows latency vs error rate.',
        analyticRoles: ['correlate', 'outlier'],
        primaryDataRef: 'wl://widgetva-app/workspace/main/data/risk_records',
        role: 'primary',
        sourceKind: 'baseSpec',
        supportsSpecMutation: true,
        usageNotes: ['Use brushRegion to select an interval.'],
        actionNames: ['scatter.brushRegion'],
        perceptionQueryNames: ['perception.summarizeSelection'],
      }
    },
    getHumanInteractionConfig() {
      return {
        mode: 'brush2d',
        actionName: 'scatter.brushRegion',
        supportsDirectManipulation: true,
      }
    },
    getState() {
      return { ref: 'wl://widgetva-app/workspace/main/widget/scatter_a' }
    },
    applyState() {},
    bindHumanInteractions() {},
    registerActions() {},
    registerPerceptionQueries() {},
  })

  assert.equal(summary?.title, 'Risk Scatterplot')
  assert.equal(summary?.description, 'Shows latency vs error rate.')
  assert.deepEqual(summary?.analyticRoles, ['correlate', 'outlier'])
  assert.equal(summary?.primaryDataRef, 'wl://widgetva-app/workspace/main/data/risk_records')
  assert.equal(summary?.sourceKind, 'baseSpec')
  assert.equal(summary?.supportsSpecMutation, true)
  assert.deepEqual(summary?.usageNotes, ['Use brushRegion to select an interval.'])
  assert.equal(summary?.humanInteraction?.mode, 'brush2d')
  assert.equal(summary?.capabilities?.canDescribe, true)
  assert.equal(summary?.capabilities?.canReadState, true)
})
