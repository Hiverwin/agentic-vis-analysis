import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeWidgetAdapterSummarySchema,
  makeWidgetAdapterCapabilities,
  makeWidgetAdapterHumanInteraction,
  makeWidgetAdapterProviderCapabilities,
  makeWidgetAdapterSummary,
} from './widgetAdapters.js'

test('makeWidgetAdapterSummary defaults widget description context fields', () => {
  const summary = makeWidgetAdapterSummary({
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
  })

  assert.equal(summary.title, '')
  assert.equal(summary.description, '')
  assert.deepEqual(summary.analyticRoles, [])
  assert.equal(summary.primaryDataRef, null)
  assert.equal(summary.sourceKind, null)
  assert.equal(summary.supportsSpecMutation, false)
  assert.deepEqual(summary.usageNotes, [])
})

test('widget adapter constructors normalize nested provider, interaction, and capability payloads', () => {
  const providerCapabilities = makeWidgetAdapterProviderCapabilities({
    renderStrategy: 'vega-view',
  })
  const humanInteraction = makeWidgetAdapterHumanInteraction({
    mode: 'brush2d',
  })
  const capabilities = makeWidgetAdapterCapabilities({
    canDescribe: true,
  })
  const summary = makeWidgetAdapterSummary({
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    providerCapabilities,
    humanInteraction,
    capabilities,
  })

  assert.equal(providerCapabilities.stateApplyStrategy, 'custom')
  assert.deepEqual(providerCapabilities.supportedWidgetKinds, [])
  assert.equal(humanInteraction.actionName, null)
  assert.equal(capabilities.canReadState, false)
  assert.equal(summary.providerCapabilities.renderStrategy, 'vega-view')
  assert.equal(summary.providerCapabilities.supportsImperativeRender, false)
  assert.equal(summary.providerCapabilities.supportsRendererMount, false)
  assert.equal(summary.humanInteraction.mode, 'brush2d')
  assert.equal(summary.humanInteraction.supportsDirectManipulation, false)
  assert.equal(summary.capabilities.canDescribe, true)
  assert.equal(summary.capabilities.canMount, false)
  assert.equal(summary.capabilities.canRegisterPerceptionQueries, false)
})

test('describeWidgetAdapterSummarySchema admits widget description context fields', () => {
  const schema = describeWidgetAdapterSummarySchema()

  assert.equal(schema.properties?.title?.type, 'string')
  assert.equal(schema.properties?.description?.type, 'string')
  assert.equal(schema.properties?.analyticRoles?.items?.type, 'string')
  assert.equal(schema.properties?.primaryDataRef?.anyOf?.[0]?.type, 'string')
  assert.equal(schema.properties?.sourceKind?.type?.[0], 'string')
  assert.equal(schema.properties?.supportsSpecMutation?.type, 'boolean')
  assert.equal(schema.properties?.usageNotes?.items?.type, 'string')
  assert.equal(schema.properties?.capabilities?.properties?.canDescribe?.type, 'boolean')
  assert.equal(schema.properties?.providerCapabilities?.properties?.supportsViewportReadback?.type, 'boolean')
  assert.equal(schema.properties?.capabilities?.properties?.canReadState?.type, 'boolean')
  assert.equal(schema.properties?.capabilities?.properties?.canReadViewport?.type, 'boolean')
})
