import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createWidgetVAHost,
  resolveWidgetRuntimeBinding,
} from './createWidgetVAHost.js'

function createRuntimeFixture() {
  const widgetRef = 'wl://widgetva-app/workspace/demo/widget/w_scatter'
  const widgetState = {
    widgetId: 'w_scatter',
    kind: 'scatter',
    humanInteraction: {
      mode: 'brush2d',
      actionName: 'scatter.brushRegion',
    },
  }
  const widgetAdapter = {
    provider: 'vega-lite',
    kind: 'scatter',
  }
  return {
    widgetRef,
    widgetState,
    widgetAdapter,
    runtime: {
      store: {
        listWidgetDescriptions: () => [
          {
            widgetId: 'w_scatter',
            ref: widgetRef,
          },
        ],
        getWidgetState: (ref) => (ref === widgetRef ? widgetState : null),
        getWidgetAdapter: (ref) => (ref === widgetRef ? widgetAdapter : null),
      },
    },
  }
}

test('resolveWidgetRuntimeBinding resolves runtime-owned widget state without host capability metadata', () => {
  const { runtime, widgetRef, widgetState, widgetAdapter } = createRuntimeFixture()
  const binding = resolveWidgetRuntimeBinding(runtime, {
    id: 'w_scatter',
    providerCapabilities: { brush: true },
  })

  assert.equal(binding.widgetRef, widgetRef)
  assert.equal(binding.widgetState, widgetState)
  assert.equal(binding.widgetAdapter, widgetAdapter)
})

test('createWidgetVAHost mounts a provider view without host-side interaction or capability fields', async () => {
  const { runtime, widgetRef, widgetState, widgetAdapter } = createRuntimeFixture()
  const calls = []
  const onActionCall = () => null
  const host = createWidgetVAHost({
    runtime,
    onActionCall,
    installWidgetView: async (options) => {
      calls.push(options)
      return { dispose: () => null }
    },
  })

  const mounted = await host.mountWidgetView({
    widget: {
      id: 'w_scatter',
      provider: 'vega-lite',
      source: {
        interactionConfig: { mode: 'categoryClick' },
        providerCapabilities: { clickSelect: true },
        providerSpec: { provider: 'vega-lite' },
      },
      hostInteractionEnabled: false,
    },
    view: { id: 'vega-view' },
    spec: { mark: 'point' },
  })

  assert.equal(typeof mounted.dispose, 'function')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].widgetRef, widgetRef)
  assert.equal(calls[0].widgetState, widgetState)
  assert.equal(calls[0].widgetAdapter, widgetAdapter)
  assert.equal(calls[0].onActionCall, onActionCall)
  assert.equal(calls[0].bindHumanInteractions, true)
  assert.equal('interactionConfig' in calls[0], false)
  assert.equal('providerCapabilities' in calls[0], false)
  assert.equal('adapterDefinition' in calls[0], false)
})

test('createWidgetVAHost creates a runtime session from a provider-native workspace spec', () => {
  const previousWindow = globalThis.window
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
    postMessage() {},
  }
  const host = createWidgetVAHost()
  let session = null
  try {
    session = host.createRuntimeSession({
      sessionId: 'external-va-session',
      userIntent: 'Find a pattern',
      workspaceSpec: {
        topology: 'T2',
        widgets: [
          {
            widgetId: 'w_scatter',
            provider: 'vega-lite',
            kind: 'scatter',
            title: 'Scatter',
            source: {
              kind: 'nativeArtifact',
              provider: 'vega-lite',
              providerSpec: {
                provider: 'vega-lite',
                spec: {
                  mark: 'point',
                  encoding: {
                    x: { field: 'x', type: 'quantitative' },
                    y: { field: 'y', type: 'quantitative' },
                  },
                },
              },
            },
          },
        ],
        links: [],
      },
      initialFocusedWidgetId: 'w_scatter',
    })

    assert.equal(session.activeWidgetId, 'w_scatter')
    assert.equal(session.widgets.length, 1)
    assert.equal(session.hostBridge.readSessionId(), 'external-va-session')
    assert.equal(session.hostBridge.readUserIntent(), 'Find a pattern')
    assert.equal(session.hostBridge.readCurrentSpec().mark, 'point')
    assert.equal(session.workspace.readFocusedWidgetId(), 'w_scatter')
  } finally {
    session?.dispose?.()
    globalThis.window = previousWindow
  }
})

test('createWidgetVAHost materializes successful runtime actions back into provider specs', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
    postMessage() {},
  }
  const host = createWidgetVAHost()
  let session = null
  try {
    session = host.createRuntimeSession({
      sessionId: 'external-line-session',
      workspaceSpec: {
        topology: 'T2',
        widgets: [
          {
            widgetId: 'w_line',
            provider: 'vega-lite',
            kind: 'line',
            title: 'Stock Prices',
            source: {
              kind: 'templateSpec',
              provider: 'vega-lite',
              spec: {
                data: {
                  values: [
                    { date: '2023-01-01', price: 80, company: 'RetailInc' },
                    { date: '2023-01-01', price: 150, company: 'TechCorp' },
                  ],
                },
                mark: 'line',
                encoding: {
                  x: { field: 'date', type: 'temporal' },
                  y: { field: 'price', type: 'quantitative' },
                  color: { field: 'company', type: 'nominal' },
                },
              },
              providerSpec: {
                provider: 'vega-lite',
                spec: {
                  data: {
                    values: [
                      { date: '2023-01-01', price: 80, company: 'RetailInc' },
                      { date: '2023-01-01', price: 150, company: 'TechCorp' },
                    ],
                  },
                  mark: 'line',
                  encoding: {
                    x: { field: 'date', type: 'temporal' },
                    y: { field: 'price', type: 'quantitative' },
                    color: { field: 'company', type: 'nominal' },
                  },
                },
              },
            },
          },
        ],
        links: [],
      },
      initialFocusedWidgetId: 'w_line',
    })

    const widgetRef = session.runtime.describeWorkspace().widgets[0].ref
    const result = await session.runtime.executeAction({
      callId: 'bold_techcorp',
      actor: 'agent',
      name: 'line.boldLines',
      target: { widgetRef },
      params: {
        lineNames: ['TechCorp'],
        boldWidth: 5,
        baseWidth: 1,
      },
    })
    const nextSpec = session.runtime.readWidgetRenderPayload(widgetRef)?.providerSpec?.spec

    assert.equal(result.ok, true)
    assert.equal('providerMaterialization' in result, false)
    assert.equal(nextSpec.encoding.strokeWidth.condition.value, 5)
    assert.match(nextSpec.encoding.strokeWidth.condition.test, /TechCorp/)
    assert.equal(session.workspaceSpec.widgets[0].source.providerSpec.spec.encoding.strokeWidth, undefined)
  } finally {
    session?.dispose?.()
    globalThis.window = previousWindow
  }
})

test('createWidgetVAHost materializes sankey actions from canonical runtime provider params', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {}
  let session = null
  try {
    const host = createWidgetVAHost()
    session = host.createRuntimeSession({
      sessionId: 'host-provider-sankey-materialization',
      workspaceId: 'host-provider-sankey-materialization',
      workspaceSpec: {
        topology: 'T1',
        widgets: [
          {
            widgetId: 'w_sankey',
            provider: 'vega-lite',
            kind: 'sankey',
            title: 'Sankey',
            source: {
              kind: 'nativeArtifact',
              provider: 'vega-lite',
              spec: {
                data: [
                  {
                    name: 'rawLinks',
                    values: [
                      { source: 'A', target: 'B', value: 10 },
                      { source: 'B', target: 'D', value: 8 },
                    ],
                  },
                  {
                    name: 'rawNodes',
                    values: [
                      { name: 'A' },
                      { name: 'B' },
                      { name: 'D' },
                    ],
                  },
                ],
                marks: [
                  { name: 'edgeMark', type: 'path', from: { data: 'rawLinks' } },
                  { name: 'nodeMark', type: 'rect', from: { data: 'rawNodes' } },
                ],
              },
              providerSpec: {
                provider: 'vega-lite',
                spec: {
                  data: [
                    {
                      name: 'rawLinks',
                      values: [
                        { source: 'A', target: 'B', value: 10 },
                        { source: 'B', target: 'D', value: 8 },
                      ],
                    },
                    {
                      name: 'rawNodes',
                      values: [
                        { name: 'A' },
                        { name: 'B' },
                        { name: 'D' },
                      ],
                    },
                  ],
                  marks: [
                    { name: 'edgeMark', type: 'path', from: { data: 'rawLinks' } },
                    { name: 'nodeMark', type: 'rect', from: { data: 'rawNodes' } },
                  ],
                },
              },
            },
          },
        ],
        links: [],
      },
      initialFocusedWidgetId: 'w_sankey',
    })

    const widgetRef = session.runtime.describeWorkspace().widgets[0].ref
    const result = await session.runtime.executeAction({
      callId: 'highlight_sankey_path',
      actor: 'agent',
      name: 'sankey.highlightPath',
      target: { widgetRef },
      params: {
        path: 'A, B, D',
      },
    })
    const nextSpec = session.runtime.readWidgetRenderPayload(widgetRef)?.providerSpec?.spec

    assert.equal(result.ok, true)
    assert.equal('providerMaterialization' in result, false)
    assert.deepEqual(result.providerParams, {
      path: ['A', 'B', 'D'],
      nodes: ['A', 'B', 'D'],
    })
    assert.deepEqual(nextSpec._sankey_highlight_state.nodes, ['A', 'B', 'D'])
  } finally {
    session?.dispose?.()
    globalThis.window = previousWindow
  }
})
