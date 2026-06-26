import test from 'node:test'
import assert from 'node:assert/strict'

import { runPagePortAgentLoop } from './pagePortAgentLoop.js'

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
      }
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
    async planner({ observe, workspacePlan }) {
      assert.equal(observe.workspace.workspaceId, 'workspace_main')
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
    'planWorkspace',
    'describeActionUsage',
    'executeVerifiedAction',
    'readLatestCoordinationResult',
  ])
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
    'describeActionUsage',
    'runVerifiedAction',
    'readLatestCoordinationResult',
  ])
})
