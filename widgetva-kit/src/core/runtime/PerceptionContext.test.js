import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeSelectionRef,
  makeSelectionScopedDataRef,
  makeWidgetRef,
} from '../protocol/refs.js'
import { makeWorkspaceState } from '../protocol/state.js'
import { WidgetVARuntimeStore } from './RuntimeStore.js'
import { PerceptionContext } from './PerceptionContext.js'

test('PerceptionContext.describeContract exposes the shared context summary contract', () => {
  const contract = PerceptionContext.describeContract()

  assert.equal(Array.isArray(contract.methods), true)
  assert.equal(contract.methods.includes('recordQuery'), true)
  assert.equal(contract.capabilities.selectionScopedQueries, true)
  assert.equal(contract.integrations.traceRecorder, true)
})

test('PerceptionContext.resolveRowsForWidget honors selection-scoped data from selectionRef', () => {
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

  const ctx = new PerceptionContext({
    store,
    call: {
      name: 'perception.inspectVisibleRows',
      targetRef: widgetRef,
      params: {
        selectionRef,
      },
    },
  })

  const targetWidget = ctx.requireTargetWidget()
  const result = ctx.resolveRowsForWidget(targetWidget, { selectionRef })

  assert.equal(result.dataRef, selectionScopedDataRef)
  assert.deepEqual(result.rows, [{ id: 1, region: 'west' }])
})

test('PerceptionContext supports plain RuntimeStore record facades for manual assembly', () => {
  const widgetRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/scatter_a_visible'
  const selectionRef = makeSelectionRef({ widgetId: 'scatter_a', selectionId: 'region_a' })
  const selectionScopedDataRef = makeSelectionScopedDataRef({ widgetId: 'scatter_a', selectionId: 'region_a' })

  const ctx = new PerceptionContext({
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
    call: {
      name: 'perception.inspectVisibleRows',
      targetRef: widgetRef,
      params: {
        selectionRef,
      },
    },
  })

  const targetWidget = ctx.requireTargetWidget()
  const result = ctx.resolveRowsForWidget(targetWidget, { selectionRef })

  assert.equal(targetWidget.ref, widgetRef)
  assert.equal(result.dataRef, selectionScopedDataRef)
  assert.deepEqual(result.rows, [{ id: 1, region: 'west' }])
})

test('PerceptionContext prefers host bridge focused widget and selection registry when available', () => {
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

  const ctx = new PerceptionContext({
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
    call: {
      name: 'perception.findExtremes',
      params: {
        selectionRef,
      },
    },
  })

  const targetWidget = ctx.requireTargetWidget({ kind: 'bar' })
  const result = ctx.resolveRowsForWidget(targetWidget, { selectionRef })

  assert.equal(targetWidget.ref, barRef)
  assert.deepEqual(result.rows, [{ id: 2, region: 'north' }])
})

test('PerceptionContext falls back to host focus/highlight state when focusedWidgetRef is not provided', () => {
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

  const ctx = new PerceptionContext({
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
    call: {
      name: 'perception.findExtremes',
      params: {},
    },
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

test('PerceptionContext prioritizes params.queryScope over legacy target fields', () => {
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

  const ctx = new PerceptionContext({
    store,
    call: {
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
