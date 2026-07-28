import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeCanonicalPropagationSkipReason,
} from './propagationReasons.js'

test('normalizeCanonicalPropagationSkipReason maps legacy reasons into canonical coordination vocabulary', () => {
  assert.equal(normalizeCanonicalPropagationSkipReason('manual_activation_policy'), 'manualLink')
  assert.equal(normalizeCanonicalPropagationSkipReason('no_applicable_link'), 'noApplicableLink')
  assert.equal(normalizeCanonicalPropagationSkipReason('mapping_unresolved'), 'mappingUnavailable')
  assert.equal(normalizeCanonicalPropagationSkipReason('unsupported_effect'), 'unsupportedEffect')
})

test('normalizeCanonicalPropagationSkipReason falls back to canonical defaults', () => {
  assert.equal(normalizeCanonicalPropagationSkipReason('unknown_reason'), 'mappingFailed')
  assert.equal(normalizeCanonicalPropagationSkipReason('unknown_reason', 'noApplicableLink'), 'noApplicableLink')
})
