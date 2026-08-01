import test from 'node:test'
import assert from 'node:assert/strict'

import {
  runAgentLoop,
  runAgentSession,
  runAgentTurn,
} from './runAgentLoop.js'

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
            recognizedKinds: ['scatter'],
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
    async readObservation(options = {}) {
      observedCalls.push(['readObservation'])
      return {
        query: options?.query || null,
        state: {
          stateId: 'main:s1',
          widgets: [
            {
              ref: 'wl://widgetva-app/workspace/main/widget/scatter',
              kind: 'scatter',
              recognizedKinds: ['scatter'],
              focused: true,
            },
          ],
          sharedAnalyticalState: {
            filters: {},
            viewport: null,
            focus: {
              selectionSummary: 'Current scatter selection',
              highlightedWidgetRefs: [],
            },
            activeContextKinds: ['selection', 'view', 'structure'],
            comparisonTargets: [],
            structure: {
              linkCount: 0,
            },
            sharedView: {
              activeWidgetRefs: ['wl://widgetva-app/workspace/main/widget/scatter'],
            },
            transformation: {
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
          },
        },
        view: {
          snapshot: {
            ref: 'widgetva-view:main:s1',
            mimeType: 'application/widgetva-view+json',
          },
          image: null,
          summary: null,
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
          updatedRefs: [call.target?.widgetRef || null].filter(Boolean),
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

test('runAgentLoop executes an explicit observe-plan-act-verify-reason loop through verified actions', async () => {
  const { port, observedCalls } = createObservedPort()

  const result = await runAgentLoop(port, {
    objective: 'Brush the dense middle cluster.',
    planningRequest: {
      task: {
        taskFamily: 'correlation',
        coordinationScope: 'single_widget',
      },
    },
    async planner({ observe, knowledge, workspacePlan }) {
      assert.equal(observe.query, 'Brush the dense middle cluster.')
      assert.equal('workspace' in observe, false)
      assert.equal('actions' in observe, false)
      assert.equal('perceptionQueries' in observe, false)
      assert.equal(knowledge?.widgetFamilies?.[0]?.kind, 'scatter')
      assert.equal(knowledge?.widgetFamilies?.[0]?.actions?.some((descriptor) => descriptor?.name === 'scatter.brushRegion'), true)
      assert.equal(Array.isArray(knowledge?.agentGuidance?.analysisToActionByFamily?.scatter?.analysisToAction), true)
      assert.equal(workspacePlan?.planningMode, 'topology_driven')
      return {
        assistantMessage: 'Brush the middle cluster in the scatterplot.',
        rationale: 'The middle density band reveals the local trend clearly.',
        operation: {
          kind: 'action',
          name: 'scatter.brushRegion',
          target: {
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

  assert.equal(result.observe.query, 'Brush the dense middle cluster.')
  assert.equal('workspace' in result.observe, false)
  assert.equal('knowledgeCatalogs' in result.observe, false)
  assert.equal('actions' in result.observe, false)
  assert.equal('perceptionQueries' in result.observe, false)
  assert.equal(result.plan.workspacePlan?.planningMode, 'topology_driven')
  assert.equal(result.plan.operation?.name, 'scatter.brushRegion')
  assert.deepEqual(result.plan.operation?.target, {
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
  })
  const executeCall = observedCalls.find((entry) => entry[0] === 'executeVerifiedAction')?.[1]
  assert.deepEqual(executeCall?.target, {
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
  })
  assert.equal(executeCall?.queryScope?.widgetRef, undefined)
  assert.equal(result.result.actionResult?.ok, true)
  assert.equal(result.verification?.ok, true)
  assert.equal(result.reason?.success, true)
  assert.equal(result.reason?.verificationPassed, true)
  assert.deepEqual(observedCalls.map(([name]) => name), [
    'readObservation',
    'planWorkspace',
    'executeVerifiedAction',
    'readLatestCoordinationResult',
  ])
})

test('runAgentLoop uses readObservation as the only agent observation entrypoint', async () => {
  const { port, observedCalls } = createObservedPort({
    async readAgentObservation() {
      observedCalls.push(['readAgentObservation'])
      return {
        query: 'legacy entrypoint should not be used',
        state: { widgets: [] },
        view: null,
      }
    },
  })

  await runAgentLoop(port, {
    objective: 'Inspect the current chart.',
    operation: {
      kind: 'perception',
      name: 'perception.inspectViewConfig',
      params: {},
    },
  })

  assert.equal(observedCalls.some(([name]) => name === 'readObservation'), true)
  assert.equal(observedCalls.some(([name]) => name === 'readAgentObservation'), false)
})

test('runAgentTurn maps the target loop into the formal compact turn contract', async () => {
  const { port } = createObservedPort()

  const result = await runAgentTurn(port, {
    objective: 'Focus the scatterplot on the local cluster.',
    planner: async () => ({
      assistantMessage: 'I will brush the local cluster.',
      rationale: 'A brush is the most direct next step.',
      operation: {
        kind: 'action',
        name: 'scatter.brushRegion',
        target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
        params: {
          xField: 'Horsepower',
          yField: 'Miles_per_Gallon',
          xRange: [80, 140],
          yRange: [18, 30],
        },
      },
    }),
  })

  assert.deepEqual(Object.keys(result), ['index', 'observe', 'plan', 'act', 'verify', 'reason'])
  assert.equal(result.index, 0)
  assert.deepEqual(Object.getOwnPropertyNames(result.observe), [
    'query',
    'state',
    'view',
  ])
  assert.equal(result.observe.query, 'Focus the scatterplot on the local cluster.')
  assert.equal(result.observe.view.snapshot?.ref, 'widgetva-view:main:s1')
  assert.equal(result.observe.view.snapshot?.mimeType, 'application/widgetva-view+json')
  assert.deepEqual(result.observe.state.widgets, [
    {
      ref: 'wl://widgetva-app/workspace/main/widget/scatter',
      kind: 'scatter',
      recognizedKinds: ['scatter'],
      focused: true,
    },
  ])
  assert.equal('widgetRef' in result.observe.state.sharedAnalyticalState.focus, false)
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

test('runAgentSession carries session knowledge forward and continues after a successful action turn', async () => {
  const { port } = createObservedPort()

  const result = await runAgentSession(port, {
    objective: 'Focus the scatterplot on the local cluster.',
    maxTurns: 3,
    planner: async ({ history }) => {
      const priorTurns = history?.turns || []
      if (priorTurns.length === 0) {
        return {
          assistantMessage: 'I will brush the local cluster.',
          rationale: 'A brush is the most direct next step.',
          operation: {
            kind: 'action',
            name: 'scatter.brushRegion',
            target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
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
          target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
          params: {
            xField: 'Horsepower',
            yField: 'Miles_per_Gallon',
          },
        },
      }
    },
    reasoner: async ({ result }) => {
      if (result?.queryName === 'perception.computeCorrelation') {
        return {
          answer: result?.summary || 'Correlation computed.',
          completion: {
            status: 'answered',
          },
        }
      }
      return {
        answer: 'Focused the region and need one more read step.',
      }
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.stopReason, 'answered')
  assert.equal(result.knowledge.widgetFamilies[0].kind, 'scatter')
  assert.equal(result.knowledge.widgetFamilies[0].actions.some((descriptor) => descriptor?.name === 'scatter.brushRegion'), true)
  assert.equal(Array.isArray(result.knowledge.agentGuidance.analysisToActionByFamily.scatter.analysisToAction), true)
  assert.equal(result.knowledge.widgetFamilies[0].perceptions.some((descriptor) => descriptor?.name === 'perception.inspectViewConfig'), true)
  assert.deepEqual(result.knowledge.agentGuidance.relations, {})
  assert.equal(result.knowledge.agentGuidance.workflows.some((workflow) => workflow.name === 'linked_time_window_distribution'), true)
  assert.deepEqual(Object.keys(result.knowledge), ['widgetFamilies', 'agentGuidance'])
  assert.equal(Array.isArray(result.turns), true)
  assert.equal(result.turns.length, 2)
  assert.deepEqual(Object.keys(result.turns[0]), ['index', 'observe', 'plan', 'act', 'verify', 'reason'])
  assert.equal(result.turns[0].index, 0)
  assert.equal(result.turns[1].index, 1)
  assert.equal(result.turns[0].act.kind, 'action')
  assert.equal(result.turns[1].act.kind, 'perception')
  assert.equal(result.history.turns.length, 2)
  assert.deepEqual(result.history.turns[0].operation, {
    kind: 'action',
    name: 'scatter.brushRegion',
    target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
    paramsSummary: 'xField=Horsepower; yField=Miles_per_Gallon; xRange=[80, 140]; yRange=[18, 30]',
  })
  assert.equal(result.history.turns[0].status.outcome, 'verified')
  assert.equal(result.history.turns[1].operation.name, 'perception.computeCorrelation')
  assert.equal(result.history.turns[1].status.resultSummary, 'Perception perception.computeCorrelation completed.')
  assert.equal(typeof result.answer, 'string')
})

test('runAgentSession carries bounded perception evidence into canonical history', async () => {
  const { port } = createObservedPort({
    async queryPerception(call) {
      return {
        ok: true,
        queryName: call.name,
        summary: '2 grouped summaries over 2 rows',
        result: {
          rowCount: 2,
          groups: [
            { dimension: 'feature_a', mean: 12.1 },
            { dimension: 'feature_b', mean: 8.4 },
          ],
        },
      }
    },
  })

  const result = await runAgentSession(port, {
    objective: 'Summarize the visible features.',
    maxTurns: 1,
    planner: async () => ({
      assistantMessage: 'I will summarize the visible features.',
      rationale: 'The grouped result provides the requested evidence.',
      operation: {
        kind: 'perception',
        name: 'perception.summarizeVisible',
        target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
        params: { groupBy: ['dimension'], metrics: ['mean'] },
      },
    }),
    reasoner: async () => ({
      answer: 'The visible feature means are 12.1 and 8.4.',
      completion: { status: 'answered' },
    }),
  })

  assert.deepEqual(result.history.turns[0].status.evidence.records, [
    { dimension: 'feature_a', mean: 12.1 },
    { dimension: 'feature_b', mean: 8.4 },
  ])
})

test('runAgentSession exposes selected workflow progress to the planner', async () => {
  const { port } = createObservedPort()
  const contexts = []
  const result = await runAgentSession(port, {
    objective: 'Complete the selected workflow.',
    maxTurns: 2,
    plannerContext: {
      workflow: {
        id: 'WF-TEST',
        steps: [
          { stepId: 'WF-TEST:step_1', operation: 'scatter.brushRegion', purpose: 'Create a subset.' },
          { stepId: 'WF-TEST:step_2', operation: 'scatter.brushRegion', purpose: 'Refine the subset.' },
        ],
      },
    },
    planner: async ({ history, plannerContext }) => {
      contexts.push(plannerContext)
      const operation = history?.turns?.length === 0
        ? { name: 'scatter.brushRegion', params: { xRange: [80, 140], yRange: [18, 30] } }
        : { name: 'scatter.brushRegion', params: { xRange: [90, 130], yRange: [20, 28] } }
      return {
        assistantMessage: 'Continue the selected workflow.',
        rationale: 'Follow the next workflow step.',
        operation: {
          kind: 'action',
          target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
          ...operation,
        },
      }
    },
    reasoner: async ({ history }) => ({
      answer: 'Continue.',
      completion: history?.turns?.length > 0 ? { status: 'answered' } : { status: 'continue' },
    }),
  })

  assert.equal(result.turns.length, 2)
  assert.deepEqual(contexts[1].workflowProgress.completedStepIds, ['WF-TEST:step_1'])
  assert.equal(contexts[1].workflowProgress.nextStepId, 'WF-TEST:step_2')
})

test('runAgentSession can synthesize a final answer from the compact multi-turn history', async () => {
  const { port } = createObservedPort()

  const result = await runAgentSession(port, {
    objective: 'Compare the selected scatter subset after one action and one read.',
    maxTurns: 2,
    planner: async ({ history }) => {
      const priorTurns = history?.turns || []
      if (priorTurns.length === 0) {
        return {
          assistantMessage: 'I will brush the local region first.',
          rationale: 'A focus step prepares the subset for analysis.',
          operation: {
            kind: 'action',
            name: 'scatter.brushRegion',
            target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
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
        assistantMessage: 'I will compute the correlation inside the focus.',
        rationale: 'The focused subset can now be read.',
        operation: {
          kind: 'perception',
          name: 'perception.computeCorrelation',
          target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
          params: {
            xField: 'Horsepower',
            yField: 'Miles_per_Gallon',
          },
        },
      }
    },
    reasoner: async ({ result: stepResult }) => ({
      answer: stepResult?.summary || 'Progress recorded.',
      completion: stepResult?.queryName === 'perception.computeCorrelation'
        ? { status: 'answered' }
        : { status: 'continue' },
    }),
    finalSynthesizer: async ({ objective, history, turns, stopReason }) => {
      assert.equal(objective, 'Compare the selected scatter subset after one action and one read.')
      assert.equal(stopReason, 'answered')
      assert.equal(turns.length, 2)
      assert.equal(history.turns[0].operation.name, 'scatter.brushRegion')
      assert.equal(history.turns[1].operation.name, 'perception.computeCorrelation')
      return {
        answer: 'Final synthesized answer from brush and correlation turns.',
      }
    },
  })

  assert.equal(result.stopReason, 'answered')
  assert.equal(result.finalAnswer, 'Final synthesized answer from brush and correlation turns.')
  assert.equal(result.answer, 'Final synthesized answer from brush and correlation turns.')
})

test('runAgentSession emits compact turn progress after each appended turn', async () => {
  const { port } = createObservedPort()
  const progressEvents = []

  const result = await runAgentSession(port, {
    objective: 'Focus and then inspect the scatterplot.',
    maxTurns: 2,
    planner: async ({ history }) => {
      const priorTurns = history?.turns || []
      if (priorTurns.length === 0) {
        return {
          assistantMessage: 'I will brush the local region first.',
          rationale: 'The brush prepares a focused subset.',
          operation: {
            kind: 'action',
            name: 'scatter.brushRegion',
            target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
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
        assistantMessage: 'I will compute correlation in the brushed subset.',
        rationale: 'The second turn reads the focused subset.',
        operation: {
          kind: 'perception',
          name: 'perception.computeCorrelation',
          target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
          params: {
            xField: 'Horsepower',
            yField: 'Miles_per_Gallon',
          },
        },
      }
    },
    reasoner: async ({ result: stepResult }) => ({
      answer: stepResult?.summary || 'Progress recorded.',
      completion: stepResult?.queryName === 'perception.computeCorrelation'
        ? { status: 'answered' }
        : { status: 'continue' },
    }),
    onTurn: async (progress) => {
      progressEvents.push(progress)
    },
  })

  assert.equal(result.turns.length, 2)
  assert.equal(progressEvents.length, 2)
  assert.equal(progressEvents[0].index, 0)
  assert.equal(progressEvents[0].turn.index, 0)
  assert.equal(progressEvents[0].turn.act.name, 'scatter.brushRegion')
  assert.equal(progressEvents[0].history.turns.length, 1)
  assert.equal(progressEvents[1].index, 1)
  assert.equal(progressEvents[1].turn.act.name, 'perception.computeCorrelation')
  assert.equal(progressEvents[1].history.turns.length, 2)
})

test('runAgentTurn keeps bulky observation internals out of the session turn contract', async () => {
  const { port } = createObservedPort({
    async readObservation(options = {}) {
      return {
        query: options?.query || null,
        state: {
          stateId: 'matrix:s1',
          widgets: [{
            ref: 'cell-body-mass-flipper',
            kind: 'scatter',
            focused: true,
            data: {
              currentDataRef: 'data-visible',
              rowCount: 344,
              rows: [{ sentinel: 'TURN_ROWS_SENTINEL' }],
              fields: [
                { name: 'flipper_length_mm', type: 'quantitative' },
                { name: 'body_mass_g', type: 'quantitative' },
              ],
            },
          }],
          sharedAnalyticalState: {},
        },
        view: {
          snapshot: {
            ref: 'widgetva-view:matrix:s1',
            payload: 'TURN_SNAPSHOT_SENTINEL',
          },
          summary: 'Matrix view.',
        },
      }
    },
  })

  const result = await runAgentTurn(port, {
    objective: 'Inspect the matrix.',
    planner: async () => ({
      assistantMessage: 'I will inspect the visible rows.',
      rationale: 'Start with a bounded perception.',
      operation: {
        kind: 'perception',
        name: 'perception.inspectVisibleRows',
        target: { widgetRef: 'cell-body-mass-flipper' },
        params: { limit: 10 },
      },
    }),
  })

  const serializedTurn = JSON.stringify(result)
  assert.equal(result.observe.state.widgets[0].data.rowCount, undefined)
  assert.equal(result.observe.state.widgets[0].data.rows, undefined)
  assert.equal(result.observe.view.snapshot.ref, 'widgetva-view:matrix:s1')
  assert.equal(result.observe.view.snapshot.payload, undefined)
  assert.equal(serializedTurn.includes('TURN_ROWS_SENTINEL'), false)
  assert.equal(serializedTurn.includes('TURN_SNAPSHOT_SENTINEL'), false)
})

test('runAgentSession does not stop merely because distinct perception turns verified successfully', async () => {
  const { port } = createObservedPort()

  const result = await runAgentSession(port, {
    objective: 'Inspect the scatterplot in multiple read steps before answering.',
    maxTurns: 3,
    planner: async ({ history }) => {
      const priorTurns = history?.turns || []
      if (priorTurns.length === 0) {
        return {
          assistantMessage: 'I will compute the correlation first.',
          rationale: 'This gathers the first evidence point.',
          operation: {
            kind: 'perception',
            name: 'perception.computeCorrelation',
            target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
            params: {
              xField: 'Horsepower',
              yField: 'Miles_per_Gallon',
            },
          },
        }
      }

      return {
        assistantMessage: `I still need one more step after turn ${priorTurns.length}.`,
        rationale: 'A successful perception should not end the session by itself.',
        operation: {
          kind: 'perception',
          name: 'perception.computeCorrelation',
          target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
          params: {
            xField: `Horsepower_${priorTurns.length}`,
            yField: 'Miles_per_Gallon',
          },
        },
      }
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.stopReason, 'turn_budget_reached')
  assert.equal(result.status, 'stopped')
  assert.equal(result.turns.length, 3)
  assert.equal(result.turns.every((turn) => turn?.act?.kind === 'perception'), true)
})

test('runAgentSession stops when the reason stage explicitly marks the objective as answered', async () => {
  const { port } = createObservedPort()

  const result = await runAgentSession(port, {
    objective: 'Answer after collecting one evidence step.',
    maxTurns: 3,
    planner: async ({ history }) => {
      const priorTurns = history?.turns || []
      if (priorTurns.length === 0) {
        return {
          assistantMessage: 'I will brush the local region first.',
          rationale: 'Start with a state-changing focus step.',
          operation: {
            kind: 'action',
            name: 'scatter.brushRegion',
            target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
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
        assistantMessage: 'I will compute the correlation and answer.',
        rationale: 'The focused region is ready for a final read step.',
        operation: {
          kind: 'perception',
          name: 'perception.computeCorrelation',
          target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
          params: {
            xField: 'Horsepower',
            yField: 'Miles_per_Gallon',
          },
        },
      }
    },
    reasoner: async ({ result }) => ({
      answer: result?.summary || 'Finished.',
      ...(result?.queryName === 'perception.computeCorrelation'
        ? {
          completion: {
            status: 'answered',
          },
        }
        : {}),
    }),
  })

  assert.equal(result.ok, true)
  assert.equal(result.stopReason, 'answered')
  assert.equal(result.status, 'completed')
  assert.equal(result.turns.length, 2)
  assert.equal(result.turns[1]?.reason?.completion?.status, 'answered')
})

test('runAgentTurn prefers returned perception evidence in reason.answer', async () => {
  const { port } = createObservedPort({
    async queryPerception(call) {
      return {
        ok: true,
        summary: 'Correlation between Horsepower and Miles_per_Gallon is -0.78.',
        queryName: call.name,
      }
    },
  })

  const result = await runAgentTurn(port, {
    objective: 'Compute the correlation in the scatterplot.',
    planner: async () => ({
      assistantMessage: 'I will compute the correlation.',
      rationale: 'The query asks for a quantitative relationship.',
      operation: {
        kind: 'perception',
        name: 'perception.computeCorrelation',
        target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
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

test('runAgentLoop falls back to executeAction and explicit verification when verified-action execution is unavailable', async () => {
  const { port, observedCalls } = createObservedPort({
    executeVerifiedAction: undefined,
    async executeAction(call) {
      observedCalls.push(['executeAction', call])
      return {
        ok: true,
        callId: call.callId,
        actionName: call.name,
        stateId: 'main:s2',
        updatedRefs: [call.target?.widgetRef || null].filter(Boolean),
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

  const result = await runAgentLoop(port, {
    operation: {
      kind: 'action',
      name: 'scatter.brushRegion',
      target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
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
    'readObservation',
    'executeAction',
    'queryPerception',
    'readLatestCoordinationResult',
  ])
})

test('runAgentLoop accepts transport-client method aliases such as runVerifiedAction', async () => {
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
          updatedRefs: [call.target?.widgetRef || null].filter(Boolean),
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

  const result = await runAgentLoop(port, {
    operation: {
      kind: 'action',
      name: 'scatter.brushRegion',
      target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
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
    'readObservation',
    'runVerifiedAction',
    'readLatestCoordinationResult',
  ])
})

test('runAgentLoop preserves queryScope when executing data queries selected by the planner', async () => {
  const { port, observedCalls } = createObservedPort({
    async runDataQuery(call) {
      observedCalls.push(['runDataQuery', call])
      return {
        ok: true,
        dataRef: 'wl://widgetva-app/workspace/main/data/scatter_visible',
        result: {
          fields: [
            { name: 'Horsepower', type: 'number' },
            { name: 'Miles_per_Gallon', type: 'number' },
          ],
        },
      }
    },
  })

  const result = await runAgentLoop(port, {
    objective: 'Inspect the scatter schema.',
    async planner() {
      return {
        assistantMessage: 'I will inspect the current scatter data schema first.',
        rationale: 'The schema is a safe first step before choosing a visual action.',
        operation: {
          kind: 'data_query',
          target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter' },
          query: {
            kind: 'schema',
            spec: {},
          },
        },
      }
    },
  })

  assert.equal(result.result?.ok, true)
  const runDataQueryCall = observedCalls.find(([name]) => name === 'runDataQuery')?.[1] || null
  assert.deepEqual(runDataQueryCall?.target, {
    widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter',
  })
  assert.equal(runDataQueryCall?.queryScope?.widgetRef, undefined)
  assert.equal(runDataQueryCall?.query?.spec?.queryScope?.widgetRef, undefined)
  assert.equal(result.reason?.answer?.includes?.('Horsepower'), true)
})
