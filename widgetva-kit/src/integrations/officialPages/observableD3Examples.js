import { createProviderFamilyAdapter } from '../../adapters/widgetFamilies/index.js'
import { installBrowserExtensionBridge } from '../../transports/browserExtensionBridge.js'
import { createWidgetInstance } from '../../widgets/widgetInstance.js'
import {
  describeObservableD3PageShape,
  isObservableD3NotebookPage,
  waitForObservableWorkerFrame,
} from './observableD3Pages.js'
import {
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
  return {
    subscribe: () => () => {},
    readSessionId: () => sessionId,
    readBaselineSpec: () => clone(baselineSpec),
    readCurrentSpec: () => clone(currentSpecRef.current),
    writeCurrentSpec(nextSpec) {
      currentSpecRef.current = clone(nextSpec)
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

export function createObservableScatterSurfaceWrapper({ frame }) {
  let currentSelection = null

  async function applySelection(selection = null) {
    currentSelection = selection && typeof selection === 'object' ? clone(selection) : null
    await invokeObservableWorker(frame, 'applyScatterSelection', {
      selection: currentSelection,
    })
  }

  return {
    getState() {
      return {
        view: {},
        selections: currentSelection ? { localBrush: clone(currentSelection) } : {},
      }
    },
    async renderFromState(widgetState = {}) {
      const selection = Object.values(widgetState?.selections || {}).find((entry) => entry?.kind === 'interval') || null
      await applySelection(selection)
    },
    async setBrush(selection) {
      return applySelection(selection)
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
  const wrapper = createObservableScatterSurfaceWrapper({ frame: workerFrame })

  if (rows.length === 0) {
    throw new Error('No scatter points were detected on the Observable D3 surface.')
  }

  const spec = buildObservableScatterSpec(rows)
  const widgetAdapter = createProviderFamilyAdapter('scatter', 'd3')
  const currentSpecRef = { current: clone(spec) }
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
    widget,
    widgetAdapter,
    readDebugSnapshot,
    previewVisibleBrush,
    renderDebugProbe,
    describeAgentContract() {
      return widget.describeAgentContract()
    },
    dispose() {
      widget.dispose()
    },
  }
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
    dispose() {
      try {
        disposeBridge?.()
      } finally {
        controller.dispose()
      }
    },
  }
}
