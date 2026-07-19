import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFormalActPayload,
  buildFormalVerifyPayload,
} from './turnPayloads.js'

test('formal act and verification payloads preserve runtime action errors and required params', () => {
  const plan = {
    operation: {
      kind: 'action',
      name: 'line.boldLines',
      target: {
        widgetRef: 'wl://widgetva-app/workspace/imported/widget/w_line',
      },
      params: {},
    },
  }
  const act = buildFormalActPayload(plan, {
    ok: false,
    actionResult: {
      ok: false,
      error: {
        code: 'INVALID_PARAMS',
        message: 'params must have required property lineNames',
        details: {
          requiredParams: ['lineNames'],
        },
      },
      recoveryHints: ['Provide the required params for line.boldLines: lineNames.'],
    },
  })
  const verify = buildFormalVerifyPayload({
    plan,
    act,
    verification: null,
    observe: {
      state: {
        stateId: 'imported:s1',
      },
    },
  })

  assert.equal(act.ok, false)
  assert.deepEqual(act.target, { widgetRef: 'wl://widgetva-app/workspace/imported/widget/w_line' })
  assert.equal(act.outputSummary, 'params must have required property lineNames')
  assert.equal(act.error.code, 'INVALID_PARAMS')
  assert.deepEqual(act.error.details.requiredParams, ['lineNames'])
  assert.deepEqual(act.recoveryHints, ['Provide the required params for line.boldLines: lineNames.'])
  assert.equal(verify.checks.stepChoice.summary, 'params must have required property lineNames')
  assert.equal(verify.checks.params.summary, 'Missing required parameters: lineNames.')
})

test('formal verification prefers explicit visual verification failure over wrapper ok', () => {
  const plan = {
    operation: {
      kind: 'action',
      name: 'line.selectSeries',
      target: {
        widgetRef: 'wl://widgetva-app/workspace/imported/widget/w_line',
      },
      params: {
        field: 'region',
        values: ['Downtown'],
      },
    },
  }
  const act = buildFormalActPayload(plan, {
    ok: true,
    actionResult: {
      ok: true,
      stateId: 'imported:s4',
    },
  })
  const verify = buildFormalVerifyPayload({
    plan,
    act,
    verification: {
      ok: true,
      result: {
        verified: false,
        summary: 'The runtime state changed, but the page did not show the selected series.',
      },
    },
    observe: {
      state: {
        stateId: 'imported:s3',
      },
    },
  })

  assert.equal(verify.ok, false)
  assert.equal(verify.checks.visualChange.ok, false)
})

test('formal act payload preserves recoverable action state for trace replay', () => {
  const plan = {
    operation: {
      kind: 'action',
      name: 'bar.filterCategories',
      params: {
        field: 'weather',
        categories: ['rain'],
      },
    },
  }
  const act = buildFormalActPayload(plan, {
    ok: true,
    actionResult: {
      ok: true,
      stateId: 'weather:s1',
      recoverableState: {
        stateId: 'weather:s1',
        shared: {
          activeSelections: {
            weather: {
              selectionId: 'weather',
              value: { weather: 'rain' },
            },
          },
        },
      },
    },
  })

  assert.equal(act.stateId, 'weather:s1')
  assert.deepEqual(act.recoverableState.shared.activeSelections.weather.value, { weather: 'rain' })
})
