import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeWorkspaceSpecSummarySchema,
  makeWorkspaceSpecSummary,
  summarizeWorkspaceSpec,
  describeWorkspaceSpecSchema,
  validateWorkspaceSpec,
} from './workspaceSpec.js'

test('describeWorkspaceSpecSummarySchema admits topology and workspace-level counts', () => {
  const schema = describeWorkspaceSpecSummarySchema()

  assert.equal(schema.properties?.topology?.type?.includes('string'), true)
  assert.equal(schema.properties?.widgetCount?.type, 'integer')
  assert.equal(schema.properties?.linkCount?.type, 'integer')
})

test('workspace-spec summary constructors normalize planning summary contracts', () => {
  const summary = makeWorkspaceSpecSummary({
    topology: 'T2',
    widgetCount: 2,
  })
  const derived = summarizeWorkspaceSpec({
    topology: 'T2',
    widgets: [{ widgetId: 'scatter' }, { widgetId: 'bar' }],
    links: [{ linkId: 'link_filter' }],
  })

  assert.deepEqual(summary, {
    topology: 'T2',
    widgetCount: 2,
    linkCount: 0,
  })
  assert.deepEqual(derived, {
    topology: 'T2',
    widgetCount: 2,
    linkCount: 1,
  })
})

test('workspace-spec schema and validation admit activationPolicy, effectConstraint, and responseSpec on links', () => {
  const schema = describeWorkspaceSpecSchema()
  const linkSchema = schema.properties?.links?.items?.properties
  const validation = validateWorkspaceSpec({
    topology: 'T2',
    widgets: [
      {
        widgetId: 'scatter_main',
        role: 'overview',
        source: { kind: 'baseSpec' },
      },
      {
        widgetId: 'bar_detail',
        role: 'detail',
        source: { kind: 'baseSpec' },
      },
    ],
    links: [
      {
        linkId: 'scatter_to_bar',
        sourceWidgetId: 'scatter_main',
        targetWidgetId: 'bar_detail',
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: 'highlightOnly',
        responseSpec: {
          kind: 'drillDown',
          params: {
            dimension: 'time',
            fromLevel: 'year',
            toLevel: 'month',
          },
        },
      },
    ],
  })

  assert.equal(linkSchema?.activationPolicy?.enum?.includes('automatic'), true)
  assert.equal(linkSchema?.effectConstraint?.enum?.includes('highlightOnly'), true)
  assert.equal(linkSchema?.responseSpec?.type, 'object')
  assert.equal(Object.hasOwn(linkSchema || {}, 'propagationPolicy'), false)
  assert.equal(validation.ok, true)
  assert.deepEqual(validation.issues, [])
})

test('workspace-spec validation rejects malformed responseSpec payloads', () => {
  const validation = validateWorkspaceSpec({
    topology: 'T2',
    widgets: [
      {
        widgetId: 'scatter_main',
        role: 'overview',
        source: { kind: 'baseSpec' },
      },
      {
        widgetId: 'bar_detail',
        role: 'detail',
        source: { kind: 'baseSpec' },
      },
    ],
    links: [
      {
        linkId: 'scatter_to_bar',
        sourceWidgetId: 'scatter_main',
        targetWidgetId: 'bar_detail',
        primitive: 'filter',
        responseSpec: {
          kind: 12,
        },
      },
    ],
  })

  assert.equal(validation.ok, false)
  assert.deepEqual(validation.issues, [
    'workspaceSpec.links[0].responseSpec.kind must be a non-empty string when responseSpec is provided.',
  ])
})

test('workspace-spec validation treats propagationPolicy as a legacy compatibility field', () => {
  const validation = validateWorkspaceSpec({
    topology: 'T2',
    widgets: [
      {
        widgetId: 'scatter_main',
        role: 'overview',
        source: { kind: 'baseSpec' },
      },
      {
        widgetId: 'bar_detail',
        role: 'detail',
        source: { kind: 'baseSpec' },
      },
    ],
    links: [
      {
        linkId: 'scatter_to_bar',
        sourceWidgetId: 'scatter_main',
        targetWidgetId: 'bar_detail',
        primitive: 'filter',
        propagationPolicy: 'not-a-valid-policy',
      },
    ],
  })

  assert.equal(validation.ok, false)
  assert.deepEqual(validation.issues, [
    'workspaceSpec.links[0].propagationPolicy is a legacy compatibility field and, when provided, must be one of: automatic, manual, highlightOnly, focusOnly.',
  ])
})
