import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createAgentTargetPort,
  resolveAgentTargetPort,
} from './agentTargetPort.js'

test('createAgentTargetPort forwards readObservation instead of constructing observation from state', async () => {
  const calls = []
  const target = {
    readObservation(options = {}) {
      calls.push(['readObservation', options])
      return {
        query: options?.query || null,
        state: {
          widgets: [],
        },
        view: null,
      }
    },
    readState() {
      calls.push('readState')
      return {
        stateId: 'state_should_not_be_read',
      }
    },
  }

  const port = createAgentTargetPort(target, { objective: 'Inspect the view.' })

  assert.equal(typeof port?.readObservation, 'function')
  assert.equal('readAgentObservation' in port, false)
  assert.deepEqual(await port.readObservation({ query: 'Inspect the view.' }), {
    query: 'Inspect the view.',
    state: {
      widgets: [],
    },
    view: null,
  })
  assert.deepEqual(calls, [['readObservation', { query: 'Inspect the view.' }]])
})

test('resolveAgentTargetPort rejects targets that cannot provide agent-facing readObservation', () => {
  assert.equal(createAgentTargetPort({
    readState() {
      return { stateId: 'state_a' }
    },
  }), null)

  assert.throws(
    () => resolveAgentTargetPort({
      readState() {
        return { stateId: 'state_a' }
      },
    }),
    /readObservation\(\)/,
  )
})
