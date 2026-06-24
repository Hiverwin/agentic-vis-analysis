import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeWidgetRegistrySummarySchema,
  makeWidgetRegistryCounts,
  makeWidgetRegistryRefs,
  makeWidgetRegistrySummary,
} from './widgetRegistry.js'

test('describeWidgetRegistrySummarySchema admits widget capability discoverability fields', () => {
  const schema = describeWidgetRegistrySummarySchema()
  const entrySchema = schema.properties?.widgets?.items
  const dataHandleSchema = schema.properties?.dataHandles?.items
  const linkSchema = schema.properties?.links?.items

  assert.equal(entrySchema?.properties?.title?.type, 'string')
  assert.equal(entrySchema?.properties?.description?.type, 'string')
  assert.equal(entrySchema?.properties?.analyticRoles?.items?.type, 'string')
  assert.equal(entrySchema?.properties?.sourceKind?.type?.[0], 'string')
  assert.equal(entrySchema?.properties?.supportsSpecMutation?.type, 'boolean')
  assert.equal(entrySchema?.properties?.primaryDataRef?.type?.[0], 'string')
  assert.equal(entrySchema?.properties?.usageNotes?.items?.type, 'string')
  assert.equal(entrySchema?.properties?.actionNames?.items?.type, 'string')
  assert.equal(entrySchema?.properties?.perceptionQueryNames?.items?.type, 'string')
  assert.equal(entrySchema?.properties?.providerCapabilities?.anyOf?.[1]?.properties?.renderStrategy?.type, 'string')
  assert.equal(entrySchema?.properties?.adapterCapabilities?.anyOf?.[1]?.properties?.canDescribe?.type, 'boolean')
  assert.equal(entrySchema?.properties?.humanInteractionActionName?.type?.[0], 'string')
  assert.equal(entrySchema?.properties?.supportsDirectManipulation?.type, 'boolean')
  assert.equal(dataHandleSchema?.properties?.supportedQueries?.items?.type, 'string')
  assert.equal(linkSchema?.properties?.effect?.type?.[0], 'string')
  assert.equal(linkSchema?.properties?.activationPolicy?.type, 'string')
  assert.equal(linkSchema?.properties?.effectConstraint?.type?.includes?.('null') ?? false, true)
  assert.equal(Object.hasOwn(linkSchema?.properties || {}, 'propagationPolicy'), false)
  assert.equal(Object.hasOwn(linkSchema?.properties || {}, 'trigger'), false)
})

test('widget-registry constructors normalize registry summary contracts', () => {
  const counts = makeWidgetRegistryCounts({
    widgetCount: 1,
  })
  const refs = makeWidgetRegistryRefs({
    widgetRefs: ['widget_a'],
  })
  const summary = makeWidgetRegistrySummary({
    counts,
    refs,
  })

  assert.equal(counts.widgetCount, 1)
  assert.deepEqual(refs.widgetRefs, ['widget_a'])
  assert.deepEqual(summary.widgets, [])
  assert.deepEqual(summary.dataHandles, [])
  assert.deepEqual(summary.links, [])
})

test('makeWidgetRegistrySummary normalizes nested summary defaults', () => {
  const summary = makeWidgetRegistrySummary({
    counts: {
      widgetCount: 1,
    },
    refs: {
      widgetRefs: ['widget_a'],
    },
  })

  assert.equal(summary.counts.widgetCount, 1)
  assert.equal(summary.counts.dataHandleCount, 0)
  assert.deepEqual(summary.refs.widgetRefs, ['widget_a'])
  assert.deepEqual(summary.refs.dataRefs, [])
  assert.deepEqual(summary.widgets, [])
  assert.deepEqual(summary.dataHandles, [])
  assert.deepEqual(summary.links, [])
})
