import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeWidgetLink,
  stripWidgetLinkCompatibilityFields,
} from './widget-links-contracts.js'

test('widget-links contracts normalize legacy aliases into kind-only coordination links', () => {
  const manualFilter = makeWidgetLink({
    ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
    kind: 'filters',
    automatic: false,
  })
  const highlightOnlyFilter = makeWidgetLink({
    ref: 'wl://widgetva-app/workspace/main/link/heatmap_filters_bar',
    kind: 'filter',
    propagationPolicy: 'highlightOnly',
  })

  assert.equal(manualFilter.kind, 'filter')
  assert.equal(Object.hasOwn(manualFilter, 'primitive'), false)
  assert.equal(manualFilter.activationPolicy, 'manual')
  assert.equal(Object.hasOwn(manualFilter, 'automatic'), false)
  assert.equal(highlightOnlyFilter.activationPolicy, 'automatic')
  assert.equal(highlightOnlyFilter.effectConstraint, 'highlightOnly')
  assert.equal(highlightOnlyFilter.kind, 'filter')
  assert.equal(Object.hasOwn(highlightOnlyFilter, 'primitive'), false)
  assert.equal(Object.hasOwn(highlightOnlyFilter, 'propagationPolicy'), false)
})

test('widget-links contracts preserve advanced response specs and strip compatibility fields', () => {
  const link = makeWidgetLink({
    ref: 'wl://widgetva-app/workspace/main/link/bar_drill_line',
    kind: 'drillDown',
    effect: 'transformView',
    responseSpec: {
      kind: 'drillDown',
      params: {
        dimension: 'time',
      },
    },
  })
  const publicLink = stripWidgetLinkCompatibilityFields({
    kind: 'filter',
    propagationPolicy: 'automatic',
    trigger: 'selectionChanged',
    automatic: true,
  })

  assert.equal(link.kind, 'drillDown')
  assert.equal(Object.hasOwn(link, 'primitive'), false)
  assert.equal(link.effect, 'transformView')
  assert.equal(link.responseSpec?.kind, 'drillDown')
  assert.equal(Object.hasOwn(publicLink, 'propagationPolicy'), false)
  assert.equal(Object.hasOwn(publicLink, 'trigger'), false)
  assert.equal(Object.hasOwn(publicLink, 'automatic'), false)
})
