import test from 'node:test'
import assert from 'node:assert/strict'

import { makeSelectionRef, makeWidgetRef } from '../protocol/refs.js'
import { makeWorkspaceState } from '../protocol/state.js'
import { WidgetVARuntimeStore } from './RuntimeStore.js'
import { DataQueryContext } from './DataQueryContext.js'

test('DataQueryContext.describeContract exposes the shared context summary contract', () => {
  const contract = DataQueryContext.describeContract()

  assert.equal(Array.isArray(contract.methods), true)
  assert.equal(contract.methods.includes('recordDataQuery'), true)
  assert.equal(contract.capabilities.explicitTargetValidation, true)
  assert.equal(contract.integrations.traceRecorder, true)
})

test('DataQueryContext resolves query.spec.queryScope.dataRef as the active data target', () => {
  const store = new WidgetVARuntimeStore()
  const widgetRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/scatter_a_visible'
  const scopedDataRef = 'wl://widgetva-app/workspace/main/data/scatter_a_scoped'

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
        { ref: scopedDataRef, title: 'Scoped Data' },
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
          selections: {},
        },
      },
      shared: {
        focusedWidget: widgetRef,
      },
    }),
    runtimeData: {
      [visibleDataRef]: {
        ref: visibleDataRef,
        rows: [{ id: 1, kind: 'visible' }],
        widgetRef,
      },
      [scopedDataRef]: {
        ref: scopedDataRef,
        rows: [{ id: 2, kind: 'scoped' }],
        widgetRef,
        scope: 'selection',
      },
    },
  })

  const ctx = new DataQueryContext({
    store,
    call: {
      query: {
        kind: 'sampleRows',
        spec: {
          queryScope: {
            dataRef: scopedDataRef,
          },
          limit: 10,
        },
      },
    },
  })

  assert.equal(ctx.resolveDataRef(), scopedDataRef)
  assert.deepEqual(ctx.resolveRows(), [{ id: 2, kind: 'scoped' }])
})

test('DataQueryContext prefers host bridge focused widget and selection registry when available', () => {
  const store = new WidgetVARuntimeStore()
  const scatterRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const barRef = makeWidgetRef({ widgetId: 'bar_b' })
  const scatterDataRef = 'wl://widgetva-app/workspace/main/data/scatter_a_visible'
  const barDataRef = 'wl://widgetva-app/workspace/main/data/bar_b_visible'
  const selectionRef = makeSelectionRef({ widgetId: 'scatter_a', selectionId: 'brush' })

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
        rows: [
          { id: 1, origin: 'west' },
          { id: 2, origin: 'east' },
        ],
        widgetRef: scatterRef,
      },
      [barDataRef]: {
        ref: barDataRef,
        rows: [{ id: 3, origin: 'north' }],
        widgetRef: barRef,
      },
    },
  })

  const ctx = new DataQueryContext({
    store,
    hostBridge: {
      readSelectionRegistry: () => ({
        [selectionRef]: {
          kind: 'point',
          predicates: [{ field: 'origin', op: 'equals', value: 'west' }],
        },
      }),
      readFocusedWidgetRef: () => barRef,
    },
    call: {
      query: {
        kind: 'sampleRows',
        spec: {
          selectionRef,
        },
      },
    },
  })

  assert.equal(ctx.resolveDataRef(), barDataRef)
  assert.deepEqual(ctx.resolveSelectionState(selectionRef), {
    kind: 'point',
    predicates: [{ field: 'origin', op: 'equals', value: 'west' }],
  })
  assert.deepEqual(ctx.resolveRows(undefined, { queryScope: { selectionRef } }), [])
})

test('DataQueryContext falls back to host focus/highlight state when focusedWidgetRef is not provided', () => {
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
        rows: [{ id: 1, origin: 'west' }],
        widgetRef: scatterRef,
      },
      [barDataRef]: {
        ref: barDataRef,
        rows: [{ id: 2, origin: 'north' }],
        widgetRef: barRef,
      },
    },
  })

  const ctx = new DataQueryContext({
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
      query: {
        kind: 'sampleRows',
        spec: {},
      },
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
  assert.equal(ctx.resolveDataRef(), barDataRef)
})

test('DataQueryContext prioritizes query.spec.queryScope over legacy target fields', () => {
  const store = new WidgetVARuntimeStore()
  const scatterRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const barRef = makeWidgetRef({ widgetId: 'bar_b' })
  const scatterDataRef = 'wl://widgetva-app/workspace/main/data/scatter_a_visible'
  const barDataRef = 'wl://widgetva-app/workspace/main/data/bar_b_visible'
  const selectionRef = makeSelectionRef({ widgetId: 'bar_b', selectionId: 'focus_north' })

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
              predicates: [{ field: 'origin', op: 'equals', value: 'north' }],
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
        rows: [{ id: 1, origin: 'west' }],
        widgetRef: scatterRef,
      },
      [barDataRef]: {
        ref: barDataRef,
        rows: [
          { id: 2, origin: 'north' },
          { id: 3, origin: 'south' },
        ],
        widgetRef: barRef,
      },
    },
  })

  const ctx = new DataQueryContext({
    store,
    call: {
      query: {
        kind: 'sampleRows',
        spec: {
          queryScope: {
            widgetRef: barRef,
            dataRef: barDataRef,
            selectionRef,
          },
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
  assert.deepEqual(ctx.readNormalizedQuerySpec(), {
    queryScope: {
      widgetRef: barRef,
      dataRef: barDataRef,
      selectionRef,
      focusRef: null,
      viewportRef: null,
    },
  })
  assert.equal(ctx.readFocusedWidgetRef(), scatterRef)
  assert.equal(ctx.resolveDataRef(), barDataRef)
  assert.deepEqual(ctx.resolveRows(), [{ id: 2, origin: 'north' }])
})
