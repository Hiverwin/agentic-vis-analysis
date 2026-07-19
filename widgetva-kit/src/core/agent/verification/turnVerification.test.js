import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTurnVerificationFeedback } from './turnVerification.js'

test('buildTurnVerificationFeedback reports missing required params with retry guidance', () => {
  const verify = buildTurnVerificationFeedback({
    operationKind: 'action',
    act: {
      kind: 'action',
      ok: true,
      stateId: 'main:s2',
      outputSummary: 'Action executed.',
    },
    beforeStateId: 'main:s1',
    requiredParams: ['xField', 'yField'],
    providedParams: {
      xField: 'Horsepower',
    },
    usageConfirmed: true,
    verificationOk: null,
    verificationSummary: null,
  })

  assert.equal(verify.ok, false)
  assert.equal(verify.checks.params.ok, false)
  assert.equal(verify.guidance, 'Re-check required parameters before retrying this step.')
})

test('buildTurnVerificationFeedback reports unconfirmed action selection with action-surface guidance', () => {
  const verify = buildTurnVerificationFeedback({
    operationKind: 'action',
    act: {
      kind: 'action',
      ok: true,
      stateId: 'main:s2',
      outputSummary: 'Action executed.',
    },
    beforeStateId: 'main:s1',
    requiredParams: [],
    providedParams: {},
    usageConfirmed: false,
    verificationOk: null,
    verificationSummary: null,
  })

  assert.equal(verify.ok, false)
  assert.equal(verify.checks.stepChoice.ok, false)
  assert.equal(verify.guidance, 'Re-check whether the target widget actually exposes this step before retrying.')
})

test('buildTurnVerificationFeedback prefers visual verification failures over generic success', () => {
  const verify = buildTurnVerificationFeedback({
    operationKind: 'action',
    act: {
      kind: 'action',
      ok: true,
      stateId: 'main:s2',
      outputSummary: 'Action executed.',
    },
    beforeStateId: 'main:s1',
    requiredParams: [],
    providedParams: {},
    usageConfirmed: true,
    verificationOk: false,
    verificationSummary: 'Verification reported that the visible effect was not achieved.',
  })

  assert.equal(verify.ok, false)
  assert.equal(verify.checks.visualChange.ok, false)
  assert.equal(verify.summary, 'Verification reported that the visible effect was not achieved.')
  assert.equal(verify.guidance, 'Try a narrower or better-scoped action, then verify the visible effect again.')
})

test('buildTurnVerificationFeedback does not report visual success when the action failed', () => {
  const verify = buildTurnVerificationFeedback({
    operationKind: 'action',
    act: {
      kind: 'action',
      ok: false,
      outputSummary: 'Unsupported action.',
    },
    beforeStateId: 'main:s1',
    requiredParams: [],
    providedParams: {},
    usageConfirmed: true,
    verificationOk: true,
    verificationSummary: 'Runtime trace matched the action.',
  })

  assert.equal(verify.ok, false)
  assert.equal(verify.checks.stepChoice.ok, false)
  assert.equal(verify.checks.visualChange.ok, null)
  assert.equal(verify.checks.visualChange.summary, 'Visual verification was skipped because the action did not execute successfully.')
  assert.equal(verify.summary, 'The selected step did not execute successfully.')
})

test('buildTurnVerificationFeedback lets successful perception turns answer directly', () => {
  const verify = buildTurnVerificationFeedback({
    operationKind: 'perception',
    act: {
      kind: 'perception',
      ok: true,
      stateId: null,
      outputSummary: 'Correlation is -0.78.',
    },
    beforeStateId: 'main:s1',
    requiredParams: [],
    providedParams: {
      xField: 'Horsepower',
      yField: 'Miles_per_Gallon',
    },
    usageConfirmed: null,
    verificationOk: null,
    verificationSummary: null,
  })

  assert.equal(verify.ok, true)
  assert.equal(verify.checks.stepChoice.ok, true)
  assert.equal(verify.checks.stateChange.ok, null)
  assert.equal(verify.guidance, 'This turn verified cleanly enough to answer unless the query explicitly requires another step.')
})
