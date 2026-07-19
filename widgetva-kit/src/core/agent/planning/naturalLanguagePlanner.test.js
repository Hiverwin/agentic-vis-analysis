import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createNaturalLanguageReasoner,
  createNaturalLanguagePlanner,
  formatAgentPlannerError,
  runNaturalLanguageAgentLoop,
  runNaturalLanguageAgentSession,
  runNaturalLanguageAgentTurn,
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
        widgets: [{ ref: 'scatter-ref', kind: 'scatter', focused: true }],
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
  assert.match(requests[0]?.messages?.[1]?.content || '', /"knowledge":\{/)
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

test('createNaturalLanguagePlanner adds Seattle weather demo workflow hint for high-level weather intent', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'I will filter to rain first so I can inspect one weather condition at a time.',
          rationale: 'The objective asks for weather-temperature patterns across the year.',
          operation: {
            kind: 'action',
            name: 'bar.filterCategories',
            target: { widgetRef: 'weather-ref' },
            params: { field: 'weather', categories: ['rain'] },
          },
        }),
      }
    },
  })

  await planner({
    objective: 'I want to understand how different weather conditions relate to temperature over the year in Seattle.',
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
        widgets: [{
          ref: 'weather-ref',
          kind: 'bar',
          title: 'Seattle Weather, 2012-2015',
          focused: true,
          data: {
            fieldValues: {
              weather: ['sun', 'fog', 'drizzle', 'rain', 'snow'],
            },
          },
        }],
      },
      view: {
        summary: 'Seattle Weather chart with temp_max over the year.',
      },
    },
  })

  const systemPrompt = requests[0]?.messages?.[0]?.content || ''
  assert.match(systemPrompt, /Temporary Seattle Weather demo workflow/)
  assert.match(systemPrompt, /every unfinished turn must execute exactly one action/)
  assert.match(systemPrompt, /categories \["rain"\]/)
  assert.match(systemPrompt, /categories \["fog"\]/)
  assert.match(systemPrompt, /categories \["snow"\]/)
})

test('createNaturalLanguagePlanner falls back to the next Seattle weather action when the model skips category views', async () => {
  const requests = []
  const planner = createNaturalLanguagePlanner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          assistantMessage: 'I will inspect the current view.',
          rationale: 'The view can be summarized directly.',
          operation: {
            kind: 'perception',
            name: 'perception.inspectViewConfig',
            target: { widgetRef: 'weather-ref' },
            params: {},
          },
        }),
      }
    },
  })

  const result = await planner({
    objective: 'I want to understand how different weather conditions relate to temperature over the year in Seattle.',
    knowledge: {
      widgetFamilies: [
        {
          kind: 'bar',
          actions: [{ name: 'bar.filterCategories' }],
          perceptions: [{ name: 'perception.inspectViewConfig' }],
        },
      ],
    },
    observe: {
      state: {
        widgets: [{
          ref: 'weather-ref',
          kind: 'bar',
          title: 'Seattle Weather, 2012-2015',
          focused: true,
          actionNames: ['bar.filterCategories'],
        }],
      },
      view: {
        summary: 'Seattle Weather chart with temp_max over the year.',
      },
    },
  })

  assert.equal(requests.length, 2)
  assert.equal(result.operation.kind, 'action')
  assert.equal(result.operation.name, 'bar.filterCategories')
  assert.deepEqual(result.operation.params, {
    field: 'weather',
    categories: ['rain'],
  })
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
    },
    verification: null,
  })

  assert.equal(result.completion.status, 'continue')
  const userPrompt = requests[0]?.messages?.[1]?.content || ''
  assert.match(userPrompt, /"history":\{/)
  assert.match(userPrompt, /bar\.filterCategories/)
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

test('createNaturalLanguageReasoner keeps Seattle weather demo running until all category views are inspected', async () => {
  const requests = []
  const reasoner = createNaturalLanguageReasoner({
    completeChat: async (request) => {
      requests.push(request)
      return {
        content: JSON.stringify({
          answer: 'Rain has enough evidence, so I can answer now.',
          completion: { status: 'answered' },
        }),
      }
    },
  })

  const result = await reasoner({
    objective: 'I want to understand how different weather conditions relate to temperature over the year in Seattle.',
    history: {
      turns: [],
    },
    observe: {
      state: {
        widgets: [{
          ref: 'weather-ref',
          kind: 'bar',
          title: 'Seattle Weather, 2012-2015',
          focused: true,
        }],
      },
      view: {
        summary: 'Seattle Weather chart with temp_max over the year.',
      },
    },
    plan: {
      operation: {
        kind: 'action',
        name: 'bar.filterCategories',
        target: { widgetRef: 'weather-ref' },
        params: { field: 'weather', categories: ['rain'] },
      },
    },
    result: {
      ok: true,
      summary: 'The rendered view now shows rain.',
    },
    verification: {
      ok: true,
    },
  })

  assert.equal(result.completion.status, 'continue')
  assert.match(requests[0]?.messages?.[0]?.content || '', /Temporary Seattle Weather demo workflow/)
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

test('createNaturalLanguagePlanner instructs linked bar interactions to use selection actions', async () => {
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
  assert.match(systemPrompt, /update linked views/)
  assert.match(systemPrompt, /choose bar\.selectCategory/)
  assert.match(systemPrompt, /never for linked-view propagation/)
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

test('createNaturalLanguagePlanner prompt distinguishes bar selection language from bar filtering language', async () => {
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
  assert.match(systemPrompt, /bar\.clickCategory/i)
  assert.match(systemPrompt, /bar\.selectCategory/i)
  assert.match(systemPrompt, /bar\.filterCategories only when the user explicitly wants to keep only/i)
})

test('createNaturalLanguagePlanner prompt describes Vega-Lite param actions as semantic matches instead of fixed priority rules', async () => {
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
  assert.match(systemPrompt, /page-linked action surface for brush, overview-detail, and domain-sync semantics/i)
  assert.match(systemPrompt, /page-linked action surface for click, select, hover, and bound-parameter semantics/i)
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
