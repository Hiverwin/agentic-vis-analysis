import { findObservableWorkerFrame } from './observableD3Pages.js'
import {
  findPrimaryObservableD3Surface,
  inferObservableD3LineBindings,
} from './observableD3Surface.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

const OBSERVABLE_D3_WORKER_REQUEST = 'widgetva:observable-d3-worker-request'
const OBSERVABLE_D3_WORKER_RESPONSE = 'widgetva:observable-d3-worker-response'
const OBSERVABLE_D3_TOP_SOURCE = 'widgetva-observable-d3-top'
const OBSERVABLE_D3_WORKER_SOURCE = 'widgetva-observable-d3-worker'

function resolveObservableD3MessageTarget(host) {
  if (host?.contentWindow && typeof host.contentWindow.postMessage === 'function') {
    return host.contentWindow
  }
  if (host && typeof host.postMessage === 'function') {
    return host
  }
  return null
}

export async function waitForObservableD3RpcHost(root, {
  timeoutMs = 5000,
  pollMs = 25,
} = {}) {
  const startedAt = Date.now()

  while ((Date.now() - startedAt) <= timeoutMs) {
    const workerFrame = findObservableWorkerFrame(root)
    if (resolveObservableD3MessageTarget(workerFrame)) {
      return workerFrame
    }

    if (findPrimaryObservableD3Surface(root) && resolveObservableD3MessageTarget(root)) {
      return root
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  throw new Error(`Timed out waiting for an Observable D3 interaction host after ${timeoutMs}ms.`)
}

export async function invokeObservableWorker(host, method, params = null, { timeoutMs = 5000 } = {}) {
  const targetWindow = resolveObservableD3MessageTarget(host)
  if (!targetWindow) {
    throw new Error('Observable D3 interaction host is not available for postMessage RPC.')
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

export async function waitForObservableWorkerScatterSurface(frame, {
  timeoutMs = 5000,
  pollMs = 25,
  notebook = null,
  semanticHints = null,
} = {}) {
  const startedAt = Date.now()
  let lastSurface = null
  let lastRowCount = 0

  while ((Date.now() - startedAt) <= timeoutMs) {
    try {
      const surface = await invokeObservableWorker(frame, 'describeSurface', {
        notebook,
      }, { timeoutMs: Math.min(timeoutMs, 1000) })
      const workerRows = await invokeObservableWorker(frame, 'readScatterRows', {
        semanticHints,
      }, {
        timeoutMs: Math.min(timeoutMs, 1000),
      })
      const rows = Array.isArray(workerRows?.rows) ? workerRows.rows : []

      lastSurface = surface || null
      lastRowCount = rows.length

      const inferredKind = typeof surface?.inferredKind === 'string' ? surface.inferredKind : null
      const supportsScatterRows = inferredKind === 'scatter'
        || !['bar', 'line'].includes(inferredKind)

      if (supportsScatterRows && rows.length > 0) {
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

export async function waitForObservableWorkerScatterMatrixSurface(frame, {
  timeoutMs = 5000,
  pollMs = 25,
  notebook = null,
  semanticHints = null,
} = {}) {
  const startedAt = Date.now()
  let lastSurface = null
  let lastCellCount = 0

  while ((Date.now() - startedAt) <= timeoutMs) {
    try {
      const surface = await invokeObservableWorker(frame, 'describeSurface', {
        notebook,
      }, { timeoutMs: Math.min(timeoutMs, 1000) })
      const matrix = await invokeObservableWorker(frame, 'readScatterMatrix', {
        semanticHints,
      }, {
        timeoutMs: Math.min(timeoutMs, 1000),
      })
      const cells = Array.isArray(matrix?.cells) ? matrix.cells : []

      lastSurface = surface || null
      lastCellCount = cells.length

      if (cells.length > 1) {
        return {
          surface,
          matrix,
          cells,
        }
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  throw new Error(
    `Timed out waiting for a ready Observable D3 scatterplot matrix after ${timeoutMs}ms (last inferred kind: ${lastSurface?.inferredKind || 'unknown'}, last cell count: ${lastCellCount}).`,
  )
}

export async function waitForObservableWorkerBarSurface(frame, {
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

      const inferredKind = typeof surface?.inferredKind === 'string' ? surface.inferredKind : null
      const supportsBarRows = inferredKind === 'bar'
        || !['line', 'scatter'].includes(inferredKind)

      if (supportsBarRows && rows.length > 0) {
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

export async function waitForObservableWorkerLineSurface(frame, {
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

      const inferredKind = typeof surface?.inferredKind === 'string' ? surface.inferredKind : null
      const supportsLineRows = inferredKind === 'line'
        || !['bar', 'scatter'].includes(inferredKind)

      if (supportsLineRows && rows.length > 0) {
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

export function createObservableScatterSurfaceWrapper({
  frame,
  currentSpecRef = null,
  nativeBrushBindings = [],
} = {}) {
  let currentSelection = null
  let currentViewport = null
  let currentClusterAnnotation = null
  let currentRegressionAnnotation = null
  const nativeBrushBindingByTargetRef = new Map(
    (Array.isArray(nativeBrushBindings) ? nativeBrushBindings : [])
      .filter((binding) => typeof binding?.targetRef === 'string' && typeof binding?.bindingId === 'string')
      .map((binding) => [binding.targetRef, binding]),
  )

  function readSelectionDomains(selection = null) {
    if (!selection || typeof selection !== 'object') return null
    const xDomain = Array.isArray(selection?.domain?.xDomain)
      ? selection.domain.xDomain
      : Array.isArray(selection?.xDomain)
        ? selection.xDomain
        : Array.isArray(selection?.xRange)
          ? selection.xRange
          : Array.isArray(selection?.channels?.x?.domain)
            ? selection.channels.x.domain
            : null
    const yDomain = Array.isArray(selection?.domain?.yDomain)
      ? selection.domain.yDomain
      : Array.isArray(selection?.yDomain)
        ? selection.yDomain
        : Array.isArray(selection?.yRange)
          ? selection.yRange
          : Array.isArray(selection?.channels?.y?.domain)
            ? selection.channels.y.domain
            : null
    if (!Array.isArray(xDomain) || !Array.isArray(yDomain) || xDomain.length < 2 || yDomain.length < 2) {
      return null
    }
    return {
      xDomain: clone(xDomain.slice(0, 2)),
      yDomain: clone(yDomain.slice(0, 2)),
    }
  }

  function resolveNativeBrushBinding(selection = null) {
    const targetRef = typeof selection?.targetRef === 'string' && selection.targetRef.length > 0
      ? selection.targetRef
      : typeof selection?.sourceWidgetRef === 'string' && selection.sourceWidgetRef.length > 0
        ? selection.sourceWidgetRef
        : null
    if (targetRef && nativeBrushBindingByTargetRef.has(targetRef)) {
      return nativeBrushBindingByTargetRef.get(targetRef)
    }
    const bindings = [...nativeBrushBindingByTargetRef.values()]
    return bindings.length === 1 ? bindings[0] : null
  }

  async function applySelection(selection = null) {
    currentSelection = selection && typeof selection === 'object' ? clone(selection) : null
    const binding = resolveNativeBrushBinding(currentSelection)
    if (!currentSelection) {
      if (!binding) return undefined
      return invokeObservableWorker(frame, 'clearNativeBrush', {
        bindingId: binding.bindingId,
        targetRef: binding.targetRef,
      })
    }
    const domains = readSelectionDomains(currentSelection)
    if (!binding || !domains) {
      throw new Error('Observable D3 page does not expose a native scatter brush binding for this selection.')
    }
    return invokeObservableWorker(frame, 'applyNativeBrushRegion', {
      bindingId: binding.bindingId,
      targetRef: binding.targetRef,
      xDomain: domains.xDomain,
      yDomain: domains.yDomain,
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
    const regressionState = widgetState?.rawSpec?._scatter_regression_state
      || currentSpecRef?.current?._scatter_regression_state
    if (!regressionState || typeof regressionState !== 'object') return null
    return {
      method: regressionState.method || 'linear',
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
      if (currentViewport || (nextViewport && Object.keys(nextViewport).length > 0)) {
        await applyViewport(nextViewport)
      }
      const selection = Object.values(widgetState?.selections || {}).find((entry) => entry?.kind === 'interval') || null
      if (currentSelection || selection) {
        await applySelection(selection)
      }
      const clusterState = readClusterState(widgetState)
      if (currentClusterAnnotation || clusterState) {
        await applyClusterAnnotation(clusterState)
      }
      const regressionState = readRegressionState(widgetState)
      if (currentRegressionAnnotation || regressionState) {
        await applyRegressionAnnotation(regressionState)
      }
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

export function createObservableScatterMatrixSurfaceWrapper({
  frame,
  cellRefByWidgetRef = {},
  nativeBrushBindings = [],
} = {}) {
  let currentBrush = null
  const nativeBrushBindingByTargetRef = new Map(
    (Array.isArray(nativeBrushBindings) ? nativeBrushBindings : [])
      .filter((binding) => typeof binding?.targetRef === 'string' && typeof binding?.bindingId === 'string')
      .map((binding) => [binding.targetRef, binding]),
  )

  function normalizeBrush(brush = null) {
    if (!brush || typeof brush !== 'object') return null
    const targetRef = typeof brush.targetRef === 'string' && brush.targetRef.length > 0
      ? brush.targetRef
      : null
    const xDomain = Array.isArray(brush.xDomain)
      ? clone(brush.xDomain.slice(0, 2))
      : Array.isArray(brush.xRange)
        ? clone(brush.xRange.slice(0, 2))
        : null
    const yDomain = Array.isArray(brush.yDomain)
      ? clone(brush.yDomain.slice(0, 2))
      : Array.isArray(brush.yRange)
        ? clone(brush.yRange.slice(0, 2))
        : null
    if (!targetRef || !xDomain || !yDomain || xDomain.length < 2 || yDomain.length < 2) return null
    return {
      targetRef,
      xDomain,
      yDomain,
    }
  }

  function toPageBrush(brush = null) {
    if (!brush) return null
    return {
      ...brush,
      targetRef: cellRefByWidgetRef?.[brush.targetRef] || brush.targetRef,
    }
  }

  function toNativeBrushCommand(pageBrush = null) {
    if (!pageBrush) return null
    const binding = nativeBrushBindingByTargetRef.get(pageBrush.targetRef)
    if (!binding?.bindingId) {
      throw new Error(`Observable D3 page does not expose a native brush binding for ${pageBrush.targetRef}.`)
    }
    return {
      bindingId: binding.bindingId,
      targetRef: pageBrush.targetRef,
      xDomain: clone(pageBrush.xDomain),
      yDomain: clone(pageBrush.yDomain),
    }
  }

  async function applyBrush(brush = null) {
    const previousBrush = currentBrush
    currentBrush = normalizeBrush(brush)
    const pageBrush = toPageBrush(currentBrush)
    if (!pageBrush) {
      const previousPageBrush = toPageBrush(previousBrush)
      if (!previousPageBrush) return undefined
      const binding = nativeBrushBindingByTargetRef.get(previousPageBrush.targetRef)
      if (!binding?.bindingId) {
        throw new Error(`Observable D3 page does not expose a native brush binding for ${previousPageBrush.targetRef}.`)
      }
      return invokeObservableWorker(frame, 'clearNativeBrush', {
        bindingId: binding.bindingId,
        targetRef: previousPageBrush.targetRef,
      }, {
        timeoutMs: 15000,
      })
    }
    return invokeObservableWorker(frame, 'applyNativeBrushRegion', toNativeBrushCommand(pageBrush), {
      timeoutMs: 15000,
    })
  }

  function readBrushFromState(widgetState = {}) {
    const selections = Object.values(widgetState?.selections || {})
    const selection = selections.find((entry) => entry?.kind === 'interval' && typeof entry?.targetRef === 'string')
      || selections.find((entry) => entry?.kind === 'interval' && typeof entry?.sourceWidgetRef === 'string')
      || null
    if (!selection) return null
    const xDomain = Array.isArray(selection?.domain?.xDomain)
      ? selection.domain.xDomain
      : Array.isArray(selection?.xDomain)
        ? selection.xDomain
        : Array.isArray(selection?.channels?.x?.domain)
          ? selection.channels.x.domain
          : null
    const yDomain = Array.isArray(selection?.domain?.yDomain)
      ? selection.domain.yDomain
      : Array.isArray(selection?.yDomain)
        ? selection.yDomain
        : Array.isArray(selection?.channels?.y?.domain)
          ? selection.channels.y.domain
          : null
    return normalizeBrush({
      targetRef: selection.targetRef || selection.sourceWidgetRef || widgetState?.ref || null,
      xDomain,
      yDomain,
    })
  }

  return {
    getState() {
      return {
        view: {},
        selections: currentBrush
          ? {
              matrixBrush: {
                kind: 'interval',
                targetRef: currentBrush.targetRef,
                domain: {
                  xDomain: clone(currentBrush.xDomain),
                  yDomain: clone(currentBrush.yDomain),
                },
              },
            }
          : {},
      }
    },
    async renderFromState(widgetState = {}) {
      const nextBrush = readBrushFromState(widgetState)
      if (nextBrush) return applyBrush(nextBrush)
      if (currentBrush?.targetRef && currentBrush.targetRef === widgetState?.ref) {
        return applyBrush(null)
      }
      return undefined
    },
    async setBrush(brush) {
      return applyBrush(brush)
    },
    async setSelection(selection) {
      return applyBrush(selection)
    },
    async clearBrush() {
      return applyBrush(null)
    },
    readRecoverableState() {
      return {
        brush: currentBrush ? clone(currentBrush) : null,
      }
    },
    async restoreRecoverableState(state = {}) {
      return applyBrush(state?.brush || null)
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
  let currentHighlight = null

  function normalizeSelection(selection = null) {
    if (!selection || typeof selection !== 'object') return null
    const values = Array.isArray(selection.values)
      ? selection.values
      : Array.isArray(selection.categories)
        ? selection.categories
        : selection.value != null
          ? [selection.value]
          : []
    if (values.length === 0) return null
    const field = typeof selection.field === 'string' ? selection.field : 'category'
    const normalizedSelection = {
      ...clone(selection),
      kind: typeof selection.kind === 'string' ? selection.kind : 'category',
      field,
      values: clone(values),
    }
    if (typeof selection.summary === 'string') {
      normalizedSelection.summary = selection.summary
    }
    if (Array.isArray(selection.predicates)) {
      normalizedSelection.predicates = clone(selection.predicates)
    }
    return normalizedSelection
  }

  async function applySelection(selection = null) {
    currentSelection = normalizeSelection(selection)
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

  async function applyHighlight(highlight = null) {
    const normalizedHighlight = highlight && typeof highlight === 'object'
      ? {
          ...(typeof highlight.field === 'string' ? { field: highlight.field } : {}),
          ...(Array.isArray(highlight.categories) ? { categories: clone(highlight.categories) } : {}),
          ...(Number.isFinite(highlight.n) ? { n: Number(highlight.n) } : {}),
          ...(typeof highlight.order === 'string' ? { order: highlight.order } : {}),
        }
      : null
    currentHighlight = normalizedHighlight && Array.isArray(normalizedHighlight.categories) && normalizedHighlight.categories.length > 0
      ? normalizedHighlight
      : null
    await invokeObservableWorker(frame, 'applyBarHighlight', {
      highlight: currentHighlight,
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

  function readHighlightFromWidgetState(widgetState = {}) {
    const rawSpec = widgetState?.rawSpec || currentSpecRef?.current || {}
    const highlightState = rawSpec?._bar_highlight_state
    if (!highlightState || typeof highlightState !== 'object') return null
    return {
      categories: Array.isArray(highlightState.categories) ? clone(highlightState.categories) : [],
      field: highlightState.category_field || 'category',
      ...(Number.isFinite(highlightState.n) ? { n: Number(highlightState.n) } : {}),
      ...(typeof highlightState.order === 'string' ? { order: highlightState.order } : {}),
    }
  }

  return {
    getState() {
      return {
        view: {
          ...(currentSort ? { sort: clone(currentSort) } : {}),
          ...(currentHighlight ? { highlight: clone(currentHighlight) } : {}),
        },
        selections: currentSelection ? { localSelection: clone(currentSelection) } : {},
      }
    },
    async renderFromState(widgetState = {}) {
      const selection = Object.values(widgetState?.selections || {}).find((entry) => Array.isArray(entry?.values)) || null
      if (selection) {
        await applySelection(selection)
      }
      await applyFilter(readFilterFromWidgetState(widgetState) || readFilterFromSpec())
      await applySort(readSortFromWidgetState(widgetState))
      await applyHighlight(readHighlightFromWidgetState(widgetState))
    },
    async setSelection(selection) {
      return applySelection(selection)
    },
    async setFilter(filter) {
      return applyFilter(filter)
    },
    async setHighlight(highlight) {
      return applyHighlight(highlight)
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
  let currentResample = null
  let currentViewport = null
  let currentBold = null
  let currentFilter = null

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

  async function applyResample(resample = null) {
    const normalizedResample = resample && typeof resample === 'object'
      ? {
          ...(typeof resample.granularity === 'string' ? { granularity: resample.granularity } : {}),
          ...(typeof resample.agg === 'string' ? { agg: resample.agg } : {}),
          ...(typeof resample.xField === 'string' ? { xField: resample.xField } : {}),
          ...(typeof resample.yField === 'string' ? { yField: resample.yField } : {}),
        }
      : null
    currentResample = normalizedResample && typeof normalizedResample.granularity === 'string'
      ? normalizedResample
      : null
    await invokeObservableWorker(frame, 'applyLineResample', {
      resample: currentResample,
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

  async function applyBold(bold = null) {
    const normalizedBold = bold && typeof bold === 'object'
      ? {
          ...(Array.isArray(bold.lineNames) ? { lineNames: clone(bold.lineNames) } : {}),
          ...(typeof bold.lineField === 'string' ? { lineField: bold.lineField } : {}),
          ...(Number.isFinite(bold.boldWidth) ? { boldWidth: Number(bold.boldWidth) } : {}),
          ...(Number.isFinite(bold.baseWidth) ? { baseWidth: Number(bold.baseWidth) } : {}),
        }
      : null
    currentBold = normalizedBold && Array.isArray(normalizedBold.lineNames) && normalizedBold.lineNames.length > 0
      ? normalizedBold
      : null
    await invokeObservableWorker(frame, 'applyLineBold', {
      bold: currentBold,
    })
  }

  async function applyFilter(filter = null) {
    const normalizedFilter = filter && typeof filter === 'object'
      ? {
          ...(typeof filter.lineField === 'string' ? { lineField: filter.lineField } : {}),
          ...(Array.isArray(filter.linesToRemove) ? { linesToRemove: clone(filter.linesToRemove) } : {}),
        }
      : null
    currentFilter = normalizedFilter && Array.isArray(normalizedFilter.linesToRemove) && normalizedFilter.linesToRemove.length > 0
      ? normalizedFilter
      : null
    await invokeObservableWorker(frame, 'applyLineFilter', {
      filter: currentFilter,
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
    const trendState = rawSpec?._line_trend_state
    if (!trendState || typeof trendState !== 'object') return null
    return {
      trendType: trendState.trendType || 'regression',
    }
  }

  function readMovingAverageState(widgetState = {}) {
    const rawSpec = widgetState?.rawSpec || currentSpecRef?.current || {}
    const movingAverageState = rawSpec?._line_moving_average_state
    if (!movingAverageState || typeof movingAverageState !== 'object') return null
    const windowSize = Number.isFinite(movingAverageState.windowSize)
      ? Number(movingAverageState.windowSize)
      : 3
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

  function readResampleState(widgetState = {}) {
    const rawSpec = widgetState?.rawSpec || currentSpecRef?.current || {}
    const resampleState = rawSpec?._resample_state
    if (!resampleState || typeof resampleState !== 'object') return null
    const bindings = inferObservableD3LineBindings(Array.isArray(rawSpec?.data?.values) ? rawSpec.data.values : [])
    return {
      ...(typeof resampleState.current_granularity === 'string'
        ? { granularity: resampleState.current_granularity }
        : {}),
      ...(typeof resampleState.current_agg === 'string'
        ? { agg: resampleState.current_agg }
        : {}),
      ...(typeof bindings?.xField === 'string' ? { xField: bindings.xField } : {}),
      ...(typeof bindings?.yField === 'string' ? { yField: bindings.yField } : {}),
    }
  }

  function readBoldState(widgetState = {}) {
    const rawSpec = widgetState?.rawSpec || currentSpecRef?.current || {}
    const boldState = rawSpec?._line_bold_state
    if (!boldState || typeof boldState !== 'object') return null
    return {
      lineNames: Array.isArray(boldState.line_names) ? clone(boldState.line_names) : [],
      lineField: boldState.line_field || 'series',
      ...(Number.isFinite(boldState.bold_width) ? { boldWidth: Number(boldState.bold_width) } : {}),
      ...(Number.isFinite(boldState.base_width) ? { baseWidth: Number(boldState.base_width) } : {}),
    }
  }

  function readFilterState(widgetState = {}) {
    const rawSpec = widgetState?.rawSpec || currentSpecRef?.current || {}
    const filterState = rawSpec?._line_filter_state
    if (!filterState || typeof filterState !== 'object') return null
    const field = filterState.lineField || filterState.line_field || null
    const linesToRemove = Array.isArray(filterState.linesToRemove)
      ? clone(filterState.linesToRemove)
      : Array.isArray(filterState.lines_to_remove)
        ? clone(filterState.lines_to_remove)
        : []
    if (!field || linesToRemove.length === 0) return null
    return {
      lineField: field,
      linesToRemove,
    }
  }

  return {
    getState() {
      return {
        view: {
          ...(currentViewport ? clone(currentViewport) : {}),
          ...(currentFocus ? { focus: clone(currentFocus) } : {}),
          ...(currentBold ? { bold: clone(currentBold) } : {}),
          ...(currentFilter ? { filter: clone(currentFilter) } : {}),
          ...(currentTrend ? { trend: clone(currentTrend) } : {}),
          ...(currentMovingAverage ? { movingAverage: clone(currentMovingAverage) } : {}),
          ...(currentDrilldown ? { drilldown: clone(currentDrilldown) } : {}),
          ...(currentResample ? { resample: clone(currentResample) } : {}),
        },
        selections: currentSelection ? { localSelection: clone(currentSelection) } : {},
      }
    },
    async renderFromState(widgetState = {}) {
      const selection = Object.values(widgetState?.selections || {}).find((entry) => Array.isArray(entry?.values)) || null
      await applySelection(selection)
      await applyViewport(readViewportState(widgetState))
      await applyFocus(readFocusState(widgetState))
      await applyBold(readBoldState(widgetState))
      await applyFilter(readFilterState(widgetState))
      await applyTrend(readTrendState(widgetState))
      await applyMovingAverage(readMovingAverageState(widgetState))
      await applyDrilldown(readDrilldownState(widgetState))
      await applyResample(readResampleState(widgetState))
    },
    async setSelection(selection) {
      return applySelection(selection)
    },
    async setFocus(focus) {
      return applyFocus(focus)
    },
    async setBold(bold) {
      return applyBold(bold)
    },
    async setFilter(filter) {
      return applyFilter(filter)
    },
    async setTrend(trend) {
      return applyTrend(trend)
    },
    async setMovingAverage(movingAverage) {
      return applyMovingAverage(movingAverage)
    },
    async setDrilldown(drilldown) {
      return applyDrilldown(drilldown)
    },
    async setResample(resample) {
      return applyResample(resample)
    },
    async setViewport(viewport) {
      return applyViewport(viewport)
    },
    async readDebugSnapshot() {
      return invokeObservableWorker(frame, 'readDebugSnapshot', null)
    },
  }
}
