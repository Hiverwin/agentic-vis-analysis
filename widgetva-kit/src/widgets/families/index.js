import { barFamily } from './bar/index.js'
import { heatmapFamily } from './heatmap/index.js'
import { lineFamily } from './line/index.js'
import { parallelCoordinatesFamily } from './parallelCoordinates/index.js'
import { sankeyFamily } from './sankey/index.js'
import { scatterFamily } from './scatter/index.js'
import { registerBarActions } from './bar/runtimeActions.js'
import { registerHeatmapActions } from './heatmap/runtimeActions.js'
import { registerLineActions } from './line/runtimeActions.js'
import { registerParallelCoordinatesActions } from './parallelCoordinates/runtimeActions.js'
import { registerSankeyActions } from './sankey/runtimeActions.js'
import { registerScatterActions } from './scatter/runtimeActions.js'
import { makeActionDescriptor } from '../../contracts/action-contracts.js'

export {
  barFamily,
  heatmapFamily,
  lineFamily,
  parallelCoordinatesFamily,
  sankeyFamily,
  scatterFamily,
}

const defaultWidgetFamily = Object.freeze({
  kind: 'custom',
  actions: Object.freeze({}),
  perception: Object.freeze({}),
  interactionProfile: Object.freeze({}),
})

const widgetFamiliesByKind = new Map([
  ['scatter', scatterFamily],
  ['bar', barFamily],
  ['line', lineFamily],
  ['heatmap', heatmapFamily],
  ['parallelCoordinates', parallelCoordinatesFamily],
  ['sankey', sankeyFamily],
  ['custom', defaultWidgetFamily],
])

const runtimeActionRegistrarsByKind = new Map([
  ['scatter', registerScatterActions],
  ['bar', registerBarActions],
  ['line', registerLineActions],
  ['heatmap', registerHeatmapActions],
  ['parallelCoordinates', registerParallelCoordinatesActions],
  ['sankey', registerSankeyActions],
])

function normalizeSupportedWidgetKinds(descriptor = {}, familyKind = null) {
  if (Array.isArray(descriptor.supportedWidgetKinds) && descriptor.supportedWidgetKinds.length > 0) {
    return descriptor.supportedWidgetKinds
  }
  if (descriptor.targetKind) return [descriptor.targetKind]
  if (familyKind) return [familyKind]
  return undefined
}

function normalizeExtensionDescriptor(descriptor = {}, familyKind = null) {
  return {
    ...descriptor,
    supportedWidgetKinds: normalizeSupportedWidgetKinds(descriptor, familyKind),
  }
}

function normalizeExtensionEntries(entries) {
  if (!entries) return []
  if (Array.isArray(entries)) return entries
  if (typeof entries === 'object') return Object.values(entries)
  return []
}

function hasExtensionEntries(entries) {
  return normalizeExtensionEntries(entries).some((entry) => typeof entry?.handler === 'function')
}

function registerExtensionActions(family, { actionExecutor, store } = {}) {
  for (const entry of normalizeExtensionEntries(family?.actions)) {
    const descriptor = normalizeExtensionDescriptor(entry?.descriptor || entry, family?.kind)
    if (!descriptor?.name || typeof entry?.handler !== 'function') continue
    store?.upsertActionDescriptor?.(descriptor.name, descriptor)
    actionExecutor?.register?.(descriptor, entry.handler)
  }
}

function registerExtensionPerceptions(family, { perceptionExecutor, store } = {}) {
  for (const entry of normalizeExtensionEntries(family?.perceptions || family?.perceptionQueries)) {
    const descriptor = normalizeExtensionDescriptor(entry?.descriptor || entry, family?.kind)
    if (!descriptor?.name || typeof entry?.handler !== 'function') continue
    store?.upsertPerceptionDescriptor?.(descriptor.name, descriptor)
    perceptionExecutor?.register?.(
      descriptor,
      async (_call, ctx) => entry.handler(ctx.readCallParams(), ctx),
      { supportedWidgetKinds: descriptor.supportedWidgetKinds },
    )
  }
}

export function getWidgetFamily(kind) {
  return widgetFamiliesByKind.get(kind) || defaultWidgetFamily
}

export function listWidgetFamilies() {
  return Array.from(widgetFamiliesByKind.values())
}

export function describeWidgetFamilyContract(kind) {
  const family = getWidgetFamily(kind)
  return typeof family?.describeContract === 'function'
    ? family.describeContract()
    : {
        kind: family?.kind || kind || null,
        actionNames: [],
        perceptionNames: [],
      }
}

export function buildWidgetFamilyActionDescriptors(kind, args = {}) {
  return (getWidgetFamily(kind)?.actions?.buildDescriptors?.(args) || []).map((descriptor) => (
    descriptor?.effects?.length && descriptor?.affectedStatePaths?.length
      ? descriptor
      : makeActionDescriptor(descriptor)
  ))
}

export function buildWidgetFamilyPerceptionDescriptors(kind, args = {}) {
  return getWidgetFamily(kind)?.perception?.buildDescriptors?.(args) || []
}

export function getWidgetFamilyHumanInteractionConfig(kind, args = {}) {
  return getWidgetFamily(kind)?.interactionProfile?.getConfig?.(args) || null
}

export function registerWidgetFamilyRuntime(kind, { actionExecutor, perceptionExecutor } = {}) {
  const family = getWidgetFamily(kind)
  runtimeActionRegistrarsByKind.get(family.kind)?.(actionExecutor)
  family.perception?.register?.(perceptionExecutor)
}

export function registerRuntimeWidgetFamily(family, { actionExecutor, perceptionExecutor, store } = {}) {
  if (!family || typeof family !== 'object') {
    throw new Error('registerWidgetFamily requires a widget family object.')
  }
  if (!family.kind) {
    throw new Error('registerWidgetFamily requires family.kind.')
  }

  const builtinFamily = getWidgetFamily(family.kind)
  const hasExtensions = hasExtensionEntries(family.actions)
    || hasExtensionEntries(family.perceptions)
    || hasExtensionEntries(family.perceptionQueries)
  if (builtinFamily === family || !hasExtensions) {
    registerWidgetFamilyRuntime(family.kind, { actionExecutor, perceptionExecutor })
    return family
  }

  registerExtensionActions(family, { actionExecutor, store })
  registerExtensionPerceptions(family, { perceptionExecutor, store })
  return family
}

export function registerDefaultWidgetFamiliesRuntime({ actionExecutor, perceptionExecutor } = {}) {
  for (const family of listWidgetFamilies()) {
    registerWidgetFamilyRuntime(family.kind, {
      actionExecutor,
      perceptionExecutor,
    })
  }
}
