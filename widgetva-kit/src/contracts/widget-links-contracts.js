import {
  WIDGET_LINK_ACTIVATION_POLICIES,
  WIDGET_LINK_EFFECT_CONSTRAINTS,
} from '../schemas/widget-links.schema.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

const WIDGET_LINK_KIND_ALIASES = {
  filters: 'filter',
  highlights: 'highlight',
  syncsDomain: 'syncDomain',
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
  const normalizedKind =
    WIDGET_LINK_KIND_ALIASES[link?.kind]
    || link?.kind
    || null
  const normalizedActivationPolicy = readCompatibilityActivationPolicy(link)
  const normalizedEffectConstraint = readCompatibilityEffectConstraint(link)
  const explicitEffect = typeof link?.effect === 'string' ? link.effect : null
  const inferredEffect =
    normalizedKind === 'filter'
      ? 'applyFilter'
      : normalizedKind === 'highlight'
        ? 'applyHighlight'
        : normalizedKind === 'syncDomain'
          ? 'syncDomain'
          : normalizedKind === 'sharesSelection'
            ? 'shareSelection'
            : normalizedKind === 'drillDown' || normalizedKind === 'reencode'
              ? 'transformView'
              : normalizedKind === 'aggregate'
                ? 'transformDataView'
                : normalizedKind === 'structure'
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
