import { createD3WidgetAdapter } from '../../adapters/d3/D3WidgetAdapter.js'
import { installBrowserExtensionBridge } from '../../transports/browserExtensionBridge.js'
import {
  createPostActionSyncProxy,
  readControllerRecoverableState,
  restoreControllerRecoverableState,
} from './officialPageController.js'
import { createOfficialPageHostBridge } from '../../host/hostBridge.js'
import { makeWidgetRef } from '../../contracts/refs-contracts.js'
import {
  syncObservableD3BarControllerState,
  syncObservableD3LineControllerState,
  syncObservableD3ScatterControllerState,
} from './observableD3OfficialPageController.js'
import { runAgentLoopOnTarget } from '../../core/agent/adapters/agentTargetPort.js'
import { createWidgetInstance } from '../../core/rendering/widgetRuntimeSurface.js'
import { createWidgetWorkspace } from '../../workspace/widgetWorkspace.js'
import {
  describeObservableD3PageShape,
  inferObservableD3ScatterSemanticHints,
  isObservableD3NotebookPage,
} from './observableD3Pages.js'
import {
  attachWidgetVAToObservableD3ExplicitWorkspacePage,
  createObservableD3ExplicitWorkspaceRpcController,
  readWidgetVAWorkspaceContract,
} from './observableD3ExplicitWorkspaceContract.js'
import {
  createObservableBarSurfaceWrapper,
  createObservableLineSurfaceWrapper,
  createObservableScatterMatrixSurfaceWrapper,
  createObservableScatterSurfaceWrapper,
  invokeObservableWorker,
  waitForObservableD3RpcHost,
  waitForObservableWorkerBarSurface,
  waitForObservableWorkerLineSurface,
  waitForObservableWorkerScatterMatrixSurface,
  waitForObservableWorkerScatterSurface,
} from './observableD3Materializers.js'
import {
  inferObservableD3LineBindings,
  inferObservableD3ScatterFieldBindings,
  readObservableD3BarRows,
  readObservableD3LineRows,
  summarizeObservableD3ScatterRows,
} from './observableD3Surface.js'
import { buildObservableD3NativeContract } from './observableD3NativeContract.js'
import { getWidgetFamily } from '../../widgets/families/index.js'

export {
  createObservableBarSurfaceWrapper,
  createObservableLineSurfaceWrapper,
  createObservableScatterMatrixSurfaceWrapper,
  createObservableScatterSurfaceWrapper,
} from './observableD3Materializers.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function createD3FamilyAdapter(kind) {
  return createD3WidgetAdapter({ kind: getWidgetFamily(kind).kind })
}

function readNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function buildObservableScatterSpec(rows = []) {
  const fieldBindings = inferObservableD3ScatterFieldBindings(rows)
  const xField = fieldBindings?.xField || '__screenX'
  const yField = fieldBindings?.yField || '__screenY'
  return {
    data: {
      values: rows,
    },
    mark: 'point',
    encoding: {
      x: { field: xField, type: 'quantitative' },
      y: { field: yField, type: 'quantitative' },
    },
  }
}

function normalizeIdToken(value, fallback = 'field') {
  const token = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return token || fallback
}

function buildObservableScatterMatrixCellWidgetId(cell = {}, index = 0) {
  return `cell_${normalizeIdToken(cell.xField, `x_${index + 1}`)}_${normalizeIdToken(cell.yField, `y_${index + 1}`)}`
}

function buildObservableScatterMatrixCellSpec(cell = {}, rows = []) {
  return {
    data: {
      values: rows,
    },
    mark: 'point',
    encoding: {
      x: {
        field: cell.xField || '__screenX',
        type: 'quantitative',
      },
      y: {
        field: cell.yField || '__screenY',
        type: 'quantitative',
      },
    },
  }
}

function readNumericExtent(rows = [], fieldName = null) {
  if (!fieldName) return null
  const values = (Array.isArray(rows) ? rows : [])
    .map((row) => row?.[fieldName])
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
  if (values.length === 0) return null
  return [Math.min(...values), Math.max(...values)]
}

function buildObservableScatterMatrixWorkspaceSpec({ cells = [], rows = [], nativeContract = null } = {}) {
  const nativeActionsByTargetRef = new Map()
  for (const action of Array.isArray(nativeContract?.actions) ? nativeContract.actions : []) {
    if (typeof action?.targetRef !== 'string' || typeof action?.name !== 'string') continue
    const names = nativeActionsByTargetRef.get(action.targetRef) || []
    names.push(action.name)
    nativeActionsByTargetRef.set(action.targetRef, names)
  }

  const widgets = cells.map((cell, index) => {
    const nativeActionNames = nativeActionsByTargetRef.get(cell.ref) || []
    const exposedActionNames = nativeActionNames.length > 0
      ? [...new Set([...nativeActionNames, 'widget.clearSelection'])]
      : []
    return {
      widgetId: buildObservableScatterMatrixCellWidgetId(cell, index),
      role: index === 0 ? 'primary' : 'linkedScatter',
      kind: 'scatter',
      provider: 'd3',
      title: `${cell.yField || 'y'} vs ${cell.xField || 'x'}`,
      description: 'Observable D3 scatterplot matrix cell.',
      exposedActionNames,
      exposedPerceptionNames: [
        'perception.inspectViewConfig',
        'perception.summarizeSelection',
        'perception.summarizeVisible',
      ],
      source: {
        kind: 'templateSpec',
        spec: buildObservableScatterMatrixCellSpec(cell, rows),
      },
      usageNotes: exposedActionNames.includes('scatter.brushRegion')
        ? [
            'This widget is one cell in the Observable D3 scatterplot matrix.',
            'Use scatter.brushRegion with this widget ref to drive the page native D3 brush for this cell.',
          ]
        : [
            'This widget is one cell in the Observable D3 scatterplot matrix.',
            'This official page cell did not expose a captured native D3 brush action.',
          ],
    }
  })

  const links = []
  for (const source of widgets) {
    for (const target of widgets) {
      if (source.widgetId === target.widgetId) continue
      links.push({
        linkId: `${source.widgetId}_shares_selection_${target.widgetId}`,
        kind: 'sharesSelection',
        sourceWidgetId: source.widgetId,
        targetWidgetId: target.widgetId,
        activationPolicy: 'automatic',
        description: `${source.title} shares selected rows with ${target.title}.`,
      })
    }
  }

  return {
    topology: 'T3',
    widgets,
    links,
  }
}

async function readObservableD3NativeContract(rpcHost, { timeoutMs = 5000 } = {}) {
  try {
    const captureSnapshot = await invokeObservableWorker(rpcHost, 'readNativeCapture', null, {
      timeoutMs: Math.min(timeoutMs, 1000),
    })
    return buildObservableD3NativeContract(captureSnapshot || {})
  } catch {
    return buildObservableD3NativeContract({ brushBindings: [] })
  }
}

function buildObservableScatterMatrixAgentCells(cellModels = []) {
  return cellModels.map((model) => {
    const rows = Array.isArray(model.cell?.rows)
      ? model.cell.rows
      : Array.isArray(model.spec?.data?.values)
        ? model.spec.data.values
        : []
    const xField = model.cell?.xField || null
    const yField = model.cell?.yField || null
    return {
      ref: model.widgetRef,
      xField,
      yField,
      xDomain: readNumericExtent(rows, xField),
      yDomain: readNumericExtent(rows, yField),
    }
  })
}

function summarizeObservableScatterMatrix({ cells = [], brush = null } = {}) {
  const cellCount = Array.isArray(cells) ? cells.length : 0
  const brushText = brush?.targetRef
    ? ` Current brush targets ${brush.targetRef}.`
    : ' No brush is currently active.'
  return `Observable D3 scatterplot matrix with ${cellCount} targetable scatter cells.${brushText}`
}

function buildObservableScatterMatrixObservationMeta({ cells = [], brush = null } = {}) {
  return {
    provider: 'd3',
    kind: 'scatterMatrix',
    cellCount: Array.isArray(cells) ? cells.length : 0,
    cells: clone(cells),
    currentBrush: brush ? clone(brush) : null,
    summary: summarizeObservableScatterMatrix({ cells, brush }),
  }
}

function normalizeAllowedActionNamesByWidgetRef(allowedActionNamesByWidgetRef = {}) {
  const entries = allowedActionNamesByWidgetRef instanceof Map
    ? [...allowedActionNamesByWidgetRef.entries()]
    : Object.entries(allowedActionNamesByWidgetRef || {})
  return new Map(entries.map(([widgetRef, names]) => [
    widgetRef,
    new Set((Array.isArray(names) ? names : []).filter((name) => typeof name === 'string' && name.length > 0)),
  ]))
}

function filterObservableD3WidgetActionNames(widget = {}, allowedByWidgetRef = new Map()) {
  const allowedNames = allowedByWidgetRef.get(widget?.ref) || new Set()
  return {
    ...(widget || {}),
    actionNames: (Array.isArray(widget?.actionNames) ? widget.actionNames : [])
      .filter((name) => allowedNames.has(name)),
  }
}

function filterObservableD3WorkspaceDescription(description = {}, allowedByWidgetRef = new Map()) {
  const allowedNames = new Set([...allowedByWidgetRef.values()].flatMap((names) => [...names]))
  return {
    ...(description || {}),
    widgets: (Array.isArray(description?.widgets) ? description.widgets : [])
      .map((widget) => filterObservableD3WidgetActionNames(widget, allowedByWidgetRef)),
    actions: (Array.isArray(description?.actions) ? description.actions : [])
      .filter((action) => allowedNames.has(action?.name)),
  }
}

function assertObservableD3ActionAllowed(call = {}, allowedByWidgetRef = new Map()) {
  const actionName = typeof call?.name === 'string' ? call.name : null
  if (!actionName) return
  const targetRef = call?.target?.widgetRef || call?.queryScope?.widgetRef || null
  if (targetRef && allowedByWidgetRef.get(targetRef)?.has(actionName)) return
  if (!targetRef && [...allowedByWidgetRef.values()].some((names) => names.has(actionName))) return
  throw new Error(`Unsupported Observable D3 official-page action: ${actionName}.`)
}

function createObservableD3ActionFilteredWorkspaceApi(workspaceApi, {
  allowedActionNamesByWidgetRef = {},
} = {}) {
  if (!workspaceApi || typeof workspaceApi !== 'object') return workspaceApi
  const allowedByWidgetRef = normalizeAllowedActionNamesByWidgetRef(allowedActionNamesByWidgetRef)

  return new Proxy(workspaceApi, {
    get(target, prop, receiver) {
      if (prop === 'describeWorkspace' || prop === 'describe') {
        const original = Reflect.get(target, prop, receiver)
        if (typeof original !== 'function') return original
        return (...args) => filterObservableD3WorkspaceDescription(
          original.apply(target, args),
          allowedByWidgetRef,
        )
      }
      if (prop === 'readObservation') {
        const original = Reflect.get(target, prop, receiver)
        if (typeof original !== 'function') return original
        return (...args) => {
          const observation = original.apply(target, args)
          return {
            ...(observation || {}),
            state: {
              ...(observation?.state || {}),
              widgets: Array.isArray(observation?.state?.widgets)
                ? observation.state.widgets.map((widget) => filterObservableD3WidgetActionNames(widget, allowedByWidgetRef))
                : observation?.state?.widgets,
            },
          }
        }
      }
      if (prop === 'executeAction' || prop === 'executeActionAndCommitCoordination') {
        const original = Reflect.get(target, prop, receiver)
        if (typeof original !== 'function') return original
        return async (call, ...args) => {
          assertObservableD3ActionAllowed(call, allowedByWidgetRef)
          return original.call(target, call, ...args)
        }
      }
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

function createObservableScatterMatrixWorkspaceApi(workspaceApi, {
  cells = [],
  readBrush = null,
  allowedActionNamesByWidgetRef = {},
} = {}) {
  if (!workspaceApi || typeof workspaceApi !== 'object') return workspaceApi
  const allowedByWidgetRef = normalizeAllowedActionNamesByWidgetRef(allowedActionNamesByWidgetRef)

  function readMatrixMeta() {
    return buildObservableScatterMatrixObservationMeta({
      cells,
      brush: typeof readBrush === 'function' ? readBrush() : null,
    })
  }

  return new Proxy(workspaceApi, {
    get(target, prop, receiver) {
      if (prop === 'describeWorkspace' || prop === 'describe') {
        const original = Reflect.get(target, prop, receiver)
        if (typeof original !== 'function') return original
        return (...args) => {
          const description = original.apply(target, args)
          return filterObservableD3WorkspaceDescription({
            ...(description || {}),
            provider: 'd3',
            workspaceKind: 'scatterMatrix',
            matrix: readMatrixMeta(),
          }, allowedByWidgetRef)
        }
      }
      if (prop === 'readObservation') {
        const original = Reflect.get(target, prop, receiver)
        if (typeof original !== 'function') return original
        return (...args) => {
          const observation = original.apply(target, args)
          const matrix = readMatrixMeta()
          return {
            ...(observation || {}),
            state: {
              ...(observation?.state || {}),
              widgets: Array.isArray(observation?.state?.widgets)
                ? observation.state.widgets.map((widget) => filterObservableD3WidgetActionNames(widget, allowedByWidgetRef))
                : observation?.state?.widgets,
              summary: matrix.summary,
              matrix,
            },
            view: {
              ...(observation?.view || {}),
              summary: matrix.summary,
            },
          }
        }
      }
      if (prop === 'executeAction' || prop === 'executeActionAndCommitCoordination') {
        const original = Reflect.get(target, prop, receiver)
        if (typeof original !== 'function') return original
        return async (call, ...args) => {
          assertObservableD3ActionAllowed(call, allowedByWidgetRef)
          return original.call(target, call, ...args)
        }
      }
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
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
  const bindings = inferObservableD3LineBindings(rows)
  const encoding = {
    x: {
      field: bindings?.xField || 'xValue',
      type: bindings?.xType || 'nominal',
    },
    y: {
      field: bindings?.yField || '__seriesIndex',
      type: 'quantitative',
    },
  }

  if (Array.isArray(rows) && rows.some((row) => row?.series != null && row.series !== '')) {
    encoding.color = { field: 'series', type: 'nominal' }
  }

  return {
    data: {
      values: rows,
    },
    mark: 'line',
    encoding,
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

function createOfficialPageAgentLoopRunner(agentTarget) {
  return async function runOfficialPageAgentLoop(options = {}) {
    if (!agentTarget || typeof agentTarget.describeWorkspace !== 'function') {
      throw new Error('WidgetVA page port is not ready for official-page agent-loop execution.')
    }
    return runAgentLoopOnTarget(agentTarget, options)
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
  const scatterSemanticHints = inferObservableD3ScatterSemanticHints(pageShape)
  const rpcHost = await waitForObservableD3RpcHost(root, {
    root,
    timeoutMs,
    pollMs,
  })
  const scatterSurface = await waitForObservableWorkerScatterSurface(rpcHost, {
    timeoutMs,
    pollMs,
    notebook: pageShape?.notebook || null,
    semanticHints: scatterSemanticHints,
  })
  const surfaceDescription = scatterSurface?.surface || null
  const route = rpcHost === root ? 'top-page' : 'worker'

  const rows = Array.isArray(scatterSurface?.rows) ? scatterSurface.rows : []

  if (rows.length === 0) {
    throw new Error('No scatter points were detected on the Observable D3 surface.')
  }

  const nativeContract = await readObservableD3NativeContract(rpcHost, { timeoutMs })
  const spec = buildObservableScatterSpec(rows)
  const widgetAdapter = createD3FamilyAdapter('scatter')
  const currentSpecRef = { current: clone(spec) }
  const wrapper = createObservableScatterSurfaceWrapper({
    frame: rpcHost,
    currentSpecRef,
    nativeBrushBindings: nativeContract?.native?.brushBindings || [],
  })
  const widget = createWidgetInstance({
    widgetAdapter,
    spec,
    runtimeOptions: {
      hostBridge: createOfficialPageHostBridge({
        sessionId: sessionId || `official-observable-d3-${pageShape?.notebook?.slug || 'scatterplot'}`,
        baselineSpec: spec,
        currentSpecRef,
        userIntent,
        emitOnWrite: true,
      }),
      registerDefaultWidgetFamilies: true,
    },
  })

  await widget.mount({
    view: wrapper,
    surface: root.document?.documentElement || null,
    spec,
  })

  const syncSpecDrivenState = async (actionContext = null) => syncObservableD3ScatterControllerState({
    widget,
    wrapper,
    currentSpecRef,
    actionContext,
  })

  const widgetApi = createPostActionSyncProxy(widget, syncSpecDrivenState)
  const pagePort = root?.__widgetVA
    ? createPostActionSyncProxy(root.__widgetVA, syncSpecDrivenState)
    : null
  if (pagePort) {
    root.__widgetVA = pagePort
  }
  const workspace = createWidgetWorkspace({
    runtime: widget.runtime,
    widgets: [widgetApi],
  })
  const workspaceApi = createPostActionSyncProxy(workspace, syncSpecDrivenState)
  const widgetRef = widget.resolveWidgetRef?.() || widgetApi.resolveWidgetRef?.() || null
  const hasNativeBrushAction = (Array.isArray(nativeContract?.actions) ? nativeContract.actions : [])
    .some((action) => action?.name === 'scatter.brushRegion')
  const observedWorkspaceApi = createObservableD3ActionFilteredWorkspaceApi(workspaceApi, {
    allowedActionNamesByWidgetRef: widgetRef
      ? {
          [widgetRef]: hasNativeBrushAction
            ? ['scatter.brushRegion', 'widget.clearSelection']
            : [],
        }
      : {},
  })

  await syncSpecDrivenState()

  async function readDebugSnapshot() {
    const snapshot = await wrapper.readDebugSnapshot()
    return {
      provider: 'd3',
      kind: 'scatter',
      pageShape,
      surface: surfaceDescription,
      route,
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
    return invokeObservableWorker(rpcHost, 'renderDebugProbe', null, {
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
    workspace: observedWorkspaceApi,
    widgetAdapter,
    runAgentLoop: createOfficialPageAgentLoopRunner(observedWorkspaceApi),
    readRecoverableState() {
      return readControllerRecoverableState(widget)
    },
    async restoreRecoverableState(state) {
      return restoreControllerRecoverableState(widget, state, 'Observable D3 scatter controller')
    },
    readDebugSnapshot,
    previewVisibleBrush,
    renderDebugProbe,
    dispose() {
      workspace.dispose()
      widget.dispose()
    },
  }
}

export async function attachWidgetVAToObservableD3ScatterMatrixPage({
  root = globalThis.window,
  sessionId = null,
  userIntent = 'Analyze and manipulate the current official Observable D3 scatterplot matrix through WidgetVA structured actions.',
  timeoutMs = 5000,
  pollMs = 25,
} = {}) {
  const pageUrl = root?.location?.href || ''
  if (!isObservableD3NotebookPage(pageUrl)) {
    throw new Error(`Unsupported Observable D3 URL: ${pageUrl}`)
  }

  const pageShape = describeObservableD3PageShape(root)
  const scatterSemanticHints = inferObservableD3ScatterSemanticHints(pageShape)
  const rpcHost = await waitForObservableD3RpcHost(root, {
    root,
    timeoutMs,
    pollMs,
  })
  const matrixSurface = await waitForObservableWorkerScatterMatrixSurface(rpcHost, {
    timeoutMs,
    pollMs,
    notebook: pageShape?.notebook || null,
    semanticHints: scatterSemanticHints,
  })
  const cells = Array.isArray(matrixSurface?.cells) ? matrixSurface.cells : []
  const rows = Array.isArray(matrixSurface?.matrix?.rows) ? matrixSurface.matrix.rows : []
  if (cells.length < 2) {
    throw new Error('No scatterplot matrix cells were detected on the Observable D3 surface.')
  }
  if (rows.length === 0) {
    throw new Error('No scatterplot matrix rows were detected on the Observable D3 surface.')
  }

  const workspaceId = sessionId || `official-observable-d3-${pageShape?.notebook?.slug || 'scatterplot-matrix'}`
  const nativeContract = await readObservableD3NativeContract(rpcHost, { timeoutMs })
  const workspaceSpec = buildObservableScatterMatrixWorkspaceSpec({ cells, rows, nativeContract })
  const primarySpec = buildObservableScatterMatrixCellSpec(cells[0], rows)
  const currentSpecRef = { current: clone(primarySpec) }
  const cellModels = cells.map((cell, index) => {
    const widgetId = buildObservableScatterMatrixCellWidgetId(cell, index)
    const widgetRef = makeWidgetRef({ workspaceId, widgetId })
    return {
      cell,
      widgetId,
      widgetRef,
      spec: buildObservableScatterMatrixCellSpec(cell, rows),
    }
  })
  const cellRefByWidgetRef = Object.fromEntries(
    cellModels.map((model) => [model.widgetRef, model.cell.ref]),
  )
  const nativeActionNamesByTargetRef = new Map()
  for (const action of Array.isArray(nativeContract?.actions) ? nativeContract.actions : []) {
    if (typeof action?.targetRef !== 'string' || typeof action?.name !== 'string') continue
    const names = nativeActionNamesByTargetRef.get(action.targetRef) || []
    names.push(action.name)
    nativeActionNamesByTargetRef.set(action.targetRef, names)
  }
  const allowedActionNamesByWidgetRef = Object.fromEntries(
    cellModels.map((model) => {
      const nativeActionNames = nativeActionNamesByTargetRef.get(model.cell.ref) || []
      return [
        model.widgetRef,
        nativeActionNames.length > 0
          ? [...new Set([...nativeActionNames, 'widget.clearSelection'])]
          : [],
      ]
    }),
  )
  const agentCells = buildObservableScatterMatrixAgentCells(cellModels)
  const wrapper = createObservableScatterMatrixSurfaceWrapper({
    frame: rpcHost,
    cellRefByWidgetRef,
    nativeBrushBindings: nativeContract?.native?.brushBindings || [],
  })
  const hostBridge = createOfficialPageHostBridge({
    sessionId: workspaceId,
    baselineSpec: primarySpec,
    currentSpecRef,
    workspaceSpec,
    userIntent,
    emitOnWrite: true,
  })

  const widgets = []
  let runtime = null
  for (const model of cellModels) {
    const widget = createWidgetInstance({
      runtime,
      widgetAdapter: createD3FamilyAdapter('scatter'),
      widgetRef: model.widgetRef,
      widgetId: model.widgetId,
      spec: model.spec,
      runtimeOptions: runtime
        ? {}
        : {
            hostBridge,
            registerDefaultWidgetFamilies: true,
          },
    })
    runtime = runtime || widget.runtime
    await widget.mount({
      view: wrapper,
      surface: root.document?.documentElement || null,
      spec: model.spec,
    })
    widgets.push(widget)
  }

  const widgetApis = widgets.map((widget) => createPostActionSyncProxy(
    widget,
    async () => {
      await wrapper.renderFromState(widget.readState?.() || null)
      return { recoverableState: readRecoverableState() }
    },
  ))
  const workspace = createWidgetWorkspace({
    runtime,
    widgets: widgetApis,
  })
  const syncWorkspaceAction = async ({ args = [], result = null } = {}) => {
    const call = args[0] || {}
    const targetRef =
      call?.target?.widgetRef
      || result?.actionResult?.updatedRefs?.[0]
      || result?.updatedRefs?.[0]
      || null
    const targetWidget = targetRef
      ? widgets.find((widget) => widget.resolveWidgetRef?.() === targetRef)
      : null
    if (targetWidget) {
      await wrapper.renderFromState(targetWidget.readState?.() || null)
    }
    return { recoverableState: readRecoverableState() }
  }
  const workspaceApi = createPostActionSyncProxy(workspace, syncWorkspaceAction)
  const observedWorkspaceApi = createObservableScatterMatrixWorkspaceApi(workspaceApi, {
    cells: agentCells,
    readBrush: () => wrapper.readRecoverableState?.()?.brush || null,
    allowedActionNamesByWidgetRef,
  })
  const pagePort = root?.__widgetVA
    ? createPostActionSyncProxy(root.__widgetVA, async () => {
        const brush = wrapper.readRecoverableState()?.brush || null
        const targetWidget = brush?.targetRef
          ? widgets.find((widget) => widget.resolveWidgetRef?.() === brush.targetRef)
          : null
        if (targetWidget) {
          await wrapper.renderFromState(targetWidget.readState?.() || null)
        }
        return { recoverableState: readRecoverableState() }
      })
    : null
  if (pagePort) {
    root.__widgetVA = pagePort
  }

  async function readDebugSnapshot() {
    const snapshot = await wrapper.readDebugSnapshot()
    return {
      provider: 'd3',
      kind: 'scatterMatrix',
      pageShape,
      surface: matrixSurface?.surface || null,
      route: rpcHost === root ? 'top-page' : 'worker',
      cells,
      ...snapshot,
    }
  }

  function readRecoverableState() {
    return {
      stateId: workspace.readState?.()?.stateId || null,
      ...(wrapper.readRecoverableState?.() || {}),
    }
  }

  async function restoreRecoverableState(state = {}) {
    if (state?.stateId) {
      await workspace.jumpToState({ stateId: state.stateId })
    }
    await wrapper.restoreRecoverableState({
      brush: state && Object.prototype.hasOwnProperty.call(state, 'brush')
        ? state.brush
        : wrapper.readRecoverableState?.()?.brush || null,
    })
    return {
      ok: true,
      restored: true,
      stateId: state?.stateId || workspace.readState?.()?.stateId || null,
      brush: wrapper.readRecoverableState?.()?.brush || null,
    }
  }

  async function renderDebugProbe() {
    return invokeObservableWorker(rpcHost, 'renderDebugProbe', null, {
      timeoutMs,
    })
  }

  return {
    provider: 'd3',
    kind: 'scatterMatrix',
    pageShape,
    surface: matrixSurface?.surface || null,
    rows,
    cells,
    widgets: widgetApis,
    widget: widgetApis[0] || null,
    workspace: observedWorkspaceApi,
    widgetAdapter: widgetApis[0]?.widgetAdapter || null,
    runAgentLoop: createOfficialPageAgentLoopRunner(observedWorkspaceApi),
    readRecoverableState,
    restoreRecoverableState,
    readDebugSnapshot,
    renderDebugProbe,
    dispose() {
      workspace.dispose()
      for (const widget of widgets) {
        widget.dispose()
      }
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
  const rpcHost = await waitForObservableD3RpcHost(root, {
    root,
    timeoutMs,
    pollMs,
  })
  const barSurface = await waitForObservableWorkerBarSurface(rpcHost, {
    timeoutMs,
    pollMs,
    notebook: pageShape?.notebook || null,
  })
  const surfaceDescription = barSurface?.surface || null
  const route = rpcHost === root ? 'top-page' : 'worker'

  const rows = Array.isArray(barSurface?.rows) ? barSurface.rows : []
  if (rows.length === 0) {
    throw new Error('No bars were detected on the Observable D3 surface.')
  }

  const spec = buildObservableBarSpec(rows)
  const widgetAdapter = createD3FamilyAdapter('bar')
  const currentSpecRef = { current: clone(spec) }
  const wrapper = createObservableBarSurfaceWrapper({ frame: rpcHost, currentSpecRef })
  const widget = createWidgetInstance({
    widgetAdapter,
    spec,
    runtimeOptions: {
      hostBridge: createOfficialPageHostBridge({
        sessionId: sessionId || `official-observable-d3-${pageShape?.notebook?.slug || 'bar-chart'}`,
        baselineSpec: spec,
        currentSpecRef,
        userIntent,
        emitOnWrite: true,
      }),
      registerDefaultWidgetFamilies: true,
    },
  })

  await widget.mount({
    view: wrapper,
    surface: root.document?.documentElement || null,
    spec,
  })

  const syncSpecDrivenState = async (actionContext = null) => syncObservableD3BarControllerState({
    widget,
    wrapper,
    actionContext,
  })

  const widgetApi = createPostActionSyncProxy(widget, syncSpecDrivenState)
  const pagePort = root?.__widgetVA
    ? createPostActionSyncProxy(root.__widgetVA, syncSpecDrivenState)
    : null
  if (pagePort) {
    root.__widgetVA = pagePort
  }
  const workspace = createWidgetWorkspace({
    runtime: widget.runtime,
    widgets: [widgetApi],
  })

  await syncSpecDrivenState()

  async function readDebugSnapshot() {
    const snapshot = await wrapper.readDebugSnapshot()
    return {
      provider: 'd3',
      kind: 'bar',
      pageShape,
      surface: surfaceDescription,
      route,
      ...snapshot,
    }
  }

  async function renderDebugProbe() {
    return invokeObservableWorker(rpcHost, 'renderDebugProbe', null, {
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
    workspace,
    widgetAdapter,
    runAgentLoop: createOfficialPageAgentLoopRunner(workspace),
    readRecoverableState() {
      return readControllerRecoverableState(widget)
    },
    async restoreRecoverableState(state) {
      return restoreControllerRecoverableState(widget, state, 'Observable D3 bar controller')
    },
    readDebugSnapshot,
    renderDebugProbe,
    dispose() {
      workspace.dispose()
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
  const rpcHost = await waitForObservableD3RpcHost(root, {
    root,
    timeoutMs,
    pollMs,
  })
  const lineSurface = await waitForObservableWorkerLineSurface(rpcHost, {
    timeoutMs,
    pollMs,
    notebook: pageShape?.notebook || null,
  })
  const surfaceDescription = lineSurface?.surface || null
  const route = rpcHost === root ? 'top-page' : 'worker'

  const rows = Array.isArray(lineSurface?.rows) ? lineSurface.rows : []
  if (rows.length === 0) {
    throw new Error('No line rows were detected on the Observable D3 surface.')
  }

  const spec = buildObservableLineSpec(rows)
  const widgetAdapter = createD3FamilyAdapter('line')
  const currentSpecRef = { current: clone(spec) }
  const wrapper = createObservableLineSurfaceWrapper({ frame: rpcHost, currentSpecRef })
  const widget = createWidgetInstance({
    widgetAdapter,
    spec,
    runtimeOptions: {
      hostBridge: createOfficialPageHostBridge({
        sessionId: sessionId || `official-observable-d3-${pageShape?.notebook?.slug || 'line-chart'}`,
        baselineSpec: spec,
        currentSpecRef,
        userIntent,
        emitOnWrite: true,
      }),
      registerDefaultWidgetFamilies: true,
    },
  })

  await widget.mount({
    view: wrapper,
    surface: root.document?.documentElement || null,
    spec,
  })

  const syncState = async (actionContext = null) => syncObservableD3LineControllerState({
    widget,
    wrapper,
    currentSpecRef,
    actionContext,
  })

  const widgetApi = createPostActionSyncProxy(widget, syncState)
  const pagePort = root?.__widgetVA
    ? createPostActionSyncProxy(root.__widgetVA, syncState)
    : null
  if (pagePort) root.__widgetVA = pagePort
  await syncState()
  const workspace = createWidgetWorkspace({
    runtime: widget.runtime,
    widgets: [widgetApi],
  })

  async function readDebugSnapshot() {
    const snapshot = await wrapper.readDebugSnapshot()
    return {
      provider: 'd3',
      kind: 'line',
      pageShape,
      surface: surfaceDescription,
      route,
      ...snapshot,
    }
  }

  async function renderDebugProbe() {
    return invokeObservableWorker(rpcHost, 'renderDebugProbe', null, {
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
    workspace,
    widgetAdapter,
    runAgentLoop: createOfficialPageAgentLoopRunner(workspace),
    readRecoverableState() {
      return readControllerRecoverableState(widget)
    },
    async restoreRecoverableState(state) {
      return restoreControllerRecoverableState(widget, state, 'Observable D3 line controller')
    },
    readDebugSnapshot,
    renderDebugProbe,
    dispose() {
      workspace.dispose()
      widget.dispose()
    },
  }
}

export async function attachWidgetVAToObservableD3Page(options = {}) {
  const root = options?.root || globalThis.window
  if (readWidgetVAWorkspaceContract(root)) {
    return attachWidgetVAToObservableD3ExplicitWorkspacePage(options)
  }

  const pageShape = describeObservableD3PageShape(root)
  const notebook = pageShape?.notebook || null
  const timeoutMs = options?.timeoutMs || 5000
  const pollMs = options?.pollMs || 25
  const notebookSlug = notebook?.slug || ''
  if (notebookSlug.includes('scatterplot-matrix') || notebookSlug.includes('matrix')) {
    return attachWidgetVAToObservableD3ScatterMatrixPage(options)
  }
  let inferredKind = null
  try {
    const rpcHost = await waitForObservableD3RpcHost(root, {
      root,
      timeoutMs,
      pollMs,
    })
    const explicitWorkspaceDescription = await invokeObservableWorker(rpcHost, 'describeExplicitWorkspaceContract', null, {
      timeoutMs: Math.min(timeoutMs, 1000),
    }).catch(() => null)
    if (explicitWorkspaceDescription) {
      return createObservableD3ExplicitWorkspaceRpcController({
        root,
        rpcHost,
        invokeWorker: invokeObservableWorker,
        description: explicitWorkspaceDescription,
        sessionId: options?.sessionId || null,
        userIntent: options?.userIntent,
        timeoutMs,
      })
    }

    const scatterSemanticHints = inferObservableD3ScatterSemanticHints(pageShape)
    const matrixResult = await invokeObservableWorker(rpcHost, 'readScatterMatrix', {
      semanticHints: scatterSemanticHints,
    }, {
      timeoutMs: Math.min(timeoutMs, 1000),
    }).catch(() => null)
    if (Array.isArray(matrixResult?.cells) && matrixResult.cells.length > 1) {
      return attachWidgetVAToObservableD3ScatterMatrixPage(options)
    }

    const surface = await invokeObservableWorker(rpcHost, 'describeSurface', {
      notebook,
    }, {
      timeoutMs: Math.min(timeoutMs, 1000),
    })
    inferredKind = typeof surface?.inferredKind === 'string' ? surface.inferredKind : null

    if (!['bar', 'line', 'scatter'].includes(inferredKind)) {
      const [barRowsResult, lineRowsResult, scatterRowsResult] = await Promise.all([
        invokeObservableWorker(rpcHost, 'readBarRows', null, {
          timeoutMs: Math.min(timeoutMs, 1000),
        }).catch(() => null),
        invokeObservableWorker(rpcHost, 'readLineRows', null, {
          timeoutMs: Math.min(timeoutMs, 1000),
        }).catch(() => null),
        invokeObservableWorker(rpcHost, 'readScatterRows', {
          semanticHints: scatterSemanticHints,
        }, {
          timeoutMs: Math.min(timeoutMs, 1000),
        }).catch(() => null),
      ])

      const barRows = Array.isArray(barRowsResult?.rows) ? barRowsResult.rows : []
      const lineRows = Array.isArray(lineRowsResult?.rows) ? lineRowsResult.rows : []
      const scatterRows = Array.isArray(scatterRowsResult?.rows) ? scatterRowsResult.rows : []

      if (barRows.length > 0) inferredKind = 'bar'
      else if (lineRows.length > 0) inferredKind = 'line'
      else if (scatterRows.length > 0) inferredKind = 'scatter'
    }
  } catch {}

  if (inferredKind === 'bar') {
    return attachWidgetVAToObservableD3BarPage(options)
  }
  if (inferredKind === 'line') {
    return attachWidgetVAToObservableD3LinePage(options)
  }
  if (inferredKind === 'scatter') {
    return attachWidgetVAToObservableD3ScatterPage(options)
  }

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
  forceReattach = false,
} = {}) {
  const controller = await attachWidgetVAToObservableD3ScatterPage({
    root,
    sessionId,
    userIntent,
    timeoutMs,
    pollMs,
    forceReattach,
  })

  const disposeBridge = enableExtensionBridge
    ? installBrowserExtensionBridge({ root })
    : () => {}

  return {
    ...controller,
    pagePort: root?.__widgetVA || null,
    runAgentLoop: createOfficialPageAgentLoopRunner(controller.workspace),
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
  forceReattach = false,
} = {}) {
  const controller = await attachWidgetVAToObservableD3Page({
    root,
    sessionId,
    userIntent,
    timeoutMs,
    pollMs,
    forceReattach,
  })

  const disposeBridge = enableExtensionBridge
    ? installBrowserExtensionBridge({ root })
    : () => {}

  return {
    ...controller,
    pagePort: root?.__widgetVA || controller?.pagePort || null,
    runAgentLoop: createOfficialPageAgentLoopRunner(controller.workspace),
    dispose() {
      try {
        disposeBridge?.()
      } finally {
        controller.dispose()
      }
    },
  }
}
