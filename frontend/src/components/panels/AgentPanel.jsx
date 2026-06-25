import { useCallback, useEffect, useRef, useState } from 'react'
import { streamQuery, resetView, exportSession, interruptSession } from '../../api/client.js'
import { agentLoopDescribe, listAgentResponses, recordAgentResponse } from 'widgetva-kit/transport-execute'
import t from '../../locale.js'
import IterationCard from '../agent/IterationCard.jsx'
import { buildTraceItemsFromAgentResponses } from '../agent/runtimeResponseTrace.js'
import { useAppStore } from '../../state/appStore.js'
import { useRuntimeStoreVersion } from '../devtools/useRuntimeStoreVersion.js'

const HIDDEN_TOOL_NAMES = new Set(['reset_view', 'undo_view'])
const PHASE_ORDER = ['observe', 'plan', 'act', 'verify', 'reason']

function ChatMessage({ msg, id }) {
  const cls = msg.role === 'user' ? 'bubble bubble-user'
    : msg.role === 'error' ? 'bubble bubble-error'
    : msg.role === 'system' ? 'bubble bubble-system'
    : 'bubble bubble-assistant'
  return (
    <div className="flex" style={{ flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }} id={id}>
      <div className={cls} style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
    </div>
  )
}

function createEmptyIteration(iterKey, serverIteration, runId, mode = '') {
  return {
    iterKey,
    runId,
    iteration: serverIteration,
    serverIteration,
    mode,
    status: 'running',
    activePhase: 'observe',
    stopReason: '',
    phases: PHASE_ORDER.reduce((acc, p) => {
      acc[p] = { status: 'pending', summary: '' }
      return acc
    }, {}),
    tools: [],
    observationLines: [],
    planLines: [],
    verifyLines: [],
    reasoningLines: [],
    finalResponse: '',
  }
}

function normalizeMode(mode) {
  const v = String(mode || '').toLowerCase()
  if (v === 'cooperative' || v === 'goal_oriented' || v === 'goal-oriented') return 'cooperative'
  if (v === 'autonomous' || v === 'copilot' || v === 'autonomous_exploration' || v === 'exploration') return 'autonomous'
  if (v === 'chitchat' || v === 'chat') return 'chat'
  return v
}

function detectModeFromQuery(query) {
  const q = String(query || '').toLowerCase()
  if (!q.trim()) return null
  const explicitKeywords = [
    'zoom', 'filter', 'sort', 'highlight', 'remove', 'delete', 'add',
    'toggle', 'switch to', 'set to', 'focus on', 'select only', 'drill down',
    '筛选', '过滤', '排序', '高亮', '删除', '添加', '放大', '聚焦',
  ]
  const autonomousKeywords = [
    'autonomous', 'autonomously', 'explore', 'exploration', 'proactively',
    'pattern', 'insight', 'analyze', 'analyse', 'again', 'revisit', 'what else',
    '自主', '探索', '你来分析', '再分析', '看看整体', '找规律', '异常模式',
  ]
  if (explicitKeywords.some((k) => q.includes(k))) return 'cooperative'
  if (autonomousKeywords.some((k) => q.includes(k))) return 'autonomous'
  return null
}

function appendLine(lines, text) {
  const line = String(text || '').trim()
  if (!line) return lines || []
  if ((lines || []).includes(line)) return lines
  return [...(lines || []), line]
}

function hasCjk(text) {
  return /[\u3400-\u9FFF]/.test(String(text || ''))
}

function hasSelectionPayload(selection) {
  if (!selection || typeof selection !== 'object') return false
  if (selection.selection_id) return true
  if (selection.summary) return true
  if (Array.isArray(selection.predicates) && selection.predicates.length > 0) return true
  return Number.isFinite(selection.count)
}

function summarizeRuntimeLoopContext(context) {
  if (!context || typeof context !== 'object') return null
  const workspace = context.workspace && typeof context.workspace === 'object' ? context.workspace : {}
  const view = context.view && typeof context.view === 'object' ? context.view : {}
  const shared = view.shared && typeof view.shared === 'object' ? view.shared : {}
  const activeSelections = shared.selections?.registry && typeof shared.selections.registry === 'object'
    ? shared.selections.registry
    : {}
  return {
    widgetCount: Array.isArray(workspace.widgets) ? workspace.widgets.length : 0,
    focusedWidget: shared.focusedWidget || null,
    activeSelectionCount: Object.keys(activeSelections).length,
    workspaceDescribeName: context.loopHints?.workspaceDescribeName || '',
    workspacePlanName: context.loopHints?.workspacePlanName || '',
    viewReadName: context.loopHints?.viewReadName || '',
    actionRunName: context.loopHints?.actionRunName || '',
    perceptionQueryName: context.loopHints?.perceptionQueryName || '',
    verifyQueryName: context.loopHints?.verifyQueryName || '',
    dataQueryName: context.loopHints?.dataQueryName || '',
    interactionTraceName: context.loopHints?.interactionTraceName || '',
    traceGraphName: context.loopHints?.traceGraphName || '',
    snapshotName: context.loopHints?.snapshotName || '',
    stateHistoryName: context.loopHints?.stateHistoryName || '',
    branchListName: context.loopHints?.branchListName || '',
    finalSnapshotName: context.loopHints?.finalSnapshotName || '',
    verifiedActionName: context.loopHints?.verifiedActionName || '',
    jumpToStateName: context.loopHints?.jumpToStateName || '',
    branchFromStateName: context.loopHints?.branchFromStateName || '',
    responseRecorderName: context.loopHints?.responseRecorderName || '',
    responseReadName: context.loopHints?.responseReadName || '',
    responseListName: context.loopHints?.responseListName || '',
    responseRecordName: context.loopHints?.responseRecordName || '',
    verificationSurfaces: Array.isArray(context.loopHints?.verificationSurfaces)
      ? context.loopHints.verificationSurfaces
      : [],
    planningSurfaces: Array.isArray(context.loopHints?.planningSurfaces)
      ? context.loopHints.planningSurfaces
      : [],
    historySurfaces: Array.isArray(context.loopHints?.historySurfaces)
      ? context.loopHints.historySurfaces
      : [],
    replaySurfaces: Array.isArray(context.loopHints?.replaySurfaces)
      ? context.loopHints.replaySurfaces
      : [],
    answerSurfaces: Array.isArray(context.loopHints?.answerSurfaces)
      ? context.loopHints.answerSurfaces
      : [],
    humanInteractionHints: Array.isArray(context.loopHints?.humanInteractionHints)
      ? context.loopHints.humanInteractionHints
      : [],
    recommendedOrder: Array.isArray(context.loopHints?.recommendedOrder)
      ? context.loopHints.recommendedOrder
      : [],
    sharedDataViews: Array.isArray(context.loopHints?.sharedDataViews)
      ? context.loopHints.sharedDataViews
      : [],
    focusedDataViews: Array.isArray(context.loopHints?.focusedDataViews)
      ? context.loopHints.focusedDataViews
      : [],
    preferredEvidenceRefs: context.loopHints?.preferredEvidenceRefs || {},
    workspaceTopology: context.loopHints?.workspaceTopology || null,
  }
}

function normalizeSelectionHint(selection) {
  if (!selection || typeof selection !== 'object') return null
  const normalized = { ...selection }
  if (!Number.isFinite(normalized.count) && Array.isArray(normalized.predicates)) {
    normalized.count = normalized.predicates.length > 0 ? normalized.predicates.length : undefined
  }
  if (!normalized.summary && Array.isArray(normalized.predicates) && normalized.predicates.length > 0) {
    normalized.summary = normalized.predicates
      .slice(0, 2)
      .map((p) => `${p.field || 'field'} ${p.op || ''} ${Array.isArray(p.value) ? p.value.join('~') : String(p.value ?? '')}`.trim())
      .join('; ')
  }
  return normalized
}

function normalizeSelectionMapHint(selections) {
  if (!selections || typeof selections !== 'object') return null
  const entries = Object.values(selections)
    .map((selection) => normalizeSelectionHint(selection))
    .filter(Boolean)
  if (!entries.length) return null
  if (entries.length === 1) return entries[0]

  const countedEntries = entries.filter((entry) => Number.isFinite(entry.count))
  const totalCount = countedEntries.length ? countedEntries.reduce((sum, entry) => sum + entry.count, 0) : undefined
  const summary = entries
    .slice(0, 3)
    .map((entry) => entry.summary || entry.selection_id || 'selection')
    .join(' · ')

  return {
    count: totalCount,
    summary,
    selectionCount: entries.length,
    selections: entries,
  }
}

function summarizeToolResult(toolName, result) {
  if (!result || typeof result !== 'object') return ''
  if (toolName === 'get_data_summary') {
    const summary = result.summary && typeof result.summary === 'object' ? result.summary : null
    if (summary) {
      const count = Number.isFinite(summary.count) ? summary.count : null
      const numericCount = summary.numeric_fields && typeof summary.numeric_fields === 'object'
        ? Object.keys(summary.numeric_fields).length
        : 0
      const categoricalCount = summary.categorical_fields && typeof summary.categorical_fields === 'object'
        ? Object.keys(summary.categorical_fields).length
        : 0
      const pieces = []
      if (count != null) pieces.push(`rows: ${count}`)
      pieces.push(`numeric fields: ${numericCount}`)
      pieces.push(`categorical fields: ${categoricalCount}`)
      return pieces.join(' | ')
    }
  }
  if (typeof result.message === 'string' && result.message.trim()) return result.message.trim()
  if (Array.isArray(result.insights) && result.insights.length > 0) return String(result.insights[0])
  const keys = Object.keys(result).filter((k) => !['vega_state', 'current_image', 'traceback'].includes(k))
  if (!keys.length) return `${toolName} finished`
  const preview = keys.slice(0, 3).map((k) => `${k}: ${typeof result[k] === 'object' ? '[object]' : String(result[k])}`).join('; ')
  return preview.length > 180 ? `${preview.slice(0, 180)}...` : preview
}

function SuggestionCards({ suggestions, onSelect, disabled }) {
  if (!suggestions?.length) return null
  return (
    <div>
      <div className="section-label">{t.suggestions}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {suggestions.map(s => (
          <button
            key={s.id}
            className="suggestion-card"
            disabled={disabled}
            onClick={() => onSelect(s.payload || s.query || s.label)}
          >
            <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text)' }}>{s.label}</div>
            <div className="text-xs text-dim mt-1" style={{ lineHeight: 1.4 }}>{s.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ChoiceUI({ options, onSelect }) {
  const [custom, setCustom] = useState('')
  const [selected, setSelected] = useState(null)
  if (!options?.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 10, padding: 12, boxShadow: '0 0 0 3px var(--accent-glow)' }}>
      <div className="section-label">{t.chooseOption}</div>
      <div className="flex flex-col gap-1 mt-1">
        {options.map((opt, i) => (
          <button
            key={i}
            className={`choice-option ${selected === i ? 'selected' : ''}`}
            onClick={() => { setSelected(i); onSelect(opt.label || opt) }}
          >
            {opt.label || opt}
          </button>
        ))}
        <div className="flex gap-2 mt-1">
          <input
            className="input"
            placeholder={t.customInput}
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { setSelected(-1); onSelect(custom.trim()) } }}
          />
          <button
            className="btn btn-primary btn-sm shrink-0"
            disabled={!custom.trim()}
            onClick={() => { if (custom.trim()) { setSelected(-1); onSelect(custom.trim()) } }}
          >{t.ok}</button>
        </div>
      </div>
    </div>
  )
}

export default function AgentPanel({
  runtime = null,
  sessionId,
  onSpecUpdated,
  onSamplingInfoUpdate,
  isRunning,
  setIsRunning,
  runMode = 'cooperative',
  setRunMode,
  scrollToIteration,
  onScrollToIterationDone,
  currentSelection = null,
  currentSelections = null,
  onClearSelection,
}) {
  const storeVersion = useRuntimeStoreVersion(runtime)
  const presetQueryDraft = useAppStore((s) => s.presetQueryDraft)
  const clearPresetQueryDraft = useAppStore((s) => s.clearPresetQueryDraft)
  const [traceItems, setTraceItems] = useState([])
  const [iterations, setIterations] = useState([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [choiceOptions, setChoiceOptions] = useState(null)
  const [selectionHint, setSelectionHint] = useState(null)
  const [runtimeLoopContext, setRuntimeLoopContext] = useState(null)
  const [runtimeLoopError, setRuntimeLoopError] = useState('')
  const [modeNotice, setModeNotice] = useState('')
  const [modeConfirm, setModeConfirm] = useState(null)
  const [currentIteration, setCurrentIteration] = useState(null)
  const [detectedIntent, setDetectedIntent] = useState(null)
  const cancelRef = useRef(null)
  const chatEndRef = useRef(null)
  const chatAreaRef = useRef(null)
  const currentIterationRef = useRef(null)
  const runSeqRef = useRef(0)
  const activeRunIdRef = useRef('')
  const pendingRunIdRef = useRef('')
  const pendingQueryRef = useRef(null)
  const pendingSelectionRef = useRef(null)
  const pendingRunModeRef = useRef(null)
  const lastDispatchedQueryRef = useRef('')
  const inputRef = useRef('')
  const handlerRef = useRef(null)
  const invokeHandler = useCallback((msg) => { handlerRef.current?.(msg) }, [])
  const refreshRuntimeLoopContext = useCallback(async () => {
    if (!sessionId) {
      setRuntimeLoopContext(null)
      setRuntimeLoopError('')
      return
    }
    try {
      const context = await agentLoopDescribe()
      setRuntimeLoopContext(summarizeRuntimeLoopContext(context))
      setRuntimeLoopError('')
    } catch (error) {
      setRuntimeLoopContext(null)
      setRuntimeLoopError(error instanceof Error ? error.message : String(error || 'Runtime unavailable'))
    }
  }, [sessionId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [traceItems, iterations])

  useEffect(() => {
    runSeqRef.current = 0
    activeRunIdRef.current = ''
    pendingRunIdRef.current = ''
    pendingQueryRef.current = null
    pendingSelectionRef.current = null
    pendingRunModeRef.current = null
    lastDispatchedQueryRef.current = ''
    setTraceItems([])
    setIterations([])
    setSuggestions([])
    setChoiceOptions(null)
    setSelectionHint(null)
    setRuntimeLoopContext(null)
    setRuntimeLoopError('')
    setModeNotice('')
    setModeConfirm(null)
    setCurrentIteration(null)
    setDetectedIntent(null)
    onClearSelection?.()
    setInput('')
    inputRef.current = ''
  }, [sessionId])

  useEffect(() => {
    if (!presetQueryDraft || !presetQueryDraft.trim()) return
    setInput(presetQueryDraft)
    inputRef.current = presetQueryDraft
    clearPresetQueryDraft()
  }, [presetQueryDraft, clearPresetQueryDraft])

  useEffect(() => {
    const nextHint = normalizeSelectionMapHint(currentSelections)
      || (hasSelectionPayload(currentSelection) ? normalizeSelectionHint(currentSelection) : null)
    setSelectionHint(nextHint)
  }, [currentSelection, currentSelections])

  useEffect(() => {
    refreshRuntimeLoopContext()
  }, [refreshRuntimeLoopContext])

  useEffect(() => {
    if (!sessionId) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const responses = await listAgentResponses({ limit: 100 })
        if (cancelled) return
        const hydrated = buildTraceItemsFromAgentResponses(responses, { sessionId })
        if (!hydrated.length) return
        setTraceItems((prev) => {
          const hasLiveTrace = prev.some((item) => item?.source !== 'runtime_response')
          if (hasLiveTrace) return prev
          return hydrated
        })
      } catch {}
    })()
    return () => { cancelled = true }
  }, [sessionId, storeVersion])

  useEffect(() => {
    if (!sessionId) return
    refreshRuntimeLoopContext()
  }, [sessionId, storeVersion, refreshRuntimeLoopContext])

  useEffect(() => {
    if (!modeNotice) return undefined
    const timer = setTimeout(() => setModeNotice(''), 1400)
    return () => clearTimeout(timer)
  }, [modeNotice])

  // 时间线点击：滚动到对应轮次的第一条消息（匹配最近一次运行，避免跨 run 重号冲突）
  useEffect(() => {
    if (scrollToIteration == null) return
    const targetItem = [...traceItems]
      .reverse()
      .find((item) => item.type === 'iteration' && (item.serverIteration === scrollToIteration || item.iteration === scrollToIteration))
    const targetId = targetItem?.iterKey || targetItem?.iteration
    const el = targetId != null ? document.getElementById(`msg-iter-${targetId}`) : null
    if (el && chatAreaRef.current?.contains(el)) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    onScrollToIterationDone?.()
  }, [scrollToIteration, onScrollToIterationDone, traceItems])

  function addTraceItem(type, payload = {}) {
    setTraceItems(prev => [...prev, { id: Date.now() + Math.random(), type, ...payload }])
  }

  function nextRunId() {
    runSeqRef.current += 1
    return `run-${runSeqRef.current}`
  }

  function resolveIterationContext(serverIteration, fallbackCtx = null) {
    if (!Number.isFinite(serverIteration)) {
      return fallbackCtx && fallbackCtx.iterKey ? fallbackCtx : null
    }
    const runId = pendingRunIdRef.current || activeRunIdRef.current || nextRunId()
    return {
      runId,
      serverIteration,
      iterKey: `${runId}:${serverIteration}`,
    }
  }

  function upsertIteration(iterCtx, updater, modeHint = '') {
    if (!iterCtx?.iterKey) return
    setIterations(prev => {
      const idx = prev.findIndex(it => it.iterKey === iterCtx.iterKey)
      const base = idx >= 0 ? prev[idx] : createEmptyIteration(iterCtx.iterKey, iterCtx.serverIteration, iterCtx.runId, modeHint)
      const next = updater(base)
      if (idx >= 0) {
        const cloned = [...prev]
        cloned[idx] = next
        return cloned
      }
      return [...prev, next]
    })
  }

  const advanceIterationPhase = useCallback((iterCtx, phase, summary) => {
    if (!iterCtx?.iterKey) return
    const normalizedPhase = String(phase || '').toLowerCase()
    const targetIndex = PHASE_ORDER.indexOf(normalizedPhase)
    if (targetIndex < 0) return
    const safeSummary = String(summary || '').trim()

    upsertIteration(iterCtx, old => {
      const nextPhases = { ...old.phases }
      let reachedIndex = -1
      PHASE_ORDER.forEach((p, idx) => {
        const st = nextPhases[p]?.status
        if (st === 'completed' || st === 'running') reachedIndex = Math.max(reachedIndex, idx)
      })
      const activeIndex = PHASE_ORDER.indexOf(old.activePhase)
      if (activeIndex >= 0) reachedIndex = Math.max(reachedIndex, activeIndex)

      // Late event for an already reached phase: only refresh summary, no phase jump/backtrack.
      if (targetIndex < reachedIndex) {
        const prev = nextPhases[normalizedPhase] || { status: 'pending', summary: '' }
        nextPhases[normalizedPhase] = { ...prev, summary: safeSummary || prev.summary }
        const nextIteration = { ...old, phases: nextPhases }
        if (normalizedPhase === 'observe' && safeSummary) nextIteration.observationLines = appendLine(old.observationLines, safeSummary)
        if (normalizedPhase === 'plan' && safeSummary) nextIteration.planLines = appendLine(old.planLines, safeSummary)
        if (normalizedPhase === 'verify' && safeSummary) nextIteration.verifyLines = appendLine(old.verifyLines, safeSummary)
        if (normalizedPhase === 'reason' && safeSummary) nextIteration.reasoningLines = appendLine(old.reasoningLines, safeSummary)
        return nextIteration
      }

      // Monotonic forward progression: complete previous phases in order, activate current target phase.
      PHASE_ORDER.forEach((p, idx) => {
        const prev = nextPhases[p] || { status: 'pending', summary: '' }
        if (idx < targetIndex) nextPhases[p] = { ...prev, status: 'completed' }
        else if (idx === targetIndex) nextPhases[p] = { ...prev, status: 'running', summary: safeSummary || prev.summary }
        else if (prev.status !== 'completed') nextPhases[p] = { ...prev, status: 'pending' }
      })

      const nextIteration = { ...old, phases: nextPhases, activePhase: normalizedPhase }
      if (normalizedPhase === 'observe' && safeSummary) nextIteration.observationLines = appendLine(old.observationLines, safeSummary)
      if (normalizedPhase === 'plan' && safeSummary) nextIteration.planLines = appendLine(old.planLines, safeSummary)
      if (normalizedPhase === 'verify' && safeSummary) nextIteration.verifyLines = appendLine(old.verifyLines, safeSummary)
      if (normalizedPhase === 'reason' && safeSummary) nextIteration.reasoningLines = appendLine(old.reasoningLines, safeSummary)
      return nextIteration
    })
  }, [])

  function ensureIterationTrace(iterCtx) {
    if (!iterCtx?.iterKey) return
    setTraceItems(prev => {
      if (prev.some(item => item.type === 'iteration' && item.iterKey === iterCtx.iterKey)) return prev
      return [
        ...prev,
        {
          id: `iter-${iterCtx.iterKey}`,
          type: 'iteration',
          iterKey: iterCtx.iterKey,
          runId: iterCtx.runId,
          serverIteration: iterCtx.serverIteration,
          iteration: iterCtx.serverIteration,
        },
      ]
    })
  }

  handlerRef.current = (msg) => {
    const { event, data } = msg
    if (event === 'run.started') {
      const runId = pendingRunIdRef.current || activeRunIdRef.current || nextRunId()
      activeRunIdRef.current = runId
      if (pendingRunIdRef.current === runId) pendingRunIdRef.current = ''
      currentIterationRef.current = null
    } else if (event === 'iteration.started') {
      const iterCtx = resolveIterationContext(data.iteration, currentIterationRef.current)
      if (!iterCtx) return
      currentIterationRef.current = iterCtx
      setCurrentIteration(iterCtx.serverIteration)
      ensureIterationTrace(iterCtx)
      upsertIteration(iterCtx, old => ({
        ...old,
        status: 'running',
        activePhase: 'observe',
      }), runMode)
    } else if (event === 'iteration.phase') {
      const iterCtx = resolveIterationContext(data.iteration, currentIterationRef.current)
      if (!iterCtx) return
      const phase = String(data.phase || '').toLowerCase()
      const summary = data.summary || `${String(data.phase || 'phase')} updated`
      advanceIterationPhase(iterCtx, phase, summary)
    } else if (event === 'agent.message') {
      const iterCtx = resolveIterationContext(data.iteration, currentIterationRef.current)
      if (!iterCtx) return
      upsertIteration(iterCtx, old => {
        let lines = old.reasoningLines
        let planLines = old.planLines
        let verifyLines = old.verifyLines
        const subGoal = String(data.sub_goal || '').trim()
        const toolName = String(data.tool_name || '').trim()
        const goalGapNote = String(data.goal_gap_note || '').trim()
        const chosenPath = String(data.chosen_path || '').trim()
        const strategyNote = String(data.strategy_note || '').trim()
        const candidatePaths = Array.isArray(data.candidate_paths) ? data.candidate_paths.filter(Boolean).map(String) : []

        // Do not repeat global objective each round; only show incremental plan details.
        if (subGoal || toolName) {
          const planPieces = []
          if (subGoal) planPieces.push(`Sub-goal: ${subGoal}`)
          if (toolName) planPieces.push(`Next action: ${toolName}`)
          if (planPieces.length) planLines = appendLine(planLines, planPieces.join(' | '))
        }
        if (candidatePaths.length || chosenPath) {
          const pathPieces = []
          if (chosenPath) pathPieces.push(`Chosen path: ${chosenPath}`)
          if (candidatePaths.length) pathPieces.push(`Candidates: ${candidatePaths.slice(0, 2).join(' / ')}`)
          if (pathPieces.length) planLines = appendLine(planLines, pathPieces.join(' | '))
        }
        if (goalGapNote) verifyLines = appendLine(verifyLines, `Progress check: ${goalGapNote}`)
        if (strategyNote) verifyLines = appendLine(verifyLines, `Strategy check: ${strategyNote}`)
        if (data.repeat_risk === true) verifyLines = appendLine(verifyLines, t.strategyRepeatRisk)
        if (data.goal_achieved === true) verifyLines = appendLine(verifyLines, t.goalAchieved)
        if (data.exploration_complete === true) verifyLines = appendLine(verifyLines, t.explorationComplete)

        if (Array.isArray(data.key_insights)) {
          data.key_insights.forEach(ins => {
            lines = appendLine(lines, ins)
          })
        }
        if (data.reasoning) lines = appendLine(lines, data.reasoning)
        const finalResponse = String(data.final_response || data.answer || '').trim()
        return { ...old, planLines, verifyLines, reasoningLines: lines, finalResponse: finalResponse || old.finalResponse }
      })
    } else if (event === 'tool.started') {
      if (HIDDEN_TOOL_NAMES.has(data.tool_name)) return
      const iterCtx = resolveIterationContext(data.iteration, currentIterationRef.current)
      if (!iterCtx) return
      upsertIteration(iterCtx, old => ({
        ...old,
        tools: [
          ...old.tools,
          {
            id: `tool-${Date.now()}-${Math.random()}`,
            toolName: data.tool_name,
            args: data.tool_input ?? {},
            status: 'running',
            result: null,
            resultPreview: '',
          },
        ],
      }))
    } else if (event === 'tool.finished') {
      if (HIDDEN_TOOL_NAMES.has(data.tool_name)) {
        return
      }
      const iterCtx = resolveIterationContext(data.iteration, currentIterationRef.current)
      if (!iterCtx) return
      upsertIteration(iterCtx, old => {
        const tools = [...old.tools]
        let updated = false
        for (let i = tools.length - 1; i >= 0; i -= 1) {
          if (tools[i].toolName === data.tool_name && tools[i].status === 'running') {
            tools[i] = {
              ...tools[i],
              status: data.success ? 'success' : 'failed',
              result: data.tool_result ?? null,
              resultPreview: summarizeToolResult(data.tool_name, data.tool_result),
            }
            updated = true
            break
          }
        }
        if (!updated) {
          tools.push({
            id: `tool-${Date.now()}-${Math.random()}`,
            toolName: data.tool_name,
            args: {},
            status: data.success ? 'success' : 'failed',
            result: data.tool_result ?? null,
            resultPreview: summarizeToolResult(data.tool_name, data.tool_result),
          })
        }
        const verifyLine = data.success
          ? `Tool ${data.tool_name} executed successfully`
          : `Tool ${data.tool_name} failed`
        return { ...old, tools, verifyLines: appendLine(old.verifyLines, verifyLine) }
      })
      if (!data.success) {
        const err = data.tool_result?.error || data.tool_result?.message
        addTraceItem('error', { role: 'error', content: err ? `${t.toolFailed}: ${data.tool_name} — ${err}` : `${t.toolFailed}: ${data.tool_name}` })
      }
    } else if (event === 'view.updated') {
      if (data.spec) {
        onSpecUpdated(data.spec)
      }
      refreshRuntimeLoopContext()
    } else if (event === 'iteration.finished') {
      const iterCtx = resolveIterationContext(data.iteration, currentIterationRef.current)
      if (iterCtx != null) {
        upsertIteration(iterCtx, old => {
          const nextPhases = { ...old.phases }
          const current = PHASE_ORDER.includes(old.activePhase) ? old.activePhase : null
          if (current) {
            const prev = nextPhases[current] || { status: 'pending', summary: '' }
            nextPhases[current] = { ...prev, status: 'completed' }
          }
          return {
            ...old,
            status: old.status === 'failed' ? 'failed' : 'completed',
            activePhase: '',
            phases: nextPhases,
            stopReason: old.stopReason || data.stop_reason || '',
          }
        })
      }
      currentIterationRef.current = null
      setCurrentIteration(null)
    } else if (event === 'intent.recognized') {
      setDetectedIntent({
        intent: data.intent,
        intent_display: data.intent_display,
        effective_mode: normalizeMode(data.effective_mode),
      })
    } else if (event === 'run.finishing') {
      // 后端已完成计算，立即停止转圈；完整结果随后通过 run.finished 到达
      setIsRunning(false)
    } else if (event === 'run.finished') {
      const mode = normalizeMode(data.mode || '')
      const autonomousFinished = mode === 'autonomous'
      const totalIter = (data.explorations || data.iterations || []).length
      addTraceItem('system', { role: 'system', content: `${mode === 'autonomous' ? t.autonomous : t.cooperative} ${t.runFinished} ${totalIter} ${t.iterationsCount}` })
      if (data.final_report?.summary) {
        const summary = String(data.final_report.summary)
        addTraceItem('system', {
          role: 'system',
          content: hasCjk(summary) ? `Completed ${totalIter} iteration(s).` : summary,
        })
      }
      const finalResponse = String(data.final_response || '').trim()
      if (finalResponse) {
        const allIters = data.explorations || data.iterations || []
        const lastIter = allIters.length
        if (lastIter > 0) {
          const finalIterCtx = resolveIterationContext(lastIter)
          if (finalIterCtx) {
            upsertIteration(finalIterCtx, old => ({ ...old, finalResponse: finalResponse || old.finalResponse }))
          }
        }
        void recordAgentResponse({
          runId: activeRunIdRef.current || null,
          sessionId: sessionId || null,
          actor: 'agent',
          mode: mode || null,
          query: lastDispatchedQueryRef.current || null,
          content: finalResponse,
        }).catch(() => {})
      }
      setSelectionHint(null)
      if (autonomousFinished && data.next_action_suggestions?.length) {
        setSuggestions(data.next_action_suggestions)
      } else {
        setSuggestions([])
      }
      if (data.final_spec) {
        onSpecUpdated(data.final_spec)
      }
      if (data.sampling_info != null && onSamplingInfoUpdate) {
        onSamplingInfoUpdate(data.sampling_info)
      }
      if (pendingQueryRef.current) {
        const nextQ = pendingQueryRef.current
        const nextSel = pendingSelectionRef.current ?? currentSelection
        const nextRunMode = pendingRunModeRef.current ?? runMode
        pendingQueryRef.current = null
        pendingSelectionRef.current = null
        pendingRunModeRef.current = null
        pendingRunIdRef.current = nextRunId()
        setIsRunning(true)
        onClearSelection?.()
        cancelRef.current = streamQuery(sessionId, nextQ, nextRunMode, invokeHandler, nextSel ?? undefined)
      } else {
        setIsRunning(false)
      }
      refreshRuntimeLoopContext()
      // Suggestions are finalized before run.finished in autonomous mode.
    } else if (event === 'clarification.requested') {
      const q = String(data.question || t.clarificationDefault)
      const options = Array.isArray(data.options)
        ? data.options.filter(Boolean).map((item) => {
          if (typeof item === 'string') return { label: item }
          if (item && typeof item === 'object') return { label: String(item.label || item.query || item.value || '') }
          return null
        }).filter((item) => item && item.label)
        : []
      addTraceItem('system', { role: 'system', content: hasCjk(q) ? t.clarificationNeeded : q })
      setSuggestions([])
      if (options.length) setChoiceOptions(options)
      setIsRunning(false)
    } else if (event === 'suggestions.updated') {
      if (normalizeMode(runMode) === 'autonomous' && data.next_action_suggestions?.length) {
        setSuggestions(data.next_action_suggestions)
      }
    } else if (event === 'error') {
      addTraceItem('error', { role: 'error', content: data.message || t.unknownError })
      setIsRunning(false)
    } else if (event === 'stream.end') {
      currentIterationRef.current = null
      setCurrentIteration(null)
      setIsRunning(false)
      refreshRuntimeLoopContext()
    }
  }

  function handleModeSwitch(nextMode) {
    setRunMode?.(nextMode)
    setModeNotice(`${t.modeSwitchedTo}: ${normalizeMode(nextMode) === 'autonomous' ? t.copilot : t.goalOriented}`)
  }

  async function dispatchQuery(q, selectionPayload, runModeToUse = runMode) {
    if (!sessionId || !q) return
    lastDispatchedQueryRef.current = q
    inputRef.current = ''
    setInput('')
    setModeConfirm(null)
    addTraceItem('user', { role: 'user', content: q })
    setSuggestions([])
    setChoiceOptions(null)
    if (hasSelectionPayload(selectionPayload)) {
      setSelectionHint(normalizeSelectionHint(selectionPayload))
    } else {
      setSelectionHint(null)
    }

    // 运行中只进入 pending：等待当前 iteration/run 结束后再发起新请求。
    if (isRunning) {
      pendingQueryRef.current = q
      pendingSelectionRef.current = selectionPayload ?? null
      pendingRunModeRef.current = runModeToUse
      try { await interruptSession(sessionId, 'new_query', { query: q, pending: true }) } catch {}
      addTraceItem('system', { role: 'system', content: t.waitingAfterIteration })
      onClearSelection?.()
      setSelectionHint(null)
      return
    }

    setIsRunning(true)
    pendingRunIdRef.current = nextRunId()
    onClearSelection?.()
    cancelRef.current = streamQuery(sessionId, q, runModeToUse, invokeHandler, selectionPayload ?? undefined)
  }

  async function submitQuery(queryOrFromRef) {
    const q = (typeof queryOrFromRef === 'string' ? queryOrFromRef : (inputRef.current || '')).trim()
    if (!sessionId || !q) return
    const selectionPayload = hasSelectionPayload(currentSelection) ? currentSelection : null
    const inferredMode = detectModeFromQuery(q)
    const activeMode = normalizeMode(runMode)
    // 首轮不弹模式确认：用户当前选择的模式优先。
    const hasUserTurn = traceItems.some((item) => item.role === 'user')
    if (hasUserTurn && inferredMode && inferredMode !== activeMode && inferredMode !== 'chat') {
      setModeConfirm({
        query: q,
        selectionPayload,
        suggestedMode: inferredMode,
      })
      return
    }
    await dispatchQuery(q, selectionPayload, runMode)
  }

  async function cancel() {
    pendingRunIdRef.current = ''
    activeRunIdRef.current = ''
    pendingQueryRef.current = null
    pendingSelectionRef.current = null
    pendingRunModeRef.current = null
    if (sessionId) {
      try { await interruptSession(sessionId, 'cancel') } catch {}
    }
    if (cancelRef.current) {
      cancelRef.current()
      cancelRef.current = null
    }
    setIsRunning(false)
    addTraceItem('system', { role: 'system', content: t.cancelled })
  }

  async function handleReset() {
    if (!sessionId) return
    try {
      const r = await resetView(sessionId)
      if (r.current_spec) onSpecUpdated(r.current_spec)
      if (onSamplingInfoUpdate) onSamplingInfoUpdate(r.sampling_info ?? null)
      addTraceItem('system', { role: 'system', content: t.viewResetToBaseline })
      setSuggestions([])
      refreshRuntimeLoopContext()
    } catch (e) {
      addTraceItem('error', { role: 'error', content: e.message })
    }
  }

  const iterMap = iterations.reduce((acc, it) => {
    acc[it.iterKey] = it
    return acc
  }, {})

  const currentModeNormalized = normalizeMode(runMode)
  const isAutonomousMode = currentModeNormalized === 'autonomous'
  const showSwitchPrompt = detectedIntent
    && !modeConfirm
    && detectedIntent.effective_mode !== currentModeNormalized
    && detectedIntent.effective_mode !== 'chat'
  const effectiveSelectionHint = selectionHint || currentSelection
  const runtimeLoopSummary = runtimeLoopContext
  const selectionPlaceholder = effectiveSelectionHint
    ? `Selection captured${effectiveSelectionHint.count != null ? ` (${effectiveSelectionHint.count})` : ''}. Ask a follow-up...`
    : (sessionId ? t.describeGoal : t.createSessionFirst)

  const getTraceIterId = (item) => {
    if (item.type !== 'iteration') return undefined
    return `msg-iter-${item.iterKey || item.iteration}`
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100%' }}>
      <div className="panel-header">
        <div className="header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
          <span>{t.agent}</span>
        </div>
        <div className="flex gap-2">
          {sessionId && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={handleReset} disabled={isRunning}>{t.reset}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => exportSession(sessionId)}>{t.export}</button>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <div className="mode-toggle">
          <button className={runMode === 'goal_oriented' ? 'active' : ''} onClick={() => handleModeSwitch('goal_oriented')}>
            {t.goalOriented}
          </button>
          <button className={(runMode === 'copilot' || runMode === 'autonomous') ? 'active' : ''} onClick={() => handleModeSwitch('copilot')}>
            {t.copilot}
          </button>
        </div>
        {modeNotice && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
            {modeNotice}
          </div>
        )}
      </div>

      <div ref={chatAreaRef} className="flex flex-col overflow-y-auto grow" style={{ padding: '10px 12px' }}>
        {!sessionId && (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-dim)',
            padding: '40px 0',
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}>
            {t.generateViewToStart}
          </div>
        )}
        {traceItems.map(item => {
          const iterId = getTraceIterId(item)
          if (item.type === 'iteration') {
            const iterationData = iterMap[item.iterKey]
            if (!iterationData) return null
            return <IterationCard key={item.id} iterationData={iterationData} id={iterId} />
          }
          return <ChatMessage key={item.id} msg={item} id={iterId} />
        })}
        {isRunning && (
          <div className="flex items-center gap-2" style={{ color: 'var(--accent)', fontSize: 12 }}>
            <div className="spinner" />
            <span>{t.agentAnalyzing}</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {((isAutonomousMode && suggestions.length > 0) || choiceOptions) && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          {choiceOptions && (
            <ChoiceUI options={choiceOptions} onSelect={q => { setChoiceOptions(null); submitQuery(q) }} />
          )}
          {isAutonomousMode && suggestions.length > 0 && !choiceOptions && (
            <SuggestionCards suggestions={suggestions} disabled={!sessionId}
              onSelect={q => submitQuery(q)} />
          )}
        </div>
      )}

      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        {modeConfirm && (
          <div style={{
            marginBottom: 8,
            padding: '8px 10px',
            background: 'var(--accent-glow)',
            border: '1px solid var(--accent)',
            borderRadius: 8,
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
              {t.queryIntentDetected}: {modeConfirm.suggestedMode === 'autonomous' ? t.copilot : t.goalOriented}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 8px', fontSize: 11, color: 'var(--accent)', border: '1px solid var(--accent)' }}
              onClick={() => {
                const targetMode = modeConfirm.suggestedMode === 'autonomous' ? 'copilot' : 'goal_oriented'
                handleModeSwitch(targetMode)
                dispatchQuery(modeConfirm.query, modeConfirm.selectionPayload, targetMode)
              }}
            >
              {t.switchAndSend}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 8px', fontSize: 11 }}
              onClick={() => dispatchQuery(modeConfirm.query, modeConfirm.selectionPayload, runMode)}
            >
              {t.keepAndSend}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 8px', fontSize: 11 }}
              onClick={() => setModeConfirm(null)}
            >
              {t.cancel}
            </button>
          </div>
        )}
        {detectedIntent && (
          <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-dim)' }}>
            <span>{t.intentDetected}: </span>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>
              {detectedIntent.intent_display}
            </span>
            <span> ({detectedIntent.effective_mode === 'autonomous' ? t.copilot : detectedIntent.effective_mode === 'cooperative' ? t.goalOriented : t.intentChitchat})</span>
          </div>
        )}
        {showSwitchPrompt && (
          <div style={{
            marginBottom: 8,
            padding: '6px 10px',
            background: 'var(--accent-glow)',
            border: '1px solid var(--accent)',
            borderRadius: 8,
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <span style={{ color: 'var(--accent)' }}>
              {t.interpretedAs} {detectedIntent.effective_mode === 'autonomous' ? t.copilot : t.goalOriented}.
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 8px', fontSize: 11, color: 'var(--accent)', border: '1px solid var(--accent)' }}
              onClick={() => setRunMode?.(detectedIntent.effective_mode === 'autonomous' ? 'copilot' : 'goal_oriented')}
            >
              {t.switchToMode} {detectedIntent.effective_mode === 'autonomous' ? t.copilot : t.goalOriented}
            </button>
          </div>
        )}
        {(runtimeLoopSummary || runtimeLoopError) && (
          <div style={{ marginBottom: 8 }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: '8px 10px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 11,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: 'var(--text-dim)' }}>{t.runtimeLoop}</span>
                {runtimeLoopSummary && (
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                    {t.runtimeLoopWidgets}: {runtimeLoopSummary.widgetCount}
                  </span>
                )}
              </div>
              {runtimeLoopError ? (
                <div style={{ color: 'var(--text-dim)' }}>{t.runtimeLoopUnavailable}: {runtimeLoopError}</div>
              ) : runtimeLoopSummary ? (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, color: 'var(--text-dim)' }}>
                    <span>{t.runtimeLoopFocusedWidget}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.focusedWidget || '-'}</span></span>
                    <span>{t.runtimeLoopSelections}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.activeSelectionCount}</span></span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopWorkspaceDescribe}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.workspaceDescribeName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopWorkspacePlan}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.workspacePlanName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopViewRead}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.viewReadName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopActionRun}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.actionRunName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopPerceptionQuery}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.perceptionQueryName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopVerifyQuery}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.verifyQueryName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopDataQuery}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.dataQueryName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopInteractionTrace}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.interactionTraceName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopTraceGraph}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.traceGraphName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopSnapshot}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.snapshotName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopStateHistory}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.stateHistoryName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopBranchList}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.branchListName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopFinalSnapshot}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.finalSnapshotName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopVerifiedAction}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.verifiedActionName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopJumpToState}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.jumpToStateName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopBranchFromState}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.branchFromStateName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopResponseRecorder}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.responseRecorderName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopResponseRead}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.responseReadName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopResponseList}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.responseListName || '-'}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {t.runtimeLoopResponseRecord}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.responseRecordName || '-'}</span>
                  </div>
                  {!!runtimeLoopSummary.verificationSurfaces.length && (
                    <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      {t.runtimeLoopSurfaces}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.verificationSurfaces.join(' · ')}</span>
                    </div>
                  )}
                  {!!runtimeLoopSummary.planningSurfaces.length && (
                    <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      {t.runtimeLoopPlanningSurfaces}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.planningSurfaces.join(' · ')}</span>
                    </div>
                  )}
                  {!!runtimeLoopSummary.historySurfaces.length && (
                    <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      {t.runtimeLoopHistorySurfaces}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.historySurfaces.join(' · ')}</span>
                    </div>
                  )}
                  {!!runtimeLoopSummary.replaySurfaces.length && (
                    <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      {t.runtimeLoopReplaySurfaces}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.replaySurfaces.join(' · ')}</span>
                    </div>
                  )}
                  {!!runtimeLoopSummary.answerSurfaces.length && (
                    <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      {t.runtimeLoopAnswerSurfaces}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.answerSurfaces.join(' · ')}</span>
                    </div>
                  )}
                  {!!runtimeLoopSummary.humanInteractionHints.length && (
                    <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      {t.runtimeLoopHumanInteraction}: <span style={{ color: 'var(--text)' }}>
                        {runtimeLoopSummary.humanInteractionHints
                          .map((entry) => [entry.mode, entry.actionName, entry.focused ? 'focused' : null].filter(Boolean).join(' · '))
                          .join(' | ')}
                      </span>
                    </div>
                  )}
                  {!!runtimeLoopSummary.sharedDataViews.length && (
                    <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      {t.runtimeLoopSharedDataViews}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.sharedDataViews.map((handle) => handle.title || handle.ref).join(' · ')}</span>
                    </div>
                  )}
                  {!!runtimeLoopSummary.focusedDataViews.length && (
                    <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      {t.runtimeLoopFocusedDataViews}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.focusedDataViews.map((handle) => handle.title || handle.ref).join(' · ')}</span>
                    </div>
                  )}
                  {runtimeLoopSummary.workspaceTopology?.topology ? (
                    <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      {t.runtimeLoopTopology}: <span style={{ color: 'var(--text)' }}>
                        {[runtimeLoopSummary.workspaceTopology.topology, runtimeLoopSummary.workspaceTopology.topologyLabel].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  ) : null}
                  {(runtimeLoopSummary.preferredEvidenceRefs?.currentViewRef || runtimeLoopSummary.preferredEvidenceRefs?.currentSelectionRef) && (
                    <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      {t.runtimeLoopPreferredEvidence}: <span style={{ color: 'var(--text)' }}>
                        {[runtimeLoopSummary.preferredEvidenceRefs?.currentViewRef, runtimeLoopSummary.preferredEvidenceRefs?.currentSelectionRef].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  )}
                  {!!runtimeLoopSummary.recommendedOrder.length && (
                    <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                      {t.runtimeLoopOrder}: <span style={{ color: 'var(--text)' }}>{runtimeLoopSummary.recommendedOrder.join(' → ')}</span>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}
        {effectiveSelectionHint && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}>
              <span style={{ color: 'var(--text-dim)' }}>{t.selectionChip}</span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>N={effectiveSelectionHint.count ?? '-'}</span>
              {Number.isFinite(effectiveSelectionHint.selectionCount) && effectiveSelectionHint.selectionCount > 1 && (
                <span style={{ color: 'var(--text-dim)' }}>
                  {effectiveSelectionHint.selectionCount} selections
                </span>
              )}
              {effectiveSelectionHint.summary && (
                <span className="truncate" style={{ flex: 1, color: 'var(--text-dim)', maxWidth: 200 }} title={effectiveSelectionHint.summary}>{effectiveSelectionHint.summary}</span>
              )}
              {(onClearSelection || selectionHint) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 6px', fontSize: 11 }}
                  onClick={() => {
                    onClearSelection?.()
                    setSelectionHint(null)
                  }}
                >
                  {t.clearSelection}
                </button>
              )}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-dim)' }}>
              {t.selectionActiveHint}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            className="textarea"
            rows={2}
            style={{ resize: 'none', minHeight: 'unset' }}
            placeholder={selectionPlaceholder}
            value={input}
            disabled={!sessionId}
            onChange={e => {
              const v = e.target.value
              inputRef.current = v
              setInput(v)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitQuery() }
            }}
          />
          {isRunning && (
            <button className="btn btn-danger shrink-0" onClick={cancel} style={{ alignSelf: 'flex-end' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
              {t.stop}
            </button>
          )}
          <button
            className="btn btn-primary shrink-0"
            disabled={!sessionId || !input.trim()}
            style={{ alignSelf: 'flex-end' }}
            onClick={() => submitQuery()}
          >
            {t.send}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
