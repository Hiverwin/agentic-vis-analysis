import { describeRefSchema } from './refs.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export const WIDGET_LINK_KINDS = [
  'filter',
  'highlight',
  'syncDomain',
  'sharesSelection',
  'drillDown',
  'reencode',
  'aggregate',
  'structure',
  'contains',
  'usesData',
  'filters',
  'highlights',
  'syncsDomain',
  'comparesWith',
  'derivesFrom',
]

const WIDGET_LINK_KIND_ALIASES = {
  filters: 'filter',
  highlights: 'highlight',
  syncsDomain: 'syncDomain',
}

export const WIDGET_LINK_EFFECTS = [
  'applyFilter',
  'applyHighlight',
  'focusTarget',
  'syncDomain',
  'shareSelection',
  'transformView',
  'transformDataView',
  'transformStructure',
  'updateData',
  'compare',
]

const LEGACY_WIDGET_LINK_PROPAGATION_POLICIES = [
  'automatic',
  'manual',
  'highlightOnly',
  'focusOnly',
]

export const WIDGET_LINK_ACTIVATION_POLICIES = [
  'automatic',
  'manual',
]

export const WIDGET_LINK_EFFECT_CONSTRAINTS = [
  'highlightOnly',
  'focusOnly',
]

export const WIDGET_LINK_ADVANCED_RESPONSE_KINDS = [
  'drillDown',
  'reencode',
  'aggregate',
  'expand',
  'collapse',
]

export function describeWidgetLinkKindSchema() {
  return cloneValue({
    type: 'string',
    enum: WIDGET_LINK_KINDS,
  })
}

export function describeWidgetLinkEffectSchema() {
  return cloneValue({
    type: ['string', 'null'],
    enum: [...WIDGET_LINK_EFFECTS, null],
  })
}

export function describeWidgetLinkActivationPolicySchema() {
  return cloneValue({
    type: 'string',
    enum: WIDGET_LINK_ACTIVATION_POLICIES,
  })
}

export function describeWidgetLinkEffectConstraintSchema() {
  return cloneValue({
    type: ['string', 'null'],
    enum: [...WIDGET_LINK_EFFECT_CONSTRAINTS, null],
  })
}

export function describeWidgetLinkAdvancedResponseSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      kind: { type: 'string', enum: WIDGET_LINK_ADVANCED_RESPONSE_KINDS },
      params: { type: 'object' },
      verificationHints: { type: 'object' },
    },
  })
}

function readCompatibilityActivationPolicy(link) {
  const explicitActivationPolicy = typeof link?.activationPolicy === 'string' ? link.activationPolicy : null
  const explicitPropagationPolicy = typeof link?.propagationPolicy === 'string' ? link.propagationPolicy : null
  const explicitAutomatic = typeof link?.automatic === 'boolean' ? link.automatic : null

  if (WIDGET_LINK_ACTIVATION_POLICIES.includes(explicitActivationPolicy)) {
    return explicitActivationPolicy
  }

  if (explicitPropagationPolicy === 'manual') {
    return 'manual'
  }

  if (explicitAutomatic === false) {
    return 'manual'
  }

  return 'automatic'
}

function readCompatibilityEffectConstraint(link) {
  const explicitEffectConstraint = typeof link?.effectConstraint === 'string' ? link.effectConstraint : null
  const explicitPropagationPolicy = typeof link?.propagationPolicy === 'string' ? link.propagationPolicy : null

  if (WIDGET_LINK_EFFECT_CONSTRAINTS.includes(explicitEffectConstraint)) {
    return explicitEffectConstraint
  }

  if (explicitPropagationPolicy === 'highlightOnly' || explicitPropagationPolicy === 'focusOnly') {
    return explicitPropagationPolicy
  }

  return null
}

export function makeWidgetLink(link) {
  const {
    propagationPolicy: _propagationPolicy,
    automatic: _automatic,
    trigger: _trigger,
    ...publicInput
  } = link || {}
  const explicitPrimitive = typeof link?.primitive === 'string' ? link.primitive : null
  const normalizedKind =
    WIDGET_LINK_KIND_ALIASES[link?.kind]
    || WIDGET_LINK_KIND_ALIASES[explicitPrimitive]
    || link?.kind
    || explicitPrimitive
    || null
  const normalizedPrimitive = explicitPrimitive || normalizedKind
  const normalizedActivationPolicy = readCompatibilityActivationPolicy(link)
  const normalizedEffectConstraint = readCompatibilityEffectConstraint(link)
  const explicitEffect = typeof link?.effect === 'string' ? link.effect : null
  const inferredEffect =
    normalizedPrimitive === 'filter'
      ? 'applyFilter'
      : normalizedPrimitive === 'highlight'
        ? 'applyHighlight'
        : normalizedPrimitive === 'syncDomain'
          ? 'syncDomain'
          : normalizedPrimitive === 'sharesSelection'
            ? 'shareSelection'
            : normalizedPrimitive === 'drillDown' || normalizedPrimitive === 'reencode'
              ? 'transformView'
              : normalizedPrimitive === 'aggregate'
                ? 'transformDataView'
                : normalizedPrimitive === 'structure'
                  ? 'transformStructure'
            : null
  return {
    effect: inferredEffect,
    fieldMapping: [],
    activationPolicy: 'automatic',
    effectConstraint: null,
    responseSpec: null,
    ...publicInput,
    kind: normalizedKind,
    primitive: normalizedPrimitive,
    effect: explicitEffect || inferredEffect,
    activationPolicy: normalizedActivationPolicy,
    effectConstraint: normalizedEffectConstraint,
    responseSpec: link?.responseSpec && typeof link.responseSpec === 'object' && !Array.isArray(link.responseSpec)
      ? cloneValue(link.responseSpec)
      : null,
  }
}

export function normalizeWidgetLink(link) {
  return makeWidgetLink(link)
}

export function stripWidgetLinkCompatibilityFields(link) {
  if (!link || typeof link !== 'object' || Array.isArray(link)) return link
  const {
    propagationPolicy: _propagationPolicy,
    trigger: _trigger,
    automatic: _automatic,
    ...rest
  } = link
  return rest
}

export function describeWidgetLinkSchema() {
  return cloneValue({
    type: 'object',
    required: ['ref'],
    properties: {
      ref: describeRefSchema(),
      kind: describeWidgetLinkKindSchema(),
      from: {
        anyOf: [describeRefSchema(), { type: 'null' }],
      },
      to: {
        anyOf: [describeRefSchema(), { type: 'null' }],
      },
      sourceWidgetId: { type: 'string' },
      targetWidgetId: { type: 'string' },
      sourceRef: {
        anyOf: [describeRefSchema(), { type: 'null' }],
      },
      targetRef: {
        anyOf: [describeRefSchema(), { type: 'null' }],
      },
      sourceDataRef: {
        anyOf: [describeRefSchema(), { type: 'null' }],
      },
      targetDataRef: {
        anyOf: [describeRefSchema(), { type: 'null' }],
      },
      primitive: { type: ['string', 'null'] },
      effect: describeWidgetLinkEffectSchema(),
      description: { type: 'string' },
      fieldMapping: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sourceField: { type: 'string' },
            targetField: { type: 'string' },
          },
        },
      },
      activationPolicy: describeWidgetLinkActivationPolicySchema(),
      effectConstraint: describeWidgetLinkEffectConstraintSchema(),
      responseSpec: {
        anyOf: [describeWidgetLinkAdvancedResponseSchema(), { type: 'null' }],
      },
    },
  })
}

export function describeWorkspaceTopologySummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['topology', 'topologyLabel', 'widgetCount', 'edgeCount', 'linkDensity', 'sourceWidgetCount', 'targetWidgetCount', 'maxOutDegree', 'maxInDegree', 'rationale'],
    properties: {
      topology: { type: 'string' },
      topologyLabel: { type: 'string' },
      widgetCount: { type: 'integer' },
      edgeCount: { type: 'integer' },
      linkDensity: { type: 'number' },
      sourceWidgetCount: { type: 'integer' },
      targetWidgetCount: { type: 'integer' },
      maxOutDegree: { type: 'integer' },
      maxInDegree: { type: 'integer' },
      rationale: { type: 'array', items: { type: 'string' } },
    },
  })
}

export function makeWorkspaceTopologySummary(summary = {}) {
  return {
    topology: summary?.topology || '',
    topologyLabel: summary?.topologyLabel || '',
    widgetCount: summary?.widgetCount || 0,
    edgeCount: summary?.edgeCount || 0,
    linkDensity: summary?.linkDensity || 0,
    sourceWidgetCount: summary?.sourceWidgetCount || 0,
    targetWidgetCount: summary?.targetWidgetCount || 0,
    maxOutDegree: summary?.maxOutDegree || 0,
    maxInDegree: summary?.maxInDegree || 0,
    rationale: Array.isArray(summary?.rationale) ? [...summary.rationale] : [],
  }
}

export function makeLinkEnginePrimitiveEntry(entry = {}) {
  return {
    name: entry?.name || '',
    appliedStatePaths: Array.isArray(entry?.appliedStatePaths) ? [...entry.appliedStatePaths] : [],
  }
}

export function makeLinkEngineCapabilities(capabilities = {}) {
  return {
    propagationExecution: false,
    propagationPlan: false,
    effectCollection: false,
    consistencyEvaluation: false,
    ...capabilities,
  }
}

export function makeLinkEngineSummary(summary = {}) {
  return {
    primitiveCount: summary?.primitiveCount || 0,
    primitives: Array.isArray(summary?.primitives)
      ? summary.primitives.map((entry) => makeLinkEnginePrimitiveEntry(entry))
      : [],
    linkCount: summary?.linkCount || 0,
    coordinationLinkCount: summary?.coordinationLinkCount || 0,
    structuralLinkCount: summary?.structuralLinkCount || 0,
    automaticLinkCount: summary?.automaticLinkCount || 0,
    manualLinkCount: summary?.manualLinkCount || 0,
    topology: makeWorkspaceTopologySummary(summary?.topology),
    capabilities: makeLinkEngineCapabilities(summary?.capabilities),
  }
}

export function describeLinkEngineSummarySchema() {
  return cloneValue({
    type: 'object',
    required: ['primitiveCount', 'primitives', 'linkCount', 'coordinationLinkCount', 'structuralLinkCount', 'automaticLinkCount', 'manualLinkCount', 'topology', 'capabilities'],
    properties: {
      primitiveCount: { type: 'integer' },
      primitives: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            appliedStatePaths: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
      linkCount: { type: 'integer' },
      coordinationLinkCount: { type: 'integer' },
      structuralLinkCount: { type: 'integer' },
      automaticLinkCount: { type: 'integer' },
      manualLinkCount: { type: 'integer' },
      topology: describeWorkspaceTopologySummarySchema(),
      capabilities: {
        type: 'object',
        properties: {
          propagationExecution: { type: 'boolean' },
          propagationPlan: { type: 'boolean' },
          effectCollection: { type: 'boolean' },
          consistencyEvaluation: { type: 'boolean' },
        },
      },
    },
  })
}
