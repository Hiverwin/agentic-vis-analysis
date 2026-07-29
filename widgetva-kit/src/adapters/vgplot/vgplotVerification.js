import { cloneJsonValue as clone } from '../../shared/clone.js'
import { readVgplotState } from './vgplotState.js'

function stableStringify(value) {
  if (value == null) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

function isEqual(left, right) {
  return stableStringify(left) === stableStringify(right)
}

function normalizeSnapshot(snapshot = null) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null
  return {
    selection: clone(snapshot.selection ?? null),
    viewport: clone(snapshot.viewport ?? null),
    config: clone(snapshot.config ?? null),
    binding: clone(snapshot.binding ?? null),
    providerState: clone(snapshot.providerState ?? null),
  }
}

function inferNativePath({ actionName = null, afterState = null, delta = {} } = {}) {
  if (delta.selectionChanged) {
    const selectionType = afterState?.selection?.type || null
    return selectionType ? `selection.${selectionType}` : 'selection'
  }
  if (delta.viewportChanged) {
    const viewportDrivers = Array.isArray(afterState?.providerState?.viewportDrivers)
      ? afterState.providerState.viewportDrivers
      : []
    return viewportDrivers[0] || 'viewport'
  }
  if (delta.configChanged) {
    return actionName ? `configAction.${actionName}` : 'configAction'
  }
  return null
}

function summarizeChangedKinds(changedKinds = []) {
  if (!Array.isArray(changedKinds) || changedKinds.length === 0) {
    return 'No provider-native selection, viewport, or config delta was detected.'
  }
  if (changedKinds.length === 1) {
    return `Provider-native ${changedKinds[0]} state changed.`
  }
  return `Provider-native ${changedKinds.join(', ')} state changed.`
}

export function buildVgplotVerificationEvidence({
  actionName = null,
  beforeState = null,
  afterState = null,
  view = null,
  runtime = null,
} = {}) {
  const normalizedBefore = normalizeSnapshot(beforeState)
  const normalizedAfter = normalizeSnapshot(afterState || readVgplotState({ view, runtime }))
  const delta = {
    selectionChanged: !isEqual(normalizedBefore?.selection ?? null, normalizedAfter?.selection ?? null),
    viewportChanged: !isEqual(normalizedBefore?.viewport ?? null, normalizedAfter?.viewport ?? null),
    configChanged: !isEqual(normalizedBefore?.config ?? null, normalizedAfter?.config ?? null),
  }
  const changedKinds = [
    ...(delta.selectionChanged ? ['selection'] : []),
    ...(delta.viewportChanged ? ['viewport'] : []),
    ...(delta.configChanged ? ['config'] : []),
  ]
  const nativePath = inferNativePath({
    actionName,
    afterState: normalizedAfter,
    delta,
  })
  const ok = changedKinds.length > 0

  return {
    ok,
    summary: ok
      ? [
          summarizeChangedKinds(changedKinds),
          nativePath ? `Native path: ${nativePath}.` : null,
        ].filter(Boolean).join(' ')
      : 'No provider-native state delta was observed after the requested step.',
    checks: {
      providerNativePath: {
        ok: nativePath != null,
        summary: nativePath
          ? `Verification mapped this step to ${nativePath}.`
          : 'No provider-native path could be inferred from the resulting runtime state.',
        path: nativePath,
      },
      stateChange: {
        ok,
        summary: summarizeChangedKinds(changedKinds),
        changedKinds,
      },
      visualChange: {
        ok,
        summary: ok
          ? `A visible provider-native surface changed on ${changedKinds[0]}.`
          : 'No visible provider-native surface change was detected.',
        primarySurface: changedKinds[0] || null,
      },
    },
    stateChange: {
      ok,
      changedKinds,
    },
    visualChange: {
      ok,
      primarySurface: changedKinds[0] || null,
      selectionType: normalizedAfter?.selection?.type || null,
      viewportDrivers: Array.isArray(normalizedAfter?.providerState?.viewportDrivers)
        ? [...normalizedAfter.providerState.viewportDrivers]
        : [],
    },
    evidence: {
      before: normalizedBefore,
      after: normalizedAfter,
      delta,
    },
  }
}
