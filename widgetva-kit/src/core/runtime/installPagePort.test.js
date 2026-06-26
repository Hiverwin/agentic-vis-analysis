import test from 'node:test'
import assert from 'node:assert/strict'

import { installWidgetVAPagePort } from './installPagePort.js'
import { ActionExecutor } from './ActionExecutor.js'
import { PerceptionQueryRegistry } from './PerceptionQueryRegistry.js'
import { LinkEngine } from './LinkEngine.js'
import { WidgetVARuntimeStore } from './RuntimeStore.js'
import { readStatePatch } from './readStatePatch.js'
import { ScatterWidgetAdapter } from '../../adapters/widgetFamilies/runtimeWidgetAdapters.js'

function noopAsync(value = null) {
  return async () => value
}

test('installWidgetVAPagePort.describeWorkspace can omit schemas and examples', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      listWidgetDescriptions() {
        return []
      },
      listWidgetAdapters() {
        return [
          {
            widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
            dataRef: 'wl://widgetva-app/workspace/main/data/current_view',
            kind: 'scatter',
            provider: 'vega-lite',
            providerCapabilities: {
              renderStrategy: 'vega-view',
              stateApplyStrategy: 'signals',
              interactionBindingStrategy: 'signals',
              supportsSignalPatching: true,
              supportsOptionMerging: false,
              supportsImperativeRender: true,
            },
            metadata: {},
            getDescription() {
              return {
                kind: 'scatter',
                title: 'Risk Scatterplot',
                description: 'Shows latency vs error rate.',
                analyticRoles: ['correlate', 'outlier'],
                primaryDataRef: 'wl://widgetva-app/workspace/main/data/risk_records',
                role: 'primary',
                sourceKind: 'baseSpec',
                supportsSpecMutation: true,
                usageNotes: ['Use brushRegion to select an interval.'],
                actionNames: ['scatter.brushRegion'],
                perceptionQueryNames: ['perception.summarizeVisible'],
              }
            },
            getHumanInteractionConfig() {
              return {
                mode: 'brush2d',
                actionName: 'scatter.brushRegion',
                supportsDirectManipulation: true,
              }
            },
            applyState() {},
            bindHumanInteractions() {},
            registerActions() {},
            registerPerceptionQueries() {},
          },
        ]
      },
      listLinks() {
        return []
      },
      listActions() {
        return [
          {
            name: 'widget.filterByValues',
            title: 'Filter values',
            description: 'Filter a widget by categorical values.',
            primitive: 'filter',
            category: 'dataTransform',
            paramsSchema: { type: 'object' },
            examples: [{ userGoal: 'Filter west', params: { values: ['west'] } }],
          },
        ]
      },
      listDataHandles() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/data/current_view',
            title: 'Current View Data',
            sourceKind: 'inline',
            schema: { fields: [{ name: 'Region', type: 'nominal' }] },
            supportedQueries: ['sampleRows', 'summary'],
            supportedQueryDescriptors: [
              {
                name: 'summary',
                title: 'Summarize current data view',
                description: 'Summarize rows.',
                resultKind: 'summaryTable',
                inputSchema: { type: 'object' },
                resultSchema: { type: 'object' },
                examples: [{ spec: { fields: ['Region'] } }],
              },
            ],
          },
        ]
      },
      listPerceptionQueries() {
        return [
          {
            name: 'perception.summarizeVisible',
            title: 'Summarize visible rows',
            description: 'Summarize the current view.',
            category: 'summarize',
            paramsSchema: { type: 'object' },
            returnsSchema: { type: 'object' },
            examples: [{ userGoal: 'Summarize rows', params: {} }],
          },
        ]
      },
    },
    planWorkspace: undefined,
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const stripped = await globalThis.window.__widgetVA.describeWorkspace({
    includeSchemas: false,
    includeExamples: false,
  })

  assert.equal('paramsSchema' in stripped.actions[0], false)
  assert.equal('examples' in stripped.actions[0], false)
  assert.equal('schema' in stripped.dataHandles[0], false)
  assert.equal('inputSchema' in stripped.dataHandles[0].supportedQueryDescriptors[0], false)
  assert.equal('resultSchema' in stripped.dataHandles[0].supportedQueryDescriptors[0], false)
  assert.equal('examples' in stripped.dataHandles[0].supportedQueryDescriptors[0], false)
  assert.equal('paramsSchema' in stripped.perceptionQueries[0], false)
  assert.equal('returnsSchema' in stripped.perceptionQueries[0], false)
  assert.equal('examples' in stripped.perceptionQueries[0], false)
  assert.equal(Array.isArray(stripped.widgetAdapters), true)
  assert.equal(stripped.widgetAdapters[0].provider, 'vega-lite')
  assert.equal(stripped.widgetAdapters[0].title, 'Risk Scatterplot')
  assert.deepEqual(stripped.widgetAdapters[0].analyticRoles, ['correlate', 'outlier'])
  assert.equal(stripped.widgetAdapters[0].primaryDataRef, 'wl://widgetva-app/workspace/main/data/risk_records')
  assert.equal(stripped.widgetAdapters[0].sourceKind, 'baseSpec')
  assert.equal(stripped.widgetAdapters[0].supportsSpecMutation, true)
  assert.deepEqual(stripped.widgetAdapters[0].usageNotes, ['Use brushRegion to select an interval.'])

  delete globalThis.window
})

test('installWidgetVAPagePort exposes observation, coordination, propagation, and available-surface reads', async () => {
  globalThis.window = {}
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_a'
  const state = {
    stateId: 'main:s2',
    branchId: 'main',
    shared: {
      focusedWidget: widgetRef,
      selections: {
        registry: {
          scatter_a: [`${widgetRef}/selection/current`],
        },
        views: {
          primary: {
            selectionRef: `${widgetRef}/selection/current`,
            sourceWidgetRef: widgetRef,
            sourceWidgetId: 'scatter_a',
            kind: 'interval',
            scope: 'local',
          },
          byWidget: {},
        },
      },
    },
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        feedback: {
          linkedSourceRefs: [],
        },
      },
    },
  }
  installWidgetVAPagePort({
    store: {
      currentBranchId: 'main',
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          runtimeTopology: {
            widgetCount: 1,
            linkCount: 0,
          },
          widgets: [
            {
              ref: widgetRef,
              widgetId: 'scatter_a',
              kind: 'scatter',
            },
          ],
          dataHandles: [],
          links: [],
          actions: [
            {
              name: 'workspace.focusWidget',
              paramsSchema: { type: 'object' },
            },
          ],
          perceptionQueries: [
            {
              name: 'perception.summarizeVisible',
              paramsSchema: { type: 'object' },
            },
          ],
        }
      },
      readState() {
        return state
      },
    },
    executeAction: noopAsync({ ok: true }),
    queryPerception: noopAsync({ ok: true }),
    queryData: noopAsync({ ok: true }),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {
      describeEngine() {
        return { primitiveNames: ['selectionFilter'] }
      },
      describePropagation({ sourceRef }) {
        return [{ sourceRef, targetRef: 'wl://widgetva-app/workspace/main/widget/bar_b' }]
      },
      evaluatePropagation({ sourceRef }) {
        return { sourceRef, matchedLinks: 1 }
      },
    },
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
  })

  const port = globalThis.window.__widgetVA
  const observation = await port.readObservation()
  const coordinationState = await port.readCoordinationState()
  const propagationSummary = await port.readPropagationSummary({ sourceRef: widgetRef })
  const availableActions = await port.listAvailableActions()
  const availablePerceptions = await port.listAvailablePerceptions()

  assert.equal(observation?.workspace?.workspaceId, 'main')
  assert.equal(observation?.state?.stateId, 'main:s2')
  assert.equal(coordinationState?.focusedWidgetRef, widgetRef)
  assert.equal(propagationSummary?.sourceRef, widgetRef)
  assert.equal(Array.isArray(propagationSummary?.propagation), true)
  assert.deepEqual(availableActions.map((entry) => entry?.name), ['workspace.focusWidget'])
  assert.deepEqual(availablePerceptions.map((entry) => entry?.name), ['perception.summarizeVisible'])

  delete globalThis.window
})

test('installWidgetVAPagePort optionally exposes latest coordination-result reads when provided', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      currentBranchId: 'main',
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          runtimeTopology: {
            widgetCount: 1,
            linkCount: 0,
          },
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      readState() {
        return {
          stateId: 'main:s1',
          branchId: 'main',
          shared: {},
          widgets: {},
        }
      },
    },
    readLatestCoordinationResult: async () => ({
      changed: true,
      verification: {
        status: 'verified',
        summary: 'Verified 1/1 target checks.',
      },
    }),
    executeAction: noopAsync({ ok: true }),
    queryPerception: noopAsync({ ok: true }),
    queryData: noopAsync({ ok: true }),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
  })

  const port = globalThis.window.__widgetVA
  const description = await port.describePagePort()
  const observation = await port.readObservation()
  const latestCoordinationResult = await port.readLatestCoordinationResult()

  assert.equal(description.methods.includes('readLatestCoordinationResult'), true)
  assert.equal(observation?.latestCoordinationResult?.verification?.status, 'verified')
  assert.equal(latestCoordinationResult?.verification?.status, 'verified')
  assert.equal(latestCoordinationResult?.verification?.summary, 'Verified 1/1 target checks.')

  delete globalThis.window
})

test('installWidgetVAPagePort.describeWorkspace can include protocol schemas', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      listWidgetDescriptions() {
        return []
      },
      listWidgetAdapters() {
        return []
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
    },
    planWorkspace: undefined,
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const described = await globalThis.window.__widgetVA.describeWorkspace({
    includeProtocolSchemas: true,
  })

  assert.equal(typeof described.__schemas, 'object')
  assert.equal(typeof described.__schemas.workspaceDescription, 'object')
  assert.equal(typeof described.__schemas.widgetAdapterSummary, 'object')
  assert.equal(typeof described.__schemas.actionResult, 'object')
  assert.equal(typeof described.__schemas.perceptionResult, 'object')
  assert.equal(described.__schemas.workspacePlanningRequest, undefined)
  assert.equal(described.__schemas.agentLoopContext, undefined)
  assert.equal(described.__schemas.benchmarkEvaluation, undefined)

  delete globalThis.window
})

test('installWidgetVAPagePort derives describeWorkspace from plain store fields when readDescription is unavailable', async () => {
  globalThis.window = {}
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const otherWidgetRef = 'wl://demo/workspace/main/widget/bar_b'
  const dataRef = 'wl://demo/workspace/main/data/current_view'
  const linkRef = 'wl://demo/workspace/main/link/scatter_filters_bar'
  installWidgetVAPagePort({
    store: {
      appId: 'demo',
      workspaceId: 'main',
      descriptions: {
        [widgetRef]: {
          ref: widgetRef,
          kind: 'scatter',
          title: 'Scatter A',
        },
        [otherWidgetRef]: {
          ref: otherWidgetRef,
          kind: 'bar',
          title: 'Bar B',
        },
      },
      dataHandles: {
        [dataRef]: {
          ref: dataRef,
          title: 'Current View Data',
        },
      },
      links: {
        [linkRef]: {
          ref: linkRef,
          kind: 'filters',
          from: `${widgetRef}/selection/brush`,
          to: otherWidgetRef,
        },
      },
      actions: {
        'scatter.brushRegion': {
          name: 'scatter.brushRegion',
          title: 'Brush scatter region',
        },
      },
      perceptionQueries: {
        'perception.summarizeVisible': {
          name: 'perception.summarizeVisible',
          title: 'Summarize visible rows',
        },
      },
      widgets: {
        [widgetRef]: { ref: widgetRef, widgetId: 'scatter_a', kind: 'scatter' },
        [otherWidgetRef]: { ref: otherWidgetRef, widgetId: 'bar_b', kind: 'bar' },
      },
      interactionTrace: [
        { stateId: 'main:s1', actor: 'agent', eventKind: 'action' },
      ],
      stateSnapshots: [
        { stateId: 'main:s1', branchId: 'main', state: { widgets: {}, shared: {} } },
      ],
      responseHistory: [
        { responseId: 'response_1', workspaceId: 'main', stateId: 'main:s1', actor: 'agent', content: 'Done.' },
      ],
    },
    actionExecutor: {
      list() {
        return []
      },
    },
    perceptionQueryRegistry: {
      list() {
        return []
      },
    },
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const described = await globalThis.window.__widgetVA.describeWorkspace()
  const portDescription = await globalThis.window.__widgetVA.describePagePort()

  assert.equal(portDescription.methods.includes('describeWorkspace'), true)
  assert.equal(described.appId, 'demo')
  assert.equal(described.workspaceId, 'main')
  assert.equal(described.widgets[0]?.ref, widgetRef)
  assert.equal(described.dataHandles[0]?.ref, dataRef)
  assert.equal(described.links[0]?.ref, linkRef)
  assert.equal(described.actions[0]?.name, 'scatter.brushRegion')
  assert.equal(described.perceptionQueries[0]?.name, 'perception.summarizeVisible')
  assert.equal(described.workspaceCapabilities?.includes('multiWidgetCoordination'), true)
  assert.equal(described.workspaceCapabilities?.includes('crossFilter'), true)
  assert.equal(described.workspaceCapabilities?.includes('traceReplay'), true)
  assert.equal(described.workspaceCapabilities?.includes('benchmarkExecution'), false)
  assert.equal(described.runtimeTopology?.topology, 'T2')
  assert.deepEqual(
    described.transportHints?.recommendedTools,
    ['workspace_describe', 'view_read', 'interaction_trace_read'],
  )
  assert.equal(described.transportHints?.optionalTools?.includes('workspace_snapshot_read'), false)
  assert.equal(described.transportHints?.optionalTools?.includes('trace_graph_read'), true)
  assert.equal(described.benchmarkSupport, undefined)

  delete globalThis.window
})

test('installWidgetVAPagePort.describeWorkspace filters unavailable optional transport tools from workspace transportHints', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
          transportHints: {
            recommendedTools: ['workspace_describe', 'view_read'],
            optionalTools: [
              'data_query',
              'workspace_plan',
              'agent_loop_describe',
              'state_constraints_evaluate',
              'benchmark_task_evaluate',
            ],
          },
        }
      },
      listWidgetDescriptions() {
        return []
      },
      readState() {
        return {}
      },
      listWidgetAdapters() {
        return []
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
    },
    planWorkspace: undefined,
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const described = await globalThis.window.__widgetVA.describeWorkspace()

  assert.deepEqual(described.transportHints?.recommendedTools, ['workspace_describe', 'view_read'])
  assert.deepEqual(described.transportHints?.optionalTools, ['data_query'])

  delete globalThis.window
})

test('installWidgetVAPagePort derives readView from plain store widgets and shared state when readState is unavailable', async () => {
  globalThis.window = {}
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const otherWidgetRef = 'wl://demo/workspace/main/widget/bar_b'
  installWidgetVAPagePort({
    store: {
      appId: 'demo',
      workspaceId: 'main',
      stateId: 'main:42',
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
        },
        [otherWidgetRef]: {
          ref: otherWidgetRef,
          widgetId: 'bar_b',
          kind: 'bar',
        },
      },
      shared: {
        activeSelections: {
          [`${widgetRef}/selection/brush`]: {
            kind: 'interval',
          },
        },
        globalFilters: {},
        focusedWidget: widgetRef,
      },
    },
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const described = await globalThis.window.__widgetVA.describePagePort()
  const state = await globalThis.window.__widgetVA.readView({ refs: [widgetRef] })

  assert.equal(described.methods.includes('readView'), true)
  assert.equal(state.stateId, 'main:42')
  assert.deepEqual(Object.keys(state.widgets), [widgetRef])
  assert.equal(state.widgets[widgetRef]?.widgetId, 'scatter_a')
  assert.equal(state.shared?.focusedWidget, widgetRef)
  assert.equal(typeof state.createdAt, 'string')

  delete globalThis.window
})

test('installWidgetVAPagePort derives deltaSince-scoped readView from plain snapshot facades', async () => {
  globalThis.window = {}
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const otherWidgetRef = 'wl://demo/workspace/main/widget/bar_b'
  installWidgetVAPagePort({
    store: {
      appId: 'demo',
      workspaceId: 'main',
      stateId: 'main:s2',
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 2,
          view: {
            xDomain: [0, 10],
          },
        },
        [otherWidgetRef]: {
          ref: otherWidgetRef,
          widgetId: 'bar_b',
          kind: 'bar',
          version: 1,
        },
      },
      shared: {
        focusedWidget: widgetRef,
      },
      stateSnapshots: [
        {
          stateId: 'main:s1',
          state: {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'scatter_a',
                kind: 'scatter',
                version: 1,
                view: {
                  xDomain: [0, 5],
                },
              },
              [otherWidgetRef]: {
                ref: otherWidgetRef,
                widgetId: 'bar_b',
                kind: 'bar',
                version: 1,
              },
            },
            shared: {
              focusedWidget: null,
            },
          },
        },
        {
          stateId: 'main:s2',
          state: {
            stateId: 'main:s2',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'scatter_a',
                kind: 'scatter',
                version: 2,
                view: {
                  xDomain: [0, 10],
                },
              },
              [otherWidgetRef]: {
                ref: otherWidgetRef,
                widgetId: 'bar_b',
                kind: 'bar',
                version: 1,
              },
            },
            shared: {
              focusedWidget: widgetRef,
            },
          },
        },
      ],
    },
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const state = await globalThis.window.__widgetVA.readView({
    deltaSince: 'main:s1',
    refs: [widgetRef],
  })

  assert.equal(state.stateId, 'main:s2')
  assert.equal(state.delta?.baseStateId, 'main:s1')
  assert.ok(state.delta?.changedRefs?.includes(widgetRef))
  assert.ok(state.delta?.changedRefs?.includes('shared'))
  assert.equal(state.widgets?.[widgetRef]?.view?.xDomain?.[1], 10)
  assert.equal('shared' in state, false)

  delete globalThis.window
})

test('installWidgetVAPagePort.describePagePort does not over-report planner, agent-loop, or evaluation flags when methods are missing', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      listWidgetDescriptions() {
        return []
      },
      listWidgetAdapters() {
        return []
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
    },
    planWorkspace: undefined,
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const described = await globalThis.window.__widgetVA.describePagePort()

  assert.equal(described.planner, false)
  assert.equal(described.agentLoop, false)
  assert.equal(described.methods.includes('planWorkspace'), false)
  assert.equal(described.methods.includes('describeAgentLoop'), false)
  assert.equal(described.methods.includes('jumpToState'), false)
  assert.equal(described.methods.includes('branchFromState'), false)
  assert.equal(described.aliases?.workspace_plan, undefined)
  assert.equal(described.aliases?.agent_loop_describe, undefined)
  assert.equal(described.aliases?.jump_to_state, undefined)
  assert.equal(described.aliases?.branch_from_state, undefined)
  assert.equal(typeof described.methodDescriptors?.describePagePort, 'object')
  assert.equal(described.methodDescriptors?.planWorkspace, undefined)
  assert.equal(described.methodDescriptors?.describeAgentLoop, undefined)
  assert.equal(described.methodDescriptors?.jumpToState, undefined)
  assert.equal(described.methodDescriptors?.branchFromState, undefined)
  assert.equal(typeof described.schemas?.pagePortDescription, 'object')
  assert.equal(typeof described.schemas?.actionResult, 'object')
  assert.equal(typeof described.schemas?.perceptionResult, 'object')
  assert.equal(described.schemas?.workspacePlanningRequest, undefined)
  assert.equal(described.schemas?.agentLoopContext, undefined)
  assert.equal(typeof globalThis.window.__widgetVA.planWorkspace, 'undefined')
  assert.equal(typeof globalThis.window.__widgetVA.describeAgentLoop, 'undefined')
  assert.equal(typeof globalThis.window.__widgetVA.jumpToState, 'undefined')
  assert.equal(typeof globalThis.window.__widgetVA.branchFromState, 'undefined')
  assert.deepEqual(described.transportHints?.recommendedTools, [
    'workspace_describe',
    'view_read',
    'action_run',
    'perception_query',
    'interaction_trace_read',
  ])
  assert.equal(described.transportHints?.optionalTools?.includes('workspace_plan'), false)
  assert.equal(described.transportHints?.optionalTools?.includes('agent_loop_describe'), false)
  assert.equal(described.transportHints?.optionalTools?.includes('state_constraints_evaluate'), false)
  assert.equal(described.transportHints?.optionalTools?.includes('benchmark_task_evaluate'), false)

  delete globalThis.window
})

test('installWidgetVAPagePort derives action/query methods from executor and registry surfaces when direct callbacks are omitted', async () => {
  globalThis.window = {}
  const calls = []

  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      listWidgetDescriptions() {
        return []
      },
      listWidgetAdapters() {
        return []
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
    },
    actionExecutor: {
      async run(call) {
        calls.push(['action', call])
        return { ok: true, channel: 'action', callId: call?.callId || null }
      },
    },
    perceptionQueryRegistry: {
      async query(call) {
        calls.push(['perception', call])
        return { ok: true, channel: 'perception', callId: call?.callId || null }
      },
    },
    dataQueryExecutor: {
      async run(call) {
        calls.push(['data', call])
        return { ok: true, channel: 'data', callId: call?.callId || null }
      },
    },
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const described = await globalThis.window.__widgetVA.describePagePort()
  const actionResult = await globalThis.window.__widgetVA.executeAction({
    callId: 'call_action',
    name: 'widget.testAction',
  })
  const stateResult = await globalThis.window.__widgetVA.readState({})
  const perceptionResult = await globalThis.window.__widgetVA.queryPerception({
    callId: 'call_perception',
    name: 'perception.testQuery',
  })
  const traceResult = await globalThis.window.__widgetVA.readTrace({})
  const stableDataResult = await globalThis.window.__widgetVA.runDataQuery({
    callId: 'call_data_stable',
    name: 'data.testQuery',
  })
  const dataResult = await globalThis.window.__widgetVA.queryData({
    callId: 'call_data',
    name: 'data.testQuery',
  })

  assert.equal(described.methods.includes('readState'), true)
  assert.equal(described.methods.includes('executeAction'), true)
  assert.equal(described.methods.includes('queryPerception'), true)
  assert.equal(described.methods.includes('runDataQuery'), true)
  assert.equal(described.methods.includes('readTrace'), true)
  assert.equal(described.methods.includes('replay'), false)
  assert.equal(described.methods.includes('queryData'), true)
  assert.equal(described.aliases?.state_read, 'readState')
  assert.equal(described.aliases?.action_run, 'executeAction')
  assert.equal(described.aliases?.perception_query, 'queryPerception')
  assert.equal(described.aliases?.data_query_run, 'runDataQuery')
  assert.equal(described.aliases?.data_query, 'queryData')
  assert.equal(described.aliases?.trace_read, 'readTrace')
  assert.equal(described.aliases?.workspace_replay, undefined)
  assert.deepEqual(calls, [
    ['action', { callId: 'call_action', name: 'widget.testAction' }],
    ['perception', { callId: 'call_perception', name: 'perception.testQuery' }],
    ['data', { callId: 'call_data_stable', name: 'data.testQuery' }],
    ['data', { callId: 'call_data', name: 'data.testQuery' }],
  ])
  assert.equal(typeof stateResult, 'object')
  assert.equal(stateResult?.stateId, null)
  assert.deepEqual(stateResult?.widgets, {})
  assert.equal(actionResult.channel, 'action')
  assert.equal(perceptionResult.channel, 'perception')
  assert.deepEqual(traceResult, [])
  assert.equal(stableDataResult.channel, 'data')
  assert.equal(dataResult.channel, 'data')

  delete globalThis.window
})

test('installWidgetVAPagePort can drive ActionExecutor through manual actionContext assembly', async () => {
  globalThis.window = {}
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_a'
  const nextState = {
    stateId: 'main:s2',
    widgets: {
      [widgetRef]: {
        view: {
          zoom: { level: 2 },
        },
      },
    },
    shared: {},
  }

  const actionExecutor = new ActionExecutor({})
  actionExecutor.register(
    {
      name: 'widget.testAction',
      title: 'Test action',
      description: 'Manual assembly test action.',
      primitive: 'focus',
      category: 'navigation',
      targetRef: widgetRef,
      affectedRefs: [widgetRef],
      affectedStatePaths: ['view.zoom'],
      paramsSchema: {
        type: 'object',
        properties: {
          zoomLevel: { type: 'integer' },
        },
        required: ['zoomLevel'],
      },
    },
    async (call, ctx) => {
      ctx.patchWidget(widgetRef, {
        view: {
          zoom: { level: call.params.zoomLevel },
        },
      })
      return {
        nextState,
        updatedRefs: [widgetRef],
      }
    },
  )

  const patchedWidgets = []
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [{ ref: widgetRef, kind: 'scatter', title: 'Scatter A' }],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      listWidgetDescriptions() {
        return [{ ref: widgetRef, kind: 'scatter', title: 'Scatter A' }]
      },
      listWidgetAdapters() {
        return []
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
      buildStatePatch(refs) {
        return { refs }
      },
      readState() {
        return nextState
      },
    },
    actionExecutor,
    actionContext: {
      store: {
        listActions() {
          return []
        },
        readState() {
          return nextState
        },
        readDescription() {
          return {
            widgets: [{ ref: widgetRef, kind: 'scatter', title: 'Scatter A' }],
          }
        },
        listWidgetDescriptions() {
          return [{ ref: widgetRef, kind: 'scatter', title: 'Scatter A' }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef ? { ref: widgetRef, kind: 'scatter', title: 'Scatter A' } : null
        },
        getResolvedWidget(ref) {
          return ref === widgetRef ? { ref: widgetRef, kind: 'scatter', title: 'Scatter A' } : null
        },
        patchWidget(ref, patch) {
          patchedWidgets.push([ref, patch])
          return nextState
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
      patchWidget(ref, patch) {
        patchedWidgets.push([ref, patch])
        return nextState
      },
      propagate() {
        return []
      },
      readStatePatch(refs) {
        return { refs }
      },
    },
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {
      recordAction() {},
    },
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const result = await globalThis.window.__widgetVA.executeAction({
    callId: 'manual_action_1',
    name: 'widget.testAction',
    targetRef: widgetRef,
    params: { zoomLevel: 2 },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.updatedRefs, [widgetRef])
  assert.deepEqual(patchedWidgets, [
    [
      widgetRef,
      {
        view: {
          zoom: { level: 2 },
        },
      },
    ],
  ])

  delete globalThis.window
})

test('installWidgetVAPagePort reads manual RuntimeStore facade assembly through describeWorkspace and readView', async () => {
  globalThis.window = {}
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const dataRef = 'wl://demo/workspace/main/data/cars'
  const linkRef = 'wl://demo/workspace/main/link/scatter_to_bar'

  store.descriptions[widgetRef] = {
    kind: 'scatter',
    widgetId: 'scatter_a',
    title: 'Scatter A',
    actionNames: ['scatter.brushRegion'],
    perceptionQueryNames: ['perception.summarizeVisible'],
  }
  store.widgets[widgetRef] = {
    widgetId: 'scatter_a',
    kind: 'scatter',
    version: 1,
    data: {
      sourceDataRef: dataRef,
      currentDataRef: dataRef,
    },
    view: {},
    selections: {},
  }
  store.dataHandles[dataRef] = {
    title: 'Cars',
    supportedQueries: ['summary'],
  }
  store.links[linkRef] = {
    kind: 'filter',
    from: widgetRef,
    to: 'wl://demo/workspace/main/widget/bar_b',
  }

  installWidgetVAPagePort({
    store,
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const description = await globalThis.window.__widgetVA.describeWorkspace()
  const state = await globalThis.window.__widgetVA.readView()

  assert.equal(description.appId, 'demo')
  assert.equal(description.widgets[0]?.ref, widgetRef)
  assert.equal(description.dataHandles[0]?.ref, dataRef)
  assert.equal(description.links[0]?.ref, linkRef)
  assert.equal(state.widgets?.[widgetRef]?.ref, widgetRef)

  delete globalThis.window
})

test('installWidgetVAPagePort supports the documented minimal end-to-end manual assembly flow', async () => {
  globalThis.window = {}

  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const actionExecutor = new ActionExecutor()
  const perceptionQueryRegistry = new PerceptionQueryRegistry()
  const widgetLinkEngine = new LinkEngine(store)
  const widgetRef = 'wl://demo/workspace/main/widget/scatter'
  const dataRef = 'wl://demo/workspace/main/data/cars'
  let brushedSelection = null

  const scatterChart = {
    getState() {
      return {
        ref: widgetRef,
        widgetId: 'scatter',
        kind: 'scatter',
        version: 1,
        rawSpec: {
          mark: 'point',
          data: {
            values: [
              { Horsepower: 70, MPG: 18 },
              { Horsepower: 90, MPG: 24 },
              { Horsepower: 110, MPG: 31 },
            ],
          },
          encoding: {
            x: { field: 'Horsepower', type: 'quantitative' },
            y: { field: 'MPG', type: 'quantitative' },
          },
        },
        data: {
          sourceDataRef: dataRef,
          currentDataRef: dataRef,
        },
        view: {},
        selections: {},
      }
    },
    setBrush(selection) {
      brushedSelection = selection
    },
  }

  const scatterAdapter = new ScatterWidgetAdapter(widgetRef, scatterChart, dataRef)

  store.descriptions[scatterAdapter.widgetRef] = scatterAdapter.getDescription()
  store.widgets[scatterAdapter.widgetRef] = scatterAdapter.getState()
  store.dataHandles[dataRef] = {
    ref: dataRef,
    title: 'Cars',
    supportedQueries: ['inspectVisibleRows', 'summarizeSelection', 'computeCorrelation'],
  }
  store.upsertRuntimeData(dataRef, {
    ref: dataRef,
    rows: scatterChart.getState().rawSpec.data.values,
    baseRows: scatterChart.getState().rawSpec.data.values,
    widgetRef,
    kind: 'dataView',
    scope: 'visible',
    handle: store.getDataHandle(dataRef),
  })

  scatterAdapter.registerActions(actionExecutor)
  scatterAdapter.registerPerceptionQueries(perceptionQueryRegistry)

  installWidgetVAPagePort({
    store,
    actionExecutor,
    perceptionQueryRegistry,
    actionContext: {
      store,
      patchWidget: (ref, patch) => store.patchWidget(ref, patch),
      propagate: (ref) => widgetLinkEngine.propagate(ref),
      readStatePatch: (refs) => readStatePatch(store, refs),
    },
  })

  const workspace = await globalThis.window.__widgetVA.describeWorkspace()
  assert.equal(workspace.appId, 'demo')
  assert.equal(workspace.workspaceId, 'main')
  assert.equal(workspace.widgets.some((widget) => widget?.ref === widgetRef), true)
  assert.equal(workspace.actions.some((action) => action?.name === 'scatter.brushRegion'), true)
  assert.equal(workspace.perceptionQueries.some((query) => query?.name === 'perception.computeCorrelation'), true)

  const result = await globalThis.window.__widgetVA.executeAction({
    callId: '1',
    name: 'scatter.brushRegion',
    actor: 'agent',
    params: {
      xField: 'Horsepower',
      yField: 'MPG',
      xRange: [60, 120],
      yRange: [20, 40],
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'scatter.brushRegion')
  assert.equal(Array.isArray(result.updatedRefs), true)
  assert.equal(result.updatedRefs.includes(widgetRef), true)
  assert.deepEqual(brushedSelection?.domain, {
    xDomain: [60, 120],
    yDomain: [20, 40],
  })

  const view = await globalThis.window.__widgetVA.readView()
  const widgetState = view.widgets?.[widgetRef]
  const selectionRef = Object.keys(widgetState?.selections || {})[0] || null

  assert.equal(view.stateId, result.stateId)
  assert.equal(typeof selectionRef, 'string')
  assert.equal(widgetState?.selections?.[selectionRef]?.kind, 'interval')
  assert.deepEqual(widgetState?.selections?.[selectionRef]?.value, {
    Horsepower: [60, 120],
    MPG: [20, 40],
  })

  delete globalThis.window
})

test('installWidgetVAPagePort supports the documented multi-widget scatter brush propagation flow', async () => {
  globalThis.window = {}

  const store = new WidgetVARuntimeStore({ appId: 'cars', workspaceId: 'main' })
  const actionExecutor = new ActionExecutor()
  const perceptionQueryRegistry = new PerceptionQueryRegistry()
  const widgetLinkEngine = new LinkEngine(store)
  const scatterRef = 'wl://cars/workspace/main/widget/scatter'
  const barRef = 'wl://cars/workspace/main/widget/origin_bar'
  const tableRef = 'wl://cars/workspace/main/widget/car_table'
  const scatterDataRef = 'wl://cars/workspace/main/data/cars'
  const barDataRef = 'wl://cars/workspace/main/data/origin_bar_visible'
  const tableDataRef = 'wl://cars/workspace/main/data/car_table_visible'
  const selectionRef = `${scatterRef}/selection/brush`
  const rows = [
    { Horsepower: 70, MPG: 18, Origin: 'USA', Name: 'A' },
    { Horsepower: 90, MPG: 24, Origin: 'Japan', Name: 'B' },
    { Horsepower: 110, MPG: 31, Origin: 'USA', Name: 'C' },
  ]
  let brushedSelection = null

  const scatterChart = {
    getState() {
      return {
        ref: scatterRef,
        widgetId: 'scatter',
        kind: 'scatter',
        version: 1,
        rawSpec: {
          mark: 'point',
          data: { values: rows },
          encoding: {
            x: { field: 'Horsepower', type: 'quantitative' },
            y: { field: 'MPG', type: 'quantitative' },
          },
        },
        data: {
          sourceDataRef: scatterDataRef,
          currentDataRef: scatterDataRef,
          visibleCount: rows.length,
          selectedCount: 0,
        },
        view: {},
        selections: {},
      }
    },
    setBrush(selection) {
      brushedSelection = selection
    },
  }

  const scatterAdapter = new ScatterWidgetAdapter(scatterRef, scatterChart, scatterDataRef)

  store.descriptions[scatterRef] = scatterAdapter.getDescription()
  store.widgets[scatterRef] = scatterAdapter.getState()
  store.descriptions[barRef] = {
    ref: barRef,
    widgetId: 'origin_bar',
    kind: 'bar',
    title: 'Cars by Origin',
    primaryDataRef: barDataRef,
  }
  store.widgets[barRef] = {
    ref: barRef,
    widgetId: 'origin_bar',
    kind: 'bar',
    version: 1,
    rawSpec: {
      mark: 'bar',
      data: { values: rows },
    },
    data: {
      sourceDataRef: barDataRef,
      currentDataRef: barDataRef,
      visibleCount: rows.length,
      selectedCount: 0,
    },
    transforms: [],
    selections: {},
    view: {},
    feedback: {},
  }
  store.descriptions[tableRef] = {
    ref: tableRef,
    widgetId: 'car_table',
    kind: 'table',
    title: 'Car Records',
    primaryDataRef: tableDataRef,
  }
  store.widgets[tableRef] = {
    ref: tableRef,
    widgetId: 'car_table',
    kind: 'table',
    version: 1,
    rawSpec: {
      data: { values: rows },
      columns: ['Horsepower', 'MPG', 'Origin', 'Name'],
    },
    data: {
      sourceDataRef: tableDataRef,
      currentDataRef: tableDataRef,
      visibleCount: rows.length,
      selectedCount: 0,
    },
    transforms: [],
    selections: {},
    view: {},
    feedback: {},
  }

  store.dataHandles[scatterDataRef] = { ref: scatterDataRef, title: 'Cars', supportedQueries: ['summary'] }
  store.dataHandles[barDataRef] = { ref: barDataRef, title: 'Cars by Origin Visible', supportedQueries: ['summary'] }
  store.dataHandles[tableDataRef] = { ref: tableDataRef, title: 'Car Table Visible', supportedQueries: ['summary'] }

  store.upsertRuntimeData(scatterDataRef, {
    ref: scatterDataRef,
    rows,
    baseRows: rows,
    widgetRef: scatterRef,
    kind: 'dataView',
    scope: 'visible',
    handle: store.getDataHandle(scatterDataRef),
  })
  store.upsertRuntimeData(barDataRef, {
    ref: barDataRef,
    rows,
    baseRows: rows,
    widgetRef: barRef,
    kind: 'dataView',
    scope: 'visible',
    handle: store.getDataHandle(barDataRef),
  })
  store.upsertRuntimeData(tableDataRef, {
    ref: tableDataRef,
    rows,
    baseRows: rows,
    widgetRef: tableRef,
    kind: 'dataView',
    scope: 'visible',
    handle: store.getDataHandle(tableDataRef),
  })

  store.links['wl://cars/workspace/main/link/scatter_brush_filters_bar'] = {
    ref: 'wl://cars/workspace/main/link/scatter_brush_filters_bar',
    kind: 'filters',
    from: selectionRef,
    to: barRef,
    trigger: 'selectionChanged',
    effect: 'applyFilter',
    automatic: true,
    sourceWidgetId: 'scatter',
    targetWidgetId: 'origin_bar',
  }
  store.links['wl://cars/workspace/main/link/scatter_brush_filters_table'] = {
    ref: 'wl://cars/workspace/main/link/scatter_brush_filters_table',
    kind: 'filters',
    from: selectionRef,
    to: tableRef,
    trigger: 'selectionChanged',
    effect: 'applyFilter',
    automatic: true,
    sourceWidgetId: 'scatter',
    targetWidgetId: 'car_table',
  }

  scatterAdapter.registerActions(actionExecutor)
  scatterAdapter.registerPerceptionQueries(perceptionQueryRegistry)

  installWidgetVAPagePort({
    store,
    actionExecutor,
    perceptionQueryRegistry,
    actionContext: {
      store,
      patchWidget: (ref, patch) => store.patchWidget(ref, patch),
      propagate: (ref) => widgetLinkEngine.propagate(ref),
      readStatePatch: (refs) => readStatePatch(store, refs),
    },
  })

  const result = await globalThis.window.__widgetVA.executeAction({
    callId: 'call-001',
    name: 'scatter.brushRegion',
    actor: 'agent',
    params: {
      xField: 'Horsepower',
      yField: 'MPG',
      xRange: [60, 120],
      yRange: [20, 40],
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(brushedSelection?.domain, {
    xDomain: [60, 120],
    yDomain: [20, 40],
  })
  assert.equal(result.updatedRefs.includes(scatterRef), true)
  assert.equal(result.updatedRefs.includes(selectionRef), true)
  assert.equal(result.updatedRefs.includes(barRef), true)
  assert.equal(result.updatedRefs.includes(tableRef), true)
  assert.equal(result.statePatch?.[barRef]?.transforms?.[0]?.kind, 'filter')
  assert.equal(result.statePatch?.[barRef]?.transforms?.[0]?.source, selectionRef)
  assert.equal(result.statePatch?.[tableRef]?.transforms?.[0]?.kind, 'filter')
  assert.equal(result.statePatch?.[tableRef]?.transforms?.[0]?.source, selectionRef)

  const view = await globalThis.window.__widgetVA.readView()
  assert.equal(view.widgets?.[barRef]?.data?.visibleCount, 2)
  assert.equal(view.widgets?.[tableRef]?.data?.visibleCount, 2)
  assert.equal(view.widgets?.[barRef]?.transforms?.[0]?.source, selectionRef)
  assert.equal(view.widgets?.[tableRef]?.transforms?.[0]?.source, selectionRef)

  delete globalThis.window
})

test('installWidgetVAPagePort derives getInteractionTrace from a plain interactionTrace array when readTraceWindow is unavailable', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      readState() {
        return {
          stateId: 'main:1',
          createdAt: '2026-01-01T00:00:00.000Z',
          widgets: {},
          shared: {
            activeSelections: {},
            globalFilters: {},
            focusedWidget: undefined,
          },
        }
      },
      interactionTrace: [
        { stateId: 's1', eventKind: 'action', actor: 'agent' },
        { stateId: 's2', eventKind: 'perceptionQuery', actor: 'human' },
        { stateId: 's3', eventKind: 'dataQuery', actor: 'agent' },
      ],
    },
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const described = await globalThis.window.__widgetVA.describePagePort()
  const trace = await globalThis.window.__widgetVA.getInteractionTrace({ limit: 2 })

  assert.equal(described.methods.includes('getInteractionTrace'), true)
  assert.equal(described.aliases.interaction_trace_read, 'getInteractionTrace')
  assert.deepEqual(trace, [
    { stateId: 's2', eventKind: 'perceptionQuery', actor: 'human' },
    { stateId: 's3', eventKind: 'dataQuery', actor: 'agent' },
  ])

  delete globalThis.window
})

test('installWidgetVAPagePort applies sinceStateId and actor filters when getInteractionTrace falls back to a plain interactionTrace array', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      appId: 'demo',
      workspaceId: 'main',
      readDescription() {
        return {
          appId: 'demo',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      readState() {
        return {
          stateId: 's4',
          widgets: {},
          shared: {
            activeSelections: {},
            globalFilters: {},
            focusedWidget: undefined,
          },
        }
      },
      interactionTrace: [
        { stateId: 's1', eventKind: 'action', actor: 'agent' },
        { stateId: 's2', eventKind: 'perceptionQuery', actor: 'human' },
        { stateId: 's3', eventKind: 'dataQuery', actor: 'agent' },
        { stateId: 's4', eventKind: 'action', actor: 'human' },
      ],
    },
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const trace = await globalThis.window.__widgetVA.getInteractionTrace({
    limit: 5,
    sinceStateId: 's2',
    actors: ['human'],
  })

  assert.deepEqual(trace, [
    { stateId: 's4', eventKind: 'action', actor: 'human' },
  ])

  delete globalThis.window
})

test('installWidgetVAPagePort.describePagePort reports planner, agent-loop, and evaluation flags when methods are installed', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      listWidgetDescriptions() {
        return []
      },
      listWidgetAdapters() {
        return []
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
    },
    planWorkspace: noopAsync({}),
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {
      evaluatePropagation() {
        return {}
      },
    },
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {
      describeStepContext() {
        return {}
      },
      executeVerifiedAction() {
        return {}
      },
    },
  })

  const described = await globalThis.window.__widgetVA.describePagePort()

  assert.equal(described.planner, true)
  assert.equal(described.agentLoop, true)
  assert.equal(described.methods.includes('planWorkspace'), true)
  assert.equal(described.methods.includes('describeAgentLoop'), true)
  assert.equal(described.methods.includes('jumpToState'), false)
  assert.equal(described.methods.includes('branchFromState'), false)
  assert.equal(described.aliases?.workspace_plan, 'planWorkspace')
  assert.equal(described.aliases?.agent_loop_describe, 'describeAgentLoop')
  assert.equal(described.aliases?.jump_to_state, undefined)
  assert.equal(described.aliases?.branch_from_state, undefined)
  assert.equal(typeof described.methodDescriptors?.planWorkspace, 'object')
  assert.equal(typeof described.methodDescriptors?.describeAgentLoop, 'object')
  assert.equal(described.methodDescriptors?.jumpToState, undefined)
  assert.equal(described.methodDescriptors?.branchFromState, undefined)
  assert.equal(typeof described.schemas?.workspacePlanningRequest, 'object')
  assert.equal(typeof described.schemas?.workspacePlanningResult, 'object')
  assert.equal(typeof described.schemas?.agentLoopContext, 'object')
  assert.equal(described.transportHints?.optionalTools?.includes('workspace_plan'), true)
  assert.equal(described.transportHints?.optionalTools?.includes('agent_loop_describe'), true)
  assert.equal(described.transportHints?.optionalTools?.includes('state_constraints_evaluate'), false)
  assert.equal(described.transportHints?.optionalTools?.includes('benchmark_task_evaluate'), false)

  delete globalThis.window
})

test('installWidgetVAPagePort does not expose link propagation evaluation without a link engine evaluator', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      readState() {
        return {
          stateId: 'main:s1',
          widgets: {},
          shared: {},
        }
      },
      listWidgetDescriptions() {
        return []
      },
      listWidgetAdapters() {
        return []
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
    },
  })

  const described = await globalThis.window.__widgetVA.describePagePort()

  assert.equal(described.methods.includes('evaluateLinkPropagation'), false)
  assert.equal(described.aliases?.link_propagation_evaluate, undefined)
  assert.equal(typeof globalThis.window.__widgetVA.evaluateLinkPropagation, 'undefined')

  delete globalThis.window
})

test('installWidgetVAPagePort.describePagePort exposes jumpToState and branchFromState only when the corresponding action handlers are registered', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      listWidgetDescriptions() {
        return []
      },
      listWidgetAdapters() {
        return []
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
      readState() {
        return {}
      },
      readTraceWindow() {
        return []
      },
    },
    planWorkspace: undefined,
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {
      has(name) {
        return name === 'workspace.jumpToState' || name === 'workspace.branchFromState'
      },
    },
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const described = await globalThis.window.__widgetVA.describePagePort()

  assert.equal(described.methods.includes('jumpToState'), true)
  assert.equal(described.methods.includes('branchFromState'), true)
  assert.equal(described.aliases?.jump_to_state, 'jumpToState')
  assert.equal(described.aliases?.branch_from_state, 'branchFromState')
  assert.equal(typeof globalThis.window.__widgetVA.jumpToState, 'function')
  assert.equal(typeof globalThis.window.__widgetVA.branchFromState, 'function')

  delete globalThis.window
})

test('installWidgetVAPagePort exposes state history and branch readers for plain snapshot and branch facades', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      appId: 'demo',
      workspaceId: 'main',
      descriptions: {},
      widgets: {},
      stateSnapshots: [
        {
          stateId: 'main:s1',
          createdAt: '2026-01-01T00:00:00.000Z',
          branchId: 'main',
          transitionType: 'continue',
          state: {
            delta: {
              changedRefs: ['replayContext'],
              removedRefs: [],
            },
          },
        },
        {
          stateId: 'main:s2',
          createdAt: '2026-01-01T00:01:00.000Z',
          parentStateId: 'main:s1',
          branchId: 'branch_what_if',
          branchLabel: 'What If',
          transitionType: 'branch',
          state: {
            delta: {
              changedRefs: ['wl://demo/workspace/main/widget/scatter_a'],
              removedRefs: [],
            },
          },
        },
      ],
      branchRegistry: {
        main: {
          branchId: 'main',
          label: 'Main',
          originStateId: 'main:s0',
          parentBranchId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        branch_what_if: {
          branchId: 'branch_what_if',
          label: 'What If',
          originStateId: 'main:s1',
          parentBranchId: 'main',
          createdAt: '2026-01-01T00:01:00.000Z',
        },
      },
      interactionTrace: [
        { stateId: 'main:s1', actor: 'agent' },
        { stateId: 'main:s2', actor: 'human' },
      ],
      responseHistory: [
        {
          responseId: 'response_1',
          stateId: 'main:s2',
          actor: 'agent',
          content: 'Created branch and restored the branch origin snapshot.',
        },
      ],
      stateId: 'main:s2',
      currentBranchId: 'branch_what_if',
      widgetAdapters: {},
    },
    planWorkspace: undefined,
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const described = await globalThis.window.__widgetVA.describePagePort()
  const runtimeCore = await globalThis.window.__widgetVA.describeRuntimeCore()
  const snapshot = await globalThis.window.__widgetVA.readSnapshot({
    stateId: 'main:s2',
    refs: ['replayContext'],
    includeMeta: true,
  })
  const stateHistory = await globalThis.window.__widgetVA.listStateHistory({
    actors: ['human'],
  })
  const branches = await globalThis.window.__widgetVA.listBranches()
  const traceGraph = await globalThis.window.__widgetVA.getTraceGraph()

  assert.equal(described.methods.includes('readSnapshot'), true)
  assert.equal(described.methods.includes('listStateHistory'), true)
  assert.equal(described.methods.includes('listBranches'), true)
  assert.equal(described.methods.includes('getTraceGraph'), true)
  assert.equal(typeof globalThis.window.__widgetVA.readSnapshot, 'function')
  assert.equal(typeof globalThis.window.__widgetVA.listStateHistory, 'function')
  assert.equal(typeof globalThis.window.__widgetVA.listBranches, 'function')
  assert.equal(typeof globalThis.window.__widgetVA.getTraceGraph, 'function')
  assert.equal(runtimeCore.capabilities.snapshotRead, true)
  assert.equal(runtimeCore.capabilities.stateHistoryRead, true)
  assert.equal(runtimeCore.capabilities.branchListRead, true)
  assert.equal(runtimeCore.capabilities.interactionTraceRead, true)
  assert.equal(runtimeCore.capabilities.traceGraphRead, true)
  assert.equal(runtimeCore.registries.snapshotCount, 2)
  assert.equal(runtimeCore.registries.branchCount, 2)
  assert.equal(runtimeCore.registries.traceRecordCount, 2)
  assert.equal(stateHistory.length, 1)
  assert.equal(stateHistory[0]?.stateId, 'main:s2')
  assert.equal(stateHistory[0]?.actor, 'human')
  assert.equal(stateHistory[0]?.transitionType, 'branch')
  assert.equal(stateHistory[0]?.branchLabel, 'What If')
  assert.deepEqual(branches.map((entry) => entry.branchId), ['main', 'branch_what_if'])
  assert.equal(snapshot?.replayContext, null)
  assert.equal(snapshot?.__meta?.stateId, 'main:s2')
  assert.equal(snapshot?.__meta?.parentStateId, 'main:s1')
  assert.equal(snapshot?.__meta?.transitionType, 'branch')
  assert.equal(traceGraph.current_state_id, 'main:s2')
  assert.equal(traceGraph.current_branch_id, 'branch_what_if')
  assert.equal(traceGraph.nodes.length, 2)
  assert.equal(traceGraph.edges[0]?.edge_type, 'branch')
  assert.equal(traceGraph.nodes[1]?.responseId, 'response_1')

  delete globalThis.window
})

test('installWidgetVAPagePort exposes state-manager description for plain snapshot facades without store.stateManager', async () => {
  globalThis.window = {}

  installWidgetVAPagePort({
    store: {
      appId: 'demo',
      workspaceId: 'main',
      stateId: 'main:s2',
      widgets: {},
      shared: {},
      stateSnapshots: [
        { stateId: 'main:s1', state: { widgets: {}, shared: {} } },
        { stateId: 'main:s2', state: { widgets: {}, shared: {} } },
      ],
    },
    planWorkspace: undefined,
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const describedPort = await globalThis.window.__widgetVA.describePagePort()
  const describedStateManager = await globalThis.window.__widgetVA.describeStateManager()

  assert.equal(describedPort.methods.includes('describeStateManager'), true)
  assert.equal(describedStateManager.capabilities.stateIdGeneration, true)
  assert.equal(describedStateManager.counters.generatedStateCount, 2)
  assert.equal(describedStateManager.counters.lastGeneratedStateId, 'main:s2')

  delete globalThis.window
})

test('installWidgetVAPagePort.describeWorkspace preserves runtime taskContext and structured planning metadata', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          taskContext: {
            taskId: 'task-1',
            taskMode: 'goal_oriented',
            coordinationScope: 'multi_widget',
            targetWidgetRefs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
          },
          planning: {
            requestedWorkspaceSpec: {
              topology: 'T2',
              widgetCount: 2,
              linkCount: 1,
            },
            planningRequest: {
              runMode: 'benchmark',
              complexityBudget: 'extended',
              preferredTopology: 'T2',
            },
            workspaceSpecStatus: 'planned',
            workspaceSpecIssues: [],
            materializedFromSpec: false,
            materializedFromPlanner: true,
            planner: {
              topology: 'T2',
              widgets: [
                {
                  widgetId: 'scatter_a',
                  role: 'primary',
                  source: { kind: 'baseSpec' },
                },
              ],
              links: [],
              rationale: ['Planner selected T2 for linked evidence.'],
              source: 'planner',
              planningMode: 'topology_driven',
              primaryWidgetId: 'scatter_a',
              title: 'Planned Workspace',
            },
          },
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      listWidgetDescriptions() {
        return []
      },
      listWidgetAdapters() {
        return []
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
    },
    planWorkspace: noopAsync({}),
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const described = await globalThis.window.__widgetVA.describeWorkspace()

  assert.equal(described.taskContext?.taskId, 'task-1')
  assert.equal(described.taskContext?.coordinationScope, 'multi_widget')
  assert.equal(described.planning?.requestedWorkspaceSpec?.widgetCount, 2)
  assert.equal(described.planning?.planningRequest?.runMode, 'benchmark')
  assert.equal(described.planning?.planner?.primaryWidgetId, 'scatter_a')
  assert.equal(described.planning?.planner?.title, 'Planned Workspace')

  delete globalThis.window
})

test('installWidgetVAPagePort.describeWorkspace preserves materialized widgetAdapters from workspace description', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgetAdapters: [
            {
              widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
              provider: 'vega-lite',
              capabilities: {
                canApplyState: true,
                canBindHumanInteractions: true,
                canRegisterActions: true,
                canRegisterPerceptionQueries: true,
              },
              humanInteraction: {
                mode: 'brush2d',
                actionName: 'scatter.brushRegion',
                supportsDirectManipulation: true,
              },
            },
          ],
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      listWidgetDescriptions() {
        return []
      },
      listWidgetAdapters() {
        return []
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
    },
    planWorkspace: noopAsync({}),
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const described = await globalThis.window.__widgetVA.describeWorkspace()

  assert.equal(Array.isArray(described.widgetAdapters), true)
  assert.equal(described.widgetAdapters[0]?.provider, 'vega-lite')
  assert.equal(described.widgetAdapters[0]?.humanInteraction?.mode, 'brush2d')

  delete globalThis.window
})

test('installWidgetVAPagePort.listWidgetAdapters preserves materialized widgetAdapters from workspace description', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgetAdapters: [
            {
              widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
              provider: 'vega-lite',
              capabilities: {
                canApplyState: true,
                canBindHumanInteractions: true,
                canRegisterActions: true,
                canRegisterPerceptionQueries: true,
              },
              humanInteraction: {
                mode: 'brush2d',
                actionName: 'scatter.brushRegion',
                supportsDirectManipulation: true,
              },
            },
          ],
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      listWidgetDescriptions() {
        return []
      },
      listWidgetAdapters() {
        return [
          {
            widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
            provider: 'custom',
          },
        ]
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
    },
    planWorkspace: noopAsync({}),
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const adapters = await globalThis.window.__widgetVA.listWidgetAdapters()

  assert.equal(Array.isArray(adapters), true)
  assert.equal(adapters[0]?.provider, 'vega-lite')
  assert.equal(adapters[0]?.humanInteraction?.mode, 'brush2d')

  delete globalThis.window
})

test('installWidgetVAPagePort.describeWorkspace preserves materialized widgets and links from workspace description', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [
            {
              ref: 'wl://widgetva-app/workspace/main/widget/scatter_a',
              kind: 'scatter',
              title: 'Scatter A',
              actionNames: [],
              perceptionQueryNames: [],
              humanInteraction: {
                mode: 'brush2d',
                actionName: 'scatter.brushRegion',
                supportsDirectManipulation: true,
              },
            },
          ],
          links: [
            {
              ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_table',
              kind: 'filter',
              from: 'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush',
              to: 'wl://widgetva-app/workspace/main/widget/table_a',
            },
          ],
          dataHandles: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      listWidgetDescriptions() {
        return []
      },
      listWidgetAdapters() {
        return []
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
    },
    planWorkspace: noopAsync({}),
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const described = await globalThis.window.__widgetVA.describeWorkspace()

  assert.equal(Array.isArray(described.widgets), true)
  assert.equal(described.widgets[0]?.title, 'Scatter A')
  assert.equal(Array.isArray(described.links), true)
  assert.equal(described.links[0]?.kind, 'filter')

  delete globalThis.window
})

test('installWidgetVAPagePort.describeWorkspace preserves materialized actions, dataHandles, and perceptionQueries from workspace description', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [],
          links: [],
          actions: [
            {
              name: 'scatter.brushRegion',
              title: 'Brush scatter region',
              description: 'Brush the scatterplot.',
              primitive: 'select',
              category: 'selection',
              paramsSchema: { type: 'object' },
              examples: [{ userGoal: 'Brush west', params: { xRange: [0, 10] } }],
            },
          ],
          dataHandles: [
            {
              ref: 'wl://widgetva-app/workspace/main/data/current_view',
              title: 'Current View Data',
              sourceKind: 'inline',
              schema: { fields: [{ name: 'Region', type: 'nominal' }] },
              supportedQueries: ['summary'],
            },
          ],
          perceptionQueries: [
            {
              name: 'perception.summarizeVisible',
              title: 'Summarize visible rows',
              description: 'Summarize the current view.',
              category: 'summarize',
              paramsSchema: { type: 'object' },
              returnsSchema: { type: 'object' },
              examples: [{ userGoal: 'Summarize rows', params: {} }],
            },
          ],
        }
      },
      listWidgetDescriptions() {
        return []
      },
      listWidgetAdapters() {
        return []
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
    },
    planWorkspace: noopAsync({}),
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const described = await globalThis.window.__widgetVA.describeWorkspace({
    includeSchemas: false,
    includeExamples: false,
  })

  assert.equal(described.actions[0]?.name, 'scatter.brushRegion')
  assert.equal('paramsSchema' in described.actions[0], false)
  assert.equal(Array.isArray(described.dataHandles), true)
  assert.equal(described.dataHandles[0]?.title, 'Current View Data')
  assert.equal('schema' in described.dataHandles[0], false)
  assert.equal(described.perceptionQueries[0]?.name, 'perception.summarizeVisible')
  assert.equal('paramsSchema' in described.perceptionQueries[0], false)
  assert.equal('examples' in described.perceptionQueries[0], false)

  delete globalThis.window
})

test('installWidgetVAPagePort response reads preserve workspace-scoped filters', async () => {
  globalThis.window = {}
  const calls = []
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      listWidgetDescriptions() {
        return []
      },
      listWidgetAdapters() {
        return []
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
      readLatestResponse(options = {}) {
        calls.push({ method: 'readLatestResponse', options })
        return {
          responseId: 'response_2',
          actor: 'agent',
          content: 'Scoped answer',
          createdAt: '2026-01-01T00:00:00.000Z',
        }
      },
      listResponses(limit, options = {}) {
        calls.push({ method: 'listResponses', limit, options })
        return []
      },
    },
    planWorkspace: noopAsync({}),
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  await globalThis.window.__widgetVA.getLatestAgentResponse({ workspaceId: 'workspace_b' })
  await globalThis.window.__widgetVA.listAgentResponses({ limit: 7, workspaceId: 'workspace_b' })

  assert.deepEqual(calls, [
    {
      method: 'readLatestResponse',
      options: { workspaceId: 'workspace_b' },
    },
    {
      method: 'listResponses',
      limit: 7,
      options: { workspaceId: 'workspace_b' },
    },
  ])

  delete globalThis.window
})

test('installWidgetVAPagePort derives response reads from a plain responseHistory facade', async () => {
  globalThis.window = {}

  installWidgetVAPagePort({
    store: {
      appId: 'widgetva-app',
      workspaceId: 'workspace_b',
      descriptions: {},
      widgets: {},
      responseHistory: [
        {
          responseId: 'response_1',
          workspaceId: 'workspace_a',
          actor: 'agent',
          content: 'Unrelated answer',
        },
        {
          responseId: 'response_2',
          workspaceId: 'workspace_b',
          actor: 'agent',
          content: 'Scoped answer',
        },
      ],
    },
    planWorkspace: noopAsync({}),
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {},
    perceptionQueryRegistry: {},
    dataQueryExecutor: {},
    linkEngine: {},
    traceRecorder: {},
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const described = await globalThis.window.__widgetVA.describePagePort()
  const latestResponse = await globalThis.window.__widgetVA.getLatestAgentResponse()
  const responses = await globalThis.window.__widgetVA.listAgentResponses({ limit: 5 })

  assert.equal(described.methods.includes('getLatestAgentResponse'), true)
  assert.equal(described.methods.includes('listAgentResponses'), true)
  assert.equal(latestResponse?.responseId, 'response_2')
  assert.deepEqual(responses.map((item) => item.responseId), ['response_2'])

  delete globalThis.window
})

test('installWidgetVAPagePort describe surfaces expose richer runtime introspection summaries', async () => {
  globalThis.window = {}
  installWidgetVAPagePort({
    store: {
      readDescription() {
        return {
          appId: 'widgetva-app',
          workspaceId: 'main',
          generatedAt: '2026-01-01T00:00:00.000Z',
          widgets: [],
          dataHandles: [],
          links: [],
          actions: [],
          perceptionQueries: [],
        }
      },
      listWidgetDescriptions() {
        return []
      },
      listWidgetAdapters() {
        return []
      },
      listLinks() {
        return []
      },
      listActions() {
        return []
      },
      listDataHandles() {
        return []
      },
      listPerceptionQueries() {
        return []
      },
      describeRuntimeStore() {
        return null
      },
    },
    planWorkspace: noopAsync({}),
    executeAction: noopAsync({}),
    queryPerception: noopAsync({}),
    queryData: noopAsync({}),
    actionExecutor: {
      describeExecutor() {
        return {
          counts: { descriptorCount: 1, handlerCount: 1, preconditionCount: 1 },
          capabilities: {},
          actions: [
            {
              name: 'scatter.brushRegion',
              primitive: 'select',
              category: 'selection',
              targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
              affectedRefs: [],
              affectedStatePaths: ['selections'],
              supportedWidgetKinds: ['scatter'],
              hasPreconditions: true,
              preconditionDescriptorCount: 1,
              preconditionHandlerRegistered: true,
              postconditionCount: 1,
              reversible: true,
              effectCount: 1,
              effectKinds: ['updatesSelection'],
            },
          ],
        }
      },
    },
    perceptionQueryRegistry: {
      describeRegistry() {
        return {
          counts: { descriptorCount: 1, handlerEntryCount: 1 },
          capabilities: { returnsValidation: true },
          queries: [
            {
              name: 'perception.verifyActionEffect',
              category: 'verify',
              targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
              sideEffectFree: true,
              evidenceKinds: ['verificationEvidence', 'stateDelta'],
              verificationTargets: ['statePatch', 'workspaceState'],
              supportedWidgetKinds: ['scatter'],
              handlerVariantCount: 1,
            },
          ],
        }
      },
    },
    dataQueryExecutor: {
      dataQueryEngine: {
        describeEngine() {
          return {
            engine: { kind: 'runtime-test', className: 'RuntimeTestEngine' },
            counts: { supportedQueryKindCount: 2, supportedQueryDescriptorCount: 2 },
            supportedQueryKinds: ['summary', 'schema'],
            supportedQueryDescriptors: [
              {
                name: 'summary',
                title: 'Summarize current data view',
                description: 'Summarize rows.',
                resultKind: 'summaryTable',
              },
              {
                name: 'schema',
                title: 'Inspect data schema',
                description: 'Read field schema.',
                resultKind: 'schema',
              },
            ],
            capabilities: {
              localExecution: true,
              remoteExecution: false,
              sqlSupport: false,
              fallbackEngine: false,
            },
          }
        },
      },
      describeExecutor() {
        return {
          engine: { kind: 'runtime-test', className: 'RuntimeTestEngine' },
          counts: { supportedQueryKindCount: 2, supportedQueryDescriptorCount: 2 },
          capabilities: { schemaValidation: true, returnsValidation: true, traceRecording: true, runtimeDataReads: true },
          supportedQueryKinds: ['summary', 'schema'],
          supportedQueryDescriptors: [
            {
              name: 'summary',
              title: 'Summarize current data view',
              description: 'Summarize rows.',
              resultKind: 'summaryTable',
            },
            {
              name: 'schema',
              title: 'Inspect data schema',
              description: 'Read field schema.',
              resultKind: 'schema',
            },
          ],
        }
      },
    },
    linkEngine: {
      describeEngine() {
        return {
          primitiveCount: 1,
          primitives: [
            {
              name: 'filter',
              appliedStatePaths: ['transforms', 'data.currentDataRef', 'feedback.inboundLinkIds'],
            },
          ],
          linkCount: 0,
          coordinationLinkCount: 0,
          structuralLinkCount: 0,
          automaticLinkCount: 0,
          manualLinkCount: 0,
          topology: {
            topology: 'T1',
            topologyLabel: 'Single View',
            widgetCount: 1,
            edgeCount: 0,
            linkDensity: 0,
            sourceWidgetCount: 0,
            targetWidgetCount: 0,
            maxOutDegree: 0,
            maxInDegree: 0,
            rationale: [],
          },
          capabilities: {},
        }
      },
    },
    traceRecorder: {
      describeRecorder() {
        return {
          capabilities: {},
          counters: {
            traceCount: 1,
            latestStateId: 'main:s1',
            latestBranchId: 'main',
            latestEventKind: 'dataQuery',
            latestEventFamily: 'query',
            latestQuerySurface: 'data',
          },
          eventKinds: ['action', 'perceptionQuery', 'dataQuery', 'systemTransition'],
          eventFamilies: ['action', 'query', 'systemTransition'],
          querySurfaces: ['perception', 'data'],
        }
      },
    },
    responseRecorder: {},
    agentLoopRuntime: {},
    runtimeEvaluation: {},
    benchmarkRuntimeAdapter: {},
  })

  const actionExecutor = await globalThis.window.__widgetVA.describeActionExecutor()
  const perceptionRegistry = await globalThis.window.__widgetVA.describePerceptionRegistry()
  const dataQueryExecutor = await globalThis.window.__widgetVA.describeDataQueryExecutor()
  const dataQueryEngine = await globalThis.window.__widgetVA.describeDataQueryEngine()
  const runtimeCore = await globalThis.window.__widgetVA.describeRuntimeCore()
  const linkEngine = await globalThis.window.__widgetVA.describeLinkEngine()
  const traceRecorder = await globalThis.window.__widgetVA.describeTraceRecorder()

  assert.deepEqual(actionExecutor.actions[0]?.effectKinds, ['updatesSelection'])
  assert.equal(perceptionRegistry.queries[0]?.verificationTargets?.[0], 'statePatch')
  assert.equal(dataQueryExecutor.supportedQueryDescriptors[0]?.resultKind, 'summaryTable')
  assert.equal(runtimeCore.components.dataQueryEngine, true)
  assert.equal(runtimeCore.components.workspacePlanner, true)
  assert.equal(runtimeCore.components.agentLoopRuntime, true)
  assert.equal(runtimeCore.components.runtimeEvaluation, undefined)
  assert.equal(runtimeCore.components.benchmarkRuntimeAdapter, undefined)
  assert.equal(runtimeCore.registries.widgetCount, 0)
  assert.equal(runtimeCore.registries.dataHandleCount, 0)
  assert.equal(runtimeCore.registries.linkCount, 0)
  assert.equal(runtimeCore.registries.adapterCount, 0)
  assert.equal(runtimeCore.registries.snapshotCount, 0)
  assert.equal(runtimeCore.registries.branchCount, 0)
  assert.equal(runtimeCore.registries.actionDescriptorCount, 1)
  assert.equal(runtimeCore.registries.perceptionDescriptorCount, 1)
  assert.equal(dataQueryEngine.counts.supportedQueryDescriptorCount, 2)
  assert.equal(runtimeCore.registries.dataQueryDescriptorCount, 2)
  assert.equal(runtimeCore.capabilities.actionRun, true)
  assert.equal(runtimeCore.capabilities.perceptionReturnsValidation, true)
  assert.equal(runtimeCore.capabilities.dataQueryReturnsValidation, true)
  assert.equal(runtimeCore.capabilities.perceptionQueryRun, true)
  assert.equal(runtimeCore.capabilities.dataQueryRun, true)
  assert.equal(runtimeCore.capabilities.workspacePlanning, true)
  assert.equal(runtimeCore.capabilities.verifiedActionRun, false)
  assert.equal(runtimeCore.capabilities.agentLoopContextRead, false)
  assert.equal(runtimeCore.capabilities.workspaceDescriptionRead, true)
  assert.equal(runtimeCore.capabilities.runtimeStoreRead, false)
  assert.equal(runtimeCore.capabilities.widgetRegistryRead, false)
  assert.equal(runtimeCore.capabilities.widgetAdapterListRead, true)
  assert.equal(runtimeCore.capabilities.viewRead, false)
  assert.equal(runtimeCore.capabilities.snapshotRead, false)
  assert.equal(runtimeCore.capabilities.stateHistoryRead, false)
  assert.equal(runtimeCore.capabilities.branchListRead, false)
  assert.equal(runtimeCore.capabilities.interactionTraceRead, false)
  assert.equal(runtimeCore.capabilities.primitiveTraceRead, false)
  assert.equal(runtimeCore.capabilities.actionCallTraceRead, false)
  assert.equal(runtimeCore.capabilities.branchReplayEventsRead, false)
  assert.equal(runtimeCore.capabilities.traceGraphRead, false)
  assert.equal(runtimeCore.capabilities.stateJump, false)
  assert.equal(runtimeCore.capabilities.branchCreate, false)
  assert.equal(runtimeCore.capabilities.finalWorkspaceSnapshotRead, false)
  assert.equal(runtimeCore.capabilities.linkPropagationEvaluation, false)
  assert.equal(runtimeCore.capabilities.experimentalConditionRead, undefined)
  assert.equal(runtimeCore.capabilities.actionVerificationEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.evidenceLogEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.acceptableAnswerEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.taskAlignmentEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.coordinationQualityEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.processQualityEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.requiredPrimitivesEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.optionalBindingsEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.stateConstraintEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.tracePatternEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.actionOutcomeEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.replayConsistencyEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.performanceMetricsEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.bindingAccuracyEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.selectionAccuracyEvaluation, undefined)
  assert.equal(runtimeCore.capabilities.benchmarkTaskEvaluation, undefined)
  assert.equal(dataQueryEngine.supportedQueryDescriptors[0]?.resultKind, 'summaryTable')
  assert.equal(linkEngine.primitives[0]?.appliedStatePaths?.[0], 'transforms')
  assert.equal(traceRecorder.counters.latestQuerySurface, 'data')

  delete globalThis.window
})
