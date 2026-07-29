import { cloneJsonValue as clone } from '../../shared/clone.js'

const runtimeSessionRegistry = new Map()

function makeRuntimeId(prefix = 'runtime') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function makeTimeLabel(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function parseBranchIdFromStateId(stateId) {
  if (typeof stateId !== 'string' || stateId.length === 0) return null
  const [branchId] = stateId.split(':')
  return typeof branchId === 'string' && branchId.length > 0 ? branchId : null
}

function getRuntimeSession(caseId) {
  return runtimeSessionRegistry.get(caseId) || null
}

function readCurrentWorkspaceSnapshotMeta(caseIdOrSession) {
  const session = typeof caseIdOrSession === 'string' ? getRuntimeSession(caseIdOrSession) : caseIdOrSession
  return clone(
    session?.workspace?.readCurrentSnapshotMeta?.()
      || session?.workspace?.readCoordinationState?.()
      || null,
  )
}

function makeTraceBranchId(session) {
  session.traceBranchCounter = Number.isFinite(session.traceBranchCounter) ? session.traceBranchCounter + 1 : 1
  return `trace_branch_${session.traceBranchCounter}`
}

function normalizeTraceTransitionType(value) {
  if (value === 'continuation' || value === 'handoff' || value === 'branch') return value
  return null
}

function buildRuntimeTraceLineage(session, step = {}, nextStepId) {
  const previousStep = Array.isArray(session?.trace) && session.trace.length > 0 ? session.trace.at(-1) : null
  const snapshotMeta = readCurrentWorkspaceSnapshotMeta(session)
  const explicitTransitionType = normalizeTraceTransitionType(step?.transitionType)
  const resultStateId = step?.resultStateId
    || snapshotMeta?.stateId
    || previousStep?.resultStateId
    || null
  const sourceStateId = step?.sourceStateId
    || (
      step?.kind === 'replay'
        ? previousStep?.resultStateId || resultStateId || null
        : previousStep?.resultStateId || resultStateId || null
    )
  const stateDelta = step?.stateDelta || {}
  const actorChanged = Boolean(previousStep?.actor) && previousStep.actor !== (step?.actor || 'system')
  const requestedBranch = Boolean(stateDelta?.branch) || step?.kind === 'branch'
  const replayToHistoricalState = step?.kind === 'replay'
    && typeof resultStateId === 'string'
    && resultStateId.length > 0
    && typeof sourceStateId === 'string'
    && sourceStateId.length > 0
    && resultStateId !== sourceStateId
  const consumesPendingBranch = Boolean(
    session?.pendingTraceBranch
      && step?.kind !== 'replay'
      && sourceStateId
      && session.pendingTraceBranch.sourceStateId === sourceStateId,
  )

  let transitionType = explicitTransitionType
  if (!transitionType) {
    if (replayToHistoricalState || requestedBranch || consumesPendingBranch) transitionType = 'branch'
    else if (actorChanged || step?.handoffFrom) transitionType = 'handoff'
    else transitionType = 'continuation'
  }

  let branchId = step?.branchId
    || snapshotMeta?.branchId
    || parseBranchIdFromStateId(resultStateId)
    || session.currentTraceBranchId
    || 'main'
  let branchFromStateId = step?.branchFromStateId || null
  let parentStepId = step?.parentStepId || previousStep?.id || null

  if (replayToHistoricalState) {
    branchId = step?.branchId || makeTraceBranchId(session)
    branchFromStateId = step?.branchFromStateId || resultStateId
    parentStepId = step?.parentStepId || previousStep?.id || null
    session.pendingTraceBranch = {
      branchId,
      sourceStateId: resultStateId,
      branchFromStateId,
      replayStepId: nextStepId,
    }
    session.currentTraceBranchId = branchId
  } else if (consumesPendingBranch) {
    branchId = step?.branchId || session.pendingTraceBranch.branchId
    branchFromStateId = step?.branchFromStateId || session.pendingTraceBranch.branchFromStateId || session.pendingTraceBranch.sourceStateId || null
    parentStepId = step?.parentStepId || session.pendingTraceBranch.replayStepId || previousStep?.id || null
    session.currentTraceBranchId = branchId
  } else if (transitionType === 'handoff') {
    session.pendingTraceBranch = null
    session.currentTraceBranchId = branchId
  } else {
    if (!step?.branchId && snapshotMeta?.branchId) {
      branchId = snapshotMeta.branchId
    }
    session.currentTraceBranchId = branchId
    if (!replayToHistoricalState && !consumesPendingBranch) {
      session.pendingTraceBranch = null
    }
  }

  return {
    sourceStateId,
    resultStateId,
    transitionType,
    branchId,
    branchFromStateId,
    parentStepId,
  }
}

function registerRuntimeSession(caseId, session) {
  if (typeof caseId !== 'string' || caseId.length === 0 || !session) return null
  runtimeSessionRegistry.set(caseId, session)
  return session
}

function disposeRuntimeSession(caseId) {
  const session = runtimeSessionRegistry.get(caseId)
  if (!session) return false
  session?.runtime?.dispose?.()
  runtimeSessionRegistry.delete(caseId)
  return true
}

function readRuntimeTrace(caseId) {
  return clone(getRuntimeSession(caseId)?.trace || [])
}

function readAgentMessages(caseId) {
  return clone(getRuntimeSession(caseId)?.agentMessages || [])
}

function appendRuntimeTraceStep(caseId, step = {}) {
  const session = getRuntimeSession(caseId)
  if (!session) return null
  const clonedStep = clone(step) || {}
  const nextStepId = step.id || makeRuntimeId('trace')
  const lineage = buildRuntimeTraceLineage(session, clonedStep, nextStepId)
  const nextStep = {
    id: nextStepId,
    actor: step.actor || 'system',
    kind: step.kind || 'action',
    time: step.time || makeTimeLabel(),
    status: step.status || 'ok',
    ...clonedStep,
    ...lineage,
    stateDelta: {
      selection: false,
      focus: false,
      highlight: false,
      viewport: false,
      evidence: false,
      branch: false,
      propagation: false,
      ...(clonedStep.stateDelta || {}),
    },
  }
  session.trace = [...(Array.isArray(session.trace) ? session.trace : []), nextStep].slice(-60)
  return clone(nextStep)
}

function appendAgentMessage(caseId, message = {}) {
  const session = getRuntimeSession(caseId)
  if (!session) return null
  const nextMessage = {
    id: message.id || makeRuntimeId('message'),
    role: message.role || 'assistant',
    text: message.text || '',
    ...clone(message),
  }
  session.agentMessages = [...(Array.isArray(session.agentMessages) ? session.agentMessages : []), nextMessage].slice(-24)
  return clone(nextMessage)
}

export {
  getRuntimeSession,
  registerRuntimeSession,
  disposeRuntimeSession,
  readRuntimeTrace,
  readAgentMessages,
  appendRuntimeTraceStep,
  appendAgentMessage,
}
