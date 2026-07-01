import test from 'node:test'
import assert from 'node:assert/strict'

import { runPagePortAgentLoop, runPagePortAgentSession, runPagePortAgentTurn } from './pagePortAgentLoop.js'

function createObservedPort(overrides = {}) {
  const observedCalls = []
  const port = {
    async describeWorkspace() {
      observedCalls.push(['describeWorkspace'])
      return {
        workspaceId: 'workspace_main',
        widgets: [
          {
            ref: 'wl://widgetva-app/workspace/main/widget/scatter',
            widgetId: 'scatter',
            kind: 'scatter',
            title: 'Cars Scatterplot',
          },
        ],
        actions: [
          {
            name: 'scatter.brushRegion',
            title: 'Brush region',
          },
        ],
      }
    },
    async describeAgentLoop() {
      observedCalls.push(['describeAgentLoop'])
      return {
        loopHints: {
          verifiedActionName: 'executeVerifiedAction',
        },
        view: {
          stateId: 'main:s1',
        },
      }
    },
    async readObservation() {
      observedCalls.push(['readObservation'])
      return {
        state: {
          stateId: 'main:s1',
        },
        sharedAnalyticalState: {
          focusedWidgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
          filters: {},
          viewport: null,
          selections: {
            primary: {
              summary: 'Current scatter selection',
            },
          },
          highlight: {
            activeWidgetRefs: [],
          },
          sharedViewContext: {
            activeWidgetRefs: ['wl://widgetva-app/workspace/main/widget/scatter'],
          },
          sharedTransformationContext: {
            activeWidgetRefs: ['wl://widgetva-app/workspace/main/widget/scatter'],
            widgets: {
              'wl://widgetva-app/workspace/main/widget/scatter': {
                widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
                widgetId: 'scatter',
                activeKinds: ['reencode'],
                operationModesByKind: {
                  reencode: 'stackMode',
                },
                reencode: {
                  xField: 'Horsepower',
                  yField: 'Miles_per_Gallon',
                },
              },
            },
          },
          activeAnalyticalContext: {
            activeContextKinds: ['selection', 'view', 'structure'],
          },
          comparisonTargets: [],
          annotations: [],
          links: {
            definitions: [],
          },
        },
      }
    },
    async listAvailableActions() {
      observedCalls.push(['listAvailableActions'])
      return [
        {
          name: 'scatter.brushRegion',
          targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
        },
      ]
    },
    async listAvailablePerceptions() {
      observedCalls.push(['listAvailablePerceptions'])
      return [
        {
          name: 'perception.computeCorrelation',
          targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
        },
      ]
    },
    async planWorkspace(options = {}) {
      observedCalls.push(['planWorkspace', options])
      return {
        title: 'Scatter detail plan',
        planningMode: 'topology_driven',
        widgets: [
          {
            widgetId: 'scatter',
            role: 'detail',
          },
        ],
        links: [],
        rationale: ['Use the scatterplot as the primary evidence view.'],
      }
    },
    async describeActionUsage(options = {}) {
      observedCalls.push(['describeActionUsage', options])
      return {
        targetRef: options.targetRef,
        actions: [
          {
            name: 'scatter.brushRegion',
            requiredParams: ['xField', 'yField', 'xRange', 'yRange'],
          },
        ],
      }
    },
    async executeVerifiedAction(call, options = {}) {
      observedCalls.push(['executeVerifiedAction', call, options])
      return {
        ok: true,
        callId: call.callId,
        actionName: call.name,
        stateId: 'main:s2',
        actionResult: {
          ok: true,
          stateId: 'main:s2',
          updatedRefs: [call.queryScope?.widgetRef || null].filter(Boolean),
        },
        verification: {
          ok: true,
          result: {
            passed: true,
          },
        },
      }
    },
    async queryPerception(call) {
      observedCalls.push(['queryPerception', call])
      return {
        ok: true,
        queryName: call.name,
        summary: `Perception ${call.name} completed.`,
        result: {
          passed: true,
        },
      }
    },
    async readLatestCoordinationResult() {
      observedCalls.push(['readLatestCoordinationResult'])
      return {
        verification: {
          status: 'verified',
        },
      }
    },
    ...overrides,
  }

  return {
    port,
    observedCalls,
  }
}

test('runPagePortAgentLoop executes an explicit observe-plan-act-verify-reason loop through verified actions', async () => {
  const { port, observedCalls } = createObservedPort()

  const result = await runPagePortAgentLoop(port, {
    objective: 'Brush the dense middle cluster.',
    planningRequest: {
      task: {
        taskFamily: 'correlation',
        coordinationScope: 'single_widget',
      },
    },
    async planner({ observe, knowledge, workspacePlan }) {
      assert.equal(observe.workspace.workspaceId, 'workspace_main')
      assert.equal(knowledge?.workspace?.workspaceId, 'workspace_main')
      assert.equal(knowledge?.widgets?.[0]?.widgetId, 'scatter')
      assert.deepEqual(knowledge?.catalogs?.actionsByWidgetRef?.['wl://widgetva-app/workspace/main/widget/scatter'], ['scatter.brushRegion'])
      assert.equal(workspacePlan?.planningMode, 'topology_driven')
      return {
        assistantMessage: 'Brush the middle cluster in the scatterplot.',
        rationale: 'The middle density band reveals the local trend clearly.',
        operation: {
          kind: 'action',
          name: 'scatter.brushRegion',
          queryScope: {
            widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
          },
          params: {
            xField: 'Horsepower',
            yField: 'Miles_per_Gallon',
            xRange: [80, 160],
            yRange: [18, 32],
          },
        },
      }
    },
  })

  assert.equal(result.observe.workspace.workspaceId, 'workspace_main')
  assert.equal('knowledgeCatalogs' in result.observe, false)
  assert.equal(result.plan.workspacePlan?.planningMode, 'topology_driven')
  assert.equal(result.plan.operation?.name, 'scatter.brushRegion')
  assert.deepEqual(result.plan.actionUsage?.actions?.[0]?.requiredParams, ['xField', 'yField', 'xRange', 'yRange'])
  assert.equal(result.result.actionResult?.ok, true)
  assert.equal(result.verification?.ok, true)
  assert.equal(result.reason?.success, true)
  assert.equal(result.reason?.verificationPassed, true)
  assert.deepEqual(observedCalls.map(([name]) => name), [
    'describeWorkspace',
    'describeAgentLoop',
    'readObservation',
    'listAvailableActions',
    'listAvailablePerceptions',
    'planWorkspace',
    'describeActionUsage',
    'executeVerifiedAction',
    'readLatestCoordinationResult',
  ])
})

test('runPagePortAgentTurn maps the page-port loop into the formal compact turn contract', async () => {
  const { port } = createObservedPort()

  const result = await runPagePortAgentTurn(port, {
    objective: 'Focus the scatterplot on the local cluster.',
    planner: async () => ({
      assistantMessage: 'I will brush the local cluster.',
      rationale: 'A brush is the most direct next step.',
      operation: {
        kind: 'action',
        name: 'scatter.brushRegion',
        queryScope: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
        params: {
          xField: 'Horsepower',
          yField: 'Miles_per_Gallon',
          xRange: [80, 140],
          yRange: [18, 30],
        },
      },
    }),
  })

  assert.deepEqual(Object.keys(result), ['observe', 'plan', 'act', 'verify', 'reason'])
  assert.deepEqual(Object.getOwnPropertyNames(result.observe), [
    'query',
    'previousTurnSummary',
    'state',
    'view',
    'perception',
  ])
  assert.equal(result.observe.query, 'Focus the scatterplot on the local cluster.')
  assert.equal(result.observe.view.snapshot?.ref, 'widgetva-view:main:s1')
  assert.equal(result.observe.view.snapshot?.mimeType, 'application/widgetva-view+json')
  assert.equal(result.observe.state.sharedAnalyticalState.focus.widgetRef, 'wl://widgetva-app/workspace/main/widget/scatter')
  assert.deepEqual(result.observe.state.sharedAnalyticalState.activeContextKinds, ['selection', 'view', 'structure'])
  assert.deepEqual(
    result.observe.state.sharedAnalyticalState.sharedView.activeWidgetRefs,
    ['wl://widgetva-app/workspace/main/widget/scatter'],
  )
  assert.deepEqual(
    result.observe.state.sharedAnalyticalState.transformation.activeWidgetRefs,
    ['wl://widgetva-app/workspace/main/widget/scatter'],
  )
  assert.deepEqual(
    result.observe.state.sharedAnalyticalState.transformation.widgets['wl://widgetva-app/workspace/main/widget/scatter']?.activeKinds,
    ['reencode'],
  )
  assert.deepEqual(
    result.observe.state.sharedAnalyticalState.transformation.widgets['wl://widgetva-app/workspace/main/widget/scatter']?.operationModesByKind,
    { reencode: 'stackMode' },
  )
  assert.equal(result.plan.step.name, 'scatter.brushRegion')
  assert.equal(result.act.ok, true)
  assert.equal(result.verify.ok, true)
  assert.equal(typeof result.verify.guidance, 'string')
  assert.equal(typeof result.reason.answer, 'string')
})

test('runPagePortAgentSession carries session knowledge forward and continues after a successful action turn', async () => {
  const { port } = createObservedPort()

  const result = await runPagePortAgentSession(port, {
    objective: 'Focus the scatterplot on the local cluster.',
    maxTurns: 3,
    planner: async ({ knowledge }) => {
      const priorTurns = knowledge?.history?.turns || []
      if (priorTurns.length === 0) {
        return {
          assistantMessage: 'I will brush the local cluster.',
          rationale: 'A brush is the most direct next step.',
          operation: {
            kind: 'action',
            name: 'scatter.brushRegion',
            queryScope: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
            params: {
              xField: 'Horsepower',
              yField: 'Miles_per_Gallon',
              xRange: [80, 140],
              yRange: [18, 30],
            },
          },
        }
      }

      return {
        assistantMessage: 'I will compute the correlation inside the current focus.',
        rationale: 'After focusing the region, a perception step can answer the query.',
        operation: {
          kind: 'perception',
          name: 'perception.computeCorrelation',
          queryScope: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
          params: {
            xField: 'Horsepower',
            yField: 'Miles_per_Gallon',
          },
        },
      }
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.stopReason, 'answered')
  assert.equal(result.knowledge.workspace.workspaceId, 'workspace_main')
  assert.equal('caseId' in result.knowledge.workspace, false)
  assert.equal(result.knowledge.widgets[0].widgetId, 'scatter')
  assert.equal('provider' in result.knowledge.widgets[0], false)
  assert.equal(result.knowledge.catalogs.actionsByWidgetRef['wl://widgetva-app/workspace/main/widget/scatter'][0], 'scatter.brushRegion')
  assert.equal('dataQueriesByDataRef' in result.knowledge.catalogs, false)
  assert.deepEqual(Object.keys(result.knowledge), ['workspace', 'widgets', 'catalogs', 'history'])
  assert.equal(Array.isArray(result.turns), true)
  assert.equal(result.turns.length, 2)
  assert.deepEqual(Object.keys(result.turns[0]), ['observe', 'plan', 'act', 'verify', 'reason'])
  assert.equal(result.turns[0].act.kind, 'action')
  assert.equal(result.turns[1].act.kind, 'perception')
  assert.equal(result.knowledge.history.turns.length, 2)
  assert.equal(result.knowledge.history.turns[0].summary, 'scatter.brushRegion:verified')
  assert.equal(result.knowledge.history.turns[1].summary, 'Perception perception.computeCorrelation completed.')
  assert.equal(typeof result.answer, 'string')
})

test('runPagePortAgentTurn prefers returned perception evidence in reason.answer', async () => {
  const { port } = createObservedPort({
    async queryPerception(call) {
      return {
        ok: true,
        summary: 'Correlation between Horsepower and Miles_per_Gallon is -0.78.',
        queryName: call.name,
      }
    },
  })

  const result = await runPagePortAgentTurn(port, {
    objective: 'Compute the correlation in the scatterplot.',
    planner: async () => ({
      assistantMessage: 'I will compute the correlation.',
      rationale: 'The query asks for a quantitative relationship.',
      operation: {
        kind: 'perception',
        name: 'perception.computeCorrelation',
        queryScope: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
        params: {
          xField: 'Horsepower',
          yField: 'Miles_per_Gallon',
        },
      },
    }),
  })

  assert.equal(result.act.kind, 'perception')
  assert.equal(result.reason.answer, 'Correlation between Horsepower and Miles_per_Gallon is -0.78.')
})

test('runPagePortAgentTurn surfaces missing required action parameters in verify feedback', async () => {
  const { port } = createObservedPort()

  const result = await runPagePortAgentTurn(port, {
    objective: 'Brush the scatterplot with an incomplete parameter set.',
    planner: async () => ({
      assistantMessage: 'I will try brushing first.',
      rationale: 'This intentionally omits one required parameter to test verification feedback.',
      operation: {
        kind: 'action',
        name: 'scatter.brushRegion',
        queryScope: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
        params: {
          xField: 'Horsepower',
          xRange: [80, 140],
          yRange: [18, 30],
        },
      },
    }),
  })

  assert.equal(result.act.ok, true)
  assert.equal(result.verify.ok, false)
  assert.equal(result.verify.checks.params.ok, false)
  assert.match(result.verify.checks.params.summary, /Missing required parameters: yField\./)
  assert.equal(result.verify.guidance, 'Re-check required parameters before retrying this step.')
})

test('runPagePortAgentTurn surfaces unconfirmed action selection in verify feedback', async () => {
  const { port } = createObservedPort({
    async describeActionUsage() {
      return {
        actions: [],
      }
    },
  })

  const result = await runPagePortAgentTurn(port, {
    objective: 'Try an action that is not confirmed on the widget.',
    planner: async () => ({
      assistantMessage: 'I will try brushing first.',
      rationale: 'This tests step-choice verification.',
      operation: {
        kind: 'action',
        name: 'scatter.brushRegion',
        queryScope: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
        params: {
          xField: 'Horsepower',
          yField: 'Miles_per_Gallon',
          xRange: [80, 140],
          yRange: [18, 30],
        },
      },
    }),
  })

  assert.equal(result.act.ok, true)
  assert.equal(result.verify.ok, false)
  assert.equal(result.verify.checks.stepChoice.ok, false)
  assert.equal(result.verify.checks.stepChoice.summary, 'The requested action is not confirmed on the target widget.')
  assert.equal(result.verify.guidance, 'Re-check whether the target widget actually exposes this step before retrying.')
})

test('runPagePortAgentLoop falls back to executeAction and explicit verification when verified-action execution is unavailable', async () => {
  const { port, observedCalls } = createObservedPort({
    executeVerifiedAction: undefined,
    async executeAction(call) {
      observedCalls.push(['executeAction', call])
      return {
        ok: true,
        callId: call.callId,
        actionName: call.name,
        stateId: 'main:s2',
        updatedRefs: [call.queryScope?.widgetRef || null].filter(Boolean),
      }
    },
    async queryPerception(call) {
      observedCalls.push(['queryPerception', call])
      return {
        ok: true,
        queryName: call.name,
        result: {
          passed: true,
        },
      }
    },
  })

  const result = await runPagePortAgentLoop(port, {
    operation: {
      kind: 'action',
      name: 'scatter.brushRegion',
      queryScope: {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
      },
      params: {
        xField: 'Horsepower',
        yField: 'Miles_per_Gallon',
        xRange: [90, 150],
        yRange: [16, 30],
      },
    },
  })

  assert.equal(result.result.actionName, 'scatter.brushRegion')
  assert.equal(result.verification?.queryName, 'perception.verifyActionEffect')
  assert.equal(result.reason?.verificationPassed, true)
  assert.deepEqual(observedCalls.map(([name]) => name), [
    'describeWorkspace',
    'describeAgentLoop',
    'readObservation',
    'listAvailableActions',
    'listAvailablePerceptions',
    'describeActionUsage',
    'executeAction',
    'queryPerception',
    'readLatestCoordinationResult',
  ])
})

test('runPagePortAgentLoop accepts transport-client method aliases such as runVerifiedAction', async () => {
  const { port, observedCalls } = createObservedPort({
    executeVerifiedAction: undefined,
    async runVerifiedAction(call, options = {}) {
      observedCalls.push(['runVerifiedAction', call, options])
      return {
        ok: true,
        callId: call.callId,
        actionName: call.name,
        stateId: 'main:s2',
        actionResult: {
          ok: true,
          stateId: 'main:s2',
          updatedRefs: [call.queryScope?.widgetRef || null].filter(Boolean),
        },
        verification: {
          ok: true,
          result: {
            passed: true,
          },
        },
      }
    },
  })

  const result = await runPagePortAgentLoop(port, {
    operation: {
      kind: 'action',
      name: 'scatter.brushRegion',
      queryScope: {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
      },
      params: {
        xField: 'Horsepower',
        yField: 'Miles_per_Gallon',
        xRange: [88, 144],
        yRange: [17, 29],
      },
    },
  })

  assert.equal(result.result.actionResult?.ok, true)
  assert.equal(result.verification?.ok, true)
  assert.deepEqual(observedCalls.map(([name]) => name), [
    'describeWorkspace',
    'describeAgentLoop',
    'readObservation',
    'listAvailableActions',
    'listAvailablePerceptions',
    'describeActionUsage',
    'runVerifiedAction',
    'readLatestCoordinationResult',
  ])
})
