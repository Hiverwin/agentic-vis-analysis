import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReplayContextFromFinding, buildReplayContextFromTraceStep, buildTraceNavigationTarget } from './replayState.js'

test('replay state derives stable context from trace steps and findings', () => {
  const stepContext = buildReplayContextFromTraceStep({ id: 'step-1', resultStateId: 'state-2', widgetId: 'bar' })
  assert.equal(stepContext.source, 'trace_step')
  assert.equal(stepContext.stateId, 'state-2')
  assert.equal(stepContext.widgetId, 'bar')

  const findingContext = buildReplayContextFromFinding({ id: 'finding-1', title: 'Interesting', widgetId: 'bar' }, 'state-3')
  assert.equal(findingContext.source, 'finding')
  assert.equal(findingContext.stateId, 'state-3')
  assert.equal(findingContext.findingId, 'finding-1')
  assert.deepEqual(buildTraceNavigationTarget('step-1', 'origin').stepId, 'step-1')
})
