import {
  readSelectionByWidgetView,
  readSelectionPrimaryView,
  readSelectionRegistry,
} from '../../workspace/state/selectionStateModel.js'
import { readFocusState } from '../../workspace/state/focusStateModel.js'
import { deriveHighlightState } from '../../workspace/state/highlightStateModel.js'
import { readViewportState } from '../../workspace/state/viewportStateModel.js'
import { describeWidgetVerificationContract } from '../../widgets/verificationContract.js'
import {
  readLinkDefinitions,
  readLinkTopologyState,
} from '../../workspace/state/linkStateModel.js'
import {
  isLegacyPropagationSkipReason,
  normalizeCanonicalPropagationSkipReason,
} from './propagationReasons.js'

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

function mapEffectToVerificationType(effect, responseSpec = null) {
  if (effect === 'applyFilter') return 'filter'
  if (effect === 'applyHighlight') return 'highlight'
  if (effect === 'focusTarget') return 'focus'
  if (effect === 'shareSelection') return 'selection'
  if (effect === 'syncDomain') return 'zoom'
  if (effect === 'transformView' || effect === 'transformDataView' || effect === 'transformStructure') {
    return typeof responseSpec?.kind === 'string' && responseSpec.kind.length > 0
      ? responseSpec.kind
      : 'transformation'
  }
  return null
}

function buildTargetVerificationGuidance(contract, effect, responseSpec = null) {
  const verificationType = mapEffectToVerificationType(effect, responseSpec)
  const responseHints = responseSpec?.verificationHints && typeof responseSpec.verificationHints === 'object'
    ? responseSpec.verificationHints
    : {}
  const effectChecks = Array.isArray(responseHints.checks)
    ? [...responseHints.checks]
    : verificationType
    ? Array.isArray(contract?.effectChecks?.[verificationType])
      ? [...contract.effectChecks[verificationType]]
      : []
    : []

  return {
    verificationType,
    preferredReadMethod: responseHints.preferredReadMethod || contract?.preferredReadMethod || null,
    effectChecks,
    responseKind: responseSpec?.kind || null,
    observationFields: Array.isArray(contract?.preferredObservationFields)
      ? [...contract.preferredObservationFields]
      : [],
  }
}

function buildTargetVerificationStep(target = {}) {
  const preferredReadMethod = target?.verificationGuidance?.preferredReadMethod || null
  const effectChecks = Array.isArray(target?.verificationGuidance?.effectChecks)
    ? [...target.verificationGuidance.effectChecks]
    : []
  return {
    stepId: `verify_${target?.targetWidgetId || 'target'}_${target?.effect || 'effect'}`,
    targetRef: target?.targetRef || null,
    targetWidgetId: target?.targetWidgetId || null,
    effect: target?.effect || null,
    verificationType: target?.verificationGuidance?.verificationType || null,
    readMethod: preferredReadMethod,
    checks: effectChecks,
    instruction: preferredReadMethod
      ? `Call ${preferredReadMethod} on ${target?.targetWidgetId || 'the target widget'} and inspect ${effectChecks.join(', ')}.`
      : `Inspect ${target?.targetWidgetId || 'the target widget'} for ${target?.effect || 'the propagated effect'}.`,
  }
}

function readValueAtPath(value, path) {
  if (typeof path !== 'string' || path.length === 0) return undefined
  return path.split('.').reduce((current, segment) => (
    current && typeof current === 'object' ? current[segment] : undefined
  ), value)
}

function executeVerificationSteps(store, verificationSteps = [], resolveTargetWidget = null) {
  return (Array.isArray(verificationSteps) ? verificationSteps : []).map((step) => {
    const targetWidget = step?.targetRef
      ? resolveTargetWidget?.(step.targetRef, step?.targetWidgetId || null)
        || store?.getResolvedWidgetForTarget?.(step.targetRef)
        || store?.getResolvedWidget?.(step.targetRef)
        || null
      : null
    const verificationState = step?.readMethod === 'readVerificationState'
      ? targetWidget?.readVerificationState?.() || null
      : null
    const observedChecks = Object.fromEntries(
      (Array.isArray(step?.checks) ? step.checks : []).map((path) => [path, readValueAtPath(verificationState, path)]),
    )
    return {
      stepId: step?.stepId || null,
      targetRef: step?.targetRef || null,
      targetWidgetId: step?.targetWidgetId || null,
      effect: step?.effect || null,
      verificationType: step?.verificationType || null,
      readMethod: step?.readMethod || null,
      ok: Boolean(verificationState),
      checks: observedChecks,
      verificationState,
    }
  })
}

function summarizeVerificationResults(verificationResults = []) {
  const normalized = Array.isArray(verificationResults) ? verificationResults : []
  const total = normalized.length
  const succeeded = normalized.filter((entry) => entry?.ok).length
  const failed = total - succeeded
  const status = total === 0
    ? 'not_applicable'
    : failed === 0
      ? 'verified'
      : succeeded > 0
        ? 'partial'
        : 'failed'
  return {
    status,
    total,
    succeeded,
    failed,
    summary: total === 0
      ? 'No verification steps were produced.'
      : failed === 0
        ? `Verified ${succeeded}/${total} target checks.`
        : succeeded > 0
          ? `Partially verified ${succeeded}/${total} target checks.`
          : `Failed to verify any of ${total} target checks.`,
  }
}

export function buildCoordinationStateFromWorkspaceState(state = {}, { currentBranchId = null, derivedTopology = {} } = {}) {
  const shared = state?.shared || {}
  return {
    stateId: state?.stateId || null,
    branchId: state?.branchId || currentBranchId || null,
    focusedWidgetRef: shared?.focusedWidget || null,
    selections: {
      registry: readSelectionRegistry(shared),
      views: {
        primary: readSelectionPrimaryView(shared),
        byWidget: readSelectionByWidgetView(shared),
      },
    },
    focus: readFocusState(shared, state?.widgets || {}),
    highlight: deriveHighlightState(state),
    viewport: readViewportState(shared),
    globalFilters: clone(shared?.globalFilters || {}),
    annotations: clone(state?.annotations || shared?.annotations || []),
    links: {
      definitions: readLinkDefinitions(shared),
      topology: (() => {
        const sharedTopology = readLinkTopologyState(shared)
        return Object.keys(sharedTopology).length > 0 ? sharedTopology : clone(derivedTopology || {})
      })(),
    },
  }
}

export function listAvailableActionsFromDescription(description = {}) {
  return clone(Array.isArray(description?.actions) ? description.actions : [])
}

export function listAvailablePerceptionsFromDescription(description = {}) {
  return clone(Array.isArray(description?.perceptionQueries) ? description.perceptionQueries : [])
}

export function buildPropagationSummary({
  state = {},
  description = {},
  linkEngine = null,
  sourceRef = null,
} = {}) {
  const shared = state?.shared || {}
  const registry = readSelectionRegistry(shared)
  const primarySelection = readSelectionPrimaryView(shared)
  const engineSummary = typeof linkEngine?.describeEngine === 'function'
    ? clone(linkEngine.describeEngine())
    : null
  const candidateSourceRefs = uniqueStrings([
    sourceRef,
    primarySelection?.selectionRef || null,
    ...Object.keys(registry || {}),
    shared?.focusedWidget || null,
    ...(engineSummary?.links || []).map((entry) => entry?.sourceRef || null),
  ])
  const resolvedSourceRef = sourceRef || candidateSourceRefs[0] || null
  const propagation = resolvedSourceRef && typeof linkEngine?.describePropagation === 'function'
    ? normalizePublicPropagationEntries(
      stripCompatibilityFields(clone(linkEngine.describePropagation({ sourceRef: resolvedSourceRef }))),
    )
    : []
  const evaluation = resolvedSourceRef && typeof linkEngine?.evaluatePropagation === 'function'
    ? normalizePublicPropagationEvaluation(
      stripCompatibilityFields(clone(linkEngine.evaluatePropagation({ sourceRef: resolvedSourceRef, state }))),
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

export function buildCoordinationResult({
  state = {},
  description = {},
  linkEngine = null,
  store = null,
  sourceRef = null,
  resolveTargetWidget = null,
} = {}) {
  const propagationSummary = buildPropagationSummary({
    state,
    description,
    linkEngine,
    sourceRef,
  })
  const shared = state?.shared || {}
  const primarySelection = readSelectionPrimaryView(shared)
  const widgetDescriptions = Array.isArray(description?.widgets) ? description.widgets : []
  const widgetDescriptionByRef = Object.fromEntries(
    widgetDescriptions
      .filter((entry) => typeof entry?.ref === 'string' && entry.ref.length > 0)
      .map((entry) => [entry.ref, entry]),
  )
  const widgetDescriptionById = Object.fromEntries(
    widgetDescriptions
      .filter((entry) => typeof entry?.widgetId === 'string' && entry.widgetId.length > 0)
      .map((entry) => [entry.widgetId, entry]),
  )
  const linkDescriptions = Array.isArray(description?.links) ? description.links : []
  const linkDescriptionByRef = Object.fromEntries(
    linkDescriptions
      .filter((entry) => typeof entry?.ref === 'string' && entry.ref.length > 0)
      .map((entry) => [entry.ref, entry]),
  )
  const resolveTargetDescription = (targetRef, targetWidgetId = null, linkRef = null) => {
    const linkDescription = linkDescriptionByRef[linkRef || ''] || null
    const resolvedTargetRef = targetRef || linkDescription?.to || linkDescription?.targetRef || null
    const resolvedTargetWidgetId = targetWidgetId || linkDescription?.targetWidgetId || null
    return widgetDescriptionByRef[resolvedTargetRef || '']
    || widgetDescriptionById[resolvedTargetWidgetId || '']
    || widgetDescriptionById[targetRef || '']
    || null
  }
  const isCoordinationEffect = (effect) => [
    'applyFilter',
    'applyHighlight',
    'focusTarget',
    'shareSelection',
    'transformView',
    'transformDataView',
    'transformStructure',
  ].includes(effect)
  const propagationEntries = (Array.isArray(propagationSummary?.propagation) ? propagationSummary.propagation : [])
    .filter((entry) => isCoordinationEffect(entry?.appliedEffect || entry?.declaredEffect || null))
  const activatedLinks = propagationEntries
    .map((entry) => {
      const targetDescription = resolveTargetDescription(
        entry?.targetRef || null,
        entry?.targetWidgetId || null,
        entry?.linkRef || null,
      )
      const canonicalTargetRef = targetDescription?.ref || entry?.targetRef || null
      const targetWidgetId = targetDescription?.widgetId || null
      const coordinationEffect = entry?.appliedEffect || entry?.declaredEffect || null
      const canResolveLegacyWidgetId = entry?.canApply === false
        && isLegacyPropagationSkipReason(entry?.skippedReason, 'missing_target_widget')
        && Boolean(targetDescription)
      const shouldActivate = isCoordinationEffect(coordinationEffect) && (entry?.canApply !== false || canResolveLegacyWidgetId)
      return shouldActivate
        ? {
      linkRef: entry?.linkRef || null,
      linkId: typeof entry?.linkRef === 'string' ? entry.linkRef.split('/').pop() || null : null,
      sourceRef: propagationSummary?.sourceRef || entry?.sourceSelectionRef || null,
      sourceSelectionRef: entry?.sourceSelectionRef || propagationSummary?.sourceRef || null,
      sourceWidgetId: entry?.sourceWidgetId || primarySelection?.sourceWidgetId || null,
      targetRef: canonicalTargetRef,
      targetWidgetId,
      primitive: entry?.primitive || null,
      effect: entry?.declaredEffect || null,
      declaredEffect: entry?.declaredEffect || null,
      appliedEffect: entry?.appliedEffect || null,
      responseSpec: clone(entry?.responseSpec || null),
      activationPolicy: entry?.activationPolicy || 'automatic',
      effectConstraint: entry?.effectConstraint ?? null,
        }
        : null
    })
    .filter(Boolean)
  const skippedTargets = [
    ...propagationEntries
      .map((entry) => {
        const targetDescription = resolveTargetDescription(
          entry?.targetRef || null,
          entry?.targetWidgetId || null,
          entry?.linkRef || null,
        )
        const coordinationEffect = entry?.appliedEffect || entry?.declaredEffect || null
        if (!isCoordinationEffect(coordinationEffect)) return null
        if (
          entry?.canApply === false
          && isLegacyPropagationSkipReason(entry?.skippedReason, 'missing_target_widget')
          && targetDescription
        ) {
          return null
        }
        if (entry?.canApply !== false) return null
        return {
        linkRef: entry?.linkRef || null,
        linkId: typeof entry?.linkRef === 'string' ? entry.linkRef.split('/').pop() || null : null,
        targetRef: targetDescription?.ref || entry?.targetRef || null,
        targetWidgetId: targetDescription?.widgetId || null,
        primitive: entry?.primitive || null,
        declaredEffect: entry?.declaredEffect || null,
        appliedEffect: entry?.appliedEffect || null,
        responseSpec: clone(entry?.responseSpec || null),
        activationPolicy: entry?.activationPolicy || 'automatic',
        effectConstraint: entry?.effectConstraint ?? null,
        reason: normalizeCanonicalPropagationSkipReason(entry?.skippedReason, 'noApplicableLink'),
        }
      })
      .filter(Boolean),
    ...widgetDescriptions
      .filter((widget) => widget?.widgetId && widget.widgetId !== (primarySelection?.sourceWidgetId || null))
      .filter((widget) => !activatedLinks.some((entry) => entry?.targetWidgetId === widget.widgetId))
      .filter((widget) => !propagationEntries.some((entry) => {
        const targetDescription = resolveTargetDescription(
          entry?.targetRef || null,
          entry?.targetWidgetId || null,
          entry?.linkRef || null,
        )
        return (targetDescription?.widgetId || entry?.targetWidgetId || null) === widget.widgetId
      }))
      .map((widget) => ({
        linkRef: null,
        linkId: null,
        targetRef: widget.ref || null,
        targetWidgetId: widget.widgetId || null,
        primitive: null,
        declaredEffect: null,
        appliedEffect: null,
        responseSpec: null,
        activationPolicy: null,
        effectConstraint: null,
        reason: normalizeCanonicalPropagationSkipReason('no_applicable_link', 'noApplicableLink'),
      })),
  ]
  const affectedTargets = activatedLinks.map((link) => {
    const targetDescription = resolveTargetDescription(link.targetRef || null, link.targetWidgetId || null, link.linkRef || null)
    const verificationContract = describeWidgetVerificationContract(targetDescription?.kind || null)
    const verificationGuidance = buildTargetVerificationGuidance(
      verificationContract,
      link.appliedEffect,
      link.responseSpec || null,
    )
    return {
      targetRef: link.targetRef,
      targetWidgetId: link.targetWidgetId,
      effect: link.appliedEffect,
      declaredEffect: link.declaredEffect,
      responseSpec: clone(link.responseSpec || null),
      activationPolicy: link.activationPolicy,
      effectConstraint: link.effectConstraint,
      linkId: link.linkId,
      verification: verificationContract,
      verificationGuidance,
    }
  })
  const verificationGuidance = affectedTargets.map((target) => ({
    targetRef: target.targetRef,
    targetWidgetId: target.targetWidgetId,
    effect: target.effect,
    responseSpec: clone(target.responseSpec || null),
    activationPolicy: target.activationPolicy,
    effectConstraint: target.effectConstraint,
    verificationType: target.verificationGuidance.verificationType,
    preferredReadMethod: target.verificationGuidance.preferredReadMethod,
    effectChecks: [...target.verificationGuidance.effectChecks],
  }))
  const verificationSteps = affectedTargets.map((target) => buildTargetVerificationStep(target))
  const verificationResults = executeVerificationSteps(store, verificationSteps, resolveTargetWidget)
  const verification = summarizeVerificationResults(verificationResults)
  return {
    changed: false,
    propagationSummary: {
      active: activatedLinks.length > 0 || skippedTargets.length > 0,
      sourceRef: propagationSummary?.sourceRef || primarySelection?.selectionRef || null,
      sourceSelectionRef: primarySelection?.selectionRef || propagationSummary?.sourceRef || null,
      sourceWidgetId: primarySelection?.sourceWidgetId || null,
      selectionRef: primarySelection?.selectionRef || null,
      selectionSummary: primarySelection?.summary || null,
      targetWidgetIds: uniqueStrings(affectedTargets.map((target) => target.targetWidgetId)),
      linkCount: activatedLinks.length,
      links: activatedLinks,
      activatedLinks,
      affectedTargets,
      skippedTargets,
      verificationGuidance,
      verificationSteps,
      topology: propagationSummary?.topology || null,
    },
    verificationSteps,
    verificationResults,
    verification,
  }
}

export function buildRuntimeObservation({
  description = {},
  state = {},
  coordinationState = null,
  availableActions = [],
  availablePerceptions = [],
  propagationSummary = null,
  latestCoordinationResult = null,
} = {}) {
  return {
    workspace: clone(description),
    state: clone(state),
    coordination: coordinationState ? clone(coordinationState) : null,
    availableActions: clone(availableActions),
    availablePerceptions: clone(availablePerceptions),
    propagation: propagationSummary ? clone(propagationSummary) : null,
    latestCoordinationResult: clone(latestCoordinationResult),
  }
}
