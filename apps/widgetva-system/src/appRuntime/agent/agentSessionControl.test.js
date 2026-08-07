import test from 'node:test'
import assert from 'node:assert/strict'

import {
  beginAgentSessionControl,
  clearAgentSessionControl,
  isAgentSessionPauseRequested,
  requestAgentSessionPause,
  resumeAgentSession,
  waitForAgentSessionResume,
} from './agentSessionControl.js'

test('pauses a running agent session only until it is resumed', async () => {
  const sessionKey = 'agent-session-control-test'
  beginAgentSessionControl(sessionKey)
  requestAgentSessionPause(sessionKey)

  assert.equal(isAgentSessionPauseRequested(sessionKey), true)
  let resumed = false
  const waiting = waitForAgentSessionResume(sessionKey).then(() => { resumed = true })
  await Promise.resolve()
  assert.equal(resumed, false)

  resumeAgentSession(sessionKey)
  await waiting
  assert.equal(resumed, true)
  assert.equal(isAgentSessionPauseRequested(sessionKey), false)
  clearAgentSessionControl(sessionKey)
})
