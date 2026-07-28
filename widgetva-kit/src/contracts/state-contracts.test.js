import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeInteractionFeedbackState,
  makeSelectionState,
  makeTransformState,
  makeWidgetState,
  makeWorkspaceState,
} from './state-contracts.js'

test('state contracts preserve workspace-level coordination slices', () => {
  const state = makeWorkspaceState({
    replayContext: {
      runMode: 'goal_oriented',
      userIntent: 'compare cohorts',
    },
    shared: {
      viewport: {
        sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
        xDomain: [80, 160],
        yDomain: [20, 40],
      },
      focus: {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
        source: 'workspace',
      },
      highlight: {
        entries: [{
          widgetRef: 'wl://widgetva-app/workspace/main/widget/detail_b',
          widgetId: 'detail_b',
          highlightedKeys: ['USA'],
          inboundLinkIds: ['summary_highlights_detail'],
          highlightLinkIds: [],
          linkedSourceRefs: ['wl://widgetva-app/workspace/main/widget/bar_a/selection/current'],
        }],
        activeWidgetRefs: ['wl://widgetva-app/workspace/main/widget/detail_b'],
      },
    },
  })

  assert.equal(state.replayContext?.runMode, 'goal_oriented')
  assert.equal(state.shared?.viewport?.sourceWidgetRef, 'wl://widgetva-app/workspace/main/widget/scatter_a')
  assert.deepEqual(state.shared?.viewport?.xDomain, [80, 160])
  assert.equal(state.shared?.focus?.widgetId, 'bar_a')
  assert.equal(state.shared?.highlight?.entries?.[0]?.widgetId, 'detail_b')
})

test('state contracts normalize widget state nested defaults', () => {
  const state = makeWidgetState({
    data: {
      sourceDataRef: 'wl://widgetva-app/workspace/main/data/cars',
      currentDataRef: 'wl://widgetva-app/workspace/main/data/filtered_cars',
    },
    view: {
      zoom: {
        level: 2,
      },
    },
    feedback: {
      sharedSelectionSourceWidgetId: 'scatter_a',
    },
    humanInteraction: {
      mode: 'brush2d',
      actionName: 'scatter.brushRegion',
      supportsDirectManipulation: true,
    },
  })

  assert.equal(state.data?.sourceDataRef, 'wl://widgetva-app/workspace/main/data/cars')
  assert.equal(state.data?.materializedDataRef, 'wl://widgetva-app/workspace/main/data/filtered_cars')
  assert.equal(state.data?.currentDataRef, 'wl://widgetva-app/workspace/main/data/filtered_cars')
  assert.equal(state.data?.selectedCount, 0)
  assert.equal(state.view?.zoom?.level, 2)
  assert.deepEqual(state.feedback?.highlightedKeys, [])
  assert.equal(state.feedback?.sharedSelectionSourceWidgetId, 'scatter_a')
  assert.equal(state.humanInteraction?.actionName, 'scatter.brushRegion')
})

test('state contracts preserve selection, feedback, and transform metadata', () => {
  const selection = makeSelectionState({
    selectionRef: 'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush',
    selectionId: 'brush',
    kind: 'interval',
    sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    sourceWidgetId: 'scatter_a',
    scope: 'linked',
    selectionDataRef: 'wl://widgetva-app/workspace/main/data/scatter_a_selection_brush',
  })
  const feedback = makeInteractionFeedbackState({
    highlightLinkIds: ['link_highlight'],
    sharedSelectionSourceWidgetId: 'scatter_source',
  })
  const transform = makeTransformState({
    kind: 'filter',
    sourceWidgetId: 'scatter_a',
    sourceSelectionRef: 'wl://widgetva-app/workspace/main/selection/scatter_a/brush',
    linkId: 'link_filter',
  })

  assert.equal(selection.scope, 'linked')
  assert.equal(selection.selectionDataRef, 'wl://widgetva-app/workspace/main/data/scatter_a_selection_brush')
  assert.deepEqual(feedback.highlightLinkIds, ['link_highlight'])
  assert.equal(feedback.sharedSelectionSourceWidgetId, 'scatter_source')
  assert.equal(transform.sourceWidgetId, 'scatter_a')
  assert.equal(transform.sourceSelectionRef, 'wl://widgetva-app/workspace/main/selection/scatter_a/brush')
  assert.equal(transform.linkId, 'link_filter')
})

test('state contracts expose canonical point selection shape with legacy aliases', () => {
  const selection = makeSelectionState({
    selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
    selectionId: 'current',
    kind: 'point',
    sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
    field: 'Origin',
    values: ['USA'],
  })

  assert.equal(selection.ref, 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current')
  assert.equal(selection.id, 'current')
  assert.equal(selection.selectionRef, selection.ref)
  assert.equal(selection.selectionId, selection.id)
  assert.equal(selection.kind, 'point')
  assert.equal(selection.field, 'Origin')
  assert.deepEqual(selection.values, ['USA'])
})

test('state contracts expose canonical interval selection channels', () => {
  const selection = makeSelectionState({
    selectionRef: 'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush',
    selectionId: 'brush',
    kind: 'interval',
    sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    fields: ['Horsepower', 'Miles_per_Gallon'],
    domain: {
      xDomain: [70, 140],
      yDomain: [20, 35],
    },
  })

  assert.equal(selection.kind, 'interval')
  assert.deepEqual(selection.channels, {
    x: {
      field: 'Horsepower',
      domain: [70, 140],
    },
    y: {
      field: 'Miles_per_Gallon',
      domain: [20, 35],
    },
  })
})

test('state contracts expose canonical transform source and predicate', () => {
  const transform = makeTransformState({
    kind: 'filter',
    source: 'action',
    spec: {
      actionName: 'bar.filterCategories',
      field: 'Origin',
      values: ['USA'],
    },
  })

  assert.equal(transform.kind, 'filter')
  assert.equal(transform.source, 'action')
  assert.equal(transform.sourceRef, 'bar.filterCategories')
  assert.deepEqual(transform.predicate, {
    field: 'Origin',
    op: 'in',
    value: ['USA'],
  })
  assert.equal(transform.params.actionName, 'bar.filterCategories')
})
