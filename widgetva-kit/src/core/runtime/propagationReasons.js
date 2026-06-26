export const PROPAGATION_SKIP_REASONS = [
  'missing_target_ref',
  'manual_activation_policy',
  'missing_target_widget',
  'unsupported_effect',
  'unsupported_advanced_response',
  'advanced_response_params_invalid',
  'advanced_response_verification_unavailable',
  'no_active_selection',
  'mapping_unresolved',
  'effect_not_applied',
  'no_applicable_link',
]

export function normalizePropagationSkipReason(reason, fallback = 'effect_not_applied') {
  return PROPAGATION_SKIP_REASONS.includes(reason) ? reason : fallback
}

export const CANONICAL_PROPAGATION_SKIP_REASONS = [
  'noApplicableLink',
  'manualLink',
  'sourceMismatch',
  'mappingUnavailable',
  'mappingFailed',
  'unsupportedEffect',
  'effectDowngradeUnavailable',
  'constraintBlocked',
]

const PROPAGATION_SKIP_REASON_ALIASES = {
  missing_target_ref: 'sourceMismatch',
  manual_activation_policy: 'manualLink',
  missing_target_widget: 'sourceMismatch',
  unsupported_effect: 'unsupportedEffect',
  unsupported_advanced_response: 'unsupportedEffect',
  advanced_response_params_invalid: 'mappingFailed',
  advanced_response_verification_unavailable: 'mappingFailed',
  no_active_selection: 'sourceMismatch',
  mapping_unresolved: 'mappingUnavailable',
  effect_not_applied: 'mappingFailed',
  no_applicable_link: 'noApplicableLink',
}

export function normalizeCanonicalPropagationSkipReason(reason, fallback = 'mappingFailed') {
  if (CANONICAL_PROPAGATION_SKIP_REASONS.includes(reason)) return reason
  if (typeof reason === 'string' && reason in PROPAGATION_SKIP_REASON_ALIASES) {
    return PROPAGATION_SKIP_REASON_ALIASES[reason]
  }
  if (CANONICAL_PROPAGATION_SKIP_REASONS.includes(fallback)) return fallback
  if (typeof fallback === 'string' && fallback in PROPAGATION_SKIP_REASON_ALIASES) {
    return PROPAGATION_SKIP_REASON_ALIASES[fallback]
  }
  return 'mappingFailed'
}

export function isLegacyPropagationSkipReason(reason, expectedLegacyReason) {
  return reason === expectedLegacyReason
}
