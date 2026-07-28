import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeSelectionRef,
  makeSelectionScopedDataRef,
  makeWidgetRef,
} from '../../contracts/refs-contracts.js'
import { makeWorkspaceState } from '../../contracts/state-contracts.js'
import { WidgetVARuntimeStore } from './RuntimeStore.js'
import { PerceptionExecutor } from './PerceptionExecutor.js'

test('PerceptionExecutor handler context.describeContract exposes the shared context summary contract', () => {
  const contract = new PerceptionExecutor().describeContext()

  assert.equal(Array.isArray(contract.methods), true)
  assert.equal(contract.methods.includes('recordQuery'), true)
  assert.equal(contract.capabilities.selectionScopedQueries, true)
  assert.equal(contract.integrations.traceRecorder, true)
})

test('PerceptionExecutor handler context.resolveRowsForWidget honors selection-scoped data from selectionRef', () => {
  const store = new WidgetVARuntimeStore()
  const widgetRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/scatter_a_visible'
  const selectionRef = makeSelectionRef({ widgetId: 'scatter_a', selectionId: 'region_a' })
  const selectionScopedDataRef = makeSelectionScopedDataRef({ widgetId: 'scatter_a', selectionId: 'region_a' })

  store.replaceWorkspace({
    description: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      widgets: [
        {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          title: 'Scatter A',
          primaryDataRef: visibleDataRef,
        },
      ],
      dataHandles: [
        { ref: visibleDataRef, title: 'Visible Data' },
        { ref: selectionScopedDataRef, title: 'Selection region_a Data' },
      ],
      links: [],
      actions: [],
      perceptionQueries: [],
    },
    state: makeWorkspaceState({
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: {
            sourceDataRef: visibleDataRef,
            currentDataRef: visibleDataRef,
          },
          encodings: {},
          transforms: [],
          view: {},
          selections: {
            [selectionRef]: {
              kind: 'point',
              predicates: [{ field: 'region', op: 'equals', value: 'west' }],
            },
          },
        },
      },
      shared: {
        activeSelections: {
          [selectionRef]: {
            kind: 'point',
            predicates: [{ field: 'region', op: 'equals', value: 'west' }],
          },
        },
        focusedWidget: widgetRef,
      },
    }),
    runtimeData: {
      [visibleDataRef]: {
        ref: visibleDataRef,
        rows: [
          { id: 1, region: 'west' },
          { id: 2, region: 'east' },
        ],
        widgetRef,
      },
      [selectionScopedDataRef]: {
        ref: selectionScopedDataRef,
        rows: [{ id: 1, region: 'west' }],
        widgetRef,
        sourceSelectionRef: selectionRef,
        kind: 'selectionData',
        scope: 'selection',
      },
    },
  })

  const ctx = new PerceptionExecutor({
    store,
  }).createContext({
      name: 'perception.inspectVisibleRows',
      targetRef: widgetRef,
      params: {
        selectionRef,
      },
    })

  const targetWidget = ctx.requireTargetWidget()
  const result = ctx.resolveRowsForWidget(targetWidget, { selectionRef })

  assert.equal(result.dataRef, selectionScopedDataRef)
  assert.deepEqual(result.rows, [{ id: 1, region: 'west' }])
})

test('PerceptionExecutor handler context.resolveRowsForWidget falls back to the active primary selection for the target widget when selectionRef is omitted', () => {
  const store = new WidgetVARuntimeStore()
  const widgetRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/scatter_a_visible'
  const selectionRef = makeSelectionRef({ widgetId: 'scatter_a', selectionId: 'region_a' })
  const selectionScopedDataRef = makeSelectionScopedDataRef({ widgetId: 'scatter_a', selectionId: 'region_a' })

  store.replaceWorkspace({
    description: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      widgets: [
        {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          title: 'Scatter A',
          primaryDataRef: visibleDataRef,
        },
      ],
      dataHandles: [
        { ref: visibleDataRef, title: 'Visible Data' },
        { ref: selectionScopedDataRef, title: 'Selection region_a Data' },
      ],
      links: [],
      actions: [],
      perceptionQueries: [],
    },
    state: makeWorkspaceState({
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: {
            sourceDataRef: visibleDataRef,
            currentDataRef: visibleDataRef,
          },
          encodings: {},
          transforms: [],
          view: {},
          selections: {
            [selectionRef]: {
              kind: 'interval',
              predicates: [{ field: 'region', op: 'equals', value: 'west' }],
            },
          },
        },
      },
      shared: {
        focusedWidget: widgetRef,
        selections: {
          registry: {
            [selectionRef]: {
              kind: 'interval',
              predicates: [{ field: 'region', op: 'equals', value: 'west' }],
            },
          },
          views: {
            primary: {
              selectionRef,
              sourceWidgetRef: widgetRef,
            },
            byWidget: {
              scatter_a: {
                selectionRef,
                sourceWidgetRef: widgetRef,
              },
            },
          },
        },
      },
    }),
    runtimeData: {
      [visibleDataRef]: {
        ref: visibleDataRef,
        rows: [
          { id: 1, region: 'west' },
          { id: 2, region: 'east' },
        ],
        widgetRef,
      },
      [selectionScopedDataRef]: {
        ref: selectionScopedDataRef,
        rows: [{ id: 1, region: 'west' }],
        widgetRef,
        sourceSelectionRef: selectionRef,
        kind: 'selectionData',
        scope: 'selection',
      },
    },
  })

  const ctx = new PerceptionExecutor({
    store,
  }).createContext({
      name: 'perception.computeCorrelation',
      targetRef: widgetRef,
      params: {
        xField: 'Horsepower',
        yField: 'Miles_per_Gallon',
      },
    })

  const targetWidget = ctx.requireTargetWidget()
  const result = ctx.resolveRowsForWidget(targetWidget, {
    xField: 'Horsepower',
    yField: 'Miles_per_Gallon',
  })

  assert.equal(result.dataRef, selectionScopedDataRef)
  assert.deepEqual(result.rows, [{ id: 1, region: 'west' }])
})

test('PerceptionExecutor handler context.resolveRowsForWidget can reuse the primary child selection when queryScope targets a custom composite root', () => {
  const store = new WidgetVARuntimeStore()
  const rootWidgetRef = makeWidgetRef({ widgetId: 'custom_root' })
  const sankeyWidgetRef = makeWidgetRef({ widgetId: 'sankey_a' })
  const rootVisibleDataRef = 'wl://widgetva-app/workspace/main/data/custom_root_visible'
  const sankeyVisibleDataRef = 'wl://widgetva-app/workspace/main/data/sankey_a_visible'
  const selectionRef = makeSelectionRef({ widgetId: 'sankey_a', selectionId: 'flow_a' })
  const selectionScopedDataRef = makeSelectionScopedDataRef({ widgetId: 'sankey_a', selectionId: 'flow_a' })

  store.replaceWorkspace({
    description: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      widgets: [
        {
          ref: rootWidgetRef,
          widgetId: 'custom_root',
          kind: 'custom',
          recognizedKinds: ['sankey', 'bar'],
          title: 'Composite Root',
          primaryDataRef: rootVisibleDataRef,
        },
        {
          ref: sankeyWidgetRef,
          widgetId: 'sankey_a',
          kind: 'sankey',
          title: 'Sankey A',
          primaryDataRef: sankeyVisibleDataRef,
        },
      ],
      dataHandles: [
        { ref: rootVisibleDataRef, title: 'Composite Visible Data' },
        { ref: sankeyVisibleDataRef, title: 'Sankey Visible Data' },
        { ref: selectionScopedDataRef, title: 'Sankey Selection Data' },
      ],
      links: [],
      actions: [],
      perceptionQueries: [],
    },
    state: makeWorkspaceState({
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [rootWidgetRef]: {
          ref: rootWidgetRef,
          widgetId: 'custom_root',
          kind: 'custom',
          recognizedKinds: ['sankey', 'bar'],
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: {
            sourceDataRef: rootVisibleDataRef,
            currentDataRef: rootVisibleDataRef,
          },
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
        },
        [sankeyWidgetRef]: {
          ref: sankeyWidgetRef,
          widgetId: 'sankey_a',
          kind: 'sankey',
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: {
            sourceDataRef: sankeyVisibleDataRef,
            currentDataRef: sankeyVisibleDataRef,
          },
          encodings: {},
          transforms: [],
          view: {},
          selections: {
            [selectionRef]: {
              kind: 'point',
              predicates: [{ field: 'source', op: 'in', value: ['A'] }],
            },
          },
        },
      },
      shared: {
        focusedWidget: sankeyWidgetRef,
        selections: {
          registry: {
            [selectionRef]: {
              kind: 'point',
              predicates: [{ field: 'source', op: 'in', value: ['A'] }],
            },
          },
          views: {
            primary: {
              selectionRef,
              sourceWidgetRef: sankeyWidgetRef,
            },
            byWidget: {
              sankey_a: {
                selectionRef,
                sourceWidgetRef: sankeyWidgetRef,
              },
            },
          },
        },
      },
    }),
    runtimeData: {
      [rootVisibleDataRef]: {
        ref: rootVisibleDataRef,
        rows: [],
        widgetRef: rootWidgetRef,
      },
      [sankeyVisibleDataRef]: {
        ref: sankeyVisibleDataRef,
        rows: [
          { source: 'A', target: 'B', value: 5 },
          { source: 'A', target: 'C', value: 3 },
          { source: 'B', target: 'D', value: 2 },
        ],
        widgetRef: sankeyWidgetRef,
      },
      [selectionScopedDataRef]: {
        ref: selectionScopedDataRef,
        rows: [
          { source: 'A', target: 'B', value: 5 },
          { source: 'A', target: 'C', value: 3 },
        ],
        widgetRef: sankeyWidgetRef,
        sourceSelectionRef: selectionRef,
        kind: 'selectionData',
        scope: 'selection',
      },
    },
  })

  const ctx = new PerceptionExecutor({
    store,
  }).createContext({
      name: 'perception.summarizeVisible',
      params: {
        queryScope: {
          widgetRef: rootWidgetRef,
        },
      },
    })

  const targetWidget = ctx.requireTargetWidget({ targetRef: rootWidgetRef })
  const result = ctx.resolveRowsForWidget(targetWidget, {
    queryScope: {
      widgetRef: rootWidgetRef,
    },
  })

  assert.equal(result.dataRef, selectionScopedDataRef)
  assert.deepEqual(result.rows, [
    { source: 'A', target: 'B', value: 5 },
    { source: 'A', target: 'C', value: 3 },
  ])
})

test('PerceptionExecutor handler context supports plain RuntimeStore record facades for manual assembly', () => {
  const widgetRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/scatter_a_visible'
  const selectionRef = makeSelectionRef({ widgetId: 'scatter_a', selectionId: 'region_a' })
  const selectionScopedDataRef = makeSelectionScopedDataRef({ widgetId: 'scatter_a', selectionId: 'region_a' })

  const ctx = new PerceptionExecutor({
    store: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      descriptions: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          title: 'Scatter A',
          primaryDataRef: visibleDataRef,
        },
      },
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 1,
          data: {
            sourceDataRef: visibleDataRef,
            currentDataRef: visibleDataRef,
          },
          selections: {
            [selectionRef]: {
              kind: 'point',
              predicates: [{ field: 'region', op: 'equals', value: 'west' }],
            },
          },
        },
      },
      dataHandles: {
        [visibleDataRef]: { ref: visibleDataRef, title: 'Visible Data' },
        [selectionScopedDataRef]: { ref: selectionScopedDataRef, title: 'Selection region_a Data' },
      },
      links: {},
      actions: {},
      perceptionQueries: {},
      interactionTrace: [],
      stateId: 'main:s1',
      version: 1,
      shared: {
        activeSelections: {
          [selectionRef]: {
            kind: 'point',
            predicates: [{ field: 'region', op: 'equals', value: 'west' }],
          },
        },
        focusedWidget: widgetRef,
      },
      runtimeData: {
        [visibleDataRef]: {
          ref: visibleDataRef,
          rows: [
            { id: 1, region: 'west' },
            { id: 2, region: 'east' },
          ],
          widgetRef,
        },
        [selectionScopedDataRef]: {
          ref: selectionScopedDataRef,
          rows: [{ id: 1, region: 'west' }],
          widgetRef,
          sourceSelectionRef: selectionRef,
          kind: 'selectionData',
          scope: 'selection',
        },
      },
    },
  }).createContext({
      name: 'perception.inspectVisibleRows',
      targetRef: widgetRef,
      params: {
        selectionRef,
      },
    })

  const targetWidget = ctx.requireTargetWidget()
  const result = ctx.resolveRowsForWidget(targetWidget, { selectionRef })

  assert.equal(targetWidget.ref, widgetRef)
  assert.equal(result.dataRef, selectionScopedDataRef)
  assert.deepEqual(result.rows, [{ id: 1, region: 'west' }])
})

test('PerceptionExecutor handler context prefers host bridge focused widget and selection registry when available', () => {
  const store = new WidgetVARuntimeStore()
  const scatterRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const barRef = makeWidgetRef({ widgetId: 'bar_b' })
  const scatterDataRef = 'wl://widgetva-app/workspace/main/data/scatter_a_visible'
  const barDataRef = 'wl://widgetva-app/workspace/main/data/bar_b_visible'
  const selectionRef = makeSelectionRef({ widgetId: 'bar_b', selectionId: 'region_b' })

  store.replaceWorkspace({
    description: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      widgets: [
        { ref: scatterRef, widgetId: 'scatter_a', kind: 'scatter', title: 'Scatter A', primaryDataRef: scatterDataRef },
        { ref: barRef, widgetId: 'bar_b', kind: 'bar', title: 'Bar B', primaryDataRef: barDataRef },
      ],
      dataHandles: [
        { ref: scatterDataRef, title: 'Scatter Visible Data' },
        { ref: barDataRef, title: 'Bar Visible Data' },
      ],
      links: [],
      actions: [],
      perceptionQueries: [],
    },
    state: makeWorkspaceState({
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [scatterRef]: {
          ref: scatterRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { sourceDataRef: scatterDataRef, currentDataRef: scatterDataRef },
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
        },
        [barRef]: {
          ref: barRef,
          widgetId: 'bar_b',
          kind: 'bar',
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { sourceDataRef: barDataRef, currentDataRef: barDataRef },
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
        },
      },
      shared: {
        focusedWidget: scatterRef,
      },
    }),
    runtimeData: {
      [scatterDataRef]: {
        ref: scatterDataRef,
        rows: [{ id: 1, region: 'west' }],
        widgetRef: scatterRef,
      },
      [barDataRef]: {
        ref: barDataRef,
        rows: [
          { id: 2, region: 'north' },
          { id: 3, region: 'south' },
        ],
        widgetRef: barRef,
      },
    },
  })

  const ctx = new PerceptionExecutor({
    store,
    hostBridge: {
      readFocusedWidgetRef: () => barRef,
      readSelectionRegistry: () => ({
        [selectionRef]: {
          kind: 'point',
          predicates: [{ field: 'region', op: 'equals', value: 'north' }],
        },
      }),
    },
  }).createContext({
      name: 'perception.findExtremes',
      params: {
        selectionRef,
      },
    })

  const targetWidget = ctx.requireTargetWidget({ kind: 'bar' })
  const result = ctx.resolveRowsForWidget(targetWidget, { selectionRef })

  assert.equal(targetWidget.ref, barRef)
  assert.deepEqual(result.rows, [{ id: 2, region: 'north' }])
})

test('PerceptionExecutor handler context falls back to host focus/highlight state when focusedWidgetRef is not provided', () => {
  const store = new WidgetVARuntimeStore()
  const scatterRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const barRef = makeWidgetRef({ widgetId: 'bar_b' })
  const scatterDataRef = 'wl://widgetva-app/workspace/main/data/scatter_a_visible'
  const barDataRef = 'wl://widgetva-app/workspace/main/data/bar_b_visible'

  store.replaceWorkspace({
    description: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      widgets: [
        { ref: scatterRef, widgetId: 'scatter_a', kind: 'scatter', title: 'Scatter A', primaryDataRef: scatterDataRef },
        { ref: barRef, widgetId: 'bar_b', kind: 'bar', title: 'Bar B', primaryDataRef: barDataRef },
      ],
      dataHandles: [
        { ref: scatterDataRef, title: 'Scatter Visible Data' },
        { ref: barDataRef, title: 'Bar Visible Data' },
      ],
      links: [],
      actions: [],
      perceptionQueries: [],
    },
    state: makeWorkspaceState({
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [scatterRef]: {
          ref: scatterRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { sourceDataRef: scatterDataRef, currentDataRef: scatterDataRef },
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
        },
        [barRef]: {
          ref: barRef,
          widgetId: 'bar_b',
          kind: 'bar',
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { sourceDataRef: barDataRef, currentDataRef: barDataRef },
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
        },
      },
      shared: {
        focusedWidget: scatterRef,
      },
    }),
    runtimeData: {
      [scatterDataRef]: {
        ref: scatterDataRef,
        rows: [{ id: 1, region: 'west' }],
        widgetRef: scatterRef,
      },
      [barDataRef]: {
        ref: barDataRef,
        rows: [{ id: 2, region: 'north' }],
        widgetRef: barRef,
      },
    },
  })

  const ctx = new PerceptionExecutor({
    store,
    hostBridge: {
      readFocusState: () => ({
        widgetRef: barRef,
        widgetId: 'bar_b',
        source: 'workspace',
      }),
      readHighlightState: () => ({
        entries: [{
          widgetRef: barRef,
          widgetId: 'bar_b',
          highlightedKeys: ['north'],
        }],
        activeWidgetRefs: [barRef],
      }),
    },
  }).createContext({
      name: 'perception.findExtremes',
      params: {},
  })

  assert.deepEqual(ctx.readFocusState(), {
    widgetRef: barRef,
    widgetId: 'bar_b',
    source: 'workspace',
  })
  assert.deepEqual(ctx.readHighlightState(), {
    entries: [{
      widgetRef: barRef,
      widgetId: 'bar_b',
      highlightedKeys: ['north'],
    }],
    activeWidgetRefs: [barRef],
  })
  assert.equal(ctx.readFocusedWidgetRef(), barRef)
  assert.equal(ctx.requireTargetWidget({ kind: 'bar' }).ref, barRef)
})

test('PerceptionExecutor handler context prioritizes params.queryScope over legacy target fields', () => {
  const store = new WidgetVARuntimeStore()
  const scatterRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const barRef = makeWidgetRef({ widgetId: 'bar_b' })
  const scatterDataRef = 'wl://widgetva-app/workspace/main/data/scatter_a_visible'
  const barDataRef = 'wl://widgetva-app/workspace/main/data/bar_b_visible'
  const selectionRef = makeSelectionRef({ widgetId: 'bar_b', selectionId: 'region_b' })

  store.replaceWorkspace({
    description: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      widgets: [
        { ref: scatterRef, widgetId: 'scatter_a', kind: 'scatter', title: 'Scatter A', primaryDataRef: scatterDataRef },
        { ref: barRef, widgetId: 'bar_b', kind: 'bar', title: 'Bar B', primaryDataRef: barDataRef },
      ],
      dataHandles: [
        { ref: scatterDataRef, title: 'Scatter Visible Data' },
        { ref: barDataRef, title: 'Bar Visible Data' },
      ],
      links: [],
      actions: [],
      perceptionQueries: [],
    },
    state: makeWorkspaceState({
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [scatterRef]: {
          ref: scatterRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { sourceDataRef: scatterDataRef, currentDataRef: scatterDataRef },
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
        },
        [barRef]: {
          ref: barRef,
          widgetId: 'bar_b',
          kind: 'bar',
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { sourceDataRef: barDataRef, currentDataRef: barDataRef },
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
        },
      },
      shared: {
        focusedWidget: scatterRef,
        selections: {
          registry: {
            [selectionRef]: {
              kind: 'point',
              predicates: [{ field: 'region', op: 'equals', value: 'north' }],
            },
          },
          views: {
            primary: null,
            byWidget: {},
          },
        },
      },
    }),
    runtimeData: {
      [scatterDataRef]: {
        ref: scatterDataRef,
        rows: [{ id: 1, region: 'west' }],
        widgetRef: scatterRef,
      },
      [barDataRef]: {
        ref: barDataRef,
        rows: [
          { id: 2, region: 'north' },
          { id: 3, region: 'south' },
        ],
        widgetRef: barRef,
      },
    },
  })

  const ctx = new PerceptionExecutor({
    store,
  }).createContext({
      name: 'perception.findExtremes',
      targetRef: scatterRef,
      params: {
        targetRef: scatterRef,
        selectionRef,
        queryScope: {
          widgetRef: barRef,
          dataRef: barDataRef,
          selectionRef,
        },
      },
  })

  assert.deepEqual(ctx.readQueryScope(), {
    widgetRef: barRef,
    dataRef: barDataRef,
    selectionRef,
    focusRef: null,
    viewportRef: null,
  })
  assert.deepEqual(ctx.readCallParams(), {
    queryScope: {
      widgetRef: barRef,
      dataRef: barDataRef,
      selectionRef,
      focusRef: null,
      viewportRef: null,
    },
  })
  assert.equal(ctx.requireTargetWidget({ kind: 'bar' }).ref, barRef)
  assert.deepEqual(ctx.resolveRowsForWidget(ctx.requireTargetWidget({ kind: 'bar' }), { queryScope: { dataRef: barDataRef, selectionRef } }).rows, [{ id: 2, region: 'north' }])
})
