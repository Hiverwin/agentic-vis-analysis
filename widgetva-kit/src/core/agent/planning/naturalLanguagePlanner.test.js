import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createNaturalLanguageReasoner,
  createNaturalLanguagePlanner,
  createNaturalLanguageFinalSynthesizer,
  formatAgentPlannerError,
  runNaturalLanguageAgentLoop,
  runNaturalLanguageAgentSession,
  runNaturalLanguageAgentTurn,
} from './naturalLanguagePlanner.js'
import { buildAgentKnowledge } from '../context/index.js'

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
    async readObservation(options = {}) {
      return {
        query: options?.query || null,
        state: {
          stateId: 'main:s1',
          widgets: [
            {
              ref: 'w://widgetva-app/workspace/official-vega-lite-point_2d/widget/session_official-vega-lite-point_2d',
              kind: 'scatter',
              focused: true,
            },
          ],
          sharedAnalyticalState: {
            filters: {},
            viewport: null,
            focus: {
              selectionSummary: null,
              highlightedWidgetRefs: [],
            },
            activeContextKinds: [],
            comparisonTargets: [],
            structure: {
              linkCount: 0,
            },
            sharedView: {
              activeWidgetRefs: [],
            },
            transformation: {
              activeWidgetRefs: [],
              widgets: {},
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
    async executeVerifiedAction(call) {
      calls.push(call)
      return {
        actionResult: {
          ok: true,
          stateId: 'main:s2',
          updatedRefs: [call.target?.widgetRef || null].filter(Boolean),
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
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'I will zoom into the middle horsepower region.',
          rationale: 'A tighter viewport will support local inspection.',
          operation: {
            kind: 'action',
            name: 'scatter.zoomDomain',
            target: {
              widgetRef: 'scatter-ref',
            },
            params: {
              xDomain: [80, 160],
              yDomain: [18, 32],
            },
          },
        }),
        raw: { ok: true },
      }
    },
    model: 'test-model',
  })

  const result = await planner({
    objective: 'Focus on the middle horsepower region.',
    knowledge: {
      widgetFamilies: [
        {
          kind: 'scatter',
          actions: [{ name: 'scatter.zoomDomain' }],
          perceptions: [],
        },
      ],
    },
    observe: {
      query: 'Focus on the middle horsepower region.',
      state: {
        widgets: [{ ref: 'scatter-ref', widgetId: 'scatter_1', kind: 'scatter', focused: true }],
        sharedAnalyticalState: {
          filters: {},
          viewport: null,
          focus: {
            selectionSummary: null,
            highlightedWidgetRefs: [],
          },
          activeContextKinds: [],
          comparisonTargets: [],
          structure: { linkCount: 0 },
          sharedView: { activeWidgetRefs: [] },
          transformation: { activeWidgetRefs: [], widgets: {} },
        },
      },
      view: null,
    },
  })

  assert.equal(result.model, 'test-model')
  assert.equal(result.operation.name, 'scatter.zoomDomain')
  assert.deepEqual(result.operation.target, { widgetRef: 'scatter-ref' })
  assert.deepEqual(requests[0]?.responseFormat, { type: 'json_object' })
  const systemPrompt = requests[0]?.messages?.[0]?.content || ''
  const userPrompt = requests[0]?.messages?.[1]?.content || ''
  assert.match(systemPrompt, /Return exactly one JSON object matching this shape/)
  assert.doesNotMatch(systemPrompt, /data_query/)
  assert.doesNotMatch(userPrompt, /"widgetId"/)
  assert.match(userPrompt, /"knowledge":\{/)
  assert.match(userPrompt, /"requiredResponseShape":\{/)
})

test('direct-tools planner accepts an exposed tool for a target selected from observation', async () => {
  const requests = []
  const responses = [
    {
      assistantMessage: 'I will use an unavailable operation.',
      rationale: 'Incorrect tool choice.',
      operation: {
        kind: 'action',
        name: 'scatter.filterCategorical',
        target: { widgetRef: 'scatter-ref' },
        params: {},
      },
    },
    {
      assistantMessage: 'I will zoom the visible scatterplot.',
      rationale: 'The direct tool is available.',
      operation: {
        kind: 'action',
        name: 'scatter.zoomDomain',
        target: { widgetRef: 'scatter-ref' },
        params: { xDomain: [80, 160], yDomain: [18, 32] },
      },
    },
  ]
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return { content: JSON.stringify(responses.shift()) }
    },
  })

  const result = await planner({
    objective: 'Focus on the central scatterplot region.',
    knowledge: {
      tools: [{
        kind: 'action',
        name: 'scatter.zoomDomain',
        description: 'Zoom the scatterplot to the supplied domains.',
        paramsSchema: { type: 'object', properties: {} },
        target: { widgetRef: 'scatter-ref' },
      }],
    },
    plannerContext: {
      analysisToAction: [{ id: 'should-not-be-visible' }],
      relations: [{ id: 'should-not-be-visible' }],
    },
    observe: {
      state: { widgets: [{ ref: 'scatter-ref', kind: 'scatter', focused: true }] },
      view: null,
    },
  })

  assert.equal(requests.length, 2)
  assert.equal(result.operation.name, 'scatter.zoomDomain')
  assert.deepEqual(result.operation.target, { widgetRef: 'scatter-ref' })
  assert.match(requests[0].messages[0].content, /semantic widget operations/i)
  assert.match(requests[0].messages[0].content, /linked subset, cohort, category, or interval/i)
  const payload = JSON.parse(requests[0].messages[1].content)
  assert.deepEqual(Object.keys(payload.knowledge), ['tools'])
  assert.equal(payload.plannerContext, null)
})

test('planner receives answer requirements derived from check types without expected values', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'I will inspect the chart.',
          rationale: 'The current view is the next source of evidence.',
          operation: {
            kind: 'action',
            name: 'scatter.brushRegion',
            target: { widgetRef: 'scatter-ref' },
            params: {},
          },
        }),
      }
    },
  })

  await planner({
    objective: 'Answer the question.',
    responseRequirements: {
      mode: 'verifiable',
      answerTypes: ['categorical', 'numeric', 'interval', 'boolean'],
    },
    knowledge: { widgetFamilies: [{ kind: 'scatter', actions: [], perceptions: ['perception.summarizeVisible'] }] },
    observe: {
      state: { widgets: [{ ref: 'scatter-ref', kind: 'scatter', focused: true }] },
      view: null,
    },
  })

  const userPrompt = requests[0]?.messages?.[1]?.content || ''
  assert.match(userPrompt, /responseRequirements/)
  assert.match(userPrompt, /categorical/)
  assert.match(userPrompt, /numeric/)
  assert.match(userPrompt, /interval/)
  assert.match(userPrompt, /boolean/)
  assert.doesNotMatch(userPrompt, /expectedValue|"expected"/)
})

test('planner prompt includes canonical agent guidance without provider internals', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'I will select the category.',
          rationale: 'The category action can affect the linked views.',
          operation: {
            kind: 'action',
            name: 'bar.selectCategory',
            target: { widgetRef: 'bar-ref' },
            params: { field: 'category', values: ['A'] },
          },
        }),
      }
    },
    model: 'test-model',
  })

  const knowledge = buildAgentKnowledge({ widgetKinds: ['bar', 'scatter', 'line'] })
  await planner({
    objective: 'Select a category and inspect the linked views.',
    knowledge,
    observe: {
      query: 'Select a category and inspect the linked views.',
      state: {
        widgets: [{ ref: 'bar-ref', kind: 'bar' }, { ref: 'scatter-ref', kind: 'scatter' }, { ref: 'line-ref', kind: 'line' }],
      },
      view: { summary: 'Three linked views.' },
    },
  })

  const payload = JSON.parse(requests[0].messages[1].content)
  assert.ok(payload.knowledge.agentGuidance.analysisToActionByFamily.bar)
  assert.ok(payload.knowledge.agentGuidance.relations.bar['bar.selectCategory'])
  assert.ok(payload.knowledge.agentGuidance.workflows.some((workflow) => workflow.name === 'category_to_trend'))
  assert.equal(payload.knowledge.agentGuidance.workflows[0].examples.length > 0, true)
  assert.equal('rawSpec' in payload.knowledge, false)
  const knowledgeText = JSON.stringify(payload.knowledge)
  assert.equal(knowledgeText.includes('sourceStateRef'), false)
  assert.equal(knowledgeText.includes('"transform"'), false)
  assert.equal(knowledgeText.includes('"provider"'), false)
})

test('createNaturalLanguagePlanner includes compact session history in planning prompts', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'I will inspect the snow-filtered view next.',
          rationale: 'The history shows snow was already selected, so the next step should read that filtered subset.',
          operation: {
            kind: 'perception',
            name: 'perception.inspectVisibleRows',
            target: { widgetRef: 'weather-ref' },
            params: { limit: 10 },
          },
        }),
      }
    },
    model: 'test-model',
  })

  await planner({
    objective: 'Compare snow, rain, and fog temperature trends.',
    history: {
      turns: [
        {
          turnId: 'turn_1',
          operation: {
            kind: 'action',
            name: 'bar.filterCategories',
            paramsSummary: 'field=weather; values=[snow]',
          },
          status: {
            outcome: 'verified',
            resultSummary: 'The view now focuses on snow records.',
            stateSummary: 'Active filter: weather in [snow].',
            reasonSummary: 'Next, inspect temperature over time for the filtered subset.',
          },
        },
      ],
    },
    knowledge: {
      widgetFamilies: [
        {
          kind: 'bar',
          actions: [{ name: 'bar.filterCategories' }],
          perceptions: [{ name: 'perception.inspectVisibleRows' }],
        },
      ],
    },
    observe: {
      query: 'Compare snow, rain, and fog temperature trends.',
      state: {
        widgets: [{ ref: 'weather-ref', kind: 'bar', focused: true }],
      },
      view: null,
    },
  })

  const userPrompt = requests[0]?.messages?.[1]?.content || ''
  assert.match(userPrompt, /"history":\{/)
  assert.match(userPrompt, /bar\.filterCategories/)
  assert.match(userPrompt, /field=weather; values=\[snow\]/)
  assert.match(userPrompt, /Active filter: weather in \[snow\]/)
})

test('createNaturalLanguagePlanner does not replay prior prompt messages across planner calls', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      const index = requests.length
      return {
        content: JSON.stringify({
          assistantMessage: `step ${index}`,
          rationale: 'Continue from the previous conversational turn.',
          operation: {
            kind: 'perception',
            name: 'perception.inspectVisibleRows',
            target: { widgetRef: 'bar-ref' },
            params: {},
          },
        }),
      }
    },
    model: 'test-model',
  })

  const observe = {
    query: 'Inspect the bar chart.',
    state: {
      widgets: [{ ref: 'bar-ref', widgetId: 'bar_1', kind: 'bar', focused: true }],
      sharedAnalyticalState: {
        filters: {},
        viewport: null,
        focus: { selectionSummary: null, highlightedWidgetRefs: [] },
        activeContextKinds: [],
        comparisonTargets: [],
        structure: { linkCount: 0 },
        sharedView: { activeWidgetRefs: [] },
        transformation: { activeWidgetRefs: [], widgets: {} },
      },
    },
    view: null,
  }

  await planner({
    objective: 'Inspect the bar chart.',
    knowledge: {
      widgetFamilies: [{
        kind: 'bar',
        actions: [],
        perceptions: [{ name: 'perception.inspectVisibleRows' }],
      }],
    },
    observe,
  })
  await planner({
    objective: 'Continue the inspection.',
    knowledge: {
      widgetFamilies: [{
        kind: 'bar',
        actions: [],
        perceptions: [{ name: 'perception.inspectVisibleRows' }],
      }],
    },
    observe,
  })

  assert.equal(requests.length, 2)
  assert.equal(requests[0].messages.length, 2)
  assert.equal(requests[1].messages[0].role, 'system')
  assert.equal(requests[1].messages[1].role, 'user')
  assert.equal(requests[1].messages.length, 2)
})

test('createNaturalLanguagePlanner preserves continuity through canonical history', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'Continue from history.',
          rationale: 'The canonical history identifies the completed first step.',
          operation: {
            kind: 'perception',
            name: 'perception.inspectVisibleRows',
            target: { widgetRef: 'bar-ref' },
            params: {},
          },
        }),
      }
    },
    model: 'test-model',
  })

  await planner({
    objective: 'Inspect the bar chart.',
    knowledge: { widgetFamilies: [{ kind: 'bar', actions: [], perceptions: [{ name: 'perception.inspectVisibleRows' }] }] },
    observe: { state: { widgets: [{ ref: 'bar-ref', kind: 'bar' }] }, view: null },
  })
  await planner({
    objective: 'Continue the inspection.',
    knowledge: { widgetFamilies: [{ kind: 'bar', actions: [], perceptions: [{ name: 'perception.inspectVisibleRows' }] }] },
    history: {
      turns: [{
        turnId: 'turn_1',
        operation: { kind: 'perception', name: 'perception.inspectVisibleRows' },
        status: { outcome: 'verified', resultSummary: '3 visible rows' },
      }],
    },
    observe: { state: { widgets: [{ ref: 'bar-ref', kind: 'bar' }] }, view: null },
  })

  assert.match(requests[1].messages[1].content, /3 visible rows/)
  assert.doesNotMatch(requests[1].messages[1].content, /Continue from history/)
})

test('createNaturalLanguagePlanner prunes bulky official-page observation payloads from prompt', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'I will brush a useful matrix cell.',
          rationale: 'The compact matrix observation exposes field pairs and domains.',
          operation: {
            kind: 'action',
            name: 'scatter.brushRegion',
            target: { widgetRef: 'cell-body-mass-flipper' },
            params: {
              xField: 'flipper_length_mm',
              yField: 'body_mass_g',
              xRange: [190, 230],
              yRange: [3500, 5500],
            },
          },
        }),
      }
    },
  })

  await planner({
    objective: 'Which penguin measurements are most associated with body mass?',
    knowledge: {
      widgetFamilies: [
        {
          kind: 'scatter',
          actions: [{ name: 'scatter.brushRegion' }],
          perceptions: [],
        },
      ],
    },
    history: {
      turns: [{
        turnId: 'turn_1',
        operation: {
          kind: 'perception',
          name: 'perception.inspectVisibleRows',
          paramsSummary: 'limit=20',
        },
        observe: {
          state: {
            rawRows: [{ sentinel: 'HISTORY_RAW_ROWS_SENTINEL' }],
          },
        },
        status: {
          outcome: 'ok',
          resultSummary: 'The matrix fields were detected.',
        },
      }],
    },
    observe: {
      query: 'Which penguin measurements are most associated with body mass?',
      state: {
        matrix: {
          provider: 'd3',
          kind: 'scatterMatrix',
          cellCount: 2,
          rowCount: 344,
          rawCode: 'RAW_CODE_SENTINEL',
          pageText: 'PAGE_TEXT_SENTINEL',
          cells: [
            {
              ref: 'cell-body-mass-flipper',
              xField: 'flipper_length_mm',
              yField: 'body_mass_g',
              xDomain: [172, 231],
              yDomain: [2700, 6300],
              rows: [{ sentinel: 'CELL_ROWS_SENTINEL' }],
              rowCount: 344,
            },
          ],
          summary: 'Observable D3 scatterplot matrix.',
        },
        widgets: [{
          ref: 'cell-body-mass-flipper',
          kind: 'scatter',
          focused: true,
          data: {
            rowCount: 344,
            fields: [
              { name: 'flipper_length_mm', type: 'quantitative' },
              { name: 'body_mass_g', type: 'quantitative' },
            ],
          },
          rawSpec: {
            data: {
              values: [{ sentinel: 'RAW_SPEC_VALUES_SENTINEL' }],
            },
          },
        }],
      },
      view: {
        snapshot: {
          ref: 'view-ref',
          payload: 'SNAPSHOT_SENTINEL',
        },
        summary: 'Matrix view.',
      },
    },
  })

  const userPrompt = requests[0]?.messages?.[1]?.content || ''
  const payload = JSON.parse(userPrompt)

  assert.equal(payload.observe.state.matrix.cells[0].xField, 'flipper_length_mm')
  assert.equal(payload.observe.state.matrix.cells[0].yField, 'body_mass_g')
  assert.deepEqual(payload.observe.state.matrix.cells[0].yDomain, [2700, 6300])
  assert.equal(payload.observe.state.matrix.rowCount, undefined)
  assert.equal(payload.observe.state.widgets[0].data.rowCount, undefined)
  assert.equal(payload.observe.view.snapshot, undefined)
  assert.equal(JSON.stringify(payload).includes('RAW_CODE_SENTINEL'), false)
  assert.equal(JSON.stringify(payload).includes('PAGE_TEXT_SENTINEL'), false)
  assert.equal(JSON.stringify(payload).includes('CELL_ROWS_SENTINEL'), false)
  assert.equal(JSON.stringify(payload).includes('RAW_SPEC_VALUES_SENTINEL'), false)
  assert.equal(JSON.stringify(payload).includes('HISTORY_RAW_ROWS_SENTINEL'), false)
})

test('createNaturalLanguagePlanner does not inject a task-specific linked-view workflow hint', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'I will brush the shorter flipper-length region first.',
          rationale: 'The objective asks for a comparison across flipper-length bands.',
          operation: {
            kind: 'action',
            name: 'scatter.brushRegion',
            target: { widgetRef: 'flipper-scatter-ref' },
            params: { xRange: [170, 195], yRange: [2500, 6500] },
          },
        }),
      }
    },
  })

  await planner({
    objective: 'How does body mass vary across penguins with shorter, medium, and longer flipper lengths?',
    knowledge: {
      widgetFamilies: [
        {
          kind: 'scatter',
          actions: [{ name: 'scatter.brushRegion' }],
          perceptions: [{ name: 'perception.summarizeVisible' }],
        },
      ],
    },
    observe: {
      state: {
        widgets: [{
          ref: 'flipper-scatter-ref',
          kind: 'scatter',
          title: 'Flipper length and body mass',
          focused: true,
          actionNames: ['scatter.brushRegion'],
          data: {
            fields: [
              { name: 'flipper_length_mm', type: 'quantitative' },
              { name: 'body_mass_g', type: 'quantitative' },
              { name: 'species', type: 'nominal' },
            ],
          },
        }],
      },
      view: {
        summary: 'Penguin body mass linked view with scatter brush and species bar.',
      },
    },
  })

  const systemPrompt = requests[0]?.messages?.[0]?.content || ''
  assert.doesNotMatch(systemPrompt, /Temporary Penguin linked-view demo workflow/)
})

test('createNaturalLanguagePlanner prioritizes linked actions before perceptions for subset objectives', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'I will select the cohort first.',
          rationale: 'The linked detail view should update before it is read.',
          operation: {
            kind: 'action',
            name: 'bar.selectCategory',
            target: { widgetRef: 'bar-ref' },
            params: { field: 'cohort', values: ['group C'] },
          },
        }),
      }
    },
  })

  await planner({
    objective: 'Compare the profile of the largest and smallest cohorts.',
    knowledge: { widgetFamilies: [{ kind: 'bar', actions: [{ name: 'bar.selectCategory' }], perceptions: [] }] },
    observe: { state: { widgets: [{ ref: 'bar-ref', kind: 'bar', actionNames: ['bar.selectCategory'] }] } },
  })

  assert.match(requests[0].messages[0].content, /linked subset, cohort, category, or interval/i)
})

test('createNaturalLanguagePlanner does not force D3 matrix perception into a brush action', async () => {
  const planner = createNaturalLanguagePlanner({
    completeChat: async () => ({
      content: JSON.stringify({
        assistantMessage: 'I will inspect the penguin matrix first.',
        rationale: 'I need the visible configuration before acting.',
        operation: {
          kind: 'perception',
          name: 'perception.inspectViewConfig',
          target: { widgetRef: 'cell-flipper-body' },
          params: {},
        },
      }),
    }),
  })

  const result = await planner({
    objective: 'Help me understand which penguin measurements are associated with body mass.',
    knowledge: {
      widgetFamilies: [
        {
          kind: 'scatter',
          actions: [{ name: 'scatter.brushRegion' }],
          perceptions: [{ name: 'perception.inspectViewConfig' }],
        },
      ],
    },
    observe: {
      state: {
        matrix: {
          kind: 'scatterMatrix',
          cells: [
            {
              ref: 'cell-flipper-body',
              xField: 'flipper length (mm)',
              yField: 'body mass (g)',
              xDomain: [170, 230],
              yDomain: [2700, 6300],
            },
            {
              ref: 'cell-bill-body',
              xField: 'bill length (mm)',
              yField: 'body mass (g)',
              xDomain: [30, 60],
              yDomain: [2700, 6300],
            },
          ],
        },
        widgets: [
          { ref: 'cell-flipper-body', kind: 'scatter', focused: true },
          { ref: 'cell-bill-body', kind: 'scatter' },
        ],
      },
      view: {
        summary: 'Observable D3 scatterplot matrix for penguins.',
      },
    },
  })

  assert.equal(result.operation.kind, 'perception')
  assert.equal(result.operation.name, 'perception.inspectViewConfig')
  assert.deepEqual(result.operation.target, { widgetRef: 'cell-flipper-body' })
})

test('createNaturalLanguagePlanner includes compact session history in repair prompts', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      if (requests.length === 1) {
        return {
          content: JSON.stringify({
            assistantMessage: 'Invalid attempt.',
            rationale: 'Missing target.',
            operation: {
              kind: 'action',
              name: 'bar.filterCategories',
              params: { field: 'weather', values: ['rain'] },
            },
          }),
        }
      }
      return {
        content: JSON.stringify({
          assistantMessage: 'I will filter the bar widget to rain.',
          rationale: 'The repair includes the target widget ref and continues from the snow history.',
          operation: {
            kind: 'action',
            name: 'bar.filterCategories',
            target: { widgetRef: 'weather-ref' },
            params: { field: 'weather', values: ['rain'] },
          },
        }),
      }
    },
  })

  await planner({
    objective: 'Compare snow, rain, and fog temperature trends.',
    history: {
      turns: [
        {
          turnId: 'turn_1',
          operation: {
            kind: 'action',
            name: 'bar.filterCategories',
            paramsSummary: 'field=weather; values=[snow]',
          },
          status: {
            outcome: 'verified',
            resultSummary: 'The view now focuses on snow records.',
          },
        },
      ],
    },
    knowledge: {
      widgetFamilies: [
        {
          kind: 'bar',
          actions: [{ name: 'bar.filterCategories' }],
          perceptions: [],
        },
      ],
    },
    observe: {
      state: {
        widgets: [{ ref: 'weather-ref', kind: 'bar', focused: true }],
      },
      view: null,
    },
  })

  assert.equal(requests.length, 2)
  const repairPrompt = requests[1]?.messages?.[1]?.content || ''
  assert.match(repairPrompt, /"history":\{/)
  assert.match(repairPrompt, /field=weather; values=\[snow\]/)
})

test('createNaturalLanguageReasoner includes compact session history in progress prompts', async () => {
  const requests = []
  const reasoner = createNaturalLanguageReasoner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          answer: 'Snow has been inspected; continue with rain next.',
          completion: { status: 'continue' },
        }),
      }
    },
  })

  const result = await reasoner({
    objective: 'Compare snow, rain, and fog temperature trends.',
    history: {
      turns: [
        {
          turnId: 'turn_1',
          operation: {
            kind: 'action',
            name: 'bar.filterCategories',
            paramsSummary: 'field=weather; values=[snow]',
          },
          status: {
            outcome: 'verified',
            resultSummary: 'The view now focuses on snow records.',
          },
        },
      ],
    },
    observe: {
      state: {
        widgets: [{ ref: 'weather-ref', kind: 'bar', focused: true }],
      },
      view: null,
    },
    plan: {
      operation: {
        kind: 'perception',
        name: 'perception.inspectVisibleRows',
        target: { widgetRef: 'weather-ref' },
        params: { limit: 10 },
      },
    },
    result: {
      ok: true,
      summary: 'Visible rows show snow records.',
      result: {
        rowCount: 2,
        groups: [
          { weather: 'snow', meanTemperature: -3.5 },
          { weather: 'rain', meanTemperature: 4.25 },
        ],
      },
    },
    verification: null,
  })

  assert.equal(result.completion.status, 'continue')
  const userPrompt = requests[0]?.messages?.[1]?.content || ''
  assert.match(userPrompt, /"history":\{/)
  assert.match(userPrompt, /bar\.filterCategories/)
  assert.equal(userPrompt.includes('meanTemperature'), true)
})

test('createNaturalLanguageReasoner prunes bulky action result and verification payloads', async () => {
  const requests = []
  const reasoner = createNaturalLanguageReasoner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          answer: 'The brush was applied; continue with another field pair.',
          completion: { status: 'continue' },
        }),
      }
    },
  })

  await reasoner({
    objective: 'Which penguin measurements are most associated with body mass?',
    history: { turns: [] },
    observe: {
      state: {
        widgets: [{ ref: 'cell-body-mass-flipper', kind: 'scatter', focused: true }],
      },
      view: null,
    },
    plan: {
      operation: {
        kind: 'action',
        name: 'scatter.brushRegion',
        target: { widgetRef: 'cell-body-mass-flipper' },
        params: {
          xField: 'flipper_length_mm',
          yField: 'body_mass_g',
          xRange: [190, 230],
          yRange: [3500, 5500],
        },
      },
    },
    result: {
      ok: true,
      stateId: 'matrix:s2',
      updatedRefs: ['cell-body-mass-flipper'],
      summary: 'Brush applied.',
      afterView: {
        payload: 'RESULT_AFTER_VIEW_SENTINEL',
        rows: [{ sentinel: 'RESULT_ROWS_SENTINEL' }],
      },
      result: {
        rows: [{ sentinel: 'RESULT_NESTED_ROWS_SENTINEL' }],
      },
    },
    verification: {
      ok: true,
      summary: 'Visual change matched the selected brush.',
      checks: {
        visualChange: {
          ok: true,
          summary: 'Matched rendered brush.',
          snapshot: {
            payload: 'VERIFY_SNAPSHOT_SENTINEL',
          },
          rows: [{ sentinel: 'VERIFY_ROWS_SENTINEL' }],
        },
      },
    },
  })

  const userPrompt = requests[0]?.messages?.[1]?.content || ''
  assert.equal(userPrompt.includes('RESULT_AFTER_VIEW_SENTINEL'), false)
  assert.equal(userPrompt.includes('RESULT_ROWS_SENTINEL'), false)
  assert.equal(userPrompt.includes('RESULT_NESTED_ROWS_SENTINEL'), false)
  assert.equal(userPrompt.includes('VERIFY_SNAPSHOT_SENTINEL'), false)
  assert.equal(userPrompt.includes('VERIFY_ROWS_SENTINEL'), false)
  assert.match(userPrompt, /Brush applied/)
  assert.match(userPrompt, /Matched rendered brush/)
})

test('createNaturalLanguageReasoner keeps bounded structured perception evidence', async () => {
  const requests = []
  const reasoner = createNaturalLanguageReasoner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          answer: 'The visible profiles differ by dimension.',
          completion: { status: 'answered' },
        }),
      }
    },
  })

  await reasoner({
    objective: 'Compare the visible feature profiles.',
    history: { turns: [] },
    observe: { state: { widgets: [{ ref: 'feature-ref', kind: 'parallelCoordinates' }] }, view: null },
    plan: {
      operation: {
        kind: 'perception',
        name: 'perception.summarizeVisible',
        target: { widgetRef: 'feature-ref' },
        params: { groupBy: ['dimension'], metrics: ['mean'] },
      },
    },
    result: {
      ok: true,
      queryName: 'perception.summarizeVisible',
      summary: '4 grouped summaries over 4 rows',
      result: {
        rowCount: 4,
        groups: [
          { dimension: 'feature_a', mean: 12.1 },
          { dimension: 'feature_b', mean: 8.4 },
        ],
      },
    },
    verification: { ok: true, summary: 'The grouped visible result was returned.' },
  })

  const userPrompt = requests[0]?.messages?.[1]?.content || ''
  assert.match(userPrompt, /feature_a/)
  assert.match(userPrompt, /feature_b/)
  assert.match(userPrompt, /12\.1/)
})

test('createNaturalLanguageReasoner preserves falsy typed answers in verifiable mode', async () => {
  const reasoner = createNaturalLanguageReasoner({
    completeChat: async () => ({
      content: JSON.stringify({ answer: false, completion: { status: 'answered' } }),
    }),
  })

  const result = await reasoner({
    objective: 'Return whether the linked evidence establishes causation.',
    responseRequirements: { mode: 'verifiable', answerType: 'boolean' },
  })

  assert.equal(result.answer, false)
  assert.equal(result.completion.status, 'answered')
})

test('createNaturalLanguagePlanner preserves runtime-built agentObservation in prompts', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'I will inspect visible rows before answering.',
          rationale: 'The current imported chart fields are available in the runtime observation.',
          operation: {
            kind: 'perception',
            name: 'perception.inspectVisibleRows',
            target: {
              widgetRef: 'scatter-ref',
            },
            params: {
              limit: 5,
            },
          },
        }),
      }
    },
    model: 'test-model',
  })

  await planner({
    objective: 'What is the chart?',
    knowledge: {
      widgetFamilies: [
        {
          kind: 'scatter',
          actions: [],
          perceptions: [
            {
              name: 'perception.computeCorrelation',
              examples: [{
                params: {
                  xField: 'Horsepower',
                  yField: 'Miles_per_Gallon',
                },
              }],
            },
          ],
        },
      ],
    },
    observe: {
      workspace: {
        widgets: [{ ref: 'scatter-ref', kind: 'scatter' }],
      },
      observation: null,
      agentObservation: {
        query: 'What is the chart?',
        state: {
          stateId: 'imported:s1',
          widgets: [{
            ref: 'scatter-ref',
            kind: 'scatter',
            title: 'Imported visualization',
            data: {
              currentDataRef: 'data-visible',
              fields: [
                { name: 'xValue', type: 'quantitative' },
                { name: 'yValue', type: 'quantitative' },
                { name: 'group', type: 'nominal' },
              ],
              visibleCount: 3,
            },
            encodings: {
              x: { field: 'xValue', type: 'quantitative' },
              y: { field: 'yValue', type: 'quantitative' },
              color: { field: 'group', type: 'nominal' },
            },
            focused: true,
          }],
          sharedAnalyticalState: {},
        },
        view: {
          summary: null,
        },
      },
    },
  })

  const userPrompt = requests[0]?.messages?.[1]?.content || ''
  assert.match(userPrompt, /xValue/)
  assert.match(userPrompt, /yValue/)
  assert.match(userPrompt, /group/)
  assert.match(userPrompt, /visibleCount/)
  assert.doesNotMatch(userPrompt, /Horsepower/)
  assert.doesNotMatch(userPrompt, /Miles_per_Gallon/)
})

test('createNaturalLanguagePlanner does not inject fixed linked-bar action guidance', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'I will select Downtown in the bar chart.',
          rationale: 'A source selection should propagate through linked views.',
          operation: {
            kind: 'action',
            name: 'bar.selectCategory',
            target: { widgetRef: 'bar-ref' },
            params: {
              field: 'region',
              values: ['Downtown'],
            },
          },
        }),
      }
    },
    model: 'test-model',
  })

  const result = await planner({
    objective: 'Select Downtown in the bar chart and update the linked line and scatter views.',
    knowledge: {
      widgetFamilies: [
        {
          kind: 'bar',
          actions: [
            { name: 'bar.selectCategory' },
            { name: 'bar.filterCategories' },
          ],
          perceptions: [],
        },
      ],
    },
    observe: {
      workspace: {
        widgets: [{ ref: 'bar-ref', kind: 'bar' }],
      },
    },
  })

  const systemPrompt = requests[0]?.messages?.[0]?.content || ''
  assert.equal(result.operation.name, 'bar.selectCategory')
  assert.doesNotMatch(systemPrompt, /choose bar\.selectCategory/)
  assert.doesNotMatch(systemPrompt, /never for linked-view propagation/)
})

test('createNaturalLanguagePlanner repairs action plans that omit the target widgetRef', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      if (requests.length === 1) {
        return {
          content: JSON.stringify({
            assistantMessage: 'I will zoom a scatter plot.',
            rationale: 'The next step is a scatter zoom, but no target was specified.',
            operation: {
              kind: 'action',
              name: 'scatter.zoomDomain',
              params: {
                xDomain: [10, 30],
              },
            },
          }),
        }
      }
      return {
        content: JSON.stringify({
          assistantMessage: 'I will zoom the specified scatter plot.',
          rationale: 'The repair includes the target widget reference required by the action contract.',
          operation: {
            kind: 'action',
            name: 'scatter.zoomDomain',
            target: {
              widgetRef: 'scatter-a-ref',
            },
            params: {
              xDomain: [10, 30],
            },
          },
        }),
      }
    },
    model: 'test-model',
  })

  const result = await planner({
    objective: 'Zoom one of the scatter plots.',
    knowledge: {
      widgetFamilies: [
        {
          kind: 'scatter',
          actions: [{ name: 'scatter.zoomDomain' }],
          perceptions: [],
        },
      ],
    },
    observe: {
      workspace: {
        widgets: [
          { ref: 'scatter-a-ref', kind: 'scatter' },
          { ref: 'scatter-b-ref', kind: 'scatter' },
        ],
      },
    },
  })

  assert.equal(requests.length, 2)
  assert.deepEqual(result.operation.target, { widgetRef: 'scatter-a-ref' })
})

test('createNaturalLanguagePlanner repairs action plans that use widgetId instead of full widgetRef', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      if (requests.length === 1) {
        return {
          content: JSON.stringify({
            assistantMessage: 'I will sort the bar chart.',
            rationale: 'The request asks for a descending bar order.',
            operation: {
              kind: 'action',
              name: 'bar.sortBars',
              target: { widgetRef: 'bar_1' },
              params: {
                channel: 'y',
                order: 'descending',
                field: 'visitors',
                aggregate: 'sum',
              },
            },
          }),
        }
      }
      return {
        content: JSON.stringify({
          assistantMessage: 'I will sort the specified bar chart.',
          rationale: 'The repaired plan copies the full widget ref from observation.',
          operation: {
            kind: 'action',
            name: 'bar.sortBars',
            target: { widgetRef: 'bar-ref' },
            params: {
              channel: 'y',
              order: 'descending',
              field: 'visitors',
              aggregate: 'sum',
            },
          },
        }),
      }
    },
  })

  const result = await planner({
    objective: 'Sort the region bar chart by total visitors descending.',
    knowledge: {
      widgetFamilies: [{
        kind: 'bar',
        actions: [{ name: 'bar.sortBars' }],
        perceptions: [],
      }],
    },
    observe: {
      state: {
        widgets: [{ ref: 'bar-ref', widgetId: 'bar_1', kind: 'bar', focused: true }],
      },
    },
  })

  assert.equal(requests.length, 2)
  assert.deepEqual(result.operation.target, { widgetRef: 'bar-ref' })
})

test('createNaturalLanguagePlanner repairs perceptions that do not belong to the target widget family', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      if (requests.length === 1) {
        return {
          content: JSON.stringify({
            assistantMessage: 'I will find the extreme value.',
            rationale: 'The objective asks for the highest category.',
            operation: {
              kind: 'perception',
              name: 'perception.findExtremes',
              target: { widgetRef: 'bar-ref' },
              params: {
                field: 'visitors',
                direction: 'max',
                limit: 1,
              },
            },
          }),
        }
      }
      return {
        content: JSON.stringify({
          assistantMessage: 'I will sort the bar chart to make the highest category visible.',
          rationale: 'The repaired plan uses a bar action exposed by the target widget family.',
          operation: {
            kind: 'action',
            name: 'bar.sortBars',
            target: { widgetRef: 'bar-ref' },
            params: {
              channel: 'y',
              order: 'descending',
              field: 'visitors',
              aggregate: 'sum',
            },
          },
        }),
      }
    },
  })

  const result = await planner({
    objective: 'Find the city with the highest total visitors in this bar chart.',
    knowledge: {
      widgetFamilies: [
        {
          kind: 'bar',
          actions: [{ name: 'bar.sortBars' }],
          perceptions: [{ name: 'perception.compareGroups' }],
        },
        {
          kind: 'line',
          actions: [],
          perceptions: [{ name: 'perception.findExtremes' }],
        },
      ],
    },
    observe: {
      state: {
        widgets: [
          { ref: 'bar-ref', kind: 'bar', focused: true },
          { ref: 'line-ref', kind: 'line' },
        ],
      },
    },
  })

  assert.equal(requests.length, 2)
  assert.equal(result.operation.name, 'bar.sortBars')
  assert.deepEqual(result.operation.target, { widgetRef: 'bar-ref' })
})

test('createNaturalLanguagePlanner does not inject fixed bar selection guidance', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'I will click the requested bar category.',
          rationale: 'Explicit click language should map to existing click-style category semantics.',
          operation: {
            kind: 'action',
            name: 'bar.clickCategory',
            target: { widgetRef: 'bar-ref' },
            params: {
              field: 'weather',
              values: ['sun'],
            },
          },
        }),
      }
    },
  })

  await planner({
    objective: 'Click the sun bar and keep the other categories visible.',
    knowledge: {
      widgets: [{ ref: 'bar-ref', widgetId: 'bar_1' }],
    },
    observe: {
      workspace: {
        widgets: [{ ref: 'bar-ref' }],
      },
    },
  })

  const systemPrompt = requests[0]?.messages?.[0]?.content || ''
  assert.doesNotMatch(systemPrompt, /bar\.clickCategory/i)
  assert.doesNotMatch(systemPrompt, /bar\.selectCategory/i)
  assert.doesNotMatch(systemPrompt, /bar\.filterCategories only when the user explicitly wants to keep only/i)
})

test('createNaturalLanguagePlanner keeps provider-agnostic semantic operation rules', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'I will brush the requested interval.',
          rationale: 'The request matches interval brush semantics.',
          operation: {
            kind: 'action',
            name: 'vegaLite.setIntervalParam',
            target: { widgetRef: 'custom-ref' },
            params: {
              paramName: 'brush',
              xField: 'date',
              xRange: ['2012-03-01', '2012-05-31'],
            },
          },
        }),
      }
    },
  })

  await planner({
    objective: 'Brush the spring date range in this linked Vega-Lite view.',
    knowledge: {
      widgets: [{ ref: 'custom-ref', widgetId: 'custom_1' }],
    },
    observe: {
      workspace: {
        widgets: [{ ref: 'custom-ref' }],
      },
    },
  })

  const systemPrompt = requests[0]?.messages?.[0]?.content || ''
  assert.doesNotMatch(systemPrompt, /page-linked action surface/i)
  assert.match(systemPrompt, /shared-state updates/i)
  assert.match(systemPrompt, /rematerialize the page/i)
  assert.match(systemPrompt, /Do not reason as if you need to touch private Vega runtime internals/i)
  assert.doesNotMatch(systemPrompt, /prefer vegaLite\.setIntervalParam/i)
  assert.doesNotMatch(systemPrompt, /prefer vegaLite\.setPointParam/i)
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
            target: { widgetRef: 'scatter-ref' },
            params: {},
          },
        }),
      }
    },
  })

  const result = await planner({
    objective: 'Understand the current chart state.',
    observe: {
      query: 'Understand the current chart state.',
      state: {
        widgets: [
          {
            ref: 'scatter-ref',
            kind: 'scatter',
            focused: true,
          },
        ],
      },
      view: null,
    },
  })

  assert.equal(requests.length, 2)
  assert.equal(result.operation.kind, 'perception')
  assert.equal(result.operation.name, 'perception.inspectViewConfig')
})

test('createNaturalLanguagePlanner retries a non-JSON first response', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      if (requests.length === 1) {
        return { content: 'I need to inspect the chart before choosing an operation.' }
      }
      return {
        content: JSON.stringify({
          assistantMessage: 'I will inspect the current view configuration.',
          rationale: 'The repaired response is strict JSON with a valid target.',
          operation: {
            kind: 'perception',
            name: 'perception.inspectViewConfig',
            target: { widgetRef: 'scatter-ref' },
            params: {},
          },
        }),
      }
    },
  })

  const result = await planner({
    objective: 'Understand the current chart state.',
    knowledge: {
      widgetFamilies: [{
        kind: 'scatter',
        actions: [],
        perceptions: [{ name: 'perception.inspectViewConfig' }],
      }],
    },
    observe: {
      state: {
        widgets: [{ ref: 'scatter-ref', kind: 'scatter', focused: true }],
      },
      view: null,
    },
  })

  assert.equal(requests.length, 2)
  assert.match(requests[1]?.messages?.[0]?.content || '', /Return JSON only/)
  assert.equal(result.operation.name, 'perception.inspectViewConfig')
})

test('createNaturalLanguagePlanner fallback reads widget kind from observation state and descriptors from knowledge', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'Invalid attempt',
          rationale: 'Missing operation name.',
          operation: {
            kind: 'action',
            params: {},
          },
        }),
      }
    },
  })

  const result = await planner({
    objective: 'Inspect the current chart.',
    knowledge: {
      widgetFamilies: [
        {
          kind: 'scatter',
          actions: [],
          perceptions: [
            { name: 'perception.inspectViewConfig' },
          ],
        },
      ],
    },
    observe: {
      query: 'Inspect the current chart.',
      state: {
        widgets: [
          {
            ref: 'scatter-ref',
            kind: 'scatter',
            focused: true,
          },
        ],
      },
      view: null,
    },
  })

  assert.equal(requests.length, 2)
  assert.equal(result.operation.kind, 'perception')
  assert.equal(result.operation.name, 'perception.inspectViewConfig')
  assert.deepEqual(result.operation.target, { widgetRef: 'scatter-ref' })
})

test('createNaturalLanguagePlanner fallback does not treat custom recognizedKinds as widget identity', async () => {
  const planner = createNaturalLanguagePlanner({
    completeChat: async () => ({
      content: JSON.stringify({
        assistantMessage: 'Invalid attempt',
        rationale: 'Missing operation name.',
        operation: {
          kind: 'action',
          params: {},
        },
      }),
    }),
  })

  await assert.rejects(
    () => planner({
      objective: 'Inspect the composite chart.',
      knowledge: {
        widgetFamilies: [
          {
            kind: 'scatter',
            actions: [],
            perceptions: [
              { name: 'perception.inspectViewConfig' },
            ],
          },
        ],
      },
      observe: {
        query: 'Inspect the composite chart.',
        state: {
          widgets: [
            {
              ref: 'custom-ref',
              kind: 'custom',
              recognizedKinds: ['scatter'],
              focused: true,
            },
          ],
        },
        view: null,
      },
    }),
    /current workspace catalog does not expose a fallback/,
  )
})

test('runNaturalLanguageAgentLoop executes the planner result through the target surface', async () => {
  const port = createMockPagePort()
  const result = await runNaturalLanguageAgentLoop(port, {
    objective: 'Brush the central scatterplot window.',
    model: 'test-model',
    completeChat: async () => ({
      content: JSON.stringify({
        assistantMessage: 'I will brush the central region of the scatterplot.',
        rationale: 'The brush creates a visible local subset for analysis.',
        operation: {
          kind: 'action',
          name: 'scatter.brushRegion',
          target: {
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

test('runNaturalLanguageAgentSession returns a final synthesis answer from the existing multi-turn entrypoint', async () => {
  const port = createMockPagePort()
  const requests = []
  const result = await runNaturalLanguageAgentSession(port, {
    objective: 'Brush the central scatterplot window and summarize it.',
    model: 'test-model',
    maxTurns: 2,
    completeChat: async (request) => {
      requests.push(request)
      const systemPrompt = request?.messages?.[0]?.content || ''
      if (systemPrompt.includes('final synthesis stage')) {
        return {
          content: JSON.stringify({
            answer: 'Final synthesized answer based on the completed brush turn.',
          }),
        }
      }
      if (systemPrompt.includes('answer stage')) {
        return {
          content: JSON.stringify({
            answer: 'Brush turn completed; enough information is available.',
            completion: { status: 'answered' },
          }),
        }
      }
      return {
        content: JSON.stringify({
          assistantMessage: 'I will brush the central region of the scatterplot.',
          rationale: 'The brush creates a visible local subset for analysis.',
          operation: {
            kind: 'action',
            name: 'scatter.brushRegion',
            target: {
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
      }
    },
  })

  assert.equal(result.stopReason, 'answered')
  assert.equal(result.turns.length, 1)
  assert.equal(result.answer, 'Final synthesized answer based on the completed brush turn.')
  assert.equal(result.finalAnswer, 'Final synthesized answer based on the completed brush turn.')
  const finalRequest = requests.find((request) => {
    const systemPrompt = request?.messages?.[0]?.content || ''
    return systemPrompt.includes('final synthesis stage')
  })
  const finalPrompt = finalRequest?.messages?.[1]?.content || ''
  assert.match(finalPrompt, /"history":\{/)
  assert.match(finalPrompt, /scatter\.brushRegion/)
  const finalSystemPrompt = finalRequest?.messages?.[0]?.content || ''
  assert.match(finalSystemPrompt, /every completed turn/i)
  assert.match(finalSystemPrompt, /do not return only the last turn/i)
})

test('runNaturalLanguageAgentSession uses a verified typed reason answer without final synthesis', async () => {
  const port = createMockPagePort()
  const requests = []
  const result = await runNaturalLanguageAgentSession(port, {
    objective: 'Did the linked evidence establish causation?',
    maxTurns: 2,
    responseRequirements: { mode: 'verifiable', answerType: 'boolean' },
    completeChat: async (request) => {
      requests.push(request)
      const systemPrompt = request?.messages?.[0]?.content || ''
      if (systemPrompt.includes('answer stage')) {
        return { content: JSON.stringify({ answer: false, completion: { status: 'answered' } }) }
      }
      return {
        content: JSON.stringify({
          assistantMessage: 'I will inspect the linked evidence.',
          rationale: 'The available perception provides the requested evidence.',
          operation: {
            kind: 'action',
            name: 'scatter.brushRegion',
            target: { widgetRef: 'w://widgetva-app/workspace/official-vega-lite-point_2d/widget/session_official-vega-lite-point_2d' },
            params: { xField: 'Horsepower', yField: 'Miles_per_Gallon', xRange: [80, 140], yRange: [18, 30] },
          },
        }),
      }
    },
  })

  assert.equal(result.answer, false)
  assert.equal(result.turns.length, 1)
  assert.equal(requests.some((request) => String(request?.messages?.[0]?.content || '').includes('final synthesis stage')), false)
})

test('final synthesis uses typed machine answer mode when response requirements are verifiable', async () => {
  const requests = []
  const finalSynthesizer = createNaturalLanguageFinalSynthesizer({
    completeChat: async (request) => {
      requests.push(request)
      return { content: JSON.stringify({ answer: 42 }) }
    },
  })

  const result = await finalSynthesizer({
    objective: 'Summarize the measured result.',
    turns: [{ index: 0, reason: { answer: 'The score is 42 for group A.' } }],
    responseRequirements: {
      mode: 'verifiable',
      answerType: 'numeric',
    },
  })

  assert.equal(result.answer, 42)
  const systemPrompt = requests[0]?.messages?.[0]?.content || ''
  assert.match(systemPrompt, /machine answer mode/i)
  assert.match(systemPrompt, /single answer type/i)
  assert.match(systemPrompt, /return null rather than guessing/i)
})

test('final synthesis accepts boolean values from the canonical answer contract', async () => {
  const finalSynthesizer = createNaturalLanguageFinalSynthesizer({
    completeChat: async () => ({ content: JSON.stringify({ answer: true }) }),
  })
  const result = await finalSynthesizer({
    objective: 'Did the metric improve?',
    responseRequirements: { mode: 'verifiable', answerType: 'boolean' },
  })
  assert.equal(result.answer, true)
})

test('final synthesis rejects prose when machine answer type is numeric', async () => {
  const finalSynthesizer = createNaturalLanguageFinalSynthesizer({
    completeChat: async () => ({ content: JSON.stringify({ answer: 'The score is 42.' }) }),
  })
  const result = await finalSynthesizer({
    objective: 'Return the score.',
    responseRequirements: { mode: 'verifiable', answerType: 'numeric' },
  })
  assert.equal(result.answer, null)
})

test('final synthesizer preserves all progress evidence when its response is invalid', async () => {
  const finalSynthesizer = createNaturalLanguageFinalSynthesizer({
    completeChat: async () => ({ content: 'not-json' }),
  })
  const result = await finalSynthesizer({
    objective: 'Inspect two linked views and summarize both results.',
    turns: [
      { index: 0, reason: { answer: 'First view result: alpha is 10.' } },
      { index: 1, reason: { answer: 'Second view result: beta is 6.' } },
    ],
  })

  assert.match(result.answer, /First view result: alpha is 10\./)
  assert.match(result.answer, /Second view result: beta is 6\./)
})

test('runNaturalLanguageAgentTurn returns the compact formal turn contract', async () => {
  const port = createMockPagePort()
  const result = await runNaturalLanguageAgentTurn(port, {
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
          target: {
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

  assert.deepEqual(Object.keys(result), ['index', 'observe', 'plan', 'act', 'verify', 'reason'])
  assert.equal(result.index, 0)
  assert.equal(result.plan.step.name, 'scatter.brushRegion')
  assert.equal(typeof result.observe.view.snapshot?.ref, 'string')
  assert.equal(result.act.ok, true)
  assert.equal(result.verify.ok, true)
  assert.equal(typeof result.verify.guidance, 'string')
})

test('planner sends a captured observation image as a multimodal user message part', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'Inspect the current view.',
          rationale: 'A visible summary is useful before acting.',
          operation: {
            kind: 'perception',
            name: 'perception.summarizeVisible',
            target: { widgetRef: 'bar-ref' },
            params: {},
          },
        }),
      }
    },
  })

  await planner({
    objective: 'Inspect the chart.',
    observe: {
      query: 'Inspect the chart.',
      state: {
        stateId: 's1',
        widgets: [{ ref: 'bar-ref', kind: 'bar', focused: true, perceptionNames: ['perception.summarizeVisible'] }],
      },
      view: {
        image: {
          ref: 'view-image:s1',
          mimeType: 'image/png',
          data: 'ZmFrZQ==',
        },
      },
    },
    knowledge: { families: { bar: { perceptions: ['perception.summarizeVisible'] } } },
  })

  const content = requests[0]?.messages?.[1]?.content
  assert.equal(Array.isArray(content), true)
  assert.equal(content[0].type, 'text')
  assert.equal(content[1].type, 'image_url')
  assert.equal(content[1].image_url.url, 'data:image/png;base64,ZmFrZQ==')
  assert.equal(content[0].text.includes('ZmFrZQ=='), false)
})
