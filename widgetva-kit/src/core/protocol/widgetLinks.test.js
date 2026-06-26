import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeWidgetLinkAdvancedResponseSchema,
  describeWidgetLinkActivationPolicySchema,
  describeWidgetLinkEffectConstraintSchema,
  describeWidgetLinkEffectSchema,
  describeWidgetLinkKindSchema,
  describeLinkEngineSummarySchema,
  makeLinkEngineCapabilities,
  makeLinkEnginePrimitiveEntry,
  makeLinkEngineSummary,
  makeWidgetLink,
  makeWorkspaceTopologySummary,
  stripWidgetLinkCompatibilityFields,
} from './widgetLinks.js'

test('describeLinkEngineSummarySchema admits runtime topology summaries', () => {
  const schema = describeLinkEngineSummarySchema()
  const primitiveSchema = schema.properties?.primitives?.items

  assert.equal(schema.properties?.topology?.type, 'object')
  assert.equal(schema.properties?.topology?.properties?.topology?.type, 'string')
  assert.equal(schema.properties?.topology?.properties?.topologyLabel?.type, 'string')
  assert.equal(schema.properties?.topology?.properties?.widgetCount?.type, 'integer')
  assert.equal(schema.properties?.topology?.properties?.linkDensity?.type, 'number')
  assert.equal(primitiveSchema?.properties?.appliedStatePaths?.type, 'array')
  assert.equal(primitiveSchema?.properties?.appliedStatePaths?.items?.type, 'string')
  assert.equal(schema.properties?.coordinationLinkCount?.type, 'integer')
  assert.equal(schema.properties?.structuralLinkCount?.type, 'integer')
})

test('makeWidgetLink treats automatic false as manual propagation when propagationPolicy is omitted', () => {
  const link = makeWidgetLink({
    ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
    kind: 'filters',
    automatic: false,
  })

  assert.equal(link.kind, 'filter')
  assert.equal(link.primitive, 'filter')
  assert.equal(link.activationPolicy, 'manual')
  assert.equal(link.effectConstraint, null)
  assert.equal(Object.hasOwn(link, 'automatic'), false)
  assert.equal(Object.hasOwn(link, 'propagationPolicy'), false)
})

test('makeWidgetLink derives canonical kind from primitive-only coordination links', () => {
  const link = makeWidgetLink({
    ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
    primitive: 'filter',
  })

  assert.equal(link.kind, 'filter')
  assert.equal(link.primitive, 'filter')
})

test('makeWidgetLink preserves constrained propagation-policy vocabulary', () => {
  const link = makeWidgetLink({
    ref: 'wl://widgetva-app/workspace/main/link/heatmap_filters_bar',
    primitive: 'filter',
    propagationPolicy: 'highlightOnly',
  })

  assert.equal(link.activationPolicy, 'automatic')
  assert.equal(link.effectConstraint, 'highlightOnly')
  assert.equal(Object.hasOwn(link, 'propagationPolicy'), false)
})

test('makeWidgetLink preserves explicit activationPolicy and effectConstraint', () => {
  const link = makeWidgetLink({
    ref: 'wl://widgetva-app/workspace/main/link/heatmap_filters_bar',
    primitive: 'filter',
    activationPolicy: 'manual',
    effectConstraint: 'focusOnly',
  })

  assert.equal(link.activationPolicy, 'manual')
  assert.equal(link.effectConstraint, 'focusOnly')
  assert.equal(Object.hasOwn(link, 'propagationPolicy'), false)
})

test('makeWidgetLink preserves responseSpec on normalized public link objects', () => {
  const link = makeWidgetLink({
    ref: 'wl://widgetva-app/workspace/main/link/scatter_drill_line',
    primitive: 'filter',
    effect: 'applyFilter',
    responseSpec: {
      kind: 'drillDown',
      params: {
        dimension: 'time',
        fromLevel: 'year',
        toLevel: 'month',
      },
      verificationHints: {
        preferredReadMethod: 'readVerificationState',
      },
    },
  })

  assert.deepEqual(link.responseSpec, {
    kind: 'drillDown',
    params: {
      dimension: 'time',
      fromLevel: 'year',
      toLevel: 'month',
    },
    verificationHints: {
      preferredReadMethod: 'readVerificationState',
    },
  })
})

test('makeWidgetLink preserves advanced response primitive and effect combinations', () => {
  const link = makeWidgetLink({
    ref: 'wl://widgetva-app/workspace/main/link/bar_drill_line',
    primitive: 'drillDown',
    effect: 'transformView',
    responseSpec: {
      kind: 'drillDown',
      params: {
        dimension: 'time',
        fromLevel: 'year',
        toLevel: 'month',
      },
    },
  })

  assert.equal(link.kind, 'drillDown')
  assert.equal(link.primitive, 'drillDown')
  assert.equal(link.effect, 'transformView')
  assert.equal(link.responseSpec?.kind, 'drillDown')
})

test('stripWidgetLinkCompatibilityFields removes legacy compatibility fields from public link surfaces', () => {
  const link = stripWidgetLinkCompatibilityFields({
    ref: 'wl://widgetva-app/workspace/main/link/heatmap_filters_bar',
    primitive: 'filter',
    effect: 'applyFilter',
    activationPolicy: 'automatic',
    effectConstraint: null,
    propagationPolicy: 'automatic',
    trigger: 'selectionChanged',
    automatic: true,
  })

  assert.equal(Object.hasOwn(link, 'propagationPolicy'), false)
  assert.equal(Object.hasOwn(link, 'trigger'), false)
  assert.equal(Object.hasOwn(link, 'automatic'), false)
  assert.equal(link.activationPolicy, 'automatic')
})

test('describeWidgetLinkActivationPolicySchema exposes the supported activation-policy enum', () => {
  const schema = describeWidgetLinkActivationPolicySchema()

  assert.deepEqual(schema.enum, ['automatic', 'manual'])
})

test('describeWidgetLinkEffectConstraintSchema exposes the supported effect-constraint enum', () => {
  const schema = describeWidgetLinkEffectConstraintSchema()

  assert.deepEqual(schema.enum, ['highlightOnly', 'focusOnly', null])
})

test('describeWidgetLinkAdvancedResponseSchema exposes responseSpec contract fields', () => {
  const schema = describeWidgetLinkAdvancedResponseSchema()

  assert.equal(schema?.type, 'object')
  assert.equal(schema?.properties?.kind?.type, 'string')
  assert.equal(schema?.properties?.params?.type, 'object')
  assert.equal(schema?.properties?.verificationHints?.type, 'object')
})

test('link kind and effect schemas expose advanced coordination vocabulary', () => {
  const kindSchema = describeWidgetLinkKindSchema()
  const effectSchema = describeWidgetLinkEffectSchema()

  assert.equal(kindSchema.enum.includes('drillDown'), true)
  assert.equal(kindSchema.enum.includes('reencode'), true)
  assert.equal(kindSchema.enum.includes('aggregate'), true)
  assert.equal(kindSchema.enum.includes('structure'), true)
  assert.equal(effectSchema.enum.includes('transformView'), true)
  assert.equal(effectSchema.enum.includes('transformDataView'), true)
  assert.equal(effectSchema.enum.includes('transformStructure'), true)
})

test('link-engine constructors normalize runtime topology and summary contracts', () => {
  const topology = makeWorkspaceTopologySummary({
    topology: 'T2',
    widgetCount: 2,
    edgeCount: 1,
  })
  const primitive = makeLinkEnginePrimitiveEntry({
    name: 'filter',
    appliedStatePaths: ['transforms'],
  })
  const capabilities = makeLinkEngineCapabilities({
    propagationExecution: true,
  })
  const summary = makeLinkEngineSummary({
    primitiveCount: 1,
    primitives: [primitive],
    linkCount: 1,
    coordinationLinkCount: 1,
    structuralLinkCount: 0,
    automaticLinkCount: 1,
    manualLinkCount: 0,
    topology,
    capabilities,
  })

  assert.deepEqual(summary, {
    primitiveCount: 1,
    primitives: [
      {
        name: 'filter',
        appliedStatePaths: ['transforms'],
      },
    ],
    linkCount: 1,
    coordinationLinkCount: 1,
    structuralLinkCount: 0,
    automaticLinkCount: 1,
    manualLinkCount: 0,
    topology: {
      topology: 'T2',
      topologyLabel: '',
      widgetCount: 2,
      edgeCount: 1,
      linkDensity: 0,
      sourceWidgetCount: 0,
      targetWidgetCount: 0,
      maxOutDegree: 0,
      maxInDegree: 0,
      rationale: [],
    },
    capabilities: {
      propagationExecution: true,
      propagationPlan: false,
      effectCollection: false,
      consistencyEvaluation: false,
    },
  })
})
