import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAgentHistory,
  buildAgentKnowledge,
  buildAgentObservation,
  buildAgentObservationFromWorkspaceState,
  listWidgetFamilyActionNames,
} from './index.js'

test('buildAgentKnowledge returns stable widget-family descriptors without per-widget catalogs', () => {
  const knowledge = buildAgentKnowledge({
    widgetKinds: ['bar', 'scatter'],
    task: { userQuery: 'This belongs in observation, not knowledge.' },
  })

  assert.deepEqual(
    knowledge.widgetFamilies.map((family) => family.kind).sort(),
    ['bar', 'scatter'],
  )
  assert.equal(knowledge.widgetFamilies.some((family) => family.actions.some((action) => action.name === 'bar.selectCategory')), true)
  assert.equal(knowledge.widgetFamilies.some((family) => family.actions.some((action) => action.name === 'scatter.brushRegion')), true)
  assert.equal(knowledge.widgetFamilies.every((family) => family.perceptions.some((query) => query.name === 'perception.inspectViewConfig')), true)
  assert.equal(knowledge.agentGuidance.relations.scatter['scatter.brushRegion'].some((link) => link.targetState === 'bar.transform'), true)
  assert.equal(knowledge.agentGuidance.workflows.some((workflow) => workflow.name === 'aggregate_to_detail'), true)
  assert.equal(knowledge.agentGuidance.analysisToActionByFamily.bar.workflows.length > 0, true)
  assert.equal('commonTools' in knowledge, false)
  assert.deepEqual(Object.keys(knowledge), ['widgetFamilies', 'agentGuidance'])
  assert.equal('catalogs' in knowledge, false)
  assert.equal('widgets' in knowledge, false)
  assert.equal('history' in knowledge, false)
  assert.equal('task' in knowledge, false)
  assert.deepEqual(listWidgetFamilyActionNames(knowledge, 'bar').includes('bar.selectCategory'), true)
})

test('buildAgentKnowledge exposes family actions from widget kind without observation-side filtering', () => {
  const knowledge = buildAgentKnowledge({
    widgetKinds: ['bar'],
    widgetActionNamesByKind: new Map([
      ['bar', new Set(['bar.selectCategory'])],
    ]),
  })

  assert.equal(listWidgetFamilyActionNames(knowledge, 'bar').includes('bar.selectCategory'), true)
  assert.equal(listWidgetFamilyActionNames(knowledge, 'bar').includes('bar.sortBars'), true)
})

test('workspace observations expose widget identity without duplicating the capability catalog', () => {
  const observation = buildAgentObservationFromWorkspaceState({
    workspace: {
      widgets: [
        { ref: 'bar-ref', widgetId: 'bar-1', kind: 'bar', actionNames: ['widget.resetView'] },
        { ref: 'scatter-ref', widgetId: 'scatter-1', kind: 'scatter' },
      ],
    },
    state: {
      stateId: 's1',
      widgets: {},
    },
  })

  const bar = observation.state.widgets.find((widget) => widget.ref === 'bar-ref')
  const scatter = observation.state.widgets.find((widget) => widget.ref === 'scatter-ref')
  assert.equal(bar.kind, 'bar')
  assert.equal(scatter.kind, 'scatter')
  assert.equal('actionNames' in bar, false)
  assert.equal('perceptionNames' in bar, false)

  const singleObservation = buildAgentObservationFromWorkspaceState({
    workspace: { widgets: [{ ref: 'bar-ref', widgetId: 'bar-1', kind: 'bar' }] },
    state: { stateId: 's1', widgets: {} },
  })
  assert.equal('actionNames' in singleObservation.state.widgets[0], false)
  assert.equal('perceptionNames' in singleObservation.state.widgets[0], false)
})

test('buildAgentObservation keeps query state and view, including optional real image references', () => {
  const observation = buildAgentObservation({
    query: 'Inspect the chart.',
    state: {
      stateId: 's1',
      summary: 'Downtown is selected.',
      widgets: [
        { ref: 'bar-ref', kind: 'bar', recognizedKinds: ['bar'], focused: true },
      ],
      sharedAnalyticalState: {
        filters: { region: 'Downtown' },
        focus: {
          selectionSummary: 'Downtown is selected.',
        },
      },
    },
    view: {
      image: {
        ref: 'view-image:s1',
        mimeType: 'image/png',
      },
      summary: 'Downtown is selected.',
    },
  })

  assert.deepEqual(Object.keys(observation), ['query', 'state', 'view'])
  assert.equal(observation.query, 'Inspect the chart.')
  assert.deepEqual(observation.state, {
    stateId: 's1',
    summary: 'Downtown is selected.',
    widgets: [
      {
        ref: 'bar-ref',
        kind: 'bar',
        recognizedKinds: ['bar'],
        focused: true,
      },
    ],
    sharedAnalyticalState: {
      filters: { region: 'Downtown' },
      viewport: null,
      focus: {
        selectionSummary: 'Downtown is selected.',
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
  })
  assert.equal(observation.view.image.mimeType, 'image/png')
})

test('buildAgentObservationFromWorkspaceState exposes small encoded field value domains for action params', () => {
  const widgetRef = 'wl://widgetva-app/workspace/imported/widget/w_line'
  const observation = buildAgentObservationFromWorkspaceState({
    query: 'Make TechCorp stand out.',
    workspace: {
      widgets: [{
        ref: widgetRef,
        widgetId: 'w_line',
        kind: 'line',
        title: 'Stock Prices 2023',
        primaryDataRef: 'data-visible',
      }],
      dataHandles: [{
        ref: 'data-visible',
        schema: {
          fields: [
            { name: 'date', type: 'temporal' },
            { name: 'price', type: 'quantitative' },
            { name: 'company', type: 'nominal' },
          ],
        },
        stats: {
          rowCount: 4,
          visibleCount: 4,
        },
      }],
    },
    state: {
      stateId: 'imported:s1',
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'w_line',
          kind: 'line',
          data: {
            currentDataRef: 'data-visible',
          },
          encodings: {
            color: { field: 'company', type: 'nominal' },
          },
          rawSpec: {
            data: {
              values: [
                { date: '2023-01-01', price: 80, company: 'RetailInc' },
                { date: '2023-02-01', price: 78, company: 'RetailInc' },
                { date: '2023-01-01', price: 150, company: 'TechCorp' },
                { date: '2023-02-01', price: 165, company: 'TechCorp' },
              ],
            },
            mark: 'line',
          },
        },
      },
      shared: {
        focusedWidget: widgetRef,
      },
    },
  })

  assert.deepEqual(observation.state.widgets[0].data.fieldValues, {
    company: ['RetailInc', 'TechCorp'],
  })
})

test('buildAgentHistory is independent from knowledge', () => {
  const history = buildAgentHistory({
    turns: [
      {
        act: {
          kind: 'action',
          name: 'bar.selectCategory',
          target: {
            widgetRef: 'wl://widgetva-app/workspace/weather/widget/w_weather_bar',
          },
          params: {
            field: 'weather',
            values: ['snow'],
          },
          outputSummary: 'The view now focuses on snow records.',
        },
        verify: {
          ok: true,
          summary: 'The category filter was applied to the visible view.',
        },
        reason: {
          answer: 'Next, inspect the filtered snow subset.',
        },
      },
    ],
  })

  assert.deepEqual(history.turns, [
    {
      turnId: 'turn_1',
      operation: {
        kind: 'action',
        name: 'bar.selectCategory',
        target: {
          widgetRef: 'wl://widgetva-app/workspace/weather/widget/w_weather_bar',
        },
        paramsSummary: 'field=weather; values=[snow]',
      },
      status: {
        outcome: 'verified',
        resultSummary: 'The view now focuses on snow records.',
        stateSummary: 'The category filter was applied to the visible view.',
        reasonSummary: 'Next, inspect the filtered snow subset.',
      },
    },
  ])
})
