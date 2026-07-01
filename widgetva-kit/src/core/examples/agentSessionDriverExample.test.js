import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVAAgentSessionDriver } from './agentSessionDriverExample.js'

function makePort() {
  return {
    async describeWorkspace() {
      return {
        workspaceId: 'main',
        widgets: [
          {
            ref: 'wl://widgetva-app/workspace/main/widget/scatter',
            widgetId: 'scatter_1',
            kind: 'scatter',
            title: 'Cars',
          },
        ],
      }
    },
    async describeAgentLoop() {
      return {
        workspace: {
          workspaceId: 'main',
          widgets: [
            {
              ref: 'wl://widgetva-app/workspace/main/widget/scatter',
              widgetId: 'scatter_1',
              kind: 'scatter',
              title: 'Cars',
            },
          ],
        },
        agentLoop: {
          queryScopePolicy: 'widget_required',
        },
      }
    },
    async listAvailableActions() {
      return [
        {
          targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
          name: 'scatter.zoomDomain',
        },
      ]
    },
    async listAvailablePerceptions() {
      return [
        {
          targetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
          name: 'perception.computeCorrelation',
        },
      ]
    },
    async readObservation() {
      return {
        state: {
          stateId: 'main:s1',
        },
        coordination: {
          focusedWidgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
        },
        sharedAnalyticalState: {
          focusedWidgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
          filters: {},
          viewport: null,
          focus: null,
          comparisonTargets: [],
          annotations: [],
        },
      }
    },
    async queryPerception(call) {
      return {
        ok: true,
        queryName: call.name,
        result: {
          correlation: -0.78,
          xField: call.params?.xField,
          yField: call.params?.yField,
          sampleSize: 392,
        },
      }
    },
  }
}

test('createWidgetVAAgentSessionDriver exposes stable runTurn and runSession helpers over a page port', async () => {
  const port = makePort()
  const completeChat = async () => ({
    content: JSON.stringify({
      rationale: 'Read the correlation directly.',
      operation: {
        kind: 'perception',
        name: 'perception.computeCorrelation',
        queryScope: {
          widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
        },
        params: {
          xField: 'Horsepower',
          yField: 'Miles_per_Gallon',
        },
      },
      assistantMessage: 'I will compute the correlation first.',
    }),
  })

  const driver = createWidgetVAAgentSessionDriver({
    port,
    completeChat,
  })

  const turn = await driver.runTurn({
    objective: '分析这个散点图',
  })
  const session = await driver.runSession({
    objective: '分析这个散点图',
    maxTurns: 2,
  })

  assert.equal(typeof driver.runTurn, 'function')
  assert.equal(typeof driver.runSession, 'function')
  assert.equal(turn.act.kind, 'perception')
  assert.equal(turn.act.name, 'perception.computeCorrelation')
  assert.equal(session.stopReason, 'answered')
  assert.equal(session.turns[0].act.name, 'perception.computeCorrelation')
})

test('createWidgetVAAgentSessionDriver enforces the minimal page-port and chat requirements', async () => {
  assert.throws(
    () => createWidgetVAAgentSessionDriver({
      port: null,
      completeChat: async () => ({ content: '{}' }),
    }),
    /requires a page port object/i,
  )

  assert.throws(
    () => createWidgetVAAgentSessionDriver({
      port: {
        async describeWorkspace() {
          return {}
        },
      },
      completeChat: async () => ({ content: '{}' }),
    }),
    /must expose describeAgentLoop/i,
  )

  assert.throws(
    () => createWidgetVAAgentSessionDriver({
      port: makePort(),
      completeChat: null,
    }),
    /requires a completeChat/i,
  )
})
