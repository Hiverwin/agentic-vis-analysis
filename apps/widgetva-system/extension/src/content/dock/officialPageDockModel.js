function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function compactNames(items = []) {
  return Array.from(new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => (typeof item === 'string' ? item : item?.name))
      .filter((name) => typeof name === 'string' && name.length > 0),
  ))
}

function labelWidget(widget = null) {
  if (!widget || typeof widget !== 'object') return 'Widget'
  return widget.title || widget.name || widget.ref || widget.widgetId || widget.kind || 'Widget'
}

function labelLink(link = null) {
  if (!link || typeof link !== 'object') return 'link'
  const source = link.sourceAction
    || link.sourceStep
    || link.sourceStateRef
    || link.sourceWidgetId
    || link.sourceRef
    || link.source
    || 'source'
  const target = link.targetAction
    || link.targetStep
    || link.targetStateRef
    || link.targetWidgetId
    || link.targetRef
    || link.target
    || 'target'
  return `${source} -> ${target}`
}

function compactLinks(links = []) {
  const buckets = new Map()
  for (const link of Array.isArray(links) ? links : []) {
    const kind = link?.kind || link?.relation || null
    const source = link?.sourceAction || link?.sourceWidgetId || link?.sourceRef || link?.source || null
    const target = link?.targetAction || link?.targetWidgetId || link?.targetRef || link?.target || null
    const genericPair = (!source || source === 'source') && (!target || target === 'target')
    const label = kind === 'sharesSelection' && genericPair
      ? 'Shared selection across views'
      : labelLink(link)
    const key = [kind || '', label, source || '', target || ''].join('\u0000')
    const existing = buckets.get(key)
    if (existing) {
      existing.count += 1
    } else {
      buckets.set(key, {
        label,
        kind,
        source,
        target,
        count: 1,
      })
    }
  }
  return Array.from(buckets.values())
}

export function extractDockWorkspaceSummary(snapshot = {}) {
  const workspace = snapshot?.workspace && typeof snapshot.workspace === 'object'
    ? snapshot.workspace
    : {}
  const widget = Array.isArray(workspace.widgets) ? workspace.widgets[0] || null : null
  const actions = compactNames(workspace.actions)
  const perceptions = compactNames(
    workspace.perceptionQueries || workspace.perceptions || workspace.queries,
  )
  const links = compactLinks(workspace.links)

  return {
    widget: widget
      ? {
          ref: widget.ref || widget.widgetRef || null,
          kind: widget.kind || widget.family || widget.type || null,
          label: labelWidget(widget),
        }
      : {
          ref: null,
          kind: null,
          label: 'Widget',
        },
    links,
    tools: {
      actions,
      perceptions,
    },
  }
}

function readAct(turn = {}) {
  return turn?.act && typeof turn.act === 'object' ? turn.act : {}
}

function readPlanStep(turn = {}) {
  return turn?.plan?.step && typeof turn.plan.step === 'object' ? turn.plan.step : {}
}

function readOperation(turn = {}) {
  const act = readAct(turn)
  const step = readPlanStep(turn)
  return {
    kind: act.kind || step.kind || null,
    name: act.name || step.name || null,
    params: clone(act.params || step.params || {}),
  }
}

function readObservedState(turn = {}) {
  const observedState = turn?.observe?.state || turn?.observe?.observation?.state || null
  return observedState && typeof observedState === 'object' && !Array.isArray(observedState)
    ? clone(observedState)
    : null
}

function readObservedStateId(turn = {}) {
  return readObservedState(turn)?.stateId || null
}

function readSnapshotRecoverableState(snapshot = {}) {
  const recoverableState = snapshot?.recoverableState || snapshot?.state?.recoverableState || null
  if (recoverableState && typeof recoverableState === 'object' && !Array.isArray(recoverableState)) {
    return clone(recoverableState)
  }
  return null
}

function readStateId(turn = {}, fallbackStateId = null) {
  const act = readAct(turn)
  return act.stateId
    || act?.result?.actionResult?.stateId
    || act?.result?.stateId
    || turn?.result?.actionResult?.stateId
    || turn?.result?.stateId
    || turn?.verify?.stateId
    || turn?.verify?.afterStateId
    || turn?.verification?.stateId
    || fallbackStateId
    || null
}

function readUpdatedRefs(turn = {}) {
  const act = readAct(turn)
  if (Array.isArray(act.updatedRefs)) return clone(act.updatedRefs)
  if (Array.isArray(act.affectedRefs)) return clone(act.affectedRefs)
  if (Array.isArray(act?.result?.actionResult?.updatedRefs)) return clone(act.result.actionResult.updatedRefs)
  if (Array.isArray(act?.result?.updatedRefs)) return clone(act.result.updatedRefs)
  if (Array.isArray(turn?.result?.actionResult?.updatedRefs)) return clone(turn.result.actionResult.updatedRefs)
  if (Array.isArray(turn?.result?.updatedRefs)) return clone(turn.result.updatedRefs)
  if (Array.isArray(turn?.verify?.updatedRefs)) return clone(turn.verify.updatedRefs)
  return []
}

function readRecoverableState(turn = {}, stateId = null) {
  const act = readAct(turn)
  return clone(
    act.recoverableState
    || act?.result?.actionResult?.recoverableState
    || act?.result?.recoverableState
    || act?.result?.afterView
    || act?.result?.finalSnapshot
    || turn?.result?.actionResult?.recoverableState
    || turn?.result?.recoverableState
    || turn?.result?.afterView
    || turn?.result?.finalSnapshot
    || turn?.verify?.afterView
    || turn?.verify?.finalSnapshot
    || turn?.verification?.afterView
    || turn?.verification?.finalSnapshot
    || (stateId ? { stateId } : null),
  )
}

function readStatus(turn = {}) {
  const act = readAct(turn)
  if (act.ok === false || turn?.verify?.ok === false) return 'failed'
  if (act.ok === null || turn?.verify?.ok === null) return 'running'
  return 'success'
}

function summarizeState({ stateId, updatedRefs, verifySummary } = {}) {
  if (stateId && updatedRefs.length > 0) {
    return `State ${stateId} updated ${updatedRefs.join(', ')}.`
  }
  if (stateId) return `State ${stateId}.`
  if (typeof verifySummary === 'string' && verifySummary.length > 0) return verifySummary
  return 'State summary unavailable.'
}

function buildInitialStateStep(turn = {}, snapshot = {}) {
  const observedState = readObservedState(turn)
  const recoverableState = readSnapshotRecoverableState(snapshot) || observedState || null
  const stateId = recoverableState?.stateId || observedState?.stateId || null
  if (!recoverableState && !stateId) return null
  return {
    id: 'state_0',
    label: 'State 0',
    status: 'success',
    operation: {
      kind: null,
      name: null,
      params: {},
    },
    state: {
      stateId,
      recoverableState: recoverableState || (stateId ? { stateId } : null),
      updatedRefs: [],
      summary: stateId ? `Initial state ${stateId}.` : 'Initial state.',
    },
    reply: '',
    rawTurn: null,
  }
}

export function buildDockTraceSteps({
  session = {},
  snapshot = {},
} = {}) {
  const fallbackStateId = snapshot?.state?.stateId || snapshot?.observation?.state?.stateId || null
  const turns = Array.isArray(session?.turns) ? session.turns : []
  const initialStep = turns.length > 0 ? buildInitialStateStep(turns[0], snapshot) : null
  const actionSteps = turns.map((turn, index) => {
    const operation = readOperation(turn)
    const stateId = readStateId(turn, index === 0 ? (fallbackStateId || readObservedStateId(turn)) : null)
    const updatedRefs = readUpdatedRefs(turn)
    const recoverableState = readRecoverableState(turn, stateId)
    const verifySummary = turn?.verify?.summary || turn?.verification?.summary || null
    return {
      id: `state_${index + 1}`,
      label: `State ${index + 1}`,
      status: readStatus(turn),
      operation,
      state: {
        stateId,
        recoverableState,
        updatedRefs,
        summary: summarizeState({ stateId, updatedRefs, verifySummary }),
      },
      reply: turn?.reason?.answer || turn?.plan?.assistantMessage || '',
      rawTurn: clone(turn),
    }
  })
  return initialStep ? [initialStep, ...actionSteps] : actionSteps
}
