import test from 'node:test'
import assert from 'node:assert/strict'

import {
  readSelectionPrimaryView,
  readSelectionRegistry,
  readSelectionByWidgetView,
  normalizePrimarySelectionView,
  resolvePrimarySelectionEntry,
  withSelectionSubmodel,
} from './selectionStateModel.js'

test('normalizePrimarySelectionView resolves registry metadata from selectionRef-only inputs', () => {
  const registry = {
    'wl://widgetva-app/workspace/main/widget/bar_a/selection/current': {
      selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
      selectionId: 'current',
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      sourceWidgetId: 'bar_a',
      scope: 'linked',
      kind: 'point',
      summary: 'Origin: USA',
      predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
    },
  }

  assert.deepEqual(
    normalizePrimarySelectionView(
      { selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current' },
      registry,
    ),
    {
      selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
      selectionId: 'current',
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      sourceWidgetId: 'bar_a',
      summary: 'Origin: USA',
      predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
      selectionDataRef: null,
      scope: 'linked',
      kind: 'point',
    },
  )
})

test('resolvePrimarySelectionEntry prefers the explicit primary selection view over registry order', () => {
  const firstSelectionRef = 'wl://widgetva-app/workspace/main/widget/bar_a/selection/first'
  const secondSelectionRef = 'wl://widgetva-app/workspace/main/widget/line_b/selection/second'
  const shared = {
    selections: {
      registry: {
        [firstSelectionRef]: {
          selectionRef: firstSelectionRef,
          summary: 'First selection',
          predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
        },
        [secondSelectionRef]: {
          selectionRef: secondSelectionRef,
          summary: 'Second selection',
          predicates: [{ field: 'Year', op: '>=', value: 1975 }],
        },
      },
      views: {
        primary: {
          selectionRef: secondSelectionRef,
        },
        byWidget: {},
      },
    },
  }

  assert.deepEqual(resolvePrimarySelectionEntry(shared), [
    secondSelectionRef,
    {
      selectionRef: secondSelectionRef,
      selectionId: null,
      sourceWidgetRef: null,
      sourceWidgetId: null,
      summary: 'Second selection',
      predicates: [{ field: 'Year', op: '>=', value: 1975 }],
      selectionDataRef: null,
      scope: 'local',
    },
  ])
})

test('selectionStateModel falls back to legacy activeSelections and primarySelectionRef shapes', () => {
  const selectionRef = 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current'
  const shared = {
    activeSelections: {
      [selectionRef]: {
        selectionRef,
        selectionId: 'current',
        sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
        sourceWidgetId: 'bar_a',
        kind: 'point',
        summary: 'Origin: USA',
        predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
      },
    },
    primarySelectionRef: selectionRef,
  }

  assert.deepEqual(readSelectionRegistry(shared), {
    [selectionRef]: {
      selectionRef,
      selectionId: 'current',
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      sourceWidgetId: 'bar_a',
      kind: 'point',
      summary: 'Origin: USA',
      predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
    },
  })
  assert.deepEqual(readSelectionPrimaryView(shared), {
    selectionRef,
    selectionId: 'current',
    sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
    sourceWidgetId: 'bar_a',
    summary: 'Origin: USA',
    predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
    selectionDataRef: null,
    scope: 'local',
    kind: 'point',
  })
})

test('withSelectionSubmodel mirrors canonical registry into legacy shared selection fields', () => {
  const selectionRef = 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current'
  const nextShared = withSelectionSubmodel({}, {
    registry: {
      [selectionRef]: {
        selectionRef,
        selectionId: 'current',
        sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
        sourceWidgetId: 'bar_a',
        kind: 'point',
      },
    },
    primary: {
      selectionRef,
    },
  })

  assert.deepEqual(nextShared.activeSelections, nextShared.selections.registry)
  assert.equal(nextShared.primarySelectionRef, selectionRef)
})

test('readSelectionByWidgetView derives canonical per-widget views from registry when explicit view is absent', () => {
  const firstSelectionRef = 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current'
  const secondSelectionRef = 'wl://widgetva-app/workspace/main/widget/line_b/selection/current'
  const shared = {
    selections: {
      registry: {
        [firstSelectionRef]: {
          selectionRef: firstSelectionRef,
          selectionId: 'current',
          sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
          sourceWidgetId: 'bar_a',
          kind: 'point',
          summary: 'Origin: USA',
          predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
        },
        [secondSelectionRef]: {
          selectionRef: secondSelectionRef,
          selectionId: 'current',
          sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/line_b',
          sourceWidgetId: 'line_b',
          kind: 'interval',
          summary: 'Year >= 1975',
          predicates: [{ field: 'Year', op: '>=', value: 1975 }],
        },
      },
      views: {
        primary: null,
      },
    },
  }

  assert.deepEqual(readSelectionByWidgetView(shared), {
    bar_a: {
      selectionRef: firstSelectionRef,
      selectionId: 'current',
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      sourceWidgetId: 'bar_a',
      summary: 'Origin: USA',
      predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
      selectionDataRef: null,
      scope: 'local',
      kind: 'point',
    },
    line_b: {
      selectionRef: secondSelectionRef,
      selectionId: 'current',
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/line_b',
      sourceWidgetId: 'line_b',
      summary: 'Year >= 1975',
      predicates: [{ field: 'Year', op: '>=', value: 1975 }],
      selectionDataRef: null,
      scope: 'local',
      kind: 'interval',
    },
  })
})

test('withSelectionSubmodel normalizes explicit byWidget views into canonical selection views', () => {
  const selectionRef = 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current'
  const nextShared = withSelectionSubmodel({
    selections: {
      registry: {
        [selectionRef]: {
          selectionRef,
          selectionId: 'current',
          sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
          sourceWidgetId: 'bar_a',
          kind: 'point',
          summary: 'Origin: USA',
          predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
        },
      },
      views: {
        primary: null,
        byWidget: {},
      },
    },
  }, {
    byWidget: {
      bar_a: {
        selectionRef,
      },
    },
  })

  assert.deepEqual(nextShared.selections.views.byWidget, {
    bar_a: {
      selectionRef,
      selectionId: 'current',
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      sourceWidgetId: 'bar_a',
      summary: 'Origin: USA',
      predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
      selectionDataRef: null,
      scope: 'local',
      kind: 'point',
    },
  })
})
