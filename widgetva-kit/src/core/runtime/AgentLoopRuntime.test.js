import test from 'node:test'
import assert from 'node:assert/strict'

import { AgentLoopRuntime } from './AgentLoopRuntime.js'

test('AgentLoopRuntime.describeStepContext exposes data-query guidance and shared data-view hints', async () => {
  const runtime = new AgentLoopRuntime({
    store: {
      readDescription() {
        return {
          runtimeTopology: {
            topology: 'T3',
            topologyLabel: 'Overview + Detail',
            widgetCount: 2,
            edgeCount: 1,
            linkDensity: 0.5,
            sourceWidgetCount: 1,
            targetWidgetCount: 1,
            maxOutDegree: 1,
            maxInDegree: 1,
            rationale: ['A detail-role widget is present in the current workspace plan.'],
          },
          widgets: [
            {
              ref: 'wl://widgetva-app/workspace/main/widget/scatter_a',
              widgetId: 'scatter_a',
              humanInteraction: {
                mode: 'brush2d',
                actionName: 'scatter.brushRegion',
                supportsDirectManipulation: true,
              },
            },
            { ref: 'wl://widgetva-app/workspace/main/widget/table_a', widgetId: 'table_a', role: 'detail' },
          ],
          links: [
            {
              ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_table',
              kind: 'filter',
              from: 'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush',
              to: 'wl://widgetva-app/workspace/main/widget/table_a',
              sourceWidgetId: 'scatter_a',
              targetWidgetId: 'table_a',
            },
          ],
          dataHandles: [
            {
              ref: 'wl://widgetva-app/workspace/main/data/current_view',
              title: 'Current View Data',
              scope: 'workspaceCurrentView',
            },
            {
              ref: 'wl://widgetva-app/workspace/main/data/current_selection',
              title: 'Current Selection Data',
              scope: 'workspaceCurrent',
            },
            {
              ref: 'wl://widgetva-app/workspace/main/data/scatter_a_visible',
              title: 'Scatter A Visible Data',
              scope: 'visible',
              widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
            },
          ],
        }
      },
      readState() {
        return {
          widgets: {
            'wl://widgetva-app/workspace/main/widget/scatter_a': {
              ref: 'wl://widgetva-app/workspace/main/widget/scatter_a',
              data: {
                currentDataRef: 'wl://widgetva-app/workspace/main/data/scatter_a_visible',
                sourceDataRef: 'wl://widgetva-app/workspace/main/data/scatter_a_visible',
              },
            },
            'wl://widgetva-app/workspace/main/widget/table_a': {
              ref: 'wl://widgetva-app/workspace/main/widget/table_a',
              data: {},
            },
          },
          shared: {
            focusedWidget: 'wl://widgetva-app/workspace/main/widget/scatter_a',
            selections: {
              registry: {
                'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush': {
                  kind: 'point',
                },
              },
              views: {
                primary: null,
                byWidget: {},
              },
            },
          },
        }
      },
      readTraceWindow() {
        return []
      },
      buildTraceGraph() {
        return {}
      },
      readSnapshotEntry() {
        return null
      },
      listStateSnapshots() {
        return []
      },
      listBranches() {
        return []
      },
      readLatestResponse() {
        return null
      },
      listResponses() {
        return []
      },
    },
    planWorkspace: async () => ({}),
    executeAction: async () => null,
    queryPerception: async () => null,
    queryData: async () => null,
    readLatestCoordinationResult: async () => ({
      changed: true,
      verification: {
        status: 'verified',
        summary: 'Verified 1/1 target checks.',
      },
    }),
    responseRecorder: {
      describeRecorder() {
        return {}
      },
      recordResponse() {
        return {}
      },
      readLatestResponse() {
        return null
      },
      listResponses() {
        return []
      },
    },
    actionExecutor: {
      has(name) {
        return name === 'workspace.jumpToState' || name === 'workspace.branchFromState'
      },
    },
    linkEngine: {
      evaluatePropagation() {
        return { ok: true }
      },
    },
  })

  const context = await runtime.describeStepContext()

  assert.ok(context.loopHints.recommendedOrder.includes('runDataQuery(optional)'))
  assert.ok(context.loopHints.recommendedOrder.includes('planWorkspace(optional)'))
  assert.equal(context.loopHints.workspaceDescribeName, 'describeWorkspace')
  assert.equal(context.loopHints.workspacePlanName, 'planWorkspace')
  assert.equal(context.loopHints.stateReadName, 'readState')
  assert.equal(context.loopHints.viewReadName, 'readView')
  assert.equal(context.loopHints.actionRunName, 'executeAction')
  assert.equal(context.loopHints.perceptionQueryName, 'queryPerception')
  assert.ok(context.loopHints.verificationSurfaces.includes('runDataQuery'))
  assert.equal(context.loopHints.dataQueryRunName, 'runDataQuery')
  assert.equal(context.loopHints.dataQueryName, 'queryData')
  assert.equal(context.loopHints.traceReadName, 'readTrace')
  assert.equal(context.loopHints.interactionTraceName, 'getInteractionTrace')
  assert.equal(context.loopHints.traceGraphName, 'getTraceGraph')
  assert.equal(context.loopHints.snapshotName, 'readSnapshot')
  assert.equal(context.loopHints.stateHistoryName, 'listStateHistory')
  assert.equal(context.loopHints.branchListName, 'listBranches')
  assert.equal(context.loopHints.finalSnapshotName, null)
  assert.equal(context.loopHints.verifiedActionName, 'executeVerifiedAction')
  assert.equal(context.loopHints.replayName, 'replay')
  assert.equal(context.loopHints.jumpToStateName, 'jumpToState')
  assert.equal(context.loopHints.branchFromStateName, 'branchFromState')
  assert.equal(context.loopHints.responseRecorderName, 'describeResponseRecorder')
  assert.equal(context.loopHints.responseReadName, 'getLatestAgentResponse')
  assert.equal(context.loopHints.responseListName, 'listAgentResponses')
  assert.equal(context.loopHints.responseRecordName, 'recordAgentResponse')
  assert.equal(context.loopHints.latestCoordinationResultReadName, 'readLatestCoordinationResult')
  assert.ok(context.loopHints.recommendedOrder.includes('produceAnswerOrContinue'))
  assert.ok(context.loopHints.recommendedOrder.includes('recordAgentResponse(optional)'))
  assert.deepEqual(
    context.loopHints.historySurfaces,
    ['readTrace', 'getInteractionTrace', 'getTraceGraph', 'readSnapshot', 'listStateHistory', 'listBranches', 'getLatestAgentResponse', 'listAgentResponses'],
  )
  assert.deepEqual(
    context.loopHints.replaySurfaces,
    ['executeVerifiedAction', 'replay', 'jumpToState', 'branchFromState'],
  )
  assert.deepEqual(
    context.loopHints.answerSurfaces,
    ['describeResponseRecorder', 'getLatestAgentResponse', 'listAgentResponses', 'recordAgentResponse'],
  )
  assert.deepEqual(
    context.loopHints.planningSurfaces,
    ['planWorkspace', 'workspace.runtimeTopology', 'workspace.planning'],
  )
  assert.deepEqual(
    context.loopHints.humanInteractionHints,
    [
      {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
        mode: 'brush2d',
        actionName: 'scatter.brushRegion',
        supportsDirectManipulation: true,
        focused: true,
      },
    ],
  )
  assert.deepEqual(
    context.loopHints.sharedDataViews.map((entry) => entry.ref),
    [
      'wl://widgetva-app/workspace/main/data/current_view',
      'wl://widgetva-app/workspace/main/data/current_selection',
    ],
  )
  assert.deepEqual(
    context.loopHints.focusedDataViews.map((entry) => entry.ref),
    ['wl://widgetva-app/workspace/main/data/scatter_a_visible'],
  )
  assert.equal(
    context.loopHints.preferredEvidenceRefs.currentViewRef,
    'wl://widgetva-app/workspace/main/data/current_view',
  )
  assert.equal(
    context.loopHints.preferredEvidenceRefs.currentSelectionRef,
    'wl://widgetva-app/workspace/main/data/current_selection',
  )
  assert.equal(context.workspace.runtimeTopology?.topology, 'T3')
  assert.equal(context.loopHints.workspaceTopology?.topology, 'T3')
  assert.equal(context.latestCoordinationResult?.verification?.status, 'verified')
  assert.ok(context.loopHints.verificationSurfaces.includes('readLatestCoordinationResult'))
})

test('AgentLoopRuntime.describeStepContext omits unavailable planning, history, branch, and response surfaces from loop hints', async () => {
  const runtime = new AgentLoopRuntime({
    store: {
      readDescription() {
        return {
          widgets: [],
          links: [],
          dataHandles: [],
        }
      },
      readState() {
        return {
          widgets: {},
          shared: {},
        }
      },
    },
    executeAction: async () => null,
    queryPerception: async () => null,
    runtimeEvaluation: null,
    linkEngine: null,
  })

  const context = await runtime.describeStepContext()

  assert.equal(context.loopHints.workspacePlanName, null)
  assert.equal(context.loopHints.dataQueryRunName, null)
  assert.equal(context.loopHints.dataQueryName, null)
  assert.equal(context.loopHints.traceReadName, null)
  assert.equal(context.loopHints.interactionTraceName, null)
  assert.equal(context.loopHints.traceGraphName, null)
  assert.equal(context.loopHints.snapshotName, null)
  assert.equal(context.loopHints.stateHistoryName, null)
  assert.equal(context.loopHints.branchListName, null)
  assert.equal(context.loopHints.finalSnapshotName, null)
  assert.equal(context.loopHints.replayName, null)
  assert.equal(context.loopHints.jumpToStateName, null)
  assert.equal(context.loopHints.branchFromStateName, null)
  assert.equal(context.loopHints.responseRecorderName, null)
  assert.equal(context.loopHints.responseReadName, null)
  assert.equal(context.loopHints.responseListName, null)
  assert.equal(context.loopHints.responseRecordName, null)
  assert.equal(context.loopHints.latestCoordinationResultReadName, null)
  assert.equal(context.loopHints.recommendedOrder.includes('planWorkspace(optional)'), false)
  assert.equal(context.loopHints.recommendedOrder.includes('runDataQuery(optional)'), false)
  assert.equal(context.loopHints.recommendedOrder.includes('recordAgentResponse(optional)'), false)
  assert.deepEqual(context.loopHints.historySurfaces, [])
  assert.deepEqual(context.loopHints.replaySurfaces, ['executeVerifiedAction'])
  assert.deepEqual(context.loopHints.answerSurfaces, [])
  assert.deepEqual(context.loopHints.verificationSurfaces, ['perception.verifyActionEffect'])
  assert.equal(context.latestCoordinationResult, null)
})

test('AgentLoopRuntime.describeStepContext does not expose linkPropagation verification without a link engine', async () => {
  const runtime = new AgentLoopRuntime({
    store: {
      readDescription() {
        return {
          widgets: [],
          links: [],
          dataHandles: [],
        }
      },
      readState() {
        return {
          widgets: {},
          shared: {},
        }
      },
    },
    executeAction: async () => null,
    queryPerception: async () => null,
    linkEngine: null,
  })

  const context = await runtime.describeStepContext()

  assert.equal(context.loopHints.verificationSurfaces.includes('linkPropagation'), false)
})

test('AgentLoopRuntime.describeStepContext derives history and answer surfaces from plain manual-assembly facades', async () => {
  const runtime = new AgentLoopRuntime({
    store: {
      appId: 'demo',
      workspaceId: 'workspace_b',
      descriptions: {
        'wl://demo/workspace/workspace_b/widget/scatter_a': {
          ref: 'wl://demo/workspace/workspace_b/widget/scatter_a',
          widgetId: 'scatter_a',
          kind: 'scatter',
        },
      },
      widgets: {
        'wl://demo/workspace/workspace_b/widget/scatter_a': {
          ref: 'wl://demo/workspace/workspace_b/widget/scatter_a',
          widgetId: 'scatter_a',
          kind: 'scatter',
          data: {},
        },
      },
      shared: {
        focusedWidget: 'wl://demo/workspace/workspace_b/widget/scatter_a',
      },
      stateSnapshots: [
        {
          stateId: 'main:s1',
          state: {
            stateId: 'main:s1',
            widgets: {},
            shared: {},
          },
        },
      ],
      branchRegistry: {
        main: {
          branchId: 'main',
          label: 'Main',
          originStateId: 'main:s0',
        },
      },
      interactionTrace: [
        {
          stateId: 'main:s1',
          actor: 'agent',
          eventKind: 'action',
          eventFamily: 'action',
        },
      ],
      responseHistory: [
        {
          responseId: 'response_1',
          workspaceId: 'workspace_b',
          actor: 'agent',
          content: 'Scoped answer',
        },
      ],
    },
    executeAction: async () => null,
    queryPerception: async () => null,
    linkEngine: null,
  })

  const context = await runtime.describeStepContext()

  assert.equal(context.loopHints.interactionTraceName, 'getInteractionTrace')
  assert.equal(context.loopHints.traceGraphName, 'getTraceGraph')
  assert.equal(context.loopHints.snapshotName, 'readSnapshot')
  assert.equal(context.loopHints.stateHistoryName, 'listStateHistory')
  assert.equal(context.loopHints.branchListName, 'listBranches')
  assert.equal(context.loopHints.responseReadName, 'getLatestAgentResponse')
  assert.equal(context.loopHints.responseListName, 'listAgentResponses')
  assert.deepEqual(
    context.loopHints.historySurfaces,
    ['readTrace', 'getInteractionTrace', 'getTraceGraph', 'readSnapshot', 'listStateHistory', 'listBranches', 'getLatestAgentResponse', 'listAgentResponses'],
  )
})

test('AgentLoopRuntime.executeVerifiedAction reads plain manual-assembly state facades', async () => {
  const widgetRef = 'wl://demo/workspace/workspace_b/widget/scatter_a'
  let readCount = 0
  const runtime = new AgentLoopRuntime({
    store: {
      stateId: 'main:s2',
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          kind: 'scatter',
          selections: {},
        },
      },
      shared: {
        selections: {
          registry: {
            [`${widgetRef}/selection/brush`]: {
              kind: 'interval',
            },
          },
          views: {
            primary: null,
            byWidget: {},
          },
        },
      },
      interactionTrace: [
        {
          stateId: 'main:s2',
          actor: 'agent',
          eventKind: 'action',
          eventFamily: 'action',
          action: {
            name: 'scatter.brushRegion',
          },
        },
      ],
      readState(options = {}) {
        readCount += 1
        return {
          stateId: readCount === 1 ? 'main:s1' : 'main:s2',
          widgets: {
            [widgetRef]: {
              ref: widgetRef,
              kind: 'scatter',
              selections: {},
            },
          },
          shared: {
            selections: {
              registry: {
                [`${widgetRef}/selection/brush`]: {
                  kind: 'interval',
                },
              },
              views: {
                primary: null,
                byWidget: {},
              },
            },
          },
          ...(options?.deltaSince
            ? {
                delta: {
                  baseStateId: options.deltaSince,
                  changedRefs: [widgetRef],
                  removedRefs: [],
                },
              }
            : {}),
        }
      },
    },
    executeAction: async () => ({
      ok: true,
      callId: 'call_plain',
      actionName: 'scatter.brushRegion',
      updatedRefs: [widgetRef],
      stateId: 'main:s2',
      verificationHints: [],
    }),
    queryPerception: async () => ({
      ok: true,
      result: {
        verified: true,
      },
    }),
    readLatestCoordinationResult: async () => ({
      verification: {
        status: 'verified',
        summary: 'Verified 1/1 target checks.',
      },
    }),
    linkEngine: null,
  })

  const result = await runtime.executeVerifiedAction({
    callId: 'call_plain',
    name: 'scatter.brushRegion',
    actor: 'agent',
  }, {
    includeDeltaSince: true,
  })

  assert.equal(result.ok, true)
  assert.equal(result.beforeStateId, 'main:s1')
  assert.equal(result.afterView?.delta?.baseStateId, 'main:s1')
  assert.equal(result.traceEvidence?.stateId, 'main:s2')
})

test('AgentLoopRuntime.executeVerifiedAction degrades cleanly when linkEngine is unavailable', async () => {
  const runtime = new AgentLoopRuntime({
    store: {
      readState(options = {}) {
        const baseState = {
          stateId: 'main:s2',
          widgets: {
            'wl://widgetva-app/workspace/main/widget/scatter_a': {
              ref: 'wl://widgetva-app/workspace/main/widget/scatter_a',
              selections: {},
            },
          },
          shared: {
            selections: {
              registry: {
                'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush': {
                  kind: 'interval',
                },
              },
              views: {
                primary: null,
                byWidget: {},
              },
            },
          },
        }
        if (options?.refs) {
          return {
            ...baseState,
            widgets: {
              'wl://widgetva-app/workspace/main/widget/scatter_a': baseState.widgets['wl://widgetva-app/workspace/main/widget/scatter_a'],
            },
          }
        }
        return baseState
      },
      readTrace() {
        return [
          {
            stateId: 'main:s2',
            action: {
              name: 'scatter.brushRegion',
            },
          },
        ]
      },
      stateSnapshots: [
        {
          stateId: 'main:s2',
          state: {
            stateId: 'main:s2',
            widgets: {
              'wl://widgetva-app/workspace/main/widget/scatter_a': {
                ref: 'wl://widgetva-app/workspace/main/widget/scatter_a',
                selections: {},
              },
            },
            shared: {
              selections: {
                registry: {
                  'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush': {
                    kind: 'interval',
                  },
                },
                views: {
                  primary: null,
                  byWidget: {},
                },
              },
            },
          },
        },
      ],
    },
    executeAction: async () => ({
      ok: true,
      callId: 'call_1',
      actionName: 'scatter.brushRegion',
      updatedRefs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
      stateId: 'main:s2',
      verificationHints: ['Check the selection state.'],
    }),
    queryPerception: async () => ({
      ok: true,
      result: {
        verified: true,
      },
    }),
    readLatestCoordinationResult: async () => ({
      verification: {
        status: 'verified',
        summary: 'Verified 1/1 target checks.',
      },
    }),
    linkEngine: null,
  })

  const result = await runtime.executeVerifiedAction({
    callId: 'call_1',
    name: 'scatter.brushRegion',
    actor: 'agent',
  })

  assert.equal(result.ok, true)
  assert.equal(result.actionResult?.ok, true)
  assert.deepEqual(result.linkPropagation, [])
  assert.equal(result.traceEvidence?.stateId, 'main:s2')
  assert.equal(result.latestCoordinationResult?.verification?.status, 'verified')
})

test('AgentLoopRuntime.executeVerifiedAction falls back to readTraceWindow when readTrace is unavailable', async () => {
  const runtime = new AgentLoopRuntime({
    store: {
      readState() {
        return {
          stateId: 'main:s2',
          widgets: {},
          shared: {},
        }
      },
      readTraceWindow() {
        return [
          {
            stateId: 'main:s2',
            eventKind: 'action',
            action: {
              name: 'scatter.brushRegion',
            },
          },
        ]
      },
    },
    executeAction: async () => ({
      ok: true,
      callId: 'call_2',
      actionName: 'scatter.brushRegion',
      updatedRefs: [],
      stateId: 'main:s2',
      verificationHints: [],
    }),
    queryPerception: async () => ({
      ok: true,
      result: {
        verified: true,
      },
    }),
    linkEngine: null,
  })

  const result = await runtime.executeVerifiedAction({
    callId: 'call_2',
    name: 'scatter.brushRegion',
    actor: 'agent',
  })

  assert.equal(result.ok, true)
  assert.equal(result.traceEvidence?.stateId, 'main:s2')
  assert.equal(result.traceEvidence?.action?.name, 'scatter.brushRegion')
})

test('AgentLoopRuntime.executeVerifiedAction follows the documented act-read-verify loop with deltaSince and verification evidence', async () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_a'
  const beforeStateId = 'main:s1'
  const afterStateId = 'main:s2'
  const observedReadViewOptions = []
  const observedVerifyCalls = []
  const observedPropagationCalls = []

  const runtime = new AgentLoopRuntime({
    store: {
      readState(options = {}) {
        observedReadViewOptions.push(options)
        if (!options || Object.keys(options).length === 0) {
          return {
            stateId: beforeStateId,
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                kind: 'scatter',
              },
            },
            shared: {
              selections: {
                registry: {},
                views: {
                  primary: null,
                  byWidget: {},
                },
              },
            },
          }
        }
        return {
          stateId: afterStateId,
          widgets: {
            [widgetRef]: {
              ref: widgetRef,
              kind: 'scatter',
              selections: {
                [`${widgetRef}/selection/brush`]: {
                  kind: 'interval',
                  value: {
                    Horsepower: [60, 120],
                    MPG: [20, 40],
                  },
                },
              },
            },
          },
          shared: {
            selections: {
              registry: {
                [`${widgetRef}/selection/brush`]: {
                  kind: 'interval',
                  value: {
                    Horsepower: [60, 120],
                    MPG: [20, 40],
                  },
                },
              },
              views: {
                primary: null,
                byWidget: {},
              },
            },
          },
          delta: {
            baseStateId: beforeStateId,
            changedRefs: [widgetRef],
            removedRefs: [],
          },
        }
      },
      readTraceWindow() {
        return [
          {
            stateId: afterStateId,
            actor: 'agent',
            eventKind: 'action',
            action: {
              name: 'scatter.brushRegion',
            },
          },
        ]
      },
      stateSnapshots: [
        {
          stateId: afterStateId,
          state: {
            stateId: afterStateId,
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                kind: 'scatter',
                selections: {
                  [`${widgetRef}/selection/brush`]: {
                    kind: 'interval',
                    value: {
                      Horsepower: [60, 120],
                      MPG: [20, 40],
                    },
                  },
                },
              },
            },
            shared: {
              selections: {
                registry: {
                  [`${widgetRef}/selection/brush`]: {
                    kind: 'interval',
                    value: {
                      Horsepower: [60, 120],
                      MPG: [20, 40],
                    },
                  },
                },
                views: {
                  primary: null,
                  byWidget: {},
                },
              },
            },
          },
        },
      ],
    },
    executeAction: async () => ({
      ok: true,
      callId: 'call_3',
      actionName: 'scatter.brushRegion',
      updatedRefs: [widgetRef, `${widgetRef}/selection/brush`],
      stateId: afterStateId,
      verificationHints: [
        'Read the updated scatter selection state.',
        'Query the current_selection query to confirm selectedCount.',
      ],
    }),
    queryPerception: async (call) => {
      observedVerifyCalls.push(call)
      return {
        ok: true,
        callId: call.callId,
        queryName: call.name,
        result: {
          verified: true,
        },
      }
    },
    readLatestCoordinationResult: async () => ({
      changed: true,
      verification: {
        status: 'verified',
        summary: 'Verified 1/1 target checks.',
      },
    }),
    linkEngine: {
      evaluatePropagation(options = {}) {
        observedPropagationCalls.push(options)
        return {
          ok: true,
          sourceRef: options.sourceRef,
          linkCount: 1,
          results: [],
        }
      },
    },
  })

  const result = await runtime.executeVerifiedAction(
    {
      callId: 'call_3',
      name: 'scatter.brushRegion',
      actor: 'agent',
      targetRef: widgetRef,
    },
    {
      includeDeltaSince: true,
      verify: true,
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.beforeStateId, beforeStateId)
  assert.equal(result.actionResult?.stateId, afterStateId)
  assert.equal(result.afterView?.delta?.baseStateId, beforeStateId)
  assert.deepEqual(observedReadViewOptions[1], {
    refs: [widgetRef, `${widgetRef}/selection/brush`],
    deltaSince: beforeStateId,
  })
  assert.equal(observedVerifyCalls[0]?.name, 'perception.verifyActionEffect')
  assert.deepEqual(observedVerifyCalls[0]?.params, {
    actionName: 'scatter.brushRegion',
    stateId: afterStateId,
    refs: [widgetRef, `${widgetRef}/selection/brush`],
  })
  assert.equal(result.verification?.result?.verified, true)
  assert.equal(result.traceEvidence?.stateId, afterStateId)
  assert.equal(result.finalSnapshot?.stateId, afterStateId)
  assert.equal(observedPropagationCalls[0]?.sourceRef, `${widgetRef}/selection/brush`)
  assert.equal(result.linkPropagation[0]?.ok, true)
  assert.equal(result.latestCoordinationResult?.verification?.status, 'verified')
  assert.deepEqual(result.verificationHints, [
    'Read the updated scatter selection state.',
    'Query the current_selection query to confirm selectedCount.',
  ])
})

test('AgentLoopRuntime.executeVerifiedAction skips link propagation evidence when linkEngine is unavailable', async () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_a'
  const selectionRef = `${widgetRef}/selection/brush`
  const observedPropagationCalls = []

  const runtime = new AgentLoopRuntime({
    store: {
      readState() {
        return {
          stateId: 'main:s1',
          widgets: {
            [widgetRef]: {
              ref: widgetRef,
              kind: 'scatter',
            },
          },
          shared: {
            selections: {
              registry: {},
              views: {
                primary: null,
                byWidget: {},
              },
            },
          },
        }
      },
      readTraceWindow() {
        return [
          {
            stateId: 'main:s2',
            actor: 'agent',
            eventKind: 'action',
            action: {
              name: 'scatter.brushRegion',
            },
          },
        ]
      },
      stateSnapshots: [
        {
          stateId: 'main:s2',
          state: {
            stateId: 'main:s2',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                selections: {
                  [selectionRef]: {
                    kind: 'interval',
                  },
                },
              },
            },
            shared: {
              selections: {
                registry: {
                  [selectionRef]: {
                    kind: 'interval',
                  },
                },
                views: {
                  primary: null,
                  byWidget: {},
                },
              },
            },
          },
        },
      ],
    },
    executeAction: async () => ({
      ok: true,
      callId: 'call_4',
      actionName: 'scatter.brushRegion',
      updatedRefs: [widgetRef, selectionRef],
      stateId: 'main:s2',
      verificationHints: [],
    }),
    queryPerception: async () => ({
      ok: true,
      result: {
        verified: true,
      },
    }),
    linkEngine: null,
  })

  const result = await runtime.executeVerifiedAction({
    callId: 'call_4',
    name: 'scatter.brushRegion',
    actor: 'agent',
  })

  assert.equal(result.ok, true)
  assert.deepEqual(observedPropagationCalls, [])
  assert.deepEqual(result.linkPropagation, [])
})
