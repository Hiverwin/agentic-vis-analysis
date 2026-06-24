import { getWidgetFamilyAdapter } from '../adapters/widgetFamilies/index.js'
import { createWidgetInstance } from './widgetInstance.js'

export const SUPPORTED_WIDGET_TYPES = [
  'bar',
  'line',
  'scatter',
  'parallelCoordinates',
  'sankey',
  'heatmap',
]

export const WIDGET_POOL_CONSTRUCTOR_FIELDS = [
  'runtime',
  'widgetAdapter',
  'spec',
  'data',
  'sessionId',
  'runMode',
  'userIntent',
  'runtimeOptions',
  'mountOptions',
  'mountTarget',
  'renderTarget',
  'view',
  'surface',
  'container',
  'widgetRef',
  'widgetId',
  'widgetState',
]

function clone(value) {
  if (value == null) return value
  return JSON.parse(JSON.stringify(value))
}

function mergeDataIntoSpec(spec, data) {
  if (data === undefined) return spec
  const nextSpec = clone(spec || {})
  nextSpec.data = {
    ...(nextSpec.data || {}),
    values: data,
  }
  return nextSpec
}

function normalizeSpecForKind(kind, spec) {
  const nextSpec = clone(spec || {})
  if (kind === 'parallelCoordinates' || kind === 'sankey') {
    nextSpec.kind = nextSpec.kind || kind
  }
  return nextSpec
}

function createStaticHostBridge({
  spec,
  sessionId,
  runMode = 'goal_oriented',
  userIntent = '',
} = {}) {
  const baselineSpec = clone(spec || null)
  let currentSpec = clone(spec || null)

  return {
    subscribe: () => () => {},
    readSessionId: () => sessionId,
    readBaselineSpec: () => clone(baselineSpec),
    readCurrentSpec: () => clone(currentSpec),
    readWorkspaceSpec: () => null,
    readPlanningRequest: () => null,
    readRunMode: () => runMode,
    readUserIntent: () => userIntent,
    readCurrentSelection: () => null,
    readCurrentSelections: () => ({}),
    readFocusedWidgetRef: () => null,
    readWorkspaceAnnotations: () => [],
    writeCurrentSpec(nextSpec) {
      currentSpec = clone(nextSpec || null)
    },
    resetCurrentSpec() {
      currentSpec = clone(baselineSpec)
    },
  }
}

function createTypedWidget(kind, {
  runtime = null,
  widgetAdapter = null,
  spec = null,
  data = undefined,
  sessionId = `${kind}-widget`,
  runMode = 'goal_oriented',
  userIntent = '',
  runtimeOptions = {},
  mountOptions = {},
  mountTarget = null,
  renderTarget = null,
  view = null,
  surface = null,
  container = null,
  ...options
} = {}) {
  const normalizedSpec = normalizeSpecForKind(kind, mergeDataIntoSpec(spec, data))
  if (!runtime && !normalizedSpec) {
    throw new Error(`create${kind[0].toUpperCase()}${kind.slice(1)}Widget requires either a runtime or a spec.`)
  }

  const hostBridge = runtimeOptions.hostBridge || createStaticHostBridge({
    spec: normalizedSpec,
    sessionId,
    runMode,
    userIntent,
  })

  return createWidgetInstance({
    runtime,
    widgetAdapter: widgetAdapter || getWidgetFamilyAdapter(kind),
    spec: normalizedSpec,
    runtimeOptions: {
      ...runtimeOptions,
      hostBridge,
    },
    mountOptions,
    mountTarget,
    renderTarget,
    view,
    surface,
    container,
    ...options,
  })
}

export function createScatterWidget(options = {}) {
  return createTypedWidget('scatter', options)
}

export function createBarWidget(options = {}) {
  return createTypedWidget('bar', options)
}

export function createLineWidget(options = {}) {
  return createTypedWidget('line', options)
}

export function createParallelCoordinatesWidget(options = {}) {
  return createTypedWidget('parallelCoordinates', options)
}

export function createParallelCoordinateWidget(options = {}) {
  return createParallelCoordinatesWidget(options)
}

export function createSankeyWidget(options = {}) {
  return createTypedWidget('sankey', options)
}

export function createHeatmapWidget(options = {}) {
  return createTypedWidget('heatmap', options)
}
