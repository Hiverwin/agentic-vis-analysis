const controls = new Map()

function getControl(sessionKey) {
  if (!controls.has(sessionKey)) {
    controls.set(sessionKey, { pauseRequested: false, waiters: new Set() })
  }
  return controls.get(sessionKey)
}

export function beginAgentSessionControl(sessionKey) {
  const control = getControl(sessionKey)
  control.pauseRequested = false
  return control
}

export function requestAgentSessionPause(sessionKey) {
  getControl(sessionKey).pauseRequested = true
}

export function resumeAgentSession(sessionKey) {
  const control = getControl(sessionKey)
  control.pauseRequested = false
  for (const resolve of control.waiters) resolve()
  control.waiters.clear()
}

export function isAgentSessionPauseRequested(sessionKey) {
  return getControl(sessionKey).pauseRequested
}

export async function waitForAgentSessionResume(sessionKey) {
  const control = getControl(sessionKey)
  if (!control.pauseRequested) return
  await new Promise((resolve) => control.waiters.add(resolve))
}

export function clearAgentSessionControl(sessionKey) {
  const control = controls.get(sessionKey)
  if (!control) return
  for (const resolve of control.waiters) resolve()
  controls.delete(sessionKey)
}
