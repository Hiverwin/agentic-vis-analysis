import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFormalActPayload,
  buildFormalVerifyPayload,
  summarizeFormalRuntimePayload,
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

test('runtime payload summary exposes nested perception evidence values', () => {
  assert.equal(
    summarizeFormalRuntimePayload({
      result: {
        dataRef: 'wl://demo/workspace/main/data/scatter_visible',
        xField: 'Horsepower',
        yField: 'Miles_per_Gallon',
        correlation: -0.78,
        sampleSize: 392,
      },
    }),
    'correlation=-0.78; n=392; xField=Horsepower; yField=Miles_per_Gallon',
  )

  assert.equal(
    summarizeFormalRuntimePayload({
      result: {
        rowCount: 1000,
        groups: [
          { group: 'group E', count: 140, mean: 73.82142857142857 },
          { group: 'group A', count: 89, mean: 61.62921348314607 },
        ],
      },
    }),
    '1000 rows; group E count=140 mean=73.8214; group A count=89 mean=61.6292',
  )
})

test('formal perception act fingerprints but does not retain the full runtime result', () => {
  const result = {
    dataRef: 'wl://demo/workspace/main/data/students_visible',
    rowCount: 1000,
    groups: [
      { 'race/ethnicity': 'group A', count: 89, mathMean: 61.63 },
      { 'race/ethnicity': 'group C', count: 319, mathMean: 64.46 },
    ],
  }

  const act = buildFormalActPayload({
    operation: {
      kind: 'perception',
      name: 'perception.summarizeVisible',
      target: { widgetRef: 'wl://widgetva-app/workspace/students/widget/w_students_bar' },
      params: {
        groupBy: ['race/ethnicity'],
        fields: ['math score'],
        metrics: ['count', 'mean'],
      },
    },
  }, {
    ok: true,
    queryName: 'perception.summarizeVisible',
    result,
  })

  assert.equal('result' in act, false)
  assert.match(act.resultFingerprint, /^fnv1a32:/)

  const repeatedAct = buildFormalActPayload({
    operation: {
      kind: 'perception',
      name: 'perception.summarizeVisible',
    },
  }, { ok: true, result })
  assert.equal(repeatedAct.resultFingerprint, act.resultFingerprint)
})

test('runtime payload summary exposes ranked rows, anomaly, and sankey evidence', () => {
  assert.equal(
    summarizeFormalRuntimePayload({
      result: {
        field: 'Visitors',
        direction: 'max',
        rows: [
          { Date: '2026-03-09', Visitors: 30 },
          { Date: '2026-03-08', Visitors: 22 },
        ],
      },
    }),
    'max Visitors: 2026-03-09 Visitors=30; 2026-03-08 Visitors=22',
  )

  assert.equal(
    summarizeFormalRuntimePayload({
      result: {
        anomaly_count: 1,
        anomalies: [{ Date: '2026-03-09', Signal: 30 }],
        stats: { yField: 'Signal', xField: 'Date', mean: 9, sample_size: 10 },
      },
    }),
    '1 anomalies for Signal; 2026-03-09 Signal=30; mean=9; sampleSize=10',
  )

  assert.equal(
    summarizeFormalRuntimePayload({
      result: {
        conversion: {
          node: 'Checkout',
          inflow: 100,
          outflow: 64,
          rate: 0.64,
          loss: 36,
          loss_rate: 0.36,
        },
      },
    }),
    'Checkout conversion rate=0.64; inflow=100; outflow=64; loss=36; lossRate=0.36',
  )

  assert.equal(
    summarizeFormalRuntimePayload({
      result: {
        message: 'Extracted 12 nodes across 4 layers',
      },
    }),
    'Extracted 12 nodes across 4 layers',
  )
})

test('runtime payload fallback preserves semantic scalar evidence after the old 220-character boundary', () => {
  const result = summarizeFormalRuntimePayload({
    result: {
      description: 'x'.repeat(240),
      decisiveValue: 42.75,
    },
  })

  assert.match(result, /"decisiveValue":42\.75/)
})
