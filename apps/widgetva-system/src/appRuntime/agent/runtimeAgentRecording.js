import { cloneJsonValue as clone } from '../../shared/clone.js'

function normalizeMessageText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function appendAgentMessageOnce(runtime, message = {}) {
  const text = normalizeMessageText(message.text)
  if (!text) return null
  const role = message.role || 'assistant'
  const messages = typeof runtime.readAgentMessages === 'function'
    ? runtime.readAgentMessages()
    : []
  const lastMessage = Array.isArray(messages) && messages.length > 0 ? messages.at(-1) : null
  if (lastMessage?.role === role && normalizeMessageText(lastMessage?.text) === text) {
    return lastMessage
  }
  return runtime.appendAgentMessage({
    ...message,
    role,
    text,
  })
}

function buildAgentTraceOperationFromTurn(turn = {}) {
  const step = turn?.plan?.step || {}
  return {
    kind: step.kind || turn?.act?.kind || null,
    name: step.name || turn?.act?.name || null,
    target: clone(step.target || turn?.act?.target || null),
    queryScope: clone(step.queryScope || turn?.act?.queryScope || null),
    assistantMessage: turn?.reason?.answer || null,
    rationale: turn?.plan?.rationale || '',
  }
}

function appendFirstPartyAgentTraceStep(runtime, {
  operation,
  act,
  verify,
  observe,
} = {}) {
  const latestCoordination = runtime.readLatestCoordinationResult()
  const widgetRef = operation?.target?.widgetRef || null
  const description = typeof runtime.describeWorkspace === 'function' ? runtime.describeWorkspace() : null
  const widgetTitle = (Array.isArray(description?.widgets)
    ? description.widgets.find((widget) => widget?.ref === widgetRef || widget?.widgetId === widgetRef)?.title
    : null) || operation?.name || 'Workspace'
  return runtime.appendTraceStep({
    actor: 'agent',
    kind: operation?.kind || 'action',
    widgetTitle,
    methodName: operation?.name || operation?.query?.kind || 'agent.step',
    summary: operation?.assistantMessage || 'Completed one agent step.',
    detail: operation?.rationale || `Executed ${operation?.kind || 'step'}.`,
    verificationSummary: verify?.summary || latestCoordination?.verification?.summary || null,
    evidenceSummary: act?.outputSummary || null,
    target: operation?.target || null,
    queryScope: operation?.queryScope || null,
    updatedRefs: act?.updatedRefs || [],
    sourceStateId: observe?.state?.stateId || null,
    resultStateId: act?.stateId || observe?.state?.stateId || null,
    stateDelta: {
      selection: operation?.kind === 'action',
      focus: operation?.kind === 'action' && operation?.name === 'workspace.focusWidget',
      highlight: operation?.kind === 'perception',
      viewport: false,
      evidence: operation?.kind !== 'action',
      branch: false,
      propagation: Boolean(latestCoordination?.propagationSummary?.active),
    },
  })
}

export function recordAgentTurnResultOnRuntime(runtime, {
  query = null,
  turn = null,
  sessionKnowledge = null,
} = {}) {
  if (typeof query === 'string' && query.length > 0) {
    appendAgentMessageOnce(runtime, {
      role: 'user',
      text: query,
    })
  }
  if (typeof turn?.reason?.answer === 'string' && turn.reason.answer.length > 0) {
    appendAgentMessageOnce(runtime, {
      role: 'assistant',
      text: turn.reason.answer,
    })
  }

  return appendFirstPartyAgentTraceStep(runtime, {
    operation: buildAgentTraceOperationFromTurn(turn),
    act: turn?.act || null,
    verify: turn?.verify || null,
    observe: turn?.observe || null,
  })
}

export function recordAgentSessionResultOnRuntime(runtime, {
  query = null,
  result = null,
  fallbackKnowledge = null,
} = {}) {
  if (typeof query === 'string' && query.length > 0) {
    appendAgentMessageOnce(runtime, {
      role: 'user',
      text: query,
    })
  }
  for (const turn of Array.isArray(result?.turns) ? result.turns : []) {
    if (typeof turn?.reason?.answer !== 'string' || turn.reason.answer.length === 0) continue
    appendAgentMessageOnce(runtime, {
      role: 'assistant',
      text: turn.reason.answer,
    })
  }

  let lastTrace = null
  for (const turn of Array.isArray(result?.turns) ? result.turns : []) {
    lastTrace = appendFirstPartyAgentTraceStep(runtime, {
      operation: buildAgentTraceOperationFromTurn(turn),
      act: turn?.act || null,
      verify: turn?.verify || null,
      observe: turn?.observe || null,
    })
  }
  return lastTrace
}
