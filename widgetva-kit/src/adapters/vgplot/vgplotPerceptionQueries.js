import { readVgplotState } from './vgplotState.js'
import { buildVgplotVerificationEvidence } from './vgplotVerification.js'

function stringifyValue(value) {
  if (value == null) return 'null'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function buildSelectionSummary(selection) {
  if (!selection) return 'No provider-native selection is active.'
  const selectionType = selection?.type || 'unknown'
  return `Active selection type: ${selectionType}; value=${stringifyValue(selection?.value ?? selection)}`
}

function buildViewportSummary(viewport) {
  if (!viewport) return 'No provider-native viewport is active.'
  const segments = []
  if (Array.isArray(viewport?.xDomain)) {
    segments.push(`xDomain=${stringifyValue(viewport.xDomain)}`)
  }
  if (Array.isArray(viewport?.yDomain)) {
    segments.push(`yDomain=${stringifyValue(viewport.yDomain)}`)
  }
  if (viewport?.zoom) {
    segments.push(`zoom=${stringifyValue(viewport.zoom)}`)
  }
  return segments.length > 0
    ? `Active viewport: ${segments.join(', ')}`
    : 'No provider-native viewport is active.'
}

function buildBindingSummary(binding) {
  if (!binding) return 'No widget/data binding metadata is attached.'
  const parts = []
  if (binding.widgetKind) parts.push(`widgetKind=${binding.widgetKind}`)
  if (binding.widgetRef) parts.push(`widgetRef=${binding.widgetRef}`)
  if (binding.dataRef) parts.push(`dataRef=${binding.dataRef}`)
  if (Array.isArray(binding.fields) && binding.fields.length > 0) {
    parts.push(`fields=${binding.fields.join(',')}`)
  }
  return parts.length > 0
    ? `Binding metadata: ${parts.join('; ')}`
    : 'Binding metadata is attached.'
}

export function queryVgplotPerception({
  perceptionName = null,
  view = null,
  runtime = null,
  state = null,
  actionName = null,
  beforeState = null,
} = {}) {
  if (perceptionName == null) return null
  const snapshot = readVgplotState({ view, runtime, state })
  if (perceptionName === 'provider.inspectSelection') {
    return {
      perceptionName,
      ok: true,
      summary: buildSelectionSummary(snapshot.selection),
      result: {
        selection: snapshot.selection,
        providerState: snapshot.providerState,
      },
    }
  }
  if (perceptionName === 'provider.inspectViewport') {
    return {
      perceptionName,
      ok: true,
      summary: buildViewportSummary(snapshot.viewport),
      result: {
        viewport: snapshot.viewport,
        providerState: snapshot.providerState,
      },
    }
  }
  if (perceptionName === 'provider.inspectBinding') {
    return {
      perceptionName,
      ok: true,
      summary: buildBindingSummary(snapshot.binding),
      result: {
        binding: snapshot.binding,
        providerState: snapshot.providerState,
      },
    }
  }
  if (perceptionName === 'provider.inspectVerification') {
    const verification = buildVgplotVerificationEvidence({
      actionName,
      beforeState,
      afterState: snapshot,
      view,
      runtime,
    })
    return {
      perceptionName,
      ok: true,
      summary: verification.summary,
      result: verification,
    }
  }
  return {
    perceptionName,
    ok: true,
    summary: 'Provider-native runtime snapshot captured.',
    result: snapshot,
  }
}
