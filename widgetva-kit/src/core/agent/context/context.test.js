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
  })

  assert.deepEqual(
    knowledge.widgetFamilies.map((family) => family.kind).sort(),
    ['bar', 'scatter'],
  )
  assert.equal(knowledge.widgetFamilies.some((family) => family.actions.some((action) => action.name === 'bar.selectCategory')), true)
  assert.equal(knowledge.widgetFamilies.some((family) => family.actions.some((action) => action.name === 'scatter.brushRegion')), true)
  assert.equal(knowledge.commonTools.perceptions.some((query) => query.name === 'perception.inspectViewConfig'), true)
  assert.deepEqual(knowledge.commonTools.actions, [])
  assert.equal('catalogs' in knowledge, false)
  assert.equal('widgets' in knowledge, false)
  assert.equal('history' in knowledge, false)
  assert.deepEqual(listWidgetFamilyActionNames(knowledge, 'bar').includes('bar.selectCategory'), true)
})

test('buildAgentKnowledge can narrow family actions to the current executable widget contract', () => {
  const knowledge = buildAgentKnowledge({
    widgetKinds: ['bar'],
    widgetActionNamesByKind: new Map([
      ['bar', new Set(['bar.selectCategory'])],
    ]),
  })

  assert.deepEqual(listWidgetFamilyActionNames(knowledge, 'bar'), ['bar.selectCategory'])
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
