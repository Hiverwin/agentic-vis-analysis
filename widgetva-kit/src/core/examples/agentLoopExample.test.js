import test from 'node:test'
import assert from 'node:assert/strict'

import { runWidgetVAAgentLoopExample } from './agentLoopExample.js'

test('runWidgetVAAgentLoopExample consumes the stable describeAgentLoop method when a page port object is provided', async () => {
  const result = await runWidgetVAAgentLoopExample({
    async describeAgentLoop() {
      return {
        workspace: {
          actions: [
            {
              name: 'scatter.brushRegion',
              targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
            },
          ],
        },
      }
    },
  })

  assert.equal(result.suggestedNextStep?.actionName, 'scatter.brushRegion')
  assert.equal(
    result.suggestedNextStep?.targetRef,
    'wl://widgetva-app/workspace/main/widget/scatter',
  )
  assert.equal(result.suggestedNextStep?.verificationQuery, 'perception.verifyActionEffect')
})

test('runWidgetVAAgentLoopExample falls back to the installed page-port alias when no explicit port object is provided', async () => {
  globalThis.window = {
    __widgetVA: {
      async agent_loop_describe() {
        return {
          workspace: {
            actions: [
              {
                name: 'bar.selectCategory',
                targetRef: 'wl://widgetva-app/workspace/main/widget/bar',
              },
            ],
          },
        }
      },
    },
  }

  const result = await runWidgetVAAgentLoopExample()

  assert.equal(result.suggestedNextStep?.actionName, 'bar.selectCategory')
  assert.equal(
    result.suggestedNextStep?.targetRef,
    'wl://widgetva-app/workspace/main/widget/bar',
  )
})

test('runWidgetVAAgentLoopExample follows the documented describe-read-act-read-verify loop when an action call is provided', async () => {
  const observedCalls = []
  const result = await runWidgetVAAgentLoopExample({
    async describeAgentLoop() {
      observedCalls.push(['describeAgentLoop'])
      return {
        workspace: {
          actions: [
            {
              name: 'scatter.brushRegion',
              targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
            },
          ],
        },
        view: {
          stateId: 'main:s1',
          widgets: {},
          shared: {},
        },
      }
    },
    async executeAction(call) {
      observedCalls.push(['executeAction', call])
      return {
        ok: true,
        callId: call.callId,
        actionName: call.name,
        stateId: 'main:s2',
        updatedRefs: ['wl://widgetva-app/workspace/main/widget/scatter'],
      }
    },
    async readView(options = {}) {
      observedCalls.push(['readView', options])
      return {
        stateId: options.deltaSince ? 'main:s2' : 'main:s1',
        widgets: {},
        shared: {},
        delta: options.deltaSince
          ? {
              baseStateId: options.deltaSince,
              changedRefs: ['wl://widgetva-app/workspace/main/widget/scatter'],
              removedRefs: [],
            }
          : undefined,
      }
    },
    async queryPerception(call) {
      observedCalls.push(['queryPerception', call])
      return {
        ok: true,
        queryName: call.name,
        result: {
          verified: true,
        },
      }
    },
  }, {
    actionCall: {
      callId: 'call_1',
      name: 'scatter.brushRegion',
      actor: 'agent',
      targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
      params: {
        xField: 'Horsepower',
        yField: 'Miles_per_Gallon',
        xRange: [80, 160],
        yRange: [18, 32],
      },
    },
  })

  assert.equal(result.beforeView?.stateId, 'main:s1')
  assert.equal(result.actionResult?.stateId, 'main:s2')
  assert.equal(result.afterView?.delta?.baseStateId, 'main:s1')
  assert.equal(result.verification?.queryName, 'perception.verifyActionEffect')
  assert.deepEqual(observedCalls[1], [
    'executeAction',
    {
      callId: 'call_1',
      name: 'scatter.brushRegion',
      actor: 'agent',
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
  ])
  assert.deepEqual(observedCalls[2], [
    'readView',
    {
      deltaSince: 'main:s1',
    },
  ])
  assert.deepEqual(observedCalls[3], [
    'queryPerception',
    {
      callId: 'call_1_verify',
      name: 'perception.verifyActionEffect',
      actor: 'agent',
      queryScope: {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
      },
      params: {
        actionName: 'scatter.brushRegion',
        stateId: 'main:s2',
        refs: ['wl://widgetva-app/workspace/main/widget/scatter'],
      },
    },
  ])
})

test('runWidgetVAAgentLoopExample optionally queries pre-action perception evidence before executing the action', async () => {
  const observedCalls = []
  const result = await runWidgetVAAgentLoopExample({
    async describeAgentLoop() {
      observedCalls.push(['describeAgentLoop'])
      return {
        workspace: {
          actions: [
            {
              name: 'scatter.brushRegion',
              targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
            },
          ],
        },
        view: {
          stateId: 'main:s1',
          widgets: {},
          shared: {},
        },
      }
    },
    async executeAction(call) {
      observedCalls.push(['executeAction', call])
      return {
        ok: true,
        callId: call.callId,
        actionName: call.name,
        stateId: 'main:s2',
        updatedRefs: ['wl://widgetva-app/workspace/main/widget/scatter'],
      }
    },
    async readView(options = {}) {
      observedCalls.push(['readView', options])
      return {
        stateId: options.deltaSince ? 'main:s2' : 'main:s1',
        widgets: {},
        shared: {},
        delta: options.deltaSince
          ? {
              baseStateId: options.deltaSince,
              changedRefs: ['wl://widgetva-app/workspace/main/widget/scatter'],
              removedRefs: [],
            }
          : undefined,
      }
    },
    async queryPerception(call) {
      observedCalls.push(['queryPerception', call])
      return {
        ok: true,
        queryName: call.name,
        result: {
          verified: true,
          observedStateId: call.params?.stateId || null,
        },
      }
    },
  }, {
    actionCall: {
      callId: 'call_2',
      name: 'scatter.brushRegion',
      actor: 'agent',
      targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
      params: {
        xField: 'Horsepower',
        yField: 'Miles_per_Gallon',
        xRange: [80, 160],
        yRange: [18, 32],
      },
    },
    prePerceptionCall: {
      callId: 'call_2_pre',
      name: 'perception.inspectVisibleRows',
      actor: 'agent',
      targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
      params: {
        stateId: 'main:s1',
      },
    },
  })

  assert.equal(result.preActionEvidence?.queryName, 'perception.inspectVisibleRows')
  assert.equal(result.preActionEvidence?.result?.observedStateId, 'main:s1')
  assert.deepEqual(observedCalls.map(([name]) => name), [
    'describeAgentLoop',
    'queryPerception',
    'executeAction',
    'readView',
    'queryPerception',
  ])
  assert.deepEqual(observedCalls[1], [
    'queryPerception',
    {
      callId: 'call_2_pre',
      name: 'perception.inspectVisibleRows',
      actor: 'agent',
      queryScope: {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
      },
      params: {
        stateId: 'main:s1',
      },
    },
  ])
  assert.deepEqual(observedCalls[4], [
    'queryPerception',
    {
      callId: 'call_2_verify',
      name: 'perception.verifyActionEffect',
      actor: 'agent',
      queryScope: {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
      },
      params: {
        actionName: 'scatter.brushRegion',
        stateId: 'main:s2',
        refs: ['wl://widgetva-app/workspace/main/widget/scatter'],
      },
    },
  ])
})

test('runWidgetVAAgentLoopExample optionally records a final response after verification', async () => {
  const observedCalls = []
  const result = await runWidgetVAAgentLoopExample({
    async describeAgentLoop() {
      observedCalls.push(['describeAgentLoop'])
      return {
        workspace: {
          workspaceId: 'workspace_b',
          actions: [
            {
              name: 'scatter.brushRegion',
              targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
            },
          ],
        },
        view: {
          stateId: 'main:s1',
          widgets: {},
          shared: {},
        },
      }
    },
    async executeAction(call) {
      observedCalls.push(['executeAction', call])
      return {
        ok: true,
        callId: call.callId,
        actionName: call.name,
        stateId: 'main:s2',
        updatedRefs: ['wl://widgetva-app/workspace/main/widget/scatter'],
      }
    },
    async readView(options = {}) {
      observedCalls.push(['readView', options])
      return {
        stateId: options.deltaSince ? 'main:s2' : 'main:s1',
        widgets: {},
        shared: {},
        delta: options.deltaSince
          ? {
              baseStateId: options.deltaSince,
              changedRefs: ['wl://widgetva-app/workspace/main/widget/scatter'],
              removedRefs: [],
            }
          : undefined,
      }
    },
    async queryPerception(call) {
      observedCalls.push(['queryPerception', call])
      return {
        ok: true,
        queryName: call.name,
        result: {
          verified: true,
        },
      }
    },
    async readLatestCoordinationResult() {
      observedCalls.push(['readLatestCoordinationResult'])
      return {
        verification: {
          status: 'verified',
          summary: 'Verified 1/1 target checks.',
        },
      }
    },
    async recordAgentResponse(record) {
      observedCalls.push(['recordAgentResponse', record])
      return {
        ...record,
        responseId: record.responseId || 'response_final',
      }
    },
  }, {
    actionCall: {
      callId: 'call_3',
      name: 'scatter.brushRegion',
      actor: 'agent',
      targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
      params: {
        xField: 'Horsepower',
        yField: 'Miles_per_Gallon',
        xRange: [80, 160],
        yRange: [18, 32],
      },
    },
    responseRecord: {
      content: 'The brushed region isolates mid-horsepower cars with better fuel efficiency.',
      mode: 'final',
      query: 'Summarize the brushed cluster.',
    },
  })

  assert.equal(result.recordedResponse?.workspaceId, 'workspace_b')
  assert.equal(result.recordedResponse?.stateId, 'main:s2')
  assert.equal(result.recordedResponse?.actor, 'agent')
  assert.equal(result.latestCoordinationResult?.verification?.status, 'verified')
  assert.deepEqual(observedCalls.map(([name]) => name), [
    'describeAgentLoop',
    'executeAction',
    'readView',
    'queryPerception',
    'readLatestCoordinationResult',
    'recordAgentResponse',
  ])
  assert.deepEqual(observedCalls[5], [
    'recordAgentResponse',
    {
      content: 'The brushed region isolates mid-horsepower cars with better fuel efficiency.',
      mode: 'final',
      query: 'Summarize the brushed cluster.',
      workspaceId: 'workspace_b',
      stateId: 'main:s2',
      actor: 'agent',
      coordinationEvidence: {
        verification: {
          status: 'verified',
          summary: 'Verified 1/1 target checks.',
        },
      },
    },
  ])
})
