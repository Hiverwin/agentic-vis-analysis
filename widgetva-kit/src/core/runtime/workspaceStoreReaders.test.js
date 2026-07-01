import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildTraceGraphFromStore,
  listBranchesFromStore,
  listResponsesFromStore,
  listStateSnapshotsFromStore,
  readCurrentSnapshotMetaFromStore,
  readLatestResponseFromStore,
  readInteractionTraceFromStore,
  readSnapshotEntryFromStore,
  readSnapshotFromStore,
  readRuntimeDataFromStore,
  resolveSelectionDataRefFromStore,
  readWorkspaceDescriptionFromStore,
  readWorkspaceStateFromStore,
} from './workspaceStoreReaders.js'

test('readWorkspaceDescriptionFromStore derives a workspace description from plain manual-assembly store fields', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const actionName = 'scatter.brushRegion'
  const perceptionName = 'perception.summarizeVisible'

  const description = readWorkspaceDescriptionFromStore({
    appId: 'demo',
    workspaceId: 'main',
    descriptions: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        title: 'Scatter A',
      },
    },
    actions: {
      [actionName]: {
        name: actionName,
        targetRef: widgetRef,
      },
    },
    perceptionQueries: {
      [perceptionName]: {
        name: perceptionName,
        targetRef: widgetRef,
      },
    },
  })

  assert.equal(description.appId, 'demo')
  assert.equal(description.workspaceId, 'main')
  assert.equal(description.widgets[0]?.ref, widgetRef)
  assert.equal(description.actions[0]?.name, actionName)
  assert.equal(description.actions[0]?.analyticalPlacement, 'workspace-shared-state')
  assert.equal(description.actions[0]?.sharedAnalyticalSurface, 'sharedSemanticFocus')
  assert.equal(description.perceptionQueries[0]?.name, perceptionName)
})

test('readWorkspaceDescriptionFromStore derives workspace capabilities, topology, and transport hints from plain manual-assembly facades', () => {
  const sourceWidgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const targetWidgetRef = 'wl://demo/workspace/main/widget/bar_b'
  const linkRef = 'wl://demo/workspace/main/link/scatter_filters_bar'

  const description = readWorkspaceDescriptionFromStore({
    appId: 'demo',
    workspaceId: 'main',
    descriptions: {
      [sourceWidgetRef]: { ref: sourceWidgetRef, kind: 'scatter', title: 'Scatter A' },
      [targetWidgetRef]: { ref: targetWidgetRef, kind: 'bar', title: 'Bar B' },
    },
    links: {
      [linkRef]: {
        ref: linkRef,
        kind: 'filters',
        from: `${sourceWidgetRef}/selection/brush`,
        to: targetWidgetRef,
      },
    },
    interactionTrace: [
      { stateId: 'main:s1', actor: 'agent', eventKind: 'action' },
    ],
    stateSnapshots: [
      { stateId: 'main:s1', branchId: 'main', state: { widgets: {}, shared: {} } },
    ],
    responseHistory: [
      { responseId: 'response_1', stateId: 'main:s1', workspaceId: 'main', actor: 'agent', content: 'Done.' },
    ],
  })

  assert.equal(description.workspaceCapabilities?.includes('singleWidgetAnalysis'), true)
  assert.equal(description.workspaceCapabilities?.includes('multiWidgetCoordination'), true)
  assert.equal(description.workspaceCapabilities?.includes('crossFilter'), true)
  assert.equal(description.workspaceCapabilities?.includes('traceReplay'), true)
  assert.equal(description.runtimeTopology?.topology, 'T2')
  assert.deepEqual(
    description.transportHints?.recommendedTools,
    ['workspace_describe', 'view_read', 'action_run', 'perception_query', 'interaction_trace_read'],
  )
  assert.equal(description.transportHints?.optionalTools?.includes('workspace_snapshot_read'), false)
  assert.equal(description.benchmarkSupport, undefined)
})

test('readWorkspaceDescriptionFromStore normalizes primitive-only coordination links from plain manual-assembly facades', () => {
  const sourceWidgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const firstTargetWidgetRef = 'wl://demo/workspace/main/widget/bar_b'
  const secondTargetWidgetRef = 'wl://demo/workspace/main/widget/table_c'
  const firstLinkRef = 'wl://demo/workspace/main/link/scatter_filters_bar'
  const secondLinkRef = 'wl://demo/workspace/main/link/scatter_filters_table'

  const description = readWorkspaceDescriptionFromStore({
    appId: 'demo',
    workspaceId: 'main',
    descriptions: {
      [sourceWidgetRef]: { ref: sourceWidgetRef, kind: 'scatter', title: 'Scatter A' },
      [firstTargetWidgetRef]: { ref: firstTargetWidgetRef, kind: 'bar', title: 'Bar B' },
      [secondTargetWidgetRef]: { ref: secondTargetWidgetRef, kind: 'table', title: 'Table C' },
    },
    links: {
      [firstLinkRef]: {
        ref: firstLinkRef,
        primitive: 'filter',
        from: `${sourceWidgetRef}/selection/brush`,
        to: firstTargetWidgetRef,
      },
      [secondLinkRef]: {
        ref: secondLinkRef,
        primitive: 'filter',
        from: `${sourceWidgetRef}/selection/brush`,
        to: secondTargetWidgetRef,
      },
    },
  })

  assert.equal(description.workspaceCapabilities?.includes('crossFilter'), true)
  assert.equal(description.runtimeTopology?.topology, 'T6')
  assert.deepEqual(
    description.links.map((link) => ({ kind: link.kind, primitive: link.primitive })),
    [
      { kind: 'filter', primitive: 'filter' },
      { kind: 'filter', primitive: 'filter' },
    ],
  )
  assert.equal(description.benchmarkSupport, undefined)
})

test('readWorkspaceStateFromStore derives a workspace state from plain manual-assembly widget and shared fields', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const state = readWorkspaceStateFromStore({
    stateId: 'main:s2',
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        version: 2,
      },
    },
    shared: {
      focusedWidget: widgetRef,
    },
  })

  assert.equal(state.stateId, 'main:s2')
  assert.equal(state.widgets[widgetRef]?.version, 2)
  assert.equal(state.shared.focusedWidget, widgetRef)
  assert.deepEqual(state.shared.selections, {
    registry: {},
    views: {
      primary: null,
      byWidget: {},
    },
  })
  assert.equal(state.shared.viewport, null)
  assert.deepEqual(state.shared.globalFilters, {})
})

test('readWorkspaceStateFromStore derives deltaSince-scoped state from plain manual-assembly snapshot facades', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const otherWidgetRef = 'wl://demo/workspace/main/widget/bar_b'
  const state = readWorkspaceStateFromStore({
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
  }, {
    deltaSince: 'main:s1',
    refs: [widgetRef],
  })

  assert.equal(state.stateId, 'main:s2')
  assert.equal(state.delta?.baseStateId, 'main:s1')
  assert.ok(state.delta?.changedRefs?.includes(widgetRef))
  assert.ok(state.delta?.changedRefs?.includes('shared'))
  assert.deepEqual(state.delta?.removedRefs, [])
  assert.equal(state.widgets?.[widgetRef]?.view?.xDomain?.[1], 10)
  assert.equal('shared' in state, false)
})

test('readRuntimeDataFromStore reads runtimeData entries from a plain manual-assembly store', () => {
  const dataRef = 'wd://demo/workspace/main/data/current-view'
  const runtimeData = readRuntimeDataFromStore({
    runtimeData: {
      [dataRef]: {
        ref: dataRef,
        rows: [{ id: 1 }, { id: 2 }],
      },
    },
  }, dataRef)

  assert.deepEqual(runtimeData?.rows, [{ id: 1 }, { id: 2 }])
})

test('resolveSelectionDataRefFromStore derives a selection-scoped data ref from a plain manual-assembly store', () => {
  const selectionRef = 'wl://demo/workspace/main/widget/scatter_a/selection/brush'
  const resolvedDataRef = resolveSelectionDataRefFromStore({
    appId: 'demo',
    workspaceId: 'main',
  }, selectionRef)

  assert.equal(resolvedDataRef, 'wl://demo/workspace/main/data/scatter_a_selection_brush')
})

test('listStateSnapshotsFromStore and listBranchesFromStore derive history metadata from plain manual-assembly facades', () => {
  const store = {
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
  }

  const history = listStateSnapshotsFromStore(store, { actors: ['human'] })
  const branches = listBranchesFromStore(store)

  assert.equal(history.length, 1)
  assert.equal(history[0]?.stateId, 'main:s2')
  assert.equal(history[0]?.actor, 'human')
  assert.equal(history[0]?.transitionType, 'branch')
  assert.equal(history[0]?.branchLabel, 'What If')
  assert.deepEqual(branches.map((entry) => entry.branchId), ['main', 'branch_what_if'])
})

test('readInteractionTraceFromStore derives filtered trace windows from plain interactionTrace facades', () => {
  const trace = readInteractionTraceFromStore({
    interactionTrace: [
      { stateId: 'main:s1', actor: 'agent', eventKind: 'action' },
      { stateId: 'main:s2', actor: 'human', eventKind: 'action' },
      { stateId: 'main:s3', actor: 'system', eventKind: 'systemTransition' },
    ],
  }, {
    sinceStateId: 'main:s1',
    actors: ['system'],
  })

  assert.deepEqual(trace, [
    { stateId: 'main:s3', actor: 'system', eventKind: 'systemTransition' },
  ])
})

test('readInteractionTraceFromStore falls back to readTrace when readTraceWindow is unavailable', () => {
  const trace = readInteractionTraceFromStore({
    readTrace(limit) {
      assert.equal(limit, 2)
      return [
        { stateId: 'main:s1', actor: 'agent', eventKind: 'action' },
        { stateId: 'main:s2', actor: 'human', eventKind: 'action' },
      ]
    },
  }, {
    limit: 2,
    actors: ['human'],
  })

  assert.deepEqual(trace, [
    { stateId: 'main:s2', actor: 'human', eventKind: 'action' },
  ])
})

test('readCurrentSnapshotMetaFromStore, readLatestResponseFromStore, and listResponsesFromStore derive plain history facades', () => {
  const store = {
    workspaceId: 'workspace_b',
    stateId: 'main:s2',
    stateSnapshots: [
      { stateId: 'main:s1' },
      { stateId: 'main:s2', branchId: 'main' },
    ],
    responseHistory: [
      { responseId: 'response_1', workspaceId: 'workspace_a', actor: 'agent' },
      { responseId: 'response_2', workspaceId: 'workspace_b', actor: 'agent' },
      { responseId: 'response_3', workspaceId: 'workspace_b', actor: 'human' },
    ],
  }

  const currentSnapshot = readCurrentSnapshotMetaFromStore(store)
  const latestResponse = readLatestResponseFromStore(store)
  const responses = listResponsesFromStore(store, 5)

  assert.equal(currentSnapshot?.stateId, 'main:s2')
  assert.equal(latestResponse?.responseId, 'response_3')
  assert.deepEqual(responses.map((item) => item.responseId), ['response_2', 'response_3'])
})

test('buildTraceGraphFromStore derives a scoped trace graph from plain manual-assembly history facades', () => {
  const store = {
    stateId: 'main:s2',
    currentBranchId: 'branch_what_if',
    stateSnapshots: [
      {
        stateId: 'main:s1',
        createdAt: '2026-01-01T00:00:00.000Z',
        branchId: 'main',
        transitionType: 'continue',
        state: {
          createdAt: '2026-01-01T00:00:00.000Z',
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
          createdAt: '2026-01-01T00:01:00.000Z',
        },
      },
    ],
    branchRegistry: {
      main: {
        branchId: 'main',
        label: 'Main',
        originStateId: 'main:s0',
      },
      branch_what_if: {
        branchId: 'branch_what_if',
        label: 'What If',
        originStateId: 'main:s1',
        parentBranchId: 'main',
      },
    },
    interactionTrace: [
      {
        stateId: 'main:s1',
        actor: 'agent',
        eventKind: 'action',
        eventFamily: 'action',
        action: {
          name: 'scatter.brushRegion',
        },
      },
      {
        stateId: 'main:s2',
        actor: 'system',
        eventKind: 'systemTransition',
        eventFamily: 'systemTransition',
      },
    ],
    responseHistory: [
      {
        responseId: 'response_1',
        stateId: 'main:s2',
        actor: 'agent',
        content: 'Created branch and restored the prior state.',
      },
    ],
  }

  const traceGraph = buildTraceGraphFromStore(store, { sinceStateId: 'main:s0' })

  assert.equal(traceGraph.current_state_id, 'main:s2')
  assert.equal(traceGraph.current_branch_id, 'branch_what_if')
  assert.equal(traceGraph.nodes.length, 2)
  assert.equal(traceGraph.edges.length, 1)
  assert.equal(traceGraph.nodes[0]?.actionName, 'scatter.brushRegion')
  assert.equal(traceGraph.nodes[1]?.transitionType, 'branch')
  assert.equal(traceGraph.nodes[1]?.responseId, 'response_1')
  assert.equal(traceGraph.edges[0]?.edge_type, 'branch')
  assert.deepEqual(traceGraph.branches.map((entry) => entry.branchId), ['main', 'branch_what_if'])
})

test('readSnapshotEntryFromStore and readSnapshotFromStore derive scoped snapshots from plain manual-assembly history facades', () => {
  const store = {
    stateSnapshots: [
      {
        stateId: 'main:s2',
        parentStateId: 'main:s1',
        branchId: 'branch_what_if',
        branchLabel: 'What If',
        transitionType: 'branch',
        replayContext: {
          runMode: 'benchmark',
        },
        state: {
          stateId: 'main:s2',
          widgets: {
            'wl://demo/workspace/main/widget/scatter_a': {
              ref: 'wl://demo/workspace/main/widget/scatter_a',
              widgetId: 'scatter_a',
              kind: 'scatter',
            },
          },
          shared: {
            focusedWidget: 'wl://demo/workspace/main/widget/scatter_a',
          },
          taskContext: {
            taskId: 'task-1',
          },
        },
      },
    ],
  }

  const entry = readSnapshotEntryFromStore(store, 'main:s2')
  const snapshot = readSnapshotFromStore(store, 'main:s2', {
    refs: ['wl://demo/workspace/main/widget/scatter_a', 'replayContext'],
    includeMeta: true,
  })

  assert.equal(entry?.stateId, 'main:s2')
  assert.equal(snapshot?.widgets?.['wl://demo/workspace/main/widget/scatter_a']?.widgetId, 'scatter_a')
  assert.equal(snapshot?.replayContext?.runMode, 'benchmark')
  assert.equal('shared' in snapshot, false)
  assert.equal(snapshot?.__meta?.parentStateId, 'main:s1')
  assert.equal(snapshot?.__meta?.transitionType, 'branch')
})
