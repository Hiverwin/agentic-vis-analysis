import test from 'node:test'
import assert from 'node:assert/strict'

import { describeRuntimeCore } from './RuntimeCoreIntrospector.js'

test('describeRuntimeCore exposes response-recorder read capabilities when installed', () => {
  const summary = describeRuntimeCore({
    store: {
      interactionTrace: [{ stateId: 'main:s1' }, { stateId: 'main:s2' }],
      stateSnapshots: [{ stateId: 'main:s1' }, { stateId: 'main:s2' }, { stateId: 'main:s3' }],
      widgetRegistry: {
        describe() {
          return {
            counts: {
              widgetCount: 3,
              dataHandleCount: 2,
              linkCount: 1,
              adapterCount: 1,
            },
          }
        },
      },
      stateManager: {},
      buildStatePatch() {
        return {}
      },
      listWidgetAdapters() {
        return []
      },
      readDescription() {
        return {}
      },
      readState() {
        return { delta: { widgets: {} } }
      },
      readSnapshotEntry() {
        return null
      },
      listStateHistory() {
        return []
      },
      listBranches() {
        return [{ branchId: 'main' }]
      },
      readTraceWindow() {
        return []
      },
      previousState: { stateId: 'main:s0' },
      state: { delta: { widgets: {} } },
      buildTraceGraph() {
        return {}
      },
      beginBranchFromState() {
        return {}
      },
    },
    planWorkspace() {
      return {}
    },
    actionExecutor: {
      handlers: new Map([
        ['workspace.jumpToState', async () => ({ ok: true })],
        ['workspace.branchFromState', async () => ({ ok: true })],
      ]),
      preconditionHandlers: new Map([['scatter.brushRegion', () => true]]),
      describeExecutor() {
        return {
          counts: {
            descriptorCount: 1,
          },
        }
      },
      describeContext() {
        return {}
      },
    },
    perceptionQueryRegistry: {
      handlerEntries: new Map(),
      describeRegistry() {
        return {
          counts: {
            descriptorCount: 2,
          },
          capabilities: {
            returnsValidation: true,
          },
        }
      },
      describeContext() {
        return {}
      },
    },
    dataQueryExecutor: {
      describeExecutor() {
        return {
          counts: {
            supportedQueryKindCount: 1,
            supportedQueryDescriptorCount: 1,
          },
          capabilities: {
            returnsValidation: true,
          },
        }
      },
      describeContext() {
        return {}
      },
      dataQueryEngine: {
        listSupportedQueryKinds() {
          return ['summary']
        },
      },
    },
    linkEngine: {
      primitiveHandlers: new Map(),
      evaluatePropagation() {
        return {}
      },
    },
    traceRecorder: {
      recordAction() {},
    },
    responseRecorder: {
      responseHistory: [{ responseId: 'r1' }, { responseId: 'r2' }],
      recordResponse() {},
      readLatestResponse() {
        return null
      },
      listResponses() {
        return []
      },
    },
    agentLoopRuntime: {
      describeStepContext() {
        return {}
      },
      executeVerifiedAction() {
        return {}
      },
    },
  })

  assert.equal(summary.components.workspacePlanner, true)
  assert.equal(summary.components.agentLoopRuntime, true)
  assert.equal(summary.components.responseRecorder, true)
  assert.equal(summary.components.dataQueryEngine, true)
  assert.equal(summary.registries.actionDescriptorCount, 1)
  assert.equal(summary.registries.actionPreconditionCount, 1)
  assert.equal(summary.registries.perceptionDescriptorCount, 2)
  assert.equal(summary.registries.dataQueryDescriptorCount, 1)
  assert.equal(summary.registries.widgetCount, 3)
  assert.equal(summary.registries.dataHandleCount, 2)
  assert.equal(summary.registries.linkCount, 1)
  assert.equal(summary.registries.adapterCount, 1)
  assert.equal(summary.registries.snapshotCount, 3)
  assert.equal(summary.registries.branchCount, 1)
  assert.equal(summary.registries.traceRecordCount, 2)
  assert.equal(summary.registries.responseCount, 2)
  assert.equal(summary.capabilities.perceptionReturnsValidation, true)
  assert.equal(summary.capabilities.dataQueryReturnsValidation, true)
  assert.equal(summary.capabilities.primitiveTraceRead, false)
  assert.equal(summary.capabilities.affectedRefsTraceRead, false)
  assert.equal(summary.capabilities.actionCallTraceRead, false)
  assert.equal(summary.capabilities.stateDeltaTraceRead, false)
  assert.equal(summary.capabilities.verifyQueryResultsRead, false)
  assert.equal(summary.capabilities.branchReplayEventsRead, false)
  assert.equal(summary.capabilities.actionRun, true)
  assert.equal(summary.capabilities.perceptionQueryRun, true)
  assert.equal(summary.capabilities.dataQueryRun, true)
  assert.equal(summary.capabilities.workspacePlanning, true)
  assert.equal(summary.capabilities.verifiedActionRun, true)
  assert.equal(summary.capabilities.agentLoopContextRead, true)
  assert.equal(summary.capabilities.workspaceDescriptionRead, true)
  assert.equal(summary.capabilities.runtimeStoreRead, false)
  assert.equal(summary.capabilities.widgetRegistryRead, true)
  assert.equal(summary.capabilities.widgetAdapterListRead, true)
  assert.equal(summary.capabilities.viewRead, true)
  assert.equal(summary.capabilities.snapshotRead, true)
  assert.equal(summary.capabilities.stateHistoryRead, true)
  assert.equal(summary.capabilities.branchListRead, true)
  assert.equal(summary.capabilities.interactionTraceRead, true)
  assert.equal(summary.capabilities.traceGraphRead, true)
  assert.equal(summary.capabilities.stateJump, true)
  assert.equal(summary.capabilities.branchCreate, true)
  assert.equal(summary.capabilities.finalWorkspaceSnapshotRead, false)
  assert.equal(summary.capabilities.linkPropagationEvaluation, true)
  assert.equal(summary.capabilities.answerRecording, true)
  assert.equal(summary.capabilities.latestResponseRead, true)
  assert.equal(summary.capabilities.responseHistoryRead, true)
})

test('describeRuntimeCore treats listStateSnapshots as state-history read support', () => {
  const summary = describeRuntimeCore({
    store: {
      readState() {
        return {}
      },
      listStateSnapshots() {
        return []
      },
    },
  })

  assert.equal(summary.capabilities.stateHistoryRead, true)
})

test('describeRuntimeCore treats plain snapshot, branch, and trace facades as readable runtime history surfaces', () => {
  const summary = describeRuntimeCore({
    store: {
      stateSnapshots: [
        { stateId: 'main:s1' },
        { stateId: 'main:s2' },
      ],
      branchRegistry: {
        main: {
          branchId: 'main',
          label: 'Main',
        },
      },
      interactionTrace: [
        { stateId: 'main:s1', actor: 'agent' },
      ],
      widgetAdapters: {},
      descriptions: {},
      widgets: {},
      appId: 'demo',
      workspaceId: 'main',
    },
  })

  assert.equal(summary.registries.snapshotCount, 2)
  assert.equal(summary.registries.branchCount, 1)
  assert.equal(summary.registries.traceRecordCount, 1)
  assert.equal(summary.components.stateManager, true)
  assert.equal(summary.capabilities.statePatching, true)
  assert.equal(summary.capabilities.stateDelta, true)
  assert.equal(summary.capabilities.widgetAdapterListRead, true)
  assert.equal(summary.capabilities.workspaceDescriptionRead, true)
  assert.equal(summary.capabilities.viewRead, true)
  assert.equal(summary.capabilities.snapshotRead, true)
  assert.equal(summary.capabilities.stateHistoryRead, true)
  assert.equal(summary.capabilities.branchListRead, true)
  assert.equal(summary.capabilities.interactionTraceRead, true)
  assert.equal(summary.capabilities.traceGraphRead, true)
})

test('describeRuntimeCore treats store response readers as response-read support even without ResponseRecorder wrapper methods', () => {
  const summary = describeRuntimeCore({
    store: {
      readState() {
        return {}
      },
      readLatestResponse() {
        return null
      },
      listResponses() {
        return []
      },
    },
    responseRecorder: {},
  })

  assert.equal(summary.capabilities.latestResponseRead, true)
  assert.equal(summary.capabilities.responseHistoryRead, true)
})

test('describeRuntimeCore treats plain responseHistory facades as response-read support', () => {
  const summary = describeRuntimeCore({
    store: {
      responseHistory: [
        { responseId: 'response_1', workspaceId: 'workspace_b' },
      ],
    },
  })

  assert.equal(summary.registries.responseCount, 1)
  assert.equal(summary.capabilities.latestResponseRead, true)
  assert.equal(summary.capabilities.responseHistoryRead, true)
})
