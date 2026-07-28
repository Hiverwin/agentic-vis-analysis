import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeActionResult,
  makeActionVerificationResult,
  makeDataQueryResult,
  makePerceptionResult,
  makeResultError,
} from './result-contracts.js'

test('result contracts normalize action, perception, and data-query results', () => {
  const error = makeResultError({ code: 'INVALID_PARAMS', message: 'bad input' })
  const actionResult = makeActionResult({ callId: 'call_1', actionName: 'scatter.brushRegion', ok: true })
  const perceptionResult = makePerceptionResult({ callId: 'query_1', queryName: 'perception.inspectSelection' })
  const verification = makeActionVerificationResult({ matchedActionName: 'scatter.brushRegion' })
  const dataQueryResult = makeDataQueryResult({ dataRef: 'wl://widgetva-app/workspace/main/data/current_view' })

  assert.equal(error.code, 'INVALID_PARAMS')
  assert.deepEqual(actionResult.updatedRefs, [])
  assert.equal(perceptionResult.queryName, 'perception.inspectSelection')
  assert.equal(verification.verified, false)
  assert.deepEqual(verification.linkPropagation, [])
  assert.equal(dataQueryResult.dataRef, 'wl://widgetva-app/workspace/main/data/current_view')
})
