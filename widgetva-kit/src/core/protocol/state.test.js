import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeTransformStateSchema,
  describeInteractionFeedbackStateSchema,
  describeSelectionStateSchema,
  describeWidgetStateSchema,
  describeWorkspaceReplayContextSchema,
  describeWorkspaceStateSchema,
  makeInteractionFeedbackState,
  makeSelectionState,
  makeTransformState,
  makeWidgetState,
  makeWorkspaceState,
} from './state.js'

test('makeWorkspaceState preserves replayContext as a first-class state slice', () => {
  const state = makeWorkspaceState({
    replayContext: {
      runMode: 'goal_oriented',
      userIntent: 'compare cohorts',
    },
  })

  assert.equal(state.replayContext?.runMode, 'goal_oriented')
  assert.equal(state.replayContext?.userIntent, 'compare cohorts')
})

test('makeWorkspaceState preserves shared viewport as a first-class coordination slice', () => {
  const state = makeWorkspaceState({
    shared: {
      viewport: {
        sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
        xDomain: [80, 160],
        yDomain: [20, 40],
      },
    },
  })

  assert.equal(state.shared?.viewport?.sourceWidgetRef, 'wl://widgetva-app/workspace/main/widget/scatter_a')
  assert.deepEqual(state.shared?.viewport?.xDomain, [80, 160])
  assert.deepEqual(state.shared?.viewport?.yDomain, [20, 40])
})

test('makeWorkspaceState preserves shared focus and highlight slices', () => {
  const state = makeWorkspaceState({
    shared: {
      focus: {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
        source: 'workspace',
      },
      highlight: {
        entries: [{
          widgetRef: 'wl://widgetva-app/workspace/main/widget/table_b',
          widgetId: 'table_b',
          highlightedKeys: ['USA'],
          inboundLinkIds: ['summary_highlights_table'],
          highlightLinkIds: [],
          linkedSourceRefs: ['wl://widgetva-app/workspace/main/widget/bar_a/selection/current'],
        }],
        activeWidgetRefs: ['wl://widgetva-app/workspace/main/widget/table_b'],
      },
    },
  })

  assert.equal(state.shared?.focus?.widgetId, 'bar_a')
  assert.equal(state.shared?.highlight?.entries?.[0]?.widgetId, 'table_b')
})

test('describeWorkspaceReplayContextSchema admits runtime replay fields', () => {
  const schema = describeWorkspaceReplayContextSchema()

  assert.equal(schema.properties?.baselineSpec?.type?.[0], 'object')
  assert.equal(schema.properties?.planningRequest?.type?.[0], 'object')
  assert.equal(schema.properties?.runMode?.type?.[0], 'string')
  assert.equal(schema.properties?.userIntent?.type?.[0], 'string')
})

test('describeWorkspaceStateSchema admits replayContext', () => {
  const schema = describeWorkspaceStateSchema()

  assert.equal(schema.properties?.replayContext?.anyOf?.[0]?.type, 'object')
  assert.equal(schema.properties?.replayContext?.anyOf?.[0]?.properties?.runMode?.type?.[0], 'string')
})

test('describeWorkspaceStateSchema admits shared viewport metadata', () => {
  const schema = describeWorkspaceStateSchema()

  assert.equal(schema.properties?.shared?.properties?.viewport?.anyOf?.[0]?.type, 'object')
  assert.equal(schema.properties?.shared?.properties?.viewport?.anyOf?.[0]?.properties?.sourceWidgetRef?.type?.[0], 'string')
  assert.equal(schema.properties?.shared?.properties?.viewport?.anyOf?.[0]?.properties?.xDomain?.anyOf?.[0]?.items?.anyOf?.[0]?.type, 'number')
})

test('describeWorkspaceStateSchema admits shared focus and highlight metadata', () => {
  const schema = describeWorkspaceStateSchema()

  assert.equal(schema.properties?.shared?.properties?.focus?.anyOf?.[0]?.properties?.widgetRef?.type?.[0], 'string')
  assert.equal(schema.properties?.shared?.properties?.highlight?.anyOf?.[0]?.properties?.entries?.items?.properties?.widgetId?.type?.[0], 'string')
})

test('makeInteractionFeedbackState preserves richer coordination feedback fields', () => {
  const feedback = makeInteractionFeedbackState({
    highlightLinkIds: ['link_highlight'],
    sharedSelectionSourceWidgetId: 'scatter_source',
  })

  assert.deepEqual(feedback.highlightLinkIds, ['link_highlight'])
  assert.equal(feedback.sharedSelectionSourceWidgetId, 'scatter_source')
})

test('makeSelectionState preserves canonical coordination metadata for shared selection state', () => {
  const selection = makeSelectionState({
    selectionRef: 'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush',
    selectionId: 'brush',
    kind: 'interval',
    sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    sourceWidgetId: 'scatter_a',
    scope: 'linked',
    selectionDataRef: 'wl://widgetva-app/workspace/main/data/scatter_a_selection_brush',
  })

  assert.equal(selection.selectionRef, 'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush')
  assert.equal(selection.selectionId, 'brush')
  assert.equal(selection.sourceWidgetRef, 'wl://widgetva-app/workspace/main/widget/scatter_a')
  assert.equal(selection.sourceWidgetId, 'scatter_a')
  assert.equal(selection.scope, 'linked')
  assert.equal(selection.selectionDataRef, 'wl://widgetva-app/workspace/main/data/scatter_a_selection_brush')
})

test('describeSelectionStateSchema admits canonical coordination metadata fields', () => {
  const schema = describeSelectionStateSchema()

  assert.equal(schema.properties?.selectionRef?.type?.[0], 'string')
  assert.equal(schema.properties?.selectionId?.type?.[0], 'string')
  assert.equal(schema.properties?.sourceWidgetRef?.type?.[0], 'string')
  assert.equal(schema.properties?.sourceWidgetId?.type?.[0], 'string')
  assert.equal(schema.properties?.scope?.type, 'string')
  assert.equal(schema.properties?.selectionDataRef?.type?.[0], 'string')
})

test('describeInteractionFeedbackStateSchema admits richer coordination feedback fields', () => {
  const schema = describeInteractionFeedbackStateSchema()

  assert.equal(schema.properties?.highlightLinkIds?.items?.type, 'string')
  assert.equal(schema.properties?.sharedSelectionSourceWidgetId?.type?.[0], 'string')
})

test('makeWidgetState preserves humanInteraction as a widget-state field', () => {
  const state = makeWidgetState({
    humanInteraction: {
      mode: 'brush2d',
      actionName: 'scatter.brushRegion',
      supportsDirectManipulation: true,
    },
  })

  assert.equal(state.humanInteraction?.mode, 'brush2d')
  assert.equal(state.humanInteraction?.actionName, 'scatter.brushRegion')
})

test('makeWidgetState normalizes nested data, view, and feedback fields without letting raw state overwrite defaults', () => {
  const state = makeWidgetState({
    data: {
      sourceDataRef: 'wl://widgetva-app/workspace/main/data/cars',
    },
    view: {
      zoom: {
        level: 2,
      },
    },
    feedback: {
      sharedSelectionSourceWidgetId: 'scatter_a',
    },
  })

  assert.equal(state.data?.sourceDataRef, 'wl://widgetva-app/workspace/main/data/cars')
  assert.equal(state.data?.currentDataRef, null)
  assert.equal(state.data?.selectedCount, 0)
  assert.equal(state.view?.zoom?.level, 2)
  assert.deepEqual(state.feedback?.highlightedKeys, [])
  assert.equal(state.feedback?.sharedSelectionSourceWidgetId, 'scatter_a')
})

test('describeWidgetStateSchema admits humanInteraction', () => {
  const schema = describeWidgetStateSchema()

  assert.equal(schema.properties?.humanInteraction?.anyOf?.[0]?.type, 'object')
  assert.equal(schema.properties?.humanInteraction?.anyOf?.[0]?.properties?.mode?.type, 'string')
})

test('describeWidgetStateSchema admits zoom center and level in view metadata', () => {
  const schema = describeWidgetStateSchema()

  assert.equal(schema.properties?.view?.properties?.zoom?.anyOf?.[0]?.properties?.level?.type, 'number')
  assert.equal(schema.properties?.view?.properties?.zoom?.anyOf?.[0]?.properties?.center?.items?.type, 'number')
})

test('makeTransformState preserves runtime transform provenance fields', () => {
  const transform = makeTransformState({
    kind: 'filter',
    source: 'wl://widgetva-app/workspace/main/selection/scatter_a/brush',
    sourceWidgetId: 'scatter_a',
    sourceSelectionRef: 'wl://widgetva-app/workspace/main/selection/scatter_a/brush',
    linkId: 'link_filter',
    spec: {
      linkRef: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
    },
  })

  assert.equal(transform.sourceWidgetId, 'scatter_a')
  assert.equal(transform.sourceSelectionRef, 'wl://widgetva-app/workspace/main/selection/scatter_a/brush')
  assert.equal(transform.linkId, 'link_filter')
})

test('describeTransformStateSchema admits runtime transform provenance fields', () => {
  const schema = describeTransformStateSchema()

  assert.equal(schema.properties?.sourceWidgetId?.type?.[0], 'string')
  assert.equal(schema.properties?.sourceSelectionRef?.type?.[0], 'string')
  assert.equal(schema.properties?.linkId?.type?.[0], 'string')
})
