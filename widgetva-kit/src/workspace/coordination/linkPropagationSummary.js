import {
  readSelectionPrimaryView,
  readSelectionRegistry,
} from '../state/selectionStateModel.js'
import { normalizeCanonicalPropagationSkipReason } from './propagationReasons.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function stripCompatibilityFields(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stripCompatibilityFields(entry))
  }
  if (!value || typeof value !== 'object') {
    return value
  }
  const next = {}
  for (const [key, entryValue] of Object.entries(value)) {
    if (key === 'propagationPolicy' || key === 'trigger' || key === 'automatic') continue
    next[key] = stripCompatibilityFields(entryValue)
  }
  return next
}

function normalizePublicPropagationEntries(entries = []) {
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    if (!entry || typeof entry !== 'object') return entry
    if (typeof entry.skippedReason !== 'string' || entry.skippedReason.length === 0) return entry
    return {
      ...entry,
      skippedReason: normalizeCanonicalPropagationSkipReason(entry.skippedReason, 'mappingFailed'),
    }
  })
}

function normalizePublicPropagationEvaluation(evaluation = null) {
  if (!evaluation || typeof evaluation !== 'object') return evaluation
  const results = Array.isArray(evaluation.results) ? evaluation.results : []
  return {
    ...evaluation,
    results: results.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry
      if (typeof entry.reason !== 'string' || entry.reason.length === 0) return entry
      return {
        ...entry,
        reason: normalizeCanonicalPropagationSkipReason(entry.reason, 'mappingFailed'),
      }
    }),
  }
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.length > 0))]
}

export function buildPropagationSummary({
  state = {},
  description = {},
  coordinationEngine = null,
  sourceRef = null,
} = {}) {
  const shared = state?.shared || {}
  const registry = readSelectionRegistry(shared)
  const primarySelection = readSelectionPrimaryView(shared)
  const engineSummary = typeof coordinationEngine?.describeEngine === 'function'
    ? clone(coordinationEngine.describeEngine())
    : null
  const candidateSourceRefs = uniqueStrings([
    sourceRef,
    primarySelection?.selectionRef || null,
    ...Object.keys(registry || {}),
    shared?.focusedWidget || null,
    ...(engineSummary?.links || []).map((entry) => entry?.sourceRef || null),
  ])
  const resolvedSourceRef = sourceRef || candidateSourceRefs[0] || null
  const propagation = resolvedSourceRef && typeof coordinationEngine?.describePropagation === 'function'
    ? normalizePublicPropagationEntries(
      stripCompatibilityFields(clone(coordinationEngine.describePropagation({ sourceRef: resolvedSourceRef }))),
    )
    : []
  const evaluation = resolvedSourceRef && typeof coordinationEngine?.evaluatePropagation === 'function'
    ? normalizePublicPropagationEvaluation(
      stripCompatibilityFields(clone(coordinationEngine.evaluatePropagation({ sourceRef: resolvedSourceRef, state }))),
    )
    : null

  return {
    sourceRef: resolvedSourceRef,
    candidateSourceRefs,
    topology: clone(description?.runtimeTopology || engineSummary?.topology || null),
    linkSummary: stripCompatibilityFields(engineSummary),
    propagation,
    evaluation,
  }
}
