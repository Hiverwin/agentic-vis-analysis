import test from 'node:test'
import assert from 'node:assert/strict'

import {
  actionRun,
  listAvailableActions,
  listAvailablePerceptions,
  readCoordinationState,
  readObservation,
  readPropagationSummary,
  describeWidget,
  executeAction,
  executeWidgetAction,
  executeWorkspaceAction,
  interactionTraceRead,
  listAvailableWidgetVAMcpTools,
  queryWidgetPerception,
  queryWorkspacePerception,
  readState,
  readTrace,
  readWidgetState,
  readWidgetTrace,
  readWorkspaceState,
  readWorkspaceTrace,
  replay,
  replayWidget,
  replayWorkspace,
  perceptionQuery,
  runDataQuery,
  stateManagerDescribe,
  viewRead,
  workspaceDescribe,
} from './inPageTransport.js'

test('inPageTransport.listAvailableWidgetVAMcpTools returns only the runtime-installed MCP tool subset', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {
    __widgetVA: {
      page_port_describe() {
        return {
          aliases: {
            page_port_describe: 'describePagePort',
            workspace_describe: 'describeWorkspace',
            view_read: 'readView',
          },
        }
      },
    },
    __widgetVAEval: {
      describeEvaluationSurface() {
        return {
          aliases: {
            evaluation_surface_describe: 'describeEvaluationSurface',
            evaluation_action_verification: 'evaluateActionVerification',
          },
        }
      },
    },
  }

  try {
    const tools = await listAvailableWidgetVAMcpTools()

    assert.deepEqual(
      tools.map((tool) => tool.name),
      [
        'page_port_describe',
        'workspace_describe',
        'view_read',
      ],
    )
  } finally {
    globalThis.window = previousWindow
  }
})

test('inPageTransport dispatches the documented core workspace tools through the page port aliases', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {
    __widgetVA: {
      workspace_describe(options = {}) {
        return {
          workspaceId: options.workspaceId || 'main',
          widgets: [{ ref: 'wl://widgetva-app/workspace/main/widget/scatter_a', widgetId: 'scatter_a' }],
        }
      },
      observation_read() {
        return {
          workspace: { workspaceId: 'main' },
          state: { stateId: 'main:s1' },
          availableActions: [{ name: 'workspace.focusWidget' }],
          availablePerceptions: [{ name: 'perception.summarizeVisible' }],
        }
      },
      coordination_state_read() {
        return {
          focusedWidgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
        }
      },
      propagation_summary_read(options = {}) {
        return {
          sourceRef: options.sourceRef || null,
          propagation: [],
        }
      },
      available_actions_list() {
        return [{ name: 'workspace.focusWidget' }]
      },
      available_perceptions_list() {
        return [{ name: 'perception.summarizeVisible' }]
      },
      view_read(options = {}) {
        return {
          stateId: options.stateId || 'main:s1',
          refs: options.refs || [],
          widgets: {
            'wl://widgetva-app/workspace/main/widget/scatter_a': {
              rawSpec: { mark: 'point' },
            },
          },
        }
      },
      action_run(call = {}) {
        return {
          ok: true,
          callId: call.callId || null,
          actionName: call.name || null,
          updatedRefs: [call.queryScope?.widgetRef || 'wl://widgetva-app/workspace/main/widget/scatter_a'],
        }
      },
      perception_query(call = {}) {
        return {
          ok: true,
          callId: call.callId || null,
          queryName: call.name || null,
          result: { summary: 'Selected 12 points.' },
        }
      },
      data_query(call = {}) {
        return {
          ok: true,
          callId: call.callId || null,
          queryName: call.query?.kind || null,
          result: { rows: [{ count: 12 }] },
        }
      },
      interaction_trace_read(options = {}) {
        return [
          {
            stateId: options.sinceStateId || 'main:s1',
            actor: 'agent',
            eventKind: 'action',
            eventFamily: 'action',
            action: {
              name: 'scatter.brushRegion',
              targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
            },
            affectedRefs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
          },
        ]
      },
      jump_to_state(options = {}) {
        return {
          ok: true,
          stateId: options.stateId || null,
        }
      },
    },
  }

  try {
    assert.deepEqual(
      await readObservation(),
      {
        workspace: { workspaceId: 'main' },
        state: { stateId: 'main:s1' },
        availableActions: [{ name: 'workspace.focusWidget' }],
        availablePerceptions: [{ name: 'perception.summarizeVisible' }],
      },
    )
    assert.deepEqual(
      await readCoordinationState(),
      {
        focusedWidgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
      },
    )
    assert.deepEqual(
      await readPropagationSummary({ sourceRef: 'wl://widgetva-app/workspace/main/widget/scatter_a' }),
      {
        sourceRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
        propagation: [],
      },
    )
    assert.deepEqual(
      await listAvailableActions(),
      [{ name: 'workspace.focusWidget' }],
    )
    assert.deepEqual(
      await listAvailablePerceptions(),
      [{ name: 'perception.summarizeVisible' }],
    )
    assert.deepEqual(
      await workspaceDescribe({ workspaceId: 'workspace_b' }),
      {
        workspaceId: 'workspace_b',
        widgets: [{ ref: 'wl://widgetva-app/workspace/main/widget/scatter_a', widgetId: 'scatter_a' }],
      },
    )
    assert.deepEqual(
      await describeWidget({ widgetId: 'scatter_a' }),
      { ref: 'wl://widgetva-app/workspace/main/widget/scatter_a', widgetId: 'scatter_a' },
    )
    assert.deepEqual(
      await viewRead({ stateId: 'main:s1' }),
      {
        stateId: 'main:s1',
        refs: [],
        widgets: {
          'wl://widgetva-app/workspace/main/widget/scatter_a': {
            rawSpec: { mark: 'point' },
          },
        },
      },
    )
    assert.deepEqual(
      await readWorkspaceState({ refs: ['wl://widgetva-app/workspace/main/widget/scatter_a'] }),
      {
        stateId: 'main:s1',
        refs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
        widgets: {
          'wl://widgetva-app/workspace/main/widget/scatter_a': {
            rawSpec: { mark: 'point' },
          },
        },
      },
    )
    assert.deepEqual(
      await readState({ refs: ['wl://widgetva-app/workspace/main/widget/scatter_a'] }),
      {
        stateId: 'main:s1',
        refs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
        widgets: {
          'wl://widgetva-app/workspace/main/widget/scatter_a': {
            rawSpec: { mark: 'point' },
          },
        },
      },
    )
    assert.deepEqual(
      await readWidgetState({ widgetId: 'scatter_a' }),
      {
        stateId: 'main:s1',
        refs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
        widgets: {
          'wl://widgetva-app/workspace/main/widget/scatter_a': {
            rawSpec: { mark: 'point' },
          },
        },
      },
    )
    assert.deepEqual(
      await actionRun({
        callId: 'call-001',
        name: 'scatter.brushRegion',
        targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
        params: {
          xField: 'latency',
          yField: 'error_rate',
          xRange: [100, 300],
          yRange: [0.05, 0.2],
        },
        actor: 'agent',
      }),
      {
        ok: true,
        callId: 'call-001',
        actionName: 'scatter.brushRegion',
        updatedRefs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
      },
    )
    assert.deepEqual(
      await executeWorkspaceAction({
        callId: 'call-001b',
        name: 'workspace.focusWidget',
        targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
      }),
      {
        ok: true,
        callId: 'call-001b',
        actionName: 'workspace.focusWidget',
        updatedRefs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
      },
    )
    assert.deepEqual(
      await executeWidgetAction({
        callId: 'call-001c',
        name: 'scatter.brushRegion',
        targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
      }),
      {
        ok: true,
        callId: 'call-001c',
        actionName: 'scatter.brushRegion',
        updatedRefs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
      },
    )
    assert.deepEqual(
      await executeAction({
        callId: 'call-001d',
        name: 'workspace.focusWidget',
        targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
      }),
      {
        ok: true,
        callId: 'call-001d',
        actionName: 'workspace.focusWidget',
        updatedRefs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
      },
    )
    assert.deepEqual(
      await perceptionQuery({
        callId: 'call-002',
        name: 'perception.summarizeSelection',
        targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
        actor: 'agent',
      }),
      {
        ok: true,
        callId: 'call-002',
        queryName: 'perception.summarizeSelection',
        result: { summary: 'Selected 12 points.' },
      },
    )
    assert.deepEqual(
      await queryWorkspacePerception({
        callId: 'call-002b',
        name: 'perception.findExtremes',
      }),
      {
        ok: true,
        callId: 'call-002b',
        queryName: 'perception.findExtremes',
        result: { summary: 'Selected 12 points.' },
      },
    )
    assert.deepEqual(
      await queryWidgetPerception({
        callId: 'call-002c',
        name: 'perception.summarizeSelection',
        targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
      }),
      {
        ok: true,
        callId: 'call-002c',
        queryName: 'perception.summarizeSelection',
        result: { summary: 'Selected 12 points.' },
      },
    )
    assert.deepEqual(
      await runDataQuery({
        callId: 'call-003',
        dataRef: 'wl://widgetva-app/workspace/main/data/current_view',
        query: {
          kind: 'summary',
          spec: {},
        },
      }),
      {
        ok: true,
        callId: 'call-003',
        queryName: 'summary',
        result: { rows: [{ count: 12 }] },
      },
    )
    assert.deepEqual(
      await interactionTraceRead({ sinceStateId: 'main:s0', limit: 10 }),
      [
        {
          stateId: 'main:s0',
          actor: 'agent',
          eventKind: 'action',
          eventFamily: 'action',
          action: {
            name: 'scatter.brushRegion',
            targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
          },
          affectedRefs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
        },
      ],
    )
    assert.deepEqual(
      await readWorkspaceTrace({ sinceStateId: 'main:s0', limit: 10 }),
      [
        {
          stateId: 'main:s0',
          actor: 'agent',
          eventKind: 'action',
          eventFamily: 'action',
          action: {
            name: 'scatter.brushRegion',
            targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
          },
          affectedRefs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
        },
      ],
    )
    assert.deepEqual(
      await readTrace({ sinceStateId: 'main:s0', limit: 10 }),
      [
        {
          stateId: 'main:s0',
          actor: 'agent',
          eventKind: 'action',
          eventFamily: 'action',
          action: {
            name: 'scatter.brushRegion',
            targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
          },
          affectedRefs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
        },
      ],
    )
    assert.deepEqual(
      await readWidgetTrace({ widgetId: 'scatter_a', sinceStateId: 'main:s0', limit: 10 }),
      [
        {
          stateId: 'main:s0',
          actor: 'agent',
          eventKind: 'action',
          eventFamily: 'action',
          action: {
            name: 'scatter.brushRegion',
            targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
          },
          affectedRefs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
        },
      ],
    )
    assert.deepEqual(await replayWorkspace('main:s2'), { ok: true, stateId: 'main:s2' })
    assert.deepEqual(await replay('main:s2'), { ok: true, stateId: 'main:s2' })
    assert.deepEqual(await replayWidget({ stateId: 'main:s3' }), { ok: true, stateId: 'main:s3' })
  } finally {
    globalThis.window = previousWindow
  }
})

test('inPageTransport dispatches state-manager introspection through the page port alias', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {
    __widgetVA: {
      state_manager_describe() {
        return {
          capabilities: {
            stateIdGeneration: true,
            deltaCreation: true,
            statePatchCreation: true,
            refScopedReads: true,
          },
          reservedRefs: ['shared', 'taskContext', 'replayContext'],
          counters: {
            generatedStateCount: 2,
            lastGeneratedStateId: 'main:s2',
          },
        }
      },
    },
  }

  try {
    assert.deepEqual(
      await stateManagerDescribe(),
      {
        capabilities: {
          stateIdGeneration: true,
          deltaCreation: true,
          statePatchCreation: true,
          refScopedReads: true,
        },
        reservedRefs: ['shared', 'taskContext', 'replayContext'],
        counters: {
          generatedStateCount: 2,
          lastGeneratedStateId: 'main:s2',
        },
      },
    )
  } finally {
    globalThis.window = previousWindow
  }
})

test('inPageTransport falls back to stable page-port methods when alias methods are unavailable', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {
    __widgetVA: {
      describeWorkspace(options = {}) {
        return {
          workspaceId: options.workspaceId || 'main',
        }
      },
      readView(options = {}) {
        return {
          stateId: options.stateId || 'main:s1',
        }
      },
      executeAction(call = {}) {
        return {
          ok: true,
          actionName: call.name || null,
        }
      },
      queryPerception(call = {}) {
        return {
          ok: true,
          queryName: call.name || null,
        }
      },
      getInteractionTrace(options = {}) {
        return [
          {
            stateId: options.sinceStateId || 'main:s1',
            actor: 'agent',
            eventKind: 'action',
          },
        ]
      },
    },
  }

  try {
    assert.deepEqual(await workspaceDescribe({ workspaceId: 'workspace_b' }), { workspaceId: 'workspace_b' })
    assert.deepEqual(await viewRead({ stateId: 'main:s7' }), { stateId: 'main:s7' })
    assert.deepEqual(
      await actionRun({ name: 'scatter.brushRegion' }),
      { ok: true, actionName: 'scatter.brushRegion' },
    )
    assert.deepEqual(
      await perceptionQuery({ name: 'perception.summarizeSelection' }),
      { ok: true, queryName: 'perception.summarizeSelection' },
    )
    assert.deepEqual(
      await interactionTraceRead({ sinceStateId: 'main:s0' }),
      [{ stateId: 'main:s0', actor: 'agent', eventKind: 'action' }],
    )
  } finally {
    globalThis.window = previousWindow
  }
})
