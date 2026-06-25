import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createNaturalLanguagePlanner,
  formatAgentPlannerError,
  runNaturalLanguagePagePortAgentLoop,
  runNaturalLanguagePagePortAgentTurn,
} from './naturalLanguagePlanner.js'

function createMockPagePort() {
  const calls = []
  return {
    calls,
    async describeWorkspace() {
      return {
        workspaceId: 'official-vega-lite-point_2d',
        widgets: [{
          ref: 'w://widgetva-app/workspace/official-vega-lite-point_2d/widget/session_official-vega-lite-point_2d',
          widgetId: 'session_official-vega-lite-point_2d',
          kind: 'scatter',
          title: 'session_official-vega-lite-point_2d',
        }],
      }
    },
    async describeAgentLoop() {
      return {
        loopHints: {
          verifiedActionName: 'executeVerifiedAction',
        },
      }
    },
    async readObservation() {
      return {
        focusedWidgetRef: 'w://widgetva-app/workspace/official-vega-lite-point_2d/widget/session_official-vega-lite-point_2d',
      }
    },
    async describeActionUsage({ actionName }) {
      return {
        actions: [{ name: actionName }],
        recommendedCall: { name: actionName },
      }
    },
    async executeVerifiedAction(call) {
      calls.push(call)
      return {
        actionResult: {
          ok: true,
          stateId: 'main:s2',
          updatedRefs: [call.queryScope?.widgetRef || null].filter(Boolean),
        },
        verification: {
          ok: true,
          summary: 'Verified.',
        },
      }
    },
    async readLatestCoordinationResult() {
      return {
        verification: {
          summary: 'Verified.',
        },
      }
    },
  }
}

test('formatAgentPlannerError returns readable strings for common payloads', () => {
  assert.equal(formatAgentPlannerError(new Error('Planner quota exceeded.')), 'Planner quota exceeded.')
  assert.equal(formatAgentPlannerError({ error: 'Provider rejected request.' }), 'Provider rejected request.')
})

test('createNaturalLanguagePlanner produces a valid structured operation from JSON chat output', async () => {
  const planner = createNaturalLanguagePlanner({
    completeChat: async () => ({
      content: JSON.stringify({
        assistantMessage: 'I will zoom into the middle horsepower region.',
        rationale: 'A tighter viewport will support local inspection.',
        operation: {
          kind: 'action',
          name: 'scatter.zoomDomain',
          queryScope: {
            widgetRef: 'scatter-ref',
          },
          params: {
            xDomain: [80, 160],
            yDomain: [18, 32],
          },
        },
      }),
      raw: { ok: true },
    }),
    model: 'test-model',
  })

  const result = await planner({
    objective: 'Focus on the middle horsepower region.',
    observe: {
      workspace: {
        widgets: [{ ref: 'scatter-ref' }],
      },
      observation: {
        focusedWidgetRef: 'scatter-ref',
      },
    },
  })

  assert.equal(result.model, 'test-model')
  assert.equal(result.operation.name, 'scatter.zoomDomain')
  assert.deepEqual(result.operation.queryScope, { widgetRef: 'scatter-ref' })
})

test('createNaturalLanguagePlanner repairs an invalid first response and falls back safely if needed', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      if (requests.length === 1) {
        return {
          content: JSON.stringify({
            assistantMessage: 'Invalid first attempt',
            rationale: 'Missing operation name.',
            operation: {
              kind: 'action',
              params: {},
            },
          }),
        }
      }
      return {
        content: JSON.stringify({
          assistantMessage: 'I will inspect the current view config first.',
          rationale: 'Safe repair response.',
          operation: {
            kind: 'perception',
            name: 'perception.inspectViewConfig',
            queryScope: {
              widgetRef: 'scatter-ref',
            },
            params: {},
          },
        }),
      }
    },
  })

  const result = await planner({
    objective: 'Understand the current chart state.',
    observe: {
      workspace: {
        widgets: [{ ref: 'scatter-ref' }],
      },
      observation: {
        focusedWidgetRef: 'scatter-ref',
      },
    },
  })

  assert.equal(requests.length, 2)
  assert.equal(result.operation.kind, 'perception')
  assert.equal(result.operation.name, 'perception.inspectViewConfig')
})

test('runNaturalLanguagePagePortAgentLoop executes the planner result through the page port', async () => {
  const port = createMockPagePort()
  const result = await runNaturalLanguagePagePortAgentLoop(port, {
    objective: 'Brush the central scatterplot window.',
    model: 'test-model',
    completeChat: async () => ({
      content: JSON.stringify({
        assistantMessage: 'I will brush the central region of the scatterplot.',
        rationale: 'The brush creates a visible local subset for analysis.',
        operation: {
          kind: 'action',
          name: 'scatter.brushRegion',
          queryScope: {
            widgetRef: 'w://widgetva-app/workspace/official-vega-lite-point_2d/widget/session_official-vega-lite-point_2d',
          },
          params: {
            xField: 'Horsepower',
            yField: 'Miles_per_Gallon',
            xRange: [80, 140],
            yRange: [18, 30],
          },
        },
      }),
    }),
  })

  assert.equal(port.calls.length, 1)
  assert.equal(port.calls[0].name, 'scatter.brushRegion')
  assert.equal(result.plan.operation.name, 'scatter.brushRegion')
  assert.equal(result.result.actionResult.ok, true)
  assert.equal(result.verification.ok, true)
})

test('runNaturalLanguagePagePortAgentTurn returns the compact formal turn contract', async () => {
  const port = createMockPagePort()
  const result = await runNaturalLanguagePagePortAgentTurn(port, {
    objective: 'Focus the scatterplot on the relevant local cluster.',
    model: 'test-model',
    completeChat: async () => ({
      raw: { id: 'response_2' },
      content: JSON.stringify({
        assistantMessage: 'I will brush the local cluster on the scatterplot.',
        rationale: 'A local brush is the clearest next interaction for this goal.',
        operation: {
          kind: 'action',
          name: 'scatter.brushRegion',
          queryScope: {
            widgetRef: 'w://widgetva-app/workspace/official-vega-lite-point_2d/widget/session_official-vega-lite-point_2d',
          },
          params: {
            xField: 'Horsepower',
            yField: 'Miles_per_Gallon',
            xRange: [80, 140],
            yRange: [18, 30],
          },
        },
      }),
    }),
  })

  assert.deepEqual(Object.keys(result), ['observe', 'plan', 'act', 'verify', 'reason'])
  assert.equal(result.plan.step.name, 'scatter.brushRegion')
  assert.equal(result.act.ok, true)
  assert.equal(result.verify.ok, true)
})
