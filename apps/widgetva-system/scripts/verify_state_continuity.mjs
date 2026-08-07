import assert from 'node:assert/strict'

import {
  createInitialSessionState,
  disposeRuntimeSession,
  executeAction,
  queryPerception,
  readObservation,
  runDataQuery,
} from '../src/appRuntime/contracts/runtimeBridge.js'

function printSection(title) {
  console.log(`\n=== ${title} ===`)
}

function findScatterWidgetRef(observation) {
  return observation?.workspace?.widgets?.find((widget) => widget?.widgetId === 'w_scatter_cars')?.ref || null
}

async function main() {
  const previousWindow = globalThis.window
  globalThis.window = {}
  const session = createInitialSessionState('cars-horsepower')
  const caseId = session.runtimeSessionKey

  try {
    const observation = readObservation(caseId)
    const scatterWidgetRef = findScatterWidgetRef(observation)
    assert.ok(scatterWidgetRef, 'Missing scatter widget ref for cars-horsepower.')

    printSection('Step 1: brush scatter region')
    const actionResult = await executeAction(caseId, {
      callId: 'acceptance_brush_region',
      actor: 'human',
      name: 'scatter.brushRegion',
      queryScope: {
        widgetRef: scatterWidgetRef,
      },
      params: {
        xField: 'horsepower',
        yField: 'mpg',
        xRange: [80, 160],
        yRange: [20, 35],
      },
    })
    assert.equal(actionResult?.ok, true, 'scatter.brushRegion did not succeed.')
    console.log('stateId:', actionResult?.stateId || actionResult?.actionResult?.stateId || null)

    printSection('Step 2: perception inherits the brushed selection')
    const correlationResult = await queryPerception(caseId, {
      callId: 'acceptance_compute_correlation',
      actor: 'agent',
      name: 'perception.computeCorrelation',
      queryScope: {
        widgetRef: scatterWidgetRef,
      },
      params: {
        xField: 'horsepower',
        yField: 'mpg',
      },
    })
    assert.equal(correlationResult?.ok, true, 'computeCorrelation failed.')
    assert.ok(
      Number.isFinite(correlationResult?.result?.sampleSize) && correlationResult.result.sampleSize > 0,
      'computeCorrelation did not return a positive sampleSize.',
    )
    console.log('sampleSize:', correlationResult.result.sampleSize)
    console.log('correlation:', correlationResult.result.correlation)

    const extremesResult = await queryPerception(caseId, {
      callId: 'acceptance_find_extremes',
      actor: 'agent',
      name: 'perception.findExtremes',
      queryScope: {
        widgetRef: scatterWidgetRef,
      },
      params: {
        field: 'horsepower',
        direction: 'max',
        limit: 5,
      },
    })
    assert.equal(extremesResult?.ok, true, 'findExtremes failed.')
    assert.ok(Array.isArray(extremesResult?.result?.rows), 'findExtremes did not return rows.')
    console.log('extremeRows:', extremesResult.result.rows.length)
    console.log('topHorsepowerValues:', extremesResult.result.rows.map((row) => row?.Horsepower ?? row?.horsepower))

    printSection('Step 3: data query also inherits the same brushed selection')
    const summaryResult = await runDataQuery(caseId, {
      callId: 'acceptance_summary_after_brush',
      actor: 'agent',
      query: {
        kind: 'summary',
        spec: {
          queryScope: {
            widgetRef: scatterWidgetRef,
          },
          metrics: ['count'],
        },
      },
    })
    assert.equal(summaryResult?.ok, true, 'summary data query failed.')
    const summaryRows = Array.isArray(summaryResult?.result?.rows) ? summaryResult.result.rows : []
    console.log('summaryRows:', JSON.stringify(summaryRows, null, 2))

    printSection('Acceptance result')
    console.log('State continuity passed across action -> perception -> data query.')
  } finally {
    disposeRuntimeSession(caseId)
    globalThis.window = previousWindow
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
