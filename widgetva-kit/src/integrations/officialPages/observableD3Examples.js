import { createProviderFamilyAdapter } from '../../adapters/widgetFamilies/index.js'
import { installBrowserExtensionBridge } from '../../transports/browserExtensionBridge.js'
import { runPagePortAgentLoop } from '../../core/runtime/pagePortAgentLoop.js'
import { createWidgetInstance } from '../../widgets/widgetInstance.js'
import {
  describeObservableD3PageShape,
  isObservableD3NotebookPage,
  waitForObservableWorkerFrame,
} from './observableD3Pages.js'
import {
  readObservableD3BarRows,
  readObservableD3LineRows,
  summarizeObservableD3ScatterRows,
} from './observableD3Surface.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function readNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function buildObservableScatterSpec(rows = []) {
  return {
    data: {
      values: rows,
    },
    mark: 'point',
    encoding: {
      x: { field: '__screenX', type: 'quantitative' },
      y: { field: '__screenY', type: 'quantitative' },
    },
  }
}

function buildObservableBarSpec(rows = []) {
  return {
    data: {
      values: rows,
    },
    mark: 'bar',
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: '__barHeight', type: 'quantitative' },
    },
  }
}

function buildObservableLineSpec(rows = []) {
  return {
    data: {
      values: rows,
    },
    mark: 'line',
    encoding: {
      x: { field: 'xValue', type: 'nominal' },
      y: { field: '__seriesIndex', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
  }
}

function buildSelectionFromRowSummary(summary) {
  if (!summary || summary.count === 0) return null
  const xSpan = summary.xMax - summary.xMin
  const ySpan = summary.yMax - summary.yMin
  return {
    kind: 'interval',
    domain: {
      xDomain: [
        summary.xMin + (xSpan * 0.25),
        summary.xMax - (xSpan * 0.25),
      ],
      yDomain: [
        summary.yMin + (ySpan * 0.25),
        summary.yMax - (ySpan * 0.25),
      ],
    },
  }
}

function createOfficialPageHostBridge({ sessionId, baselineSpec, currentSpecRef, userIntent = null }) {
  const listeners = new Set()
  const emit = () => {
    for (const listener of listeners) {
      try {
        listener()
      } catch {}
    }
  }
  return {
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {}
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    readSessionId: () => sessionId,
    readBaselineSpec: () => clone(baselineSpec),
    readCurrentSpec: () => clone(currentSpecRef.current),
    writeCurrentSpec(nextSpec) {
      currentSpecRef.current = clone(nextSpec)
      emit()
    },
    readWorkspaceSpec: () => null,
    readPlanningRequest: () => null,
    readRunMode: () => 'goal_oriented',
    readUserIntent: () => userIntent,
    readCurrentSelection: () => null,
    readCurrentSelections: () => ({}),
    readFocusedWidgetRef: () => null,
    readComparisonTargets: () => [],
    readWorkspaceAnnotations: () => [],
  }
}

function createOfficialPageAgentLoopRunner(root) {
  return async function runOfficialPageAgentLoop(options = {}) {
    const port = root?.__widgetVA || null
    if (!port || typeof port.describeWorkspace !== 'function' || typeof port.describeAgentLoop !== 'function') {
      throw new Error('WidgetVA page port is not ready for official-page agent-loop execution.')
    }
    return runPagePortAgentLoop(port, options)
  }
}

function createPostActionSyncProxy(target, syncAfterAction) {
  if (!target || typeof target !== 'object') return target
  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop === 'executeAction' || prop === 'executeVerifiedAction') {
        const original = Reflect.get(obj, prop, receiver)
        if (typeof original !== 'function') return original
        return async (...args) => {
          const result = await original.apply(obj, args)
          await syncAfterAction?.({
            method: prop,
            args,
            result,
          })
          return result
        }
      }
      const value = Reflect.get(obj, prop, receiver)
      return typeof value === 'function' ? value.bind(obj) : value
    },
  })
}

const OBSERVABLE_D3_WORKER_REQUEST = 'widgetva:observable-d3-worker-request'
const OBSERVABLE_D3_WORKER_RESPONSE = 'widgetva:observable-d3-worker-response'
const OBSERVABLE_D3_TOP_SOURCE = 'widgetva-observable-d3-top'
const OBSERVABLE_D3_WORKER_SOURCE = 'widgetva-observable-d3-worker'

async function invokeObservableWorker(frame, method, params = null, { timeoutMs = 5000 } = {}) {
  const targetWindow = frame?.contentWindow
  if (!targetWindow || typeof targetWindow.postMessage !== 'function') {
    throw new Error('Observable worker frame is not available for postMessage RPC.')
  }
  const listenerRoot = globalThis.window

  const requestId = `observable_d3_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for Observable worker RPC: ${method}.`))
    }, timeoutMs)

    const cleanup = () => {
      clearTimeout(timeout)
      listenerRoot?.removeEventListener?.('message', handleMessage)
    }

    const handleMessage = (event) => {
      const message = event?.data
      if (!message || message.source !== OBSERVABLE_D3_WORKER_SOURCE || message.type !== OBSERVABLE_D3_WORKER_RESPONSE || message.id !== requestId) {
        return
      }

      cleanup()
      if (message.ok === false) {
        reject(new Error(message?.error?.message || `Observable worker RPC failed: ${method}.`))
        return
      }
      resolve(message.result || null)
    }

    listenerRoot?.addEventListener?.('message', handleMessage)
    targetWindow.postMessage({
      source: OBSERVABLE_D3_TOP_SOURCE,
      type: OBSERVABLE_D3_WORKER_REQUEST,
      id: requestId,
      method,
      params,
    }, '*')
  })
}

async function waitForObservableWorkerScatterSurface(frame, {
  timeoutMs = 5000,
  pollMs = 25,
  notebook = null,
} = {}) {
  const startedAt = Date.now()
  let lastSurface = null
  let lastRowCount = 0

  while ((Date.now() - startedAt) <= timeoutMs) {
    try {
      const surface = await invokeObservableWorker(frame, 'describeSurface', {
        notebook,
      }, { timeoutMs: Math.min(timeoutMs, 1000) })
      const workerRows = await invokeObservableWorker(frame, 'readScatterRows', null, {
        timeoutMs: Math.min(timeoutMs, 1000),
      })
      const rows = Array.isArray(workerRows?.rows) ? workerRows.rows : []

      lastSurface = surface || null
      lastRowCount = rows.length

      if (surface?.inferredKind === 'scatter' && rows.length > 0) {
        return {
          surface,
          rows,
        }
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  throw new Error(
    `Timed out waiting for a ready Observable D3 scatter surface after ${timeoutMs}ms (last inferred kind: ${lastSurface?.inferredKind || 'unknown'}, last row count: ${lastRowCount}).`,
  )
}

async function waitForObservableWorkerBarSurface(frame, {
  timeoutMs = 5000,
  pollMs = 25,
  notebook = null,
} = {}) {
  const startedAt = Date.now()
  let lastSurface = null
  let lastRowCount = 0

  while ((Date.now() - startedAt) <= timeoutMs) {
    try {
      const surface = await invokeObservableWorker(frame, 'describeSurface', {
        notebook,
      }, { timeoutMs: Math.min(timeoutMs, 1000) })
      const workerRows = await invokeObservableWorker(frame, 'readBarRows', null, {
        timeoutMs: Math.min(timeoutMs, 1000),
      })
      const rows = Array.isArray(workerRows?.rows) ? workerRows.rows : []

      lastSurface = surface || null
      lastRowCount = rows.length

      if (surface?.inferredKind === 'bar' && rows.length > 0) {
        return {
          surface,
          rows,
        }
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  throw new Error(
    `Timed out waiting for a ready Observable D3 bar surface after ${timeoutMs}ms (last inferred kind: ${lastSurface?.inferredKind || 'unknown'}, last row count: ${lastRowCount}).`,
  )
}

async function waitForObservableWorkerLineSurface(frame, {
  timeoutMs = 5000,
  pollMs = 25,
  notebook = null,
} = {}) {
  const startedAt = Date.now()
  let lastSurface = null
  let lastRowCount = 0

  while ((Date.now() - startedAt) <= timeoutMs) {
    try {
      const surface = await invokeObservableWorker(frame, 'describeSurface', {
        notebook,
      }, { timeoutMs: Math.min(timeoutMs, 1000) })
      const workerRows = await invokeObservableWorker(frame, 'readLineRows', null, {
        timeoutMs: Math.min(timeoutMs, 1000),
      })
      const rows = Array.isArray(workerRows?.rows) ? workerRows.rows : []

      lastSurface = surface || null
      lastRowCount = rows.length

      if (surface?.inferredKind === 'line' && rows.length > 0) {
        return {
          surface,
          rows,
        }
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  throw new Error(
    `Timed out waiting for a ready Observable D3 line surface after ${timeoutMs}ms (last inferred kind: ${lastSurface?.inferredKind || 'unknown'}, last row count: ${lastRowCount}).`,
  )
}

export function createObservableScatterSurfaceWrapper({ frame, currentSpecRef = null }) {
  let currentSelection = null
  let currentViewport = null
  let currentClusterAnnotation = null
  let currentRegressionAnnotation = null

  async function applySelection(selection = null) {
    currentSelection = selection && typeof selection === 'object' ? clone(selection) : null
    await invokeObservableWorker(frame, 'applyScatterSelection', {
      selection: currentSelection,
    })
  }

  async function applyViewport(viewport = null) {
    const normalizedViewport = viewport && typeof viewport === 'object'
      ? {
          ...(Array.isArray(viewport.xDomain) ? { xDomain: clone(viewport.xDomain) } : {}),
          ...(Array.isArray(viewport.yDomain) ? { yDomain: clone(viewport.yDomain) } : {}),
        }
      : null
    currentViewport = normalizedViewport && Object.keys(normalizedViewport).length > 0
      ? normalizedViewport
      : null
    await invokeObservableWorker(frame, 'applyScatterViewport', {
      viewport: currentViewport,
    })
  }

  async function applyClusterAnnotation(cluster = null) {
    const normalizedCluster = cluster && typeof cluster === 'object'
      ? {
          ...(Number.isFinite(cluster.nClusters) ? { nClusters: Number(cluster.nClusters) } : {}),
          ...(typeof cluster.clusterField === 'string' ? { clusterField: cluster.clusterField } : {}),
          ...(typeof cluster.method === 'string' ? { method: cluster.method } : {}),
        }
      : null
    currentClusterAnnotation = normalizedCluster
    await invokeObservableWorker(frame, 'applyScatterClusters', {
      cluster: currentClusterAnnotation,
    })
  }

  async function applyRegressionAnnotation(regression = null) {
    const normalizedRegression = regression && typeof regression === 'object'
      ? {
          ...(typeof regression.method === 'string' ? { method: regression.method } : {}),
        }
      : null
    currentRegressionAnnotation = normalizedRegression
    await invokeObservableWorker(frame, 'applyScatterRegression', {
      regression: currentRegressionAnnotation,
    })
  }

  function readClusterState(widgetState = {}) {
    const clusterState = widgetState?.rawSpec?._scatter_cluster_state || currentSpecRef?.current?._scatter_cluster_state
    if (!clusterState || typeof clusterState !== 'object') return null
    return {
      nClusters: Number.isFinite(clusterState.n_clusters) ? Number(clusterState.n_clusters) : 3,
      clusterField: clusterState.cluster_field || null,
      method: clusterState.method || 'kmeans',
    }
  }

  function readRegressionState(widgetState = {}) {
    const layers = Array.isArray(widgetState?.rawSpec?.layer)
      ? widgetState.rawSpec.layer
      : Array.isArray(currentSpecRef?.current?.layer)
        ? currentSpecRef.current.layer
        : []
    const regressionLayer = layers.find((layer) => layer?._widgetvaTag === 'scatter.showRegression')
    if (!regressionLayer) return null
    const regressionTransform = Array.isArray(regressionLayer.transform)
      ? regressionLayer.transform.find((transform) => typeof transform?.regression === 'string')
      : null
    return {
      method: regressionTransform?.method || 'linear',
    }
  }

  return {
    getState() {
      return {
        view: {
          ...(currentViewport ? clone(currentViewport) : {}),
          ...(currentClusterAnnotation ? { cluster: clone(currentClusterAnnotation) } : {}),
          ...(currentRegressionAnnotation ? { regression: clone(currentRegressionAnnotation) } : {}),
        },
        selections: currentSelection ? { localBrush: clone(currentSelection) } : {},
      }
    },
    async renderFromState(widgetState = {}) {
      const nextViewport = widgetState?.view && typeof widgetState.view === 'object'
        ? {
            ...(Array.isArray(widgetState.view.xDomain) ? { xDomain: widgetState.view.xDomain } : {}),
            ...(Array.isArray(widgetState.view.yDomain) ? { yDomain: widgetState.view.yDomain } : {}),
          }
        : null
      await applyViewport(nextViewport)
      const selection = Object.values(widgetState?.selections || {}).find((entry) => entry?.kind === 'interval') || null
      await applySelection(selection)
      await applyClusterAnnotation(readClusterState(widgetState))
      await applyRegressionAnnotation(readRegressionState(widgetState))
    },
    async setBrush(selection) {
      return applySelection(selection)
    },
    async setSelection(selection) {
      return applySelection(selection)
    },
    async setViewport(viewport) {
      return applyViewport(viewport)
    },
    async setClusterAnnotation(cluster) {
      return applyClusterAnnotation(cluster)
    },
    async setRegressionAnnotation(regression) {
      return applyRegressionAnnotation(regression)
    },
    getViewport() {
      return currentViewport ? clone(currentViewport) : null
    },
    async readDebugSnapshot() {
      return invokeObservableWorker(frame, 'readDebugSnapshot', null)
    },
  }
}

export function createObservableBarSurfaceWrapper({ frame, currentSpecRef = null }) {
  let currentSelection = null
  let currentFilter = null
  let currentSort = null

  async function applySelection(selection = null) {
    currentSelection = selection && typeof selection === 'object' ? clone(selection) : null
    await invokeObservableWorker(frame, 'applyBarSelection', {
      selection: currentSelection,
    })
  }

  async function applyFilter(filter = null) {
    const normalizedFilter = filter && typeof filter === 'object'
      ? {
          field: typeof filter.field === 'string' ? filter.field : 'category',
          categories: Array.isArray(filter.categories) ? clone(filter.categories) : [],
        }
      : null
    currentFilter = normalizedFilter && currentFilter?.categories?.length !== 0
      ? normalizedFilter
      : normalizedFilter
    await invokeObservableWorker(frame, 'applyBarFilter', {
      filter: currentFilter,
    })
  }

  async function applySort(sort = null) {
    const normalizedSort = sort && typeof sort === 'object'
      ? {
          ...(typeof sort.channel === 'string' ? { channel: sort.channel } : {}),
          ...(typeof sort.field === 'string' ? { field: sort.field } : {}),
          ...(typeof sort.mode === 'string' ? { mode: sort.mode } : {}),
          ...(typeof sort.order === 'string' ? { order: sort.order } : {}),
          ...(Array.isArray(sort.values) ? { values: clone(sort.values) } : {}),
        }
      : null
    currentSort = normalizedSort && Array.isArray(normalizedSort.values) && normalizedSort.values.length > 0
      ? normalizedSort
      : null
    await invokeObservableWorker(frame, 'applyBarSort', {
      sort: currentSort,
    })
  }

  function readFilterFromSpec() {
    const transforms = Array.isArray(currentSpecRef?.current?.transform) ? currentSpecRef.current.transform : []
    const categoricalFilter = transforms.find((transform) => transform?.filter?.field && Array.isArray(transform?.filter?.oneOf))
    if (!categoricalFilter) return null
    return {
      field: categoricalFilter.filter.field,
      categories: clone(categoricalFilter.filter.oneOf),
    }
  }

  function readFilterFromWidgetState(widgetState = {}) {
    const rawSpecTransforms = Array.isArray(widgetState?.rawSpec?.transform) ? widgetState.rawSpec.transform : []
    const rawSpecFilter = rawSpecTransforms.find((transform) => transform?.filter?.field && Array.isArray(transform?.filter?.oneOf))
    if (rawSpecFilter) {
      return {
        field: rawSpecFilter.filter.field,
        categories: clone(rawSpecFilter.filter.oneOf),
      }
    }

    const runtimeTransforms = Array.isArray(widgetState?.transforms) ? widgetState.transforms : []
    const runtimeFilter = runtimeTransforms.find((transform) => transform?.spec?.filter?.field && Array.isArray(transform?.spec?.filter?.oneOf))
    if (runtimeFilter) {
      return {
        field: runtimeFilter.spec.filter.field,
        categories: clone(runtimeFilter.spec.filter.oneOf),
      }
    }

    return null
  }

  function readSortFromWidgetState(widgetState = {}) {
    const viewSort = widgetState?.view?.sort
    if (viewSort && typeof viewSort === 'object' && Array.isArray(viewSort.values) && viewSort.values.length > 0) {
      return clone(viewSort)
    }

    const rawSpecEncoding = widgetState?.rawSpec?.encoding || {}
    for (const channel of ['x', 'y']) {
      if (Array.isArray(rawSpecEncoding?.[channel]?.sort) && rawSpecEncoding[channel].sort.length > 0) {
        return {
          channel,
          field: rawSpecEncoding?.[channel]?.field || null,
          mode: 'explicitOrder',
          values: clone(rawSpecEncoding[channel].sort),
        }
      }
    }

    return null
  }

  return {
    getState() {
      return {
        view: currentSort ? { sort: clone(currentSort) } : {},
        selections: currentSelection ? { localSelection: clone(currentSelection) } : {},
      }
    },
    async renderFromState(widgetState = {}) {
      const selection = Object.values(widgetState?.selections || {}).find((entry) => Array.isArray(entry?.values)) || null
      await applySelection(selection)
      await applyFilter(readFilterFromWidgetState(widgetState) || readFilterFromSpec())
      await applySort(readSortFromWidgetState(widgetState))
    },
    async setSelection(selection) {
      return applySelection(selection)
    },
    async syncCurrentSpec() {
      return applyFilter(readFilterFromSpec())
    },
    async readDebugSnapshot() {
      return invokeObservableWorker(frame, 'readDebugSnapshot', null)
    },
  }
}

export function createObservableLineSurfaceWrapper({ frame, currentSpecRef = null }) {
  let currentSelection = null
  let currentFocus = null
  let currentTrend = null
  let currentMovingAverage = null
  let currentDrilldown = null
  let currentViewport = null

  async function applySelection(selection = null) {
    currentSelection = selection && typeof selection === 'object' ? clone(selection) : null
    await invokeObservableWorker(frame, 'applyLineSelection', {
      selection: currentSelection,
    })
  }

  async function applyFocus(focus = null) {
    const normalizedFocus = focus && typeof focus === 'object'
      ? {
          ...(Array.isArray(focus.lines) ? { lines: clone(focus.lines) } : {}),
          ...(typeof focus.lineField === 'string' ? { lineField: focus.lineField } : {}),
          ...(Number.isFinite(focus.dimOpacity) ? { dimOpacity: Number(focus.dimOpacity) } : {}),
        }
      : null
    currentFocus = normalizedFocus && Array.isArray(normalizedFocus.lines) && normalizedFocus.lines.length > 0
      ? normalizedFocus
      : null
    await invokeObservableWorker(frame, 'applyLineFocus', {
      focus: currentFocus,
    })
  }

  async function applyTrend(trend = null) {
    const normalizedTrend = trend && typeof trend === 'object'
      ? {
          ...(typeof trend.trendType === 'string' ? { trendType: trend.trendType } : {}),
        }
      : null
    currentTrend = normalizedTrend
    await invokeObservableWorker(frame, 'applyLineTrend', {
      trend: currentTrend,
    })
  }

  async function applyMovingAverage(movingAverage = null) {
    const normalizedMovingAverage = movingAverage && typeof movingAverage === 'object'
      ? {
          ...(Number.isFinite(movingAverage.windowSize) ? { windowSize: Number(movingAverage.windowSize) } : {}),
        }
      : null
    currentMovingAverage = normalizedMovingAverage
    await invokeObservableWorker(frame, 'applyLineMovingAverage', {
      movingAverage: currentMovingAverage,
    })
  }

  async function applyDrilldown(drilldown = null) {
    const normalizedDrilldown = drilldown && typeof drilldown === 'object'
      ? {
          ...(typeof drilldown.level === 'string' ? { level: drilldown.level } : {}),
          ...(Number.isFinite(drilldown.value) ? { value: Number(drilldown.value) } : {}),
          ...(drilldown.parent && typeof drilldown.parent === 'object' && !Array.isArray(drilldown.parent)
            ? { parent: clone(drilldown.parent) }
            : {}),
          ...(typeof drilldown.title === 'string' ? { title: drilldown.title } : {}),
        }
      : null
    currentDrilldown = normalizedDrilldown && typeof normalizedDrilldown.level === 'string'
      ? normalizedDrilldown
      : null
    await invokeObservableWorker(frame, 'applyLineDrilldown', {
      drilldown: currentDrilldown,
    })
  }

  async function applyViewport(viewport = null) {
    const normalizedViewport = viewport && typeof viewport === 'object'
      ? {
          ...(Array.isArray(viewport.xDomain) ? { xDomain: clone(viewport.xDomain) } : {}),
        }
      : null
    currentViewport = normalizedViewport && Array.isArray(normalizedViewport.xDomain)
      ? normalizedViewport
      : null
    await invokeObservableWorker(frame, 'applyLineViewport', {
      viewport: currentViewport,
    })
  }

  function readFocusState(widgetState = {}) {
    const rawSpec = widgetState?.rawSpec || currentSpecRef?.current || {}
    const focusState = rawSpec?._line_focus_state
    if (!focusState || typeof focusState !== 'object') return null
    const opacityCondition = rawSpec?.encoding?.opacity?.condition
    const dimOpacity = Number(rawSpec?.encoding?.opacity?.value)
    return {
      lines: Array.isArray(focusState.lines) ? clone(focusState.lines) : [],
      lineField: focusState.line_field || 'series',
      ...(Number.isFinite(dimOpacity) ? { dimOpacity } : {}),
      ...(typeof opacityCondition?.test === 'string' ? { test: opacityCondition.test } : {}),
    }
  }

  function readTrendState(widgetState = {}) {
    const rawSpec = widgetState?.rawSpec || currentSpecRef?.current || {}
    const layers = Array.isArray(rawSpec?.layer) ? rawSpec.layer : []
    const trendLayer = layers.find((layer) => layer?._widgetvaTag === 'line.highlightTrend')
    if (!trendLayer) return null
    return {
      trendType: 'regression',
    }
  }

  function readMovingAverageState(widgetState = {}) {
    const rawSpec = widgetState?.rawSpec || currentSpecRef?.current || {}
    const layers = Array.isArray(rawSpec?.layer) ? rawSpec.layer : []
    const maLayer = layers.find((layer) => layer?._widgetvaTag === 'line.showMovingAverage')
    if (!maLayer) return null
    const windowTransform = Array.isArray(maLayer.transform)
      ? maLayer.transform.find((transform) => Array.isArray(transform?.frame))
      : null
    const frameRange = windowTransform?.frame
    const windowSize = Array.isArray(frameRange) ? Math.abs(Number(frameRange[0])) + 1 : 3
    return {
      windowSize,
    }
  }

  function readDrilldownState(widgetState = {}) {
    const rawSpec = widgetState?.rawSpec || currentSpecRef?.current || {}
    const drillState = rawSpec?._line_drilldown_state
    if (!drillState || typeof drillState !== 'object') return null
    const parent = drillState.parent && typeof drillState.parent === 'object' && !Array.isArray(drillState.parent)
      ? clone(drillState.parent)
      : {}
    if (Number.isFinite(parent.month)) {
      return {
        level: 'month',
        value: Number(parent.month),
        parent: Number.isFinite(parent.year) ? { year: Number(parent.year) } : {},
        title: rawSpec?.title || '',
      }
    }
    if (Number.isFinite(parent.year)) {
      return {
        level: 'year',
        value: Number(parent.year),
        parent: {},
        title: rawSpec?.title || '',
      }
    }
    return {
      level: 'drilldown',
      parent,
      title: rawSpec?.title || '',
    }
  }

  function readViewportState(widgetState = {}) {
    const rawSpec = widgetState?.rawSpec || currentSpecRef?.current || {}
    const xDomain = rawSpec?.encoding?.x?.scale?.domain
    if (!Array.isArray(xDomain) || xDomain.length !== 2) return null
    return {
      xDomain: clone(xDomain),
    }
  }

  return {
    getState() {
      return {
        view: {
          ...(currentViewport ? clone(currentViewport) : {}),
          ...(currentFocus ? { focus: clone(currentFocus) } : {}),
          ...(currentTrend ? { trend: clone(currentTrend) } : {}),
          ...(currentMovingAverage ? { movingAverage: clone(currentMovingAverage) } : {}),
          ...(currentDrilldown ? { drilldown: clone(currentDrilldown) } : {}),
        },
        selections: currentSelection ? { localSelection: clone(currentSelection) } : {},
      }
    },
    async renderFromState(widgetState = {}) {
      const selection = Object.values(widgetState?.selections || {}).find((entry) => Array.isArray(entry?.values)) || null
      await applySelection(selection)
      await applyViewport(readViewportState(widgetState))
      await applyFocus(readFocusState(widgetState))
      await applyTrend(readTrendState(widgetState))
      await applyMovingAverage(readMovingAverageState(widgetState))
      await applyDrilldown(readDrilldownState(widgetState))
    },
    async setSelection(selection) {
      return applySelection(selection)
    },
    async readDebugSnapshot() {
      return invokeObservableWorker(frame, 'readDebugSnapshot', null)
    },
  }
}

export async function attachWidgetVAToObservableD3ScatterPage({
  root = globalThis.window,
  sessionId = null,
  userIntent = 'Analyze and manipulate the current official Observable D3 scatterplot through WidgetVA structured actions.',
  timeoutMs = 5000,
  pollMs = 25,
} = {}) {
  const pageUrl = root?.location?.href || ''
  if (!isObservableD3NotebookPage(pageUrl)) {
    throw new Error(`Unsupported Observable D3 URL: ${pageUrl}`)
  }

  const pageShape = describeObservableD3PageShape(root)
  const workerFrame = await waitForObservableWorkerFrame({
    root,
    timeoutMs,
    pollMs,
  })
  const scatterSurface = await waitForObservableWorkerScatterSurface(workerFrame, {
    timeoutMs,
    pollMs,
    notebook: pageShape?.notebook || null,
  })
  const surfaceDescription = scatterSurface?.surface || null

  if (surfaceDescription?.inferredKind !== 'scatter') {
    throw new Error(`Observable D3 page is not yet supported for WidgetVA runtime attachment: inferred kind ${surfaceDescription?.inferredKind || 'unknown'}.`)
  }

  const rows = Array.isArray(scatterSurface?.rows) ? scatterSurface.rows : []

  if (rows.length === 0) {
    throw new Error('No scatter points were detected on the Observable D3 surface.')
  }

  const spec = buildObservableScatterSpec(rows)
  const widgetAdapter = createProviderFamilyAdapter('scatter', 'd3')
  const currentSpecRef = { current: clone(spec) }
  const wrapper = createObservableScatterSurfaceWrapper({ frame: workerFrame, currentSpecRef })
  const widget = createWidgetInstance({
    widgetAdapter,
    spec,
    runtimeOptions: {
      hostBridge: createOfficialPageHostBridge({
        sessionId: sessionId || `official-observable-d3-${pageShape?.notebook?.slug || 'scatterplot'}`,
        baselineSpec: spec,
        currentSpecRef,
        userIntent,
      }),
    },
  })

  await widget.mount({
    view: wrapper,
    surface: root.document?.documentElement || null,
    spec,
  })

  const syncSpecDrivenState = async (actionContext = null) => {
    const widgetState = typeof widget.readState === 'function' ? widget.readState() : null
    if (widgetState && typeof wrapper.renderFromState === 'function') {
      await wrapper.renderFromState(widgetState)
    } else {
      await wrapper.syncCurrentSpec?.()
    }

    const actionCall = actionContext?.args?.[0]
    const actionResult = actionContext?.result
    if (!actionCall || typeof actionCall !== 'object') return

    if (actionCall.name === 'scatter.identifyClusters' && actionResult?.ok !== false) {
      const nClusters = actionResult?.result?.nClusters || actionCall?.params?.nClusters || 3
      await wrapper.setClusterAnnotation?.({
        nClusters,
        clusterField: actionResult?.result?.clusterField || `cluster_${nClusters}`,
        method: actionResult?.result?.method || actionCall?.params?.method || 'kmeans',
      })
    }

    if (actionCall.name === 'scatter.showRegression' && actionResult?.ok !== false) {
      await wrapper.setRegressionAnnotation?.({
        method: actionResult?.result?.method || actionCall?.params?.method || 'linear',
      })
    }
  }

  const widgetApi = createPostActionSyncProxy(widget, syncSpecDrivenState)
  const pagePort = root?.__widgetVA
    ? createPostActionSyncProxy(root.__widgetVA, syncSpecDrivenState)
    : null
  if (pagePort) {
    root.__widgetVA = pagePort
  }

  await syncSpecDrivenState()

  async function readDebugSnapshot() {
    const snapshot = await wrapper.readDebugSnapshot()
    return {
      provider: 'd3',
      kind: 'scatter',
      pageShape,
      surface: surfaceDescription,
      route: 'worker',
      ...snapshot,
    }
  }

  async function previewVisibleBrush() {
    const snapshot = await readDebugSnapshot()
    const selection = buildSelectionFromRowSummary(snapshot?.rowSummary || null)
    if (!selection) {
      throw new Error('Unable to preview brush because no scatter rows were detected.')
    }
    const selectionResult = await wrapper.setSelection(selection)
    return {
      ok: true,
      selection,
      selectionResult: selectionResult || null,
      snapshot,
    }
  }

  async function renderDebugProbe() {
    return invokeObservableWorker(workerFrame, 'renderDebugProbe', null, {
      timeoutMs,
    })
  }

  return {
    provider: 'd3',
    kind: 'scatter',
    pageShape,
    surface: surfaceDescription,
    rows,
    widget: widgetApi,
    widgetAdapter,
    runAgentLoop: createOfficialPageAgentLoopRunner(root),
    readDebugSnapshot,
    previewVisibleBrush,
    renderDebugProbe,
    describeAgentContract() {
      return widgetApi.describeAgentContract()
    },
    dispose() {
      widget.dispose()
    },
  }
}

export async function attachWidgetVAToObservableD3BarPage({
  root = globalThis.window,
  sessionId = null,
  userIntent = 'Analyze and manipulate the current official Observable D3 bar chart through WidgetVA structured actions.',
  timeoutMs = 5000,
  pollMs = 25,
} = {}) {
  const pageUrl = root?.location?.href || ''
  if (!isObservableD3NotebookPage(pageUrl)) {
    throw new Error(`Unsupported Observable D3 URL: ${pageUrl}`)
  }

  const pageShape = describeObservableD3PageShape(root)
  const workerFrame = await waitForObservableWorkerFrame({
    root,
    timeoutMs,
    pollMs,
  })
  const barSurface = await waitForObservableWorkerBarSurface(workerFrame, {
    timeoutMs,
    pollMs,
    notebook: pageShape?.notebook || null,
  })
  const surfaceDescription = barSurface?.surface || null

  if (surfaceDescription?.inferredKind !== 'bar') {
    throw new Error(`Observable D3 page is not yet supported for WidgetVA runtime attachment: inferred kind ${surfaceDescription?.inferredKind || 'unknown'}.`)
  }

  const rows = Array.isArray(barSurface?.rows) ? barSurface.rows : []
  if (rows.length === 0) {
    throw new Error('No bars were detected on the Observable D3 surface.')
  }

  const spec = buildObservableBarSpec(rows)
  const widgetAdapter = createProviderFamilyAdapter('bar', 'd3')
  const currentSpecRef = { current: clone(spec) }
  const wrapper = createObservableBarSurfaceWrapper({ frame: workerFrame, currentSpecRef })
  const widget = createWidgetInstance({
    widgetAdapter,
    spec,
    runtimeOptions: {
      hostBridge: createOfficialPageHostBridge({
        sessionId: sessionId || `official-observable-d3-${pageShape?.notebook?.slug || 'bar-chart'}`,
        baselineSpec: spec,
        currentSpecRef,
        userIntent,
      }),
    },
  })

  await widget.mount({
    view: wrapper,
    surface: root.document?.documentElement || null,
    spec,
  })

  const syncSpecDrivenState = async () => {
    const widgetState = typeof widget.readState === 'function' ? widget.readState() : null
    if (widgetState && typeof wrapper.renderFromState === 'function') {
      await wrapper.renderFromState(widgetState)
      return
    }
    await wrapper.syncCurrentSpec?.()
  }

  const widgetApi = createPostActionSyncProxy(widget, syncSpecDrivenState)
  const pagePort = root?.__widgetVA
    ? createPostActionSyncProxy(root.__widgetVA, syncSpecDrivenState)
    : null
  if (pagePort) {
    root.__widgetVA = pagePort
  }

  await syncSpecDrivenState()

  async function readDebugSnapshot() {
    const snapshot = await wrapper.readDebugSnapshot()
    return {
      provider: 'd3',
      kind: 'bar',
      pageShape,
      surface: surfaceDescription,
      route: 'worker',
      ...snapshot,
    }
  }

  async function renderDebugProbe() {
    return invokeObservableWorker(workerFrame, 'renderDebugProbe', null, {
      timeoutMs,
    })
  }

  return {
    provider: 'd3',
    kind: 'bar',
    pageShape,
    surface: surfaceDescription,
    rows,
    widget: widgetApi,
    widgetAdapter,
    runAgentLoop: createOfficialPageAgentLoopRunner(root),
    readDebugSnapshot,
    renderDebugProbe,
    describeAgentContract() {
      return widgetApi.describeAgentContract()
    },
    dispose() {
      widget.dispose()
    },
  }
}

export async function attachWidgetVAToObservableD3LinePage({
  root = globalThis.window,
  sessionId = null,
  userIntent = 'Analyze and manipulate the current official Observable D3 line chart through WidgetVA structured actions.',
  timeoutMs = 5000,
  pollMs = 25,
} = {}) {
  const pageUrl = root?.location?.href || ''
  if (!isObservableD3NotebookPage(pageUrl)) {
    throw new Error(`Unsupported Observable D3 URL: ${pageUrl}`)
  }

  const pageShape = describeObservableD3PageShape(root)
  const workerFrame = await waitForObservableWorkerFrame({
    root,
    timeoutMs,
    pollMs,
  })
  const lineSurface = await waitForObservableWorkerLineSurface(workerFrame, {
    timeoutMs,
    pollMs,
    notebook: pageShape?.notebook || null,
  })
  const surfaceDescription = lineSurface?.surface || null

  if (surfaceDescription?.inferredKind !== 'line') {
    throw new Error(`Observable D3 page is not yet supported for WidgetVA runtime attachment: inferred kind ${surfaceDescription?.inferredKind || 'unknown'}.`)
  }

  const rows = Array.isArray(lineSurface?.rows) ? lineSurface.rows : []
  if (rows.length === 0) {
    throw new Error('No line rows were detected on the Observable D3 surface.')
  }

  const spec = buildObservableLineSpec(rows)
  const widgetAdapter = createProviderFamilyAdapter('line', 'd3')
  const currentSpecRef = { current: clone(spec) }
  const wrapper = createObservableLineSurfaceWrapper({ frame: workerFrame, currentSpecRef })
  const widget = createWidgetInstance({
    widgetAdapter,
    spec,
    runtimeOptions: {
      hostBridge: createOfficialPageHostBridge({
        sessionId: sessionId || `official-observable-d3-${pageShape?.notebook?.slug || 'line-chart'}`,
        baselineSpec: spec,
        currentSpecRef,
        userIntent,
      }),
    },
  })

  await widget.mount({
    view: wrapper,
    surface: root.document?.documentElement || null,
    spec,
  })

  const syncState = async () => {
    const widgetState = typeof widget.readState === 'function' ? widget.readState() : null
    if (widgetState && typeof wrapper.renderFromState === 'function') {
      await wrapper.renderFromState(widgetState)
    }
  }

  const widgetApi = createPostActionSyncProxy(widget, syncState)
  const pagePort = root?.__widgetVA
    ? createPostActionSyncProxy(root.__widgetVA, syncState)
    : null
  if (pagePort) root.__widgetVA = pagePort
  await syncState()

  async function readDebugSnapshot() {
    const snapshot = await wrapper.readDebugSnapshot()
    return {
      provider: 'd3',
      kind: 'line',
      pageShape,
      surface: surfaceDescription,
      route: 'worker',
      ...snapshot,
    }
  }

  async function renderDebugProbe() {
    return invokeObservableWorker(workerFrame, 'renderDebugProbe', null, {
      timeoutMs,
    })
  }

  return {
    provider: 'd3',
    kind: 'line',
    pageShape,
    surface: surfaceDescription,
    rows,
    widget: widgetApi,
    widgetAdapter,
    readDebugSnapshot,
    renderDebugProbe,
    describeAgentContract() {
      return widgetApi.describeAgentContract()
    },
    dispose() {
      widget.dispose()
    },
  }
}

export async function attachWidgetVAToObservableD3Page(options = {}) {
  const root = options?.root || globalThis.window
  const pageShape = describeObservableD3PageShape(root)
  const notebook = pageShape?.notebook || null
  const inferredSlug = notebook?.slug || ''
  if (inferredSlug.includes('bar')) {
    return attachWidgetVAToObservableD3BarPage(options)
  }
  if (inferredSlug.includes('line') || inferredSlug.includes('index-chart')) {
    return attachWidgetVAToObservableD3LinePage(options)
  }
  return attachWidgetVAToObservableD3ScatterPage(options)
}

export async function bootstrapObservableD3ScatterPage({
  root = globalThis.window,
  sessionId = null,
  userIntent,
  timeoutMs = 5000,
  pollMs = 25,
  enableExtensionBridge = true,
} = {}) {
  const controller = await attachWidgetVAToObservableD3ScatterPage({
    root,
    sessionId,
    userIntent,
    timeoutMs,
    pollMs,
  })

  const disposeBridge = enableExtensionBridge
    ? installBrowserExtensionBridge({ root })
    : () => {}

  return {
    ...controller,
    pagePort: root?.__widgetVA || null,
    runAgentLoop: createOfficialPageAgentLoopRunner(root),
    dispose() {
      try {
        disposeBridge?.()
      } finally {
        controller.dispose()
      }
    },
  }
}

export async function bootstrapObservableD3Page({
  root = globalThis.window,
  sessionId = null,
  userIntent,
  timeoutMs = 5000,
  pollMs = 25,
  enableExtensionBridge = true,
} = {}) {
  const controller = await attachWidgetVAToObservableD3Page({
    root,
    sessionId,
    userIntent,
    timeoutMs,
    pollMs,
  })

  const disposeBridge = enableExtensionBridge
    ? installBrowserExtensionBridge({ root })
    : () => {}

  return {
    ...controller,
    pagePort: root?.__widgetVA || null,
    runAgentLoop: createOfficialPageAgentLoopRunner(root),
    dispose() {
      try {
        disposeBridge?.()
      } finally {
        controller.dispose()
      }
    },
  }
}
