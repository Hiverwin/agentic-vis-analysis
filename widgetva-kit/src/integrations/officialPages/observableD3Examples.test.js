import test from 'node:test'
import assert from 'node:assert/strict'

import { runAgentSession } from '../../core/agent/loop/runAgentLoop.js'
import { attachWidgetVAToObservableD3Page } from './observableD3Examples.js'
import { installWidgetVAWorkspaceContractRegistry } from './observableD3ExplicitWorkspaceContract.js'

function createFakeMessageRoot(
  url = 'https://observablehq.com/@d3/brushable-scatterplot-matrix',
  options = {},
) {
  const listeners = new Set()
  const workerCalls = []
  let lastBrush = null
  const exposeNativeCapture = options.exposeNativeCapture !== false
  const forceSingleScatter = options.forceSingleScatter === true
  const matrixRows = [
    { mpg: 18, hp: 130, weight: 3504 },
    { mpg: 24, hp: 95, weight: 2372 },
    { mpg: 32, hp: 70, weight: 1985 },
  ]
  const matrixCells = forceSingleScatter ? [] : [
    {
      ref: 'wl://observable-d3/scatter-matrix/cell/mpg-hp',
      xField: 'mpg',
      yField: 'hp',
      bounds: { x: 0, y: 0, width: 120, height: 120 },
      rowCount: matrixRows.length,
    },
    {
      ref: 'wl://observable-d3/scatter-matrix/cell/mpg-weight',
      xField: 'mpg',
      yField: 'weight',
      bounds: { x: 130, y: 0, width: 120, height: 120 },
      rowCount: matrixRows.length,
    },
  ]
  const root = {
    location: {
      href: url,
      pathname: new URL(url).pathname,
    },
    document: {
      documentElement: {
        dataset: {},
      },
      body: {
        innerText: 'D3 scatterplot matrix chart = Plot.plot({ x: d => d.mpg, y: d => d.hp })',
      },
      querySelectorAll(selector) {
        return selector === 'iframe' ? [workerFrame] : []
      },
    },
    addEventListener(type, listener) {
      if (type === 'message' && typeof listener === 'function') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'message') listeners.delete(listener)
    },
    dispatchMessage(data) {
      for (const listener of [...listeners]) {
        listener({ data })
      }
    },
  }
  const workerHost = {
    postMessage(message) {
      workerCalls.push(message)
      let result = null
      if (message.method === 'describeSurface') {
        result = {
          provider: 'd3',
          inferredKind: 'scatter',
          primitiveCounts: { circle: 6 },
        }
      } else if (message.method === 'readScatterMatrix') {
        result = {
          kind: 'scatterMatrix',
          cells: matrixCells,
          rows: matrixRows,
          rowCount: matrixRows.length,
        }
      } else if (message.method === 'readScatterRows') {
        result = {
          rows: matrixRows,
        }
      } else if (message.method === 'readNativeCapture') {
        result = {
          brushBindings: exposeNativeCapture
            ? (forceSingleScatter
                ? [{
                    bindingId: 'native_scatter_brush',
                    targetRef: 'wl://observable-d3/scatter/primary',
                    kind: 'scatter',
                    interaction: 'brush',
                    fields: { x: 'mpg', y: 'hp' },
                  }]
                : matrixCells.map((cell, index) => ({
                bindingId: `native_brush_${index + 1}`,
                targetRef: cell.ref,
                kind: 'scatter',
                interaction: 'brush',
                fields: { x: cell.xField, y: cell.yField },
              })))
            : [],
        }
      } else if (message.method === 'applyNativeBrushRegion') {
        lastBrush = message.params || null
        result = {
          applied: true,
          brush: lastBrush,
        }
      } else if (message.method === 'clearNativeBrush') {
        lastBrush = null
        result = {
          cleared: true,
          bindingId: message.params?.bindingId || null,
        }
      } else if (message.method === 'readDebugSnapshot') {
        result = {
          provider: 'd3',
          kind: 'scatterMatrix',
          scatterMatrixBrush: lastBrush,
        }
      }
      queueMicrotask(() => {
        root.dispatchMessage({
          source: 'widgetva-observable-d3-worker',
          type: 'widgetva:observable-d3-worker-response',
          id: message.id,
          ok: true,
          result,
        })
      })
    },
  }
  const workerFrame = {
    src: 'https://d3.static.observableusercontent.com/next/worker-test.html',
    contentWindow: workerHost,
    getAttribute(name) {
      return name === 'src' ? this.src : null
    },
    getBoundingClientRect() {
      return { width: 800, height: 600 }
    },
  }
  return {
    root,
    workerCalls,
    readLastBrush: () => lastBrush,
  }
}

test('Observable D3 page uses an explicit WidgetVA workspace contract before worker inference', async () => {
  const { root, workerCalls } = createFakeMessageRoot('https://observablehq.com/@ytchen/penguin-scatter-bar')
  const calls = []

  installWidgetVAWorkspaceContractRegistry(root).registerWorkspace({
    workspaceId: 'penguin_scatter_bar',
    widgets: [{
      widgetId: 'scatter_main',
      kind: 'scatter',
      fields: {
        x: { field: 'flipper_length_mm', type: 'quantitative' },
        y: { field: 'body_mass_g', type: 'quantitative' },
      },
      actions: {
        'scatter.brushRegion': (params) => {
          calls.push(params)
          return { selectedCount: 12 }
        },
      },
    }],
    readState() {
      return {
        summary: 'Explicit penguin demo state.',
        widgets: {
          scatter_main: { selectedCount: calls.length > 0 ? 12 : 0 },
        },
      }
    },
  })

  const controller = await attachWidgetVAToObservableD3Page({ root })
  const workspace = controller.workspace.describeWorkspace()
  const widgetRef = workspace.widgets[0]?.ref

  assert.equal(controller.source, 'explicit-widgetva-contract')
  assert.equal(workspace.source, 'explicit-widgetva-contract')
  assert.equal(workspace.widgets[0]?.actionNames[0], 'scatter.brushRegion')
  assert.deepEqual(workerCalls, [])

  const result = await controller.workspace.executeVerifiedAction({
    name: 'scatter.brushRegion',
    target: { widgetRef },
    params: { xRange: [190, 210], yRange: [3000, 4500] },
  })

  assert.equal(result.ok, true)
  assert.equal(result.actionResult.result.selectedCount, 12)
  assert.deepEqual(calls, [{ xRange: [190, 210], yRange: [3000, 4500] }])
})

test('Observable D3 matrix workspace action materializes to the page RPC and returns recoverable state', async () => {
  const previousWindow = globalThis.window
  const fakePage = createFakeMessageRoot()
  globalThis.window = fakePage.root

  try {
    const controller = await attachWidgetVAToObservableD3Page({
      root: fakePage.root,
      sessionId: 'matrix',
      timeoutMs: 200,
      pollMs: 1,
    })
    const workspace = controller.workspace.describeWorkspace()
    assert.equal(workspace.widgets.length, 2)
    const sharingLinks = workspace.links.filter((link) => link.kind === 'sharesSelection')
    assert.equal(sharingLinks.length >= 2, true)
    assert.equal(sharingLinks.every((link) => typeof link.description === 'string' && link.description.includes('shares selected rows')), true)
    assert.equal(workspace.workspaceKind, 'scatterMatrix')
    assert.equal(workspace.matrix?.cellCount, 2)
    assert.equal(workspace.matrix?.rowCount, undefined)
    assert.deepEqual(workspace.matrix?.cells?.map((cell) => [cell.xField, cell.yField]), [
      ['mpg', 'hp'],
      ['mpg', 'weight'],
    ])
    assert.deepEqual(
      [...new Set(workspace.widgets.flatMap((widget) => widget.actionNames))].sort(),
      ['scatter.brushRegion', 'widget.clearSelection'].sort(),
    )

    const targetRef = workspace.widgets[0].ref
    const initialObservation = controller.workspace.readObservation()
    assert.equal(initialObservation.state?.matrix?.kind, 'scatterMatrix')
    assert.equal(initialObservation.state?.matrix?.rowCount, undefined)
    assert.equal(initialObservation.state?.matrix?.cells?.[0]?.rowCount, undefined)
    assert.equal(initialObservation.state?.matrix?.currentBrush, null)
    assert.equal(initialObservation.state?.widgets?.length, 2)
    assert.deepEqual(initialObservation.state?.matrix?.cells?.map((cell) => cell.ref), workspace.widgets.map((widget) => widget.ref))
    assert.deepEqual(initialObservation.state?.matrix?.cells?.[0]?.xDomain, [18, 32])
    assert.deepEqual(initialObservation.state?.matrix?.cells?.[0]?.yDomain, [70, 130])

    const result = await controller.workspace.executeAction({
      name: 'scatter.brushRegion',
      target: { widgetRef: targetRef },
      params: {
        xField: 'mpg',
        yField: 'hp',
        xRange: [10, 25],
        yRange: [80, 150],
      },
    })

    assert.equal(result.ok, true)
    assert.equal(fakePage.readLastBrush()?.targetRef, 'wl://observable-d3/scatter-matrix/cell/mpg-hp')
    assert.equal(fakePage.readLastBrush()?.bindingId, 'native_brush_1')
    assert.deepEqual(fakePage.readLastBrush()?.xDomain, [10, 25])
    assert.deepEqual(fakePage.readLastBrush()?.yDomain, [80, 150])
    assert.equal(result.recoverableState?.stateId, result.stateId)
    assert.deepEqual(result.recoverableState?.brush, {
      targetRef,
      xDomain: [10, 25],
      yDomain: [80, 150],
    })

    const brushedObservation = controller.workspace.readObservation()
    assert.deepEqual(brushedObservation.state?.matrix?.currentBrush, {
      targetRef,
      xDomain: [10, 25],
      yDomain: [80, 150],
    })
    assert.match(brushedObservation.state?.summary || '', /scatterplot matrix/)

    const selectionSummary = await controller.workspace.queryPerception({
      name: 'perception.summarizeSelection',
      target: { widgetRef: targetRef },
      params: {
        fields: ['mpg', 'hp'],
        metrics: ['mean'],
      },
    })
    assert.equal(selectionSummary.ok, true)
    assert.equal(selectionSummary.result?.hasSelection, true)
    assert.equal(selectionSummary.result?.selectionCount, 1)
  } finally {
    globalThis.window = previousWindow
  }
})

test('Observable D3 matrix does not expose brush actions without native D3 brush capture', async () => {
  const previousWindow = globalThis.window
  const fakePage = createFakeMessageRoot(
    'https://observablehq.com/@d3/brushable-scatterplot-matrix',
    { exposeNativeCapture: false },
  )
  globalThis.window = fakePage.root

  try {
    const controller = await attachWidgetVAToObservableD3Page({
      root: fakePage.root,
      sessionId: 'matrix-no-native-capture',
      timeoutMs: 200,
      pollMs: 1,
    })
    const workspace = controller.workspace.describeWorkspace()

    assert.equal(workspace.widgets.length, 2)
    assert.deepEqual(
      [...new Set(workspace.widgets.flatMap((widget) => widget.actionNames))],
      [],
    )
    assert.equal(
      workspace.actions.some((action) => action.name === 'scatter.brushRegion'),
      false,
    )
    controller.dispose()
  } finally {
    globalThis.window = previousWindow
  }
})

test('Observable D3 matrix works with the existing multi-turn agent session path', async () => {
  const previousWindow = globalThis.window
  const fakePage = createFakeMessageRoot()
  globalThis.window = fakePage.root

  try {
    const controller = await attachWidgetVAToObservableD3Page({
      root: fakePage.root,
      sessionId: 'matrix-session',
      timeoutMs: 200,
      pollMs: 1,
    })
    const plannedTargets = []
    const session = await runAgentSession(controller.workspace, {
      objective: 'Find two relationships in this scatterplot matrix.',
      maxTurns: 2,
      verify: false,
      planner: ({ observe, history }) => {
        const widgets = observe?.state?.widgets || []
        const turnCount = Array.isArray(history?.turns) ? history.turns.length : 0
        const widget = widgets[Math.min(turnCount, widgets.length - 1)]
        plannedTargets.push(widget?.ref || null)
        const xField = widget?.encodings?.x?.field || 'mpg'
        const yField = widget?.encodings?.y?.field || (turnCount === 0 ? 'hp' : 'weight')
        return {
          assistantMessage: `Brush ${widget?.title || widget?.ref}.`,
          rationale: 'Use one scoped matrix brush per turn.',
          operation: {
            kind: 'action',
            name: 'scatter.brushRegion',
            target: { widgetRef: widget.ref },
            params: {
              xField,
              yField,
              xRange: [10 + turnCount, 25 + turnCount],
              yRange: turnCount === 0 ? [80, 150] : [1900, 3600],
            },
          },
        }
      },
    })

    const appliedBrushes = fakePage.workerCalls
      .filter((call) => call.method === 'applyNativeBrushRegion' && call.params)
      .map((call) => call.params)

    assert.equal(session.turns.length, 2)
    assert.equal(appliedBrushes.length, 2)
    assert.deepEqual(appliedBrushes.map((brush) => brush.targetRef), [
      'wl://observable-d3/scatter-matrix/cell/mpg-hp',
      'wl://observable-d3/scatter-matrix/cell/mpg-weight',
    ])
    assert.deepEqual(session.turns.map((turn) => turn.act?.recoverableState?.brush?.targetRef), plannedTargets)
  } finally {
    globalThis.window = previousWindow
  }
})

test('Observable D3 matrix restoreRecoverableState replays the rendered page brush', async () => {
  const previousWindow = globalThis.window
  const fakePage = createFakeMessageRoot()
  globalThis.window = fakePage.root

  try {
    const controller = await attachWidgetVAToObservableD3Page({
      root: fakePage.root,
      sessionId: 'matrix-restore',
      timeoutMs: 200,
      pollMs: 1,
    })
    const workspace = controller.workspace.describeWorkspace()
    const [firstWidget, secondWidget] = workspace.widgets

    const firstResult = await controller.workspace.executeAction({
      name: 'scatter.brushRegion',
      target: { widgetRef: firstWidget.ref },
      params: {
        xField: 'mpg',
        yField: 'hp',
        xRange: [10, 25],
        yRange: [80, 150],
      },
    })
    const firstRecoverableState = firstResult.recoverableState

    await controller.workspace.executeAction({
      name: 'scatter.brushRegion',
      target: { widgetRef: secondWidget.ref },
      params: {
        xField: 'mpg',
        yField: 'weight',
        xRange: [11, 26],
        yRange: [1900, 3600],
      },
    })
    assert.equal(fakePage.readLastBrush()?.targetRef, 'wl://observable-d3/scatter-matrix/cell/mpg-weight')

    const restoreResult = await controller.restoreRecoverableState(firstRecoverableState)
    assert.equal(restoreResult.ok, true)
    assert.equal(restoreResult.restored, true)
    assert.deepEqual(restoreResult.brush, firstRecoverableState.brush)
    assert.equal(fakePage.readLastBrush()?.targetRef, 'wl://observable-d3/scatter-matrix/cell/mpg-hp')
    assert.deepEqual(fakePage.readLastBrush()?.xDomain, [10, 25])
    assert.deepEqual(fakePage.readLastBrush()?.yDomain, [80, 150])

    const applyBrushCalls = fakePage.workerCalls
      .filter((call) => call.method === 'applyNativeBrushRegion')
      .map((call) => call.params)
      .filter(Boolean)
    assert.deepEqual(applyBrushCalls.map((brush) => brush?.targetRef), [
      'wl://observable-d3/scatter-matrix/cell/mpg-hp',
      'wl://observable-d3/scatter-matrix/cell/mpg-weight',
      'wl://observable-d3/scatter-matrix/cell/mpg-hp',
    ])
  } finally {
    globalThis.window = previousWindow
  }
})

test('Observable D3 scatter exposes brush only when native D3 capture is available', async () => {
  const previousWindow = globalThis.window
  const fakePage = createFakeMessageRoot(
    'https://observablehq.com/@d3/brushable-scatterplot',
    { forceSingleScatter: true },
  )
  globalThis.window = fakePage.root

  try {
    const controller = await attachWidgetVAToObservableD3Page({
      root: fakePage.root,
      sessionId: 'single-scatter-native',
      timeoutMs: 200,
      pollMs: 1,
    })
    const workspace = controller.workspace.describeWorkspace()
    const targetRef = workspace.widgets[0]?.ref

    assert.deepEqual(workspace.widgets[0]?.actionNames, ['scatter.brushRegion', 'widget.clearSelection'])

    await controller.workspace.executeAction({
      name: 'scatter.brushRegion',
      target: { widgetRef: targetRef },
      params: {
        xField: 'mpg',
        yField: 'hp',
        xRange: [10, 20],
        yRange: [50, 150],
      },
    })

    assert.equal(fakePage.readLastBrush()?.bindingId, 'native_scatter_brush')
    assert.equal(fakePage.readLastBrush()?.targetRef, 'wl://observable-d3/scatter/primary')
    assert.deepEqual(fakePage.readLastBrush()?.xDomain, [10, 20])
    assert.deepEqual(fakePage.readLastBrush()?.yDomain, [50, 150])
  } finally {
    globalThis.window = previousWindow
  }
})

test('Observable D3 scatter does not expose brush without native D3 capture', async () => {
  const previousWindow = globalThis.window
  const fakePage = createFakeMessageRoot(
    'https://observablehq.com/@d3/brushable-scatterplot',
    { forceSingleScatter: true, exposeNativeCapture: false },
  )
  globalThis.window = fakePage.root

  try {
    const controller = await attachWidgetVAToObservableD3Page({
      root: fakePage.root,
      sessionId: 'single-scatter-no-native',
      timeoutMs: 200,
      pollMs: 1,
    })
    const workspace = controller.workspace.describeWorkspace()
    const targetRef = workspace.widgets[0]?.ref

    assert.deepEqual(workspace.widgets[0]?.actionNames, [])
    assert.equal(workspace.actions.some((action) => action.name === 'scatter.brushRegion'), false)

    await assert.rejects(
      () => controller.workspace.executeAction({
        name: 'scatter.brushRegion',
        target: { widgetRef: targetRef },
        params: {
          xField: 'mpg',
          yField: 'hp',
          xRange: [10, 20],
          yRange: [50, 150],
        },
      }),
      /Unsupported Observable D3 official-page action: scatter\.brushRegion/,
    )
  } finally {
    globalThis.window = previousWindow
  }
})
