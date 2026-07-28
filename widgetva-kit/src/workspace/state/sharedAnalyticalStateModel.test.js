import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSharedAnalyticalStateModel,
  readActiveAnalyticalContext,
  readSharedFilterContext,
  readSharedSemanticFocus,
  readSharedStructuralContext,
  readSharedTransformationContext,
  readSharedViewContext,
  readSharedViewportContext,
  readViewStatesByWidget,
} from './sharedAnalyticalStateModel.js'

test('buildSharedAnalyticalStateModel organizes workspace-shared context into filter, viewport, semantic, and structural categories', () => {
  const state = {
    widgets: {
      'wl://widgetva-app/workspace/main/widget/bar_a': {
        ref: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
        view: {
          xDomain: [0, 10],
          yDomain: [5, 15],
          zoom: {
            center: [5, 10],
            level: 2,
          },
          sort: {
            field: 'value',
            order: 'descending',
          },
        },
      },
      'wl://widgetva-app/workspace/main/widget/line_b': {
        ref: 'wl://widgetva-app/workspace/main/widget/line_b',
        widgetId: 'line_b',
        view: {
          reencode: {
            mode: 'stackMode',
            layout: 'normalized',
          },
          drillDown: {
            axis: 'x',
            active: true,
            level: 'month',
            targetField: 'date',
          },
        },
      },
    },
    shared: {
      focusedWidget: 'wl://widgetva-app/workspace/main/widget/bar_a',
      globalFilters: {
        origin: 'USA',
      },
      focus: {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
        source: 'workspace',
      },
      viewport: {
        sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
        xDomain: [0, 10],
        yDomain: [5, 15],
      },
      comparisonTargets: ['wl://widgetva-app/workspace/main/widget/bar_b'],
      selections: {
        registry: {
          'wl://widgetva-app/workspace/main/widget/bar_a/selection/current': {
            selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
            sourceWidgetId: 'bar_a',
            sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
            summary: 'Origin: USA',
            predicates: [{ field: 'origin', op: 'equals', value: 'USA' }],
          },
        },
        views: {
          primary: {
            selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
            sourceWidgetId: 'bar_a',
            sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
            summary: 'Origin: USA',
            predicates: [{ field: 'origin', op: 'equals', value: 'USA' }],
          },
          byWidget: {},
        },
      },
      highlight: {
        entries: [
          {
            widgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
            summary: 'Origin: USA',
            predicates: [{ field: 'origin', op: 'equals', value: 'USA' }],
          },
        ],
        activeWidgetRefs: ['wl://widgetva-app/workspace/main/widget/bar_a'],
      },
      links: {
        definitions: [{ ref: 'link_1' }],
        topology: { topology: 'T2' },
      },
    },
  }

  const sharedState = buildSharedAnalyticalStateModel(state, {
    derivedTopology: { topology: 'T1' },
  })

  assert.deepEqual(sharedState.sharedFilterContext, {
    globalFilters: {
      origin: 'USA',
    },
    selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
    selectionPredicates: [{ field: 'origin', op: 'equals', value: 'USA' }],
  })
  assert.deepEqual(sharedState.sharedViewportContext, {
    focusedWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
    viewport: {
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      xDomain: [0, 10],
      yDomain: [5, 15],
      zoom: null,
    },
    comparisonTargets: ['wl://widgetva-app/workspace/main/widget/bar_b'],
  })
  assert.equal(sharedState.sharedSemanticFocus.focusedWidgetRef, 'wl://widgetva-app/workspace/main/widget/bar_a')
  assert.equal(sharedState.sharedSemanticFocus.primarySelection.summary, 'Origin: USA')
  assert.deepEqual(sharedState.sharedSemanticFocus.highlight.activeWidgetRefs, [
    'wl://widgetva-app/workspace/main/widget/bar_a',
  ])
  assert.deepEqual(sharedState.viewStatesByWidget, {
    'wl://widgetva-app/workspace/main/widget/bar_a': {
      widgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      widgetId: 'bar_a',
      activeKinds: ['zoom', 'sort'],
      operationModesByKind: {
        zoom: 'zoom',
        sort: 'sort',
      },
      xDomain: [0, 10],
      yDomain: [5, 15],
      zoom: {
        center: [5, 10],
        level: 2,
      },
      sort: {
        field: 'value',
        order: 'descending',
      },
    },
    'wl://widgetva-app/workspace/main/widget/line_b': {
      widgetRef: 'wl://widgetva-app/workspace/main/widget/line_b',
      widgetId: 'line_b',
      activeKinds: ['drillDown', 'reencode'],
      operationModesByKind: {
        drillDown: 'drillDown',
        reencode: 'stackMode',
      },
      drillDown: {
        axis: 'x',
        active: true,
        level: 'month',
        targetField: 'date',
      },
      reencode: {
        mode: 'stackMode',
        layout: 'normalized',
      },
    },
  })
  assert.deepEqual(sharedState.sharedViewContext, {
    activeWidgetRefs: [
      'wl://widgetva-app/workspace/main/widget/bar_a',
      'wl://widgetva-app/workspace/main/widget/line_b',
    ],
    widgets: {
      'wl://widgetva-app/workspace/main/widget/bar_a': {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
        activeKinds: ['zoom', 'sort'],
        operationModesByKind: {
          zoom: 'zoom',
          sort: 'sort',
        },
        xDomain: [0, 10],
        yDomain: [5, 15],
        zoom: {
          center: [5, 10],
          level: 2,
        },
        sort: {
          field: 'value',
          order: 'descending',
        },
      },
      'wl://widgetva-app/workspace/main/widget/line_b': {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/line_b',
        widgetId: 'line_b',
        activeKinds: ['drillDown', 'reencode'],
        operationModesByKind: {
          drillDown: 'drillDown',
          reencode: 'stackMode',
        },
        drillDown: {
          axis: 'x',
          active: true,
          level: 'month',
          targetField: 'date',
        },
        reencode: {
          mode: 'stackMode',
          layout: 'normalized',
        },
      },
    },
  })
  assert.deepEqual(sharedState.sharedTransformationContext, {
    activeWidgetRefs: [
      'wl://widgetva-app/workspace/main/widget/bar_a',
      'wl://widgetva-app/workspace/main/widget/line_b',
    ],
    widgets: {
      'wl://widgetva-app/workspace/main/widget/bar_a': {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
        activeKinds: ['sort'],
        operationModesByKind: {
          sort: 'sort',
        },
        sort: {
          field: 'value',
          order: 'descending',
        },
      },
      'wl://widgetva-app/workspace/main/widget/line_b': {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/line_b',
        widgetId: 'line_b',
        activeKinds: ['drillDown', 'reencode'],
        operationModesByKind: {
          drillDown: 'drillDown',
          reencode: 'stackMode',
        },
        drillDown: {
          axis: 'x',
          active: true,
          level: 'month',
          targetField: 'date',
        },
        reencode: {
          mode: 'stackMode',
          layout: 'normalized',
        },
      },
    },
  })
  assert.deepEqual(sharedState.activeAnalyticalContext, {
    activeContextKinds: ['focus', 'filters', 'selection', 'highlight', 'viewport', 'view', 'structure'],
    focusedWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
    globalFilters: {
      origin: 'USA',
    },
    primarySelection: {
      selectionRef: 'wl://widgetva-app/workspace/main/widget/bar_a/selection/current',
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      sourceWidgetId: 'bar_a',
      summary: 'Origin: USA',
      predicates: [{ field: 'origin', op: 'equals', value: 'USA' }],
      kind: null,
      scope: 'local',
    },
    highlight: {
      activeWidgetRefs: ['wl://widgetva-app/workspace/main/widget/bar_a'],
      summaries: ['Origin: USA'],
    },
    viewport: {
      sourceWidgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
      xDomain: [0, 10],
      yDomain: [5, 15],
      zoom: null,
    },
    comparisonTargets: ['wl://widgetva-app/workspace/main/widget/bar_b'],
    structure: {
      linkCount: 1,
    },
    transformationContext: {
      activeWidgetRefs: [
        'wl://widgetva-app/workspace/main/widget/bar_a',
        'wl://widgetva-app/workspace/main/widget/line_b',
      ],
      widgets: {
        'wl://widgetva-app/workspace/main/widget/bar_a': {
          widgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
          widgetId: 'bar_a',
          activeKinds: ['sort'],
          operationModesByKind: {
            sort: 'sort',
          },
          sort: {
            field: 'value',
            order: 'descending',
          },
        },
        'wl://widgetva-app/workspace/main/widget/line_b': {
          widgetRef: 'wl://widgetva-app/workspace/main/widget/line_b',
          widgetId: 'line_b',
          activeKinds: ['drillDown', 'reencode'],
          operationModesByKind: {
            drillDown: 'drillDown',
            reencode: 'stackMode',
          },
          drillDown: {
            axis: 'x',
            active: true,
            level: 'month',
            targetField: 'date',
          },
          reencode: {
            mode: 'stackMode',
            layout: 'normalized',
          },
        },
      },
    },
    viewStatesByWidget: {
      'wl://widgetva-app/workspace/main/widget/bar_a': {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/bar_a',
        widgetId: 'bar_a',
        activeKinds: ['zoom', 'sort'],
        operationModesByKind: {
          zoom: 'zoom',
          sort: 'sort',
        },
        xDomain: [0, 10],
        yDomain: [5, 15],
        zoom: {
          center: [5, 10],
          level: 2,
        },
        sort: {
          field: 'value',
          order: 'descending',
        },
      },
      'wl://widgetva-app/workspace/main/widget/line_b': {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/line_b',
        widgetId: 'line_b',
        activeKinds: ['drillDown', 'reencode'],
        operationModesByKind: {
          drillDown: 'drillDown',
          reencode: 'stackMode',
        },
        drillDown: {
          axis: 'x',
          active: true,
          level: 'month',
          targetField: 'date',
        },
        reencode: {
          mode: 'stackMode',
          layout: 'normalized',
        },
      },
    },
  })
  assert.deepEqual(sharedState.sharedStructuralContext, {
    links: {
      definitions: [{ ref: 'link_1' }],
      topology: { topology: 'T2' },
    },
    comparisonTargets: ['wl://widgetva-app/workspace/main/widget/bar_b'],
  })
})

test('buildSharedAnalyticalStateModel preserves concrete transformation operation modes for shared analytical context', () => {
  const state = {
    widgets: {
      'wl://widgetva-app/workspace/main/widget/sankey_c': {
        ref: 'wl://widgetva-app/workspace/main/widget/sankey_c',
        widgetId: 'sankey_c',
        view: {
          aggregate: {
            mode: 'collapseNodes',
            aggregateName: 'Other Sources',
          },
          navigate: {
            mode: 'expandNode',
            sourceAction: 'sankey.expandNode',
            aggregateName: 'Other Sources',
          },
          reencode: {
            mode: 'reorderNodesInLayer',
            depth: 1,
            order: ['A', 'B', 'C'],
          },
        },
      },
    },
    shared: {},
  }

  const sharedState = buildSharedAnalyticalStateModel(state)

  assert.deepEqual(
    sharedState.viewStatesByWidget['wl://widgetva-app/workspace/main/widget/sankey_c']?.operationModesByKind,
    {
      aggregate: 'collapseNodes',
      reencode: 'reorderNodesInLayer',
      navigate: 'expandNode',
    },
  )
  assert.deepEqual(
    sharedState.sharedTransformationContext.widgets['wl://widgetva-app/workspace/main/widget/sankey_c']?.operationModesByKind,
    {
      aggregate: 'collapseNodes',
      reencode: 'reorderNodesInLayer',
      navigate: 'expandNode',
    },
  )
})

test('shared analytical read helpers expose canonical projection defaults from workspace state', () => {
  const state = {
    widgets: {},
    shared: {
      links: {
        definitions: [],
        topology: {},
      },
    },
  }

  assert.deepEqual(readSharedFilterContext(state), {
    globalFilters: {},
    selectionRef: null,
    selectionPredicates: [],
  })
  assert.deepEqual(readSharedViewportContext(state), {
    focusedWidgetRef: null,
    viewport: null,
    comparisonTargets: [],
  })
  assert.deepEqual(readSharedSemanticFocus(state), {
    focusedWidgetRef: null,
    focus: null,
    primarySelection: null,
    highlight: {
      entries: [],
      activeWidgetRefs: [],
    },
  })
  assert.deepEqual(readSharedStructuralContext(state, {
    derivedTopology: { topology: 'T1', edgeCount: 0 },
  }), {
    links: {
      definitions: [],
      topology: { topology: 'T1', edgeCount: 0 },
    },
    comparisonTargets: [],
  })
  assert.deepEqual(readActiveAnalyticalContext(state), {
    activeContextKinds: [],
    focusedWidgetRef: null,
    globalFilters: null,
    primarySelection: null,
    highlight: null,
    viewport: null,
    comparisonTargets: null,
    structure: {
      linkCount: 0,
    },
    transformationContext: {
      activeWidgetRefs: [],
      widgets: {},
    },
    viewStatesByWidget: null,
  })
  assert.deepEqual(readViewStatesByWidget(state), {})
  assert.deepEqual(readSharedViewContext(state), {
    activeWidgetRefs: [],
    widgets: {},
  })
  assert.deepEqual(readSharedTransformationContext(state), {
    activeWidgetRefs: [],
    widgets: {},
  })
})
