import test from 'node:test'
import assert from 'node:assert/strict'

import { makeWorkspaceState } from '../protocol/state.js'
import { makeWidgetRef, makeSelectionRef } from '../protocol/refs.js'
import { LinkEngine } from './LinkEngine.js'

test('LinkEngine.describeEngine derives T6 topology for one-to-many coordinated workspaces', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const tableRef = makeWidgetRef({ widgetId: 'table' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
            kind: 'filter',
            from: selectionRef,
            to: barRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'bar',
            propagationPolicy: 'automatic',
          },
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_table',
            kind: 'filter',
            from: selectionRef,
            to: tableRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'table',
            propagationPolicy: 'automatic',
          },
        ]
      },
      readDescription() {
        return {
          widgets: [
            { ref: scatterRef, widgetId: 'scatter', role: 'primary' },
            { ref: barRef, widgetId: 'bar', role: 'summary' },
            { ref: tableRef, widgetId: 'table', role: 'detail' },
          ],
        }
      },
    },
  })

  const summary = linkEngine.describeEngine()
  const filterPrimitive = summary.primitives.find((entry) => entry.name === 'filter')

  assert.equal(summary.topology.topology, 'T6')
  assert.equal(summary.topology.widgetCount, 3)
  assert.equal(summary.topology.maxOutDegree, 2)
  assert.equal(summary.topology.targetWidgetCount, 2)
  assert.deepEqual(filterPrimitive?.appliedStatePaths, ['transforms', 'data.currentDataRef', 'feedback.inboundLinkIds'])
})

test('LinkEngine.describeEngine derives T2 topology for two-widget coordinated pairs', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
            kind: 'filter',
            from: selectionRef,
            to: barRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'bar',
            propagationPolicy: 'automatic',
          },
        ]
      },
      readDescription() {
        return {
          widgets: [
            { ref: scatterRef, widgetId: 'scatter', role: 'primary' },
            { ref: barRef, widgetId: 'bar', role: 'summary' },
          ],
        }
      },
    },
  })

  const summary = linkEngine.describeEngine()

  assert.equal(summary.topology.topology, 'T2')
  assert.equal(summary.topology.widgetCount, 2)
  assert.equal(summary.topology.edgeCount, 1)
})

test('LinkEngine.describeEngine excludes structural links from topology counts', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/scatter_visible'

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_uses_visible_data',
            kind: 'usesData',
            from: scatterRef,
            to: visibleDataRef,
            propagationPolicy: 'manual',
          },
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_visible_derives_from_source',
            kind: 'derivesFrom',
            from: visibleDataRef,
            to: 'wl://widgetva-app/workspace/main/data/source',
            propagationPolicy: 'manual',
          },
        ]
      },
      readDescription() {
        return {
          widgets: [
            { ref: scatterRef, widgetId: 'scatter', role: 'primary' },
          ],
        }
      },
    },
  })

  const summary = linkEngine.describeEngine()

  assert.equal(summary.linkCount, 2)
  assert.equal(summary.coordinationLinkCount, 0)
  assert.equal(summary.structuralLinkCount, 2)
  assert.equal(summary.topology.topology, 'T1')
  assert.equal(summary.topology.edgeCount, 0)
})

test('LinkEngine treats explicit automatic false links as manual when propagationPolicy is omitted', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
            kind: 'filter',
            from: selectionRef,
            to: barRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'bar',
            automatic: false,
            propagationPolicy: 'manual',
          },
        ]
      },
      readDescription() {
        return {
          widgets: [
            { ref: scatterRef, widgetId: 'scatter', role: 'primary' },
            { ref: barRef, widgetId: 'bar', role: 'summary' },
          ],
        }
      },
    },
  })

  const summary = linkEngine.describeEngine()
  const propagation = linkEngine.describePropagation({ sourceRef: selectionRef })

  assert.equal(summary.automaticLinkCount, 0)
  assert.equal(summary.manualLinkCount, 1)
  assert.equal(propagation[0]?.activationPolicy, 'manual')
  assert.equal(propagation[0]?.effectConstraint, null)
})

test('LinkEngine preserves activationPolicy and effectConstraint in propagation descriptions', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
            kind: 'drillDown',
            from: selectionRef,
            to: barRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'bar',
            activationPolicy: 'automatic',
            responseSpec: {
              kind: 'drillDown',
              params: {
                dimension: 'time',
                fromLevel: 'year',
                toLevel: 'month',
              },
            },
          },
        ]
      },
      readDescription() {
        return {
          widgets: [
            { ref: scatterRef, widgetId: 'scatter' },
            { ref: barRef, widgetId: 'bar' },
          ],
        }
      },
    },
  })

  const propagation = linkEngine.describePropagation({ sourceRef: selectionRef })

  assert.equal(propagation[0]?.activationPolicy, 'automatic')
  assert.equal(propagation[0]?.effectConstraint, null)
  assert.equal(propagation[0]?.declaredEffect, 'transformView')
  assert.equal(propagation[0]?.appliedEffect, 'transformView')
  assert.equal(propagation[0]?.responseSpec?.kind, 'drillDown')
})

test('LinkEngine resolves outgoing links by primary selection sourceWidgetId when links are widget-scoped', () => {
  const sourceWidgetRef = makeWidgetRef({ widgetId: 'scatter' })
  const targetWidgetRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })
  const state = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [targetWidgetRef]: {
        ref: targetWidgetRef,
        widgetId: 'bar',
        kind: 'bar',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: { rowCount: 2 },
      },
    },
    shared: {
      focusedWidget: sourceWidgetRef,
      selections: {
        registry: {
          [selectionRef]: {
            selectionRef,
            sourceWidgetRef,
            sourceWidgetId: 'scatter',
            predicates: [{ field: 'Origin', op: 'equals', value: 'Japan' }],
          },
        },
        views: {
          primary: {
            selectionRef,
            sourceWidgetRef,
            sourceWidgetId: 'scatter',
          },
          byWidget: {
            scatter: { selectionRef },
          },
        },
      },
    },
  })
  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
            kind: 'filter',
            from: sourceWidgetRef,
            to: targetWidgetRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'bar',
            effect: 'applyFilter',
          },
        ]
      },
      readState() {
        return state
      },
      getWidgetState(ref) {
        return state.widgets?.[ref] || null
      },
    },
  })

  const propagation = linkEngine.describePropagation({ sourceRef: selectionRef })

  assert.equal(propagation.length, 1)
  assert.equal(propagation[0]?.targetRef, targetWidgetRef)
  assert.equal(propagation[0]?.sourceWidgetId, 'scatter')
  assert.equal(propagation[0]?.canApply, true)
})

test('LinkEngine applies highlight semantics when a filter link is constrained to highlightOnly', () => {
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/bar_visible'

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [barRef]: {
        ref: barRef,
        widgetId: 'bar',
        kind: 'bar',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {
          currentDataRef: visibleDataRef,
          visibleCount: 2,
          selectedCount: 0,
        },
        encodings: {},
        transforms: [],
        view: {},
        selections: {},
        feedback: {},
        rawSpec: {
          data: {
            values: [
              { Origin: 'USA', Horsepower: 130 },
              { Origin: 'Japan', Horsepower: 95 },
            ],
          },
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            kind: 'point',
            predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const runtimeData = {
    [visibleDataRef]: {
      ref: visibleDataRef,
      rows: [
        { Origin: 'USA', Horsepower: 130 },
        { Origin: 'Japan', Horsepower: 95 },
      ],
      baseRows: [
        { Origin: 'USA', Horsepower: 130 },
        { Origin: 'Japan', Horsepower: 95 },
      ],
      handle: {
        ref: visibleDataRef,
        stats: {
          rowCount: 2,
          visibleCount: 2,
          selectedCount: 0,
        },
      },
      widgetRef: barRef,
    },
  }

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
            kind: 'filter',
            effect: 'applyFilter',
            effectConstraint: 'highlightOnly',
            from: selectionRef,
            to: barRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'bar',
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      readRuntimeData(ref) {
        return runtimeData[ref] || null
      },
      updateRuntimeData(ref, updater) {
        runtimeData[ref] = updater(runtimeData[ref])
      },
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
      commitState(nextState) {
        currentState = makeWorkspaceState(nextState)
        return currentState
      },
      syncSelectionRuntimeData() {},
    },
  })

  const result = linkEngine.propagate({ sourceRef: selectionRef, state: currentState })

  assert.equal(result.links[0]?.declaredEffect, 'applyFilter')
  assert.equal(result.links[0]?.appliedEffect, 'applyHighlight')
  assert.deepEqual(result.links[0]?.appliedStatePaths, ['feedback.highlightedKeys', 'feedback.inboundLinkIds'])
  assert.equal(currentState.widgets?.[barRef]?.transforms?.length || 0, 0)
  assert.deepEqual(currentState.widgets?.[barRef]?.feedback?.highlightedKeys || [], ['USA'])
  assert.equal(currentState.widgets?.[barRef]?.rawSpec?.data?.values?.[0]?.__widgetva_highlight, true)
  assert.equal(currentState.widgets?.[barRef]?.rawSpec?.data?.values?.[1]?.__widgetva_highlight, false)
})

test('LinkEngine applies focusTarget semantics through effect constraints at the library layer', () => {
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [barRef]: {
        ref: barRef,
        widgetId: 'bar',
        kind: 'bar',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {},
        encodings: {},
        transforms: [],
        view: {},
        selections: {},
        feedback: {},
        rawSpec: {
          data: {
            values: [
              { Origin: 'USA', Horsepower: 130 },
            ],
          },
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            kind: 'point',
            predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
      focusedWidget: null,
      focus: null,
    },
  })

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_focuses_bar',
            kind: 'filter',
            effect: 'applyFilter',
            effectConstraint: 'focusOnly',
            from: selectionRef,
            to: barRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'bar',
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
      commitState(nextState) {
        currentState = makeWorkspaceState(nextState)
        return currentState
      },
    },
  })

  const result = linkEngine.propagate({ sourceRef: selectionRef, state: currentState })
  const evaluation = linkEngine.evaluatePropagation({ sourceRef: selectionRef, state: currentState })

  assert.equal(result.links[0]?.declaredEffect, 'applyFilter')
  assert.equal(result.links[0]?.appliedEffect, 'focusTarget')
  assert.deepEqual(result.links[0]?.appliedStatePaths, ['shared.focusedWidget', 'shared.focus'])
  assert.equal(currentState.shared?.focusedWidget, barRef)
  assert.equal(currentState.shared?.focus?.widgetRef, barRef)
  assert.equal(currentState.shared?.focus?.widgetId, 'bar')
  assert.equal(currentState.widgets?.[barRef]?.feedback?.focusedBySelectionRef, selectionRef)
  assert.deepEqual(currentState.widgets?.[barRef]?.feedback?.focusLinkIds || [], ['scatter_focuses_bar'])
  assert.equal(evaluation.results[0]?.appliedEffect, 'focusTarget')
  assert.equal(evaluation.results[0]?.passed, true)
})

test('LinkEngine.propagate applies drillDown advanced responses to line widget specs', () => {
  const lineRef = makeWidgetRef({ widgetId: 'line' })
  const selectionRef = makeSelectionRef({ widgetId: 'bar', selectionId: 'year_pick' })

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [lineRef]: {
        ref: lineRef,
        widgetId: 'line',
        kind: 'line',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {},
        encodings: {},
        transforms: [],
        view: {},
        selections: {},
        feedback: {},
        currentSpec: {
          mark: 'line',
          encoding: {
            x: { field: 'date', type: 'temporal' },
            y: { field: 'sales', type: 'quantitative' },
          },
          transform: [],
          title: 'Yearly trend',
        },
        rawSpec: {
          mark: 'line',
          encoding: {
            x: { field: 'date', type: 'temporal' },
            y: { field: 'sales', type: 'quantitative' },
          },
          transform: [],
          title: 'Yearly trend',
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            selectionRef,
            kind: 'point',
            sourceWidgetId: 'bar',
            predicates: [{ field: 'year', op: 'equals', value: 1970 }],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/bar_drill_line',
            kind: 'drillDown',
            effect: 'transformView',
            from: selectionRef,
            to: lineRef,
            sourceWidgetId: 'bar',
            targetWidgetId: 'line',
            responseSpec: {
              kind: 'drillDown',
              params: {
                fromLevel: 'year',
                toLevel: 'month',
              },
            },
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
    },
  })

  const result = linkEngine.propagate({ sourceRef: selectionRef, state: currentState })

  assert.equal(result.links[0]?.appliedEffect, 'transformView')
  assert.equal(result.links[0]?.responseSpec?.kind, 'drillDown')
  assert.deepEqual(result.links[0]?.appliedStatePaths, ['currentSpec', 'rawSpec', 'transforms', 'encoding', 'feedback.inboundLinkIds'])
  assert.equal(currentState.widgets?.[lineRef]?.rawSpec?.encoding?.x?.field, 'month_date')
  assert.equal(currentState.widgets?.[lineRef]?.rawSpec?.encoding?.x?.type, 'temporal')
  assert.equal(currentState.widgets?.[lineRef]?.rawSpec?.transform?.[0]?._widgetvaTag, 'line.drillDownXAxis')
  assert.equal(currentState.widgets?.[lineRef]?.rawSpec?._line_drilldown_state?.parent?.year, 1970)
  assert.equal(currentState.widgets?.[lineRef]?.feedback?.advancedActionName, 'line.drillDownXAxis')
})

test('LinkEngine.propagate applies reencode transpose responses to heatmap widget specs', () => {
  const heatmapRef = makeWidgetRef({ widgetId: 'heatmap' })
  const selectionRef = makeSelectionRef({ widgetId: 'line', selectionId: 'year_pick' })

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [heatmapRef]: {
        ref: heatmapRef,
        widgetId: 'heatmap',
        kind: 'heatmap',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {},
        encodings: {
          x: { field: 'cylinders', type: 'ordinal' },
          y: { field: 'origin', type: 'nominal' },
        },
        transforms: [],
        view: {},
        selections: {},
        feedback: {},
        currentSpec: {
          mark: 'rect',
          width: 320,
          height: 180,
          encoding: {
            x: { field: 'cylinders', type: 'ordinal' },
            y: { field: 'origin', type: 'nominal' },
          },
          transform: [],
        },
        rawSpec: {
          mark: 'rect',
          width: 320,
          height: 180,
          encoding: {
            x: { field: 'cylinders', type: 'ordinal' },
            y: { field: 'origin', type: 'nominal' },
          },
          transform: [],
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            selectionRef,
            kind: 'point',
            sourceWidgetId: 'line',
            predicates: [{ field: 'year', op: 'equals', value: 1971 }],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/line_reencode_heatmap',
            kind: 'reencode',
            effect: 'transformView',
            from: selectionRef,
            to: heatmapRef,
            sourceWidgetId: 'line',
            targetWidgetId: 'heatmap',
            responseSpec: {
              kind: 'reencode',
              params: {
                variant: 'transpose',
                transposed: true,
              },
            },
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
    },
  })

  const result = linkEngine.propagate({ sourceRef: selectionRef, state: currentState })

  assert.equal(result.links[0]?.appliedEffect, 'transformView')
  assert.equal(result.links[0]?.responseSpec?.kind, 'reencode')
  assert.equal(currentState.widgets?.[heatmapRef]?.rawSpec?.encoding?.x?.field, 'origin')
  assert.equal(currentState.widgets?.[heatmapRef]?.rawSpec?.encoding?.y?.field, 'cylinders')
  assert.equal(currentState.widgets?.[heatmapRef]?.rawSpec?._transpose_state?.transposed, true)
  assert.equal(currentState.widgets?.[heatmapRef]?.encodings?.x?.field, 'origin')
  assert.equal(currentState.widgets?.[heatmapRef]?.feedback?.advancedActionName, 'heatmap.transpose')
})

test('LinkEngine.propagate applies aggregate auto-collapse responses to sankey widget specs', () => {
  const sankeyRef = makeWidgetRef({ widgetId: 'sankey' })
  const selectionRef = makeSelectionRef({ widgetId: 'bar', selectionId: 'origin_pick' })

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [sankeyRef]: {
        ref: sankeyRef,
        widgetId: 'sankey',
        kind: 'sankey',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {},
        encodings: {},
        transforms: [],
        view: {},
        selections: {},
        feedback: {},
        currentSpec: {
          data: [
            {
              name: 'rawLinks',
              values: [
                { source: 'A', target: 'X', value: 10 },
                { source: 'B', target: 'X', value: 5 },
                { source: 'C', target: 'X', value: 2 },
                { source: 'X', target: 'Y', value: 17 },
              ],
            },
            {
              name: 'nodeConfig',
              values: [
                { name: 'A', depth: 0, order: 0 },
                { name: 'B', depth: 0, order: 1 },
                { name: 'C', depth: 0, order: 2 },
                { name: 'X', depth: 1, order: 0 },
                { name: 'Y', depth: 2, order: 0 },
              ],
            },
          ],
          _sankey_state: {
            original_nodes: [],
            original_links: [],
            collapsed_groups: {},
          },
        },
        rawSpec: {
          data: [
            {
              name: 'rawLinks',
              values: [
                { source: 'A', target: 'X', value: 10 },
                { source: 'B', target: 'X', value: 5 },
                { source: 'C', target: 'X', value: 2 },
                { source: 'X', target: 'Y', value: 17 },
              ],
            },
            {
              name: 'nodeConfig',
              values: [
                { name: 'A', depth: 0, order: 0 },
                { name: 'B', depth: 0, order: 1 },
                { name: 'C', depth: 0, order: 2 },
                { name: 'X', depth: 1, order: 0 },
                { name: 'Y', depth: 2, order: 0 },
              ],
            },
          ],
          _sankey_state: {
            original_nodes: [],
            original_links: [],
            collapsed_groups: {},
          },
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            selectionRef,
            kind: 'point',
            sourceWidgetId: 'bar',
            predicates: [{ field: 'origin', op: 'equals', value: 'Japan' }],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/bar_aggregate_sankey',
            kind: 'aggregate',
            effect: 'transformDataView',
            from: selectionRef,
            to: sankeyRef,
            sourceWidgetId: 'bar',
            targetWidgetId: 'sankey',
            responseSpec: {
              kind: 'aggregate',
              params: {
                variant: 'autoCollapseByRank',
                topN: 1,
              },
            },
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
    },
  })

  const result = linkEngine.propagate({ sourceRef: selectionRef, state: currentState })

  assert.equal(result.links[0]?.appliedEffect, 'transformDataView')
  assert.equal(result.links[0]?.responseSpec?.kind, 'aggregate')
  assert.equal(currentState.widgets?.[sankeyRef]?.rawSpec?.data?.[1]?.values?.some?.((node) => node.name === 'Others (Layer 0)'), true)
  assert.deepEqual(currentState.widgets?.[sankeyRef]?.rawSpec?._sankey_state?.collapsed_groups?.['Others (Layer 0)'], ['B', 'C'])
  assert.equal(currentState.widgets?.[sankeyRef]?.feedback?.advancedActionName, 'sankey.autoCollapseByRank')
})

test('LinkEngine.propagate applies structure collapse responses to sankey widget specs', () => {
  const sankeyRef = makeWidgetRef({ widgetId: 'sankey' })
  const selectionRef = makeSelectionRef({ widgetId: 'bar', selectionId: 'origin_pick' })

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [sankeyRef]: {
        ref: sankeyRef,
        widgetId: 'sankey',
        kind: 'sankey',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {},
        encodings: {},
        transforms: [],
        view: {},
        selections: {},
        feedback: {},
        currentSpec: {
          data: [
            {
              name: 'rawLinks',
              values: [
                { source: 'A', target: 'X', value: 10 },
                { source: 'B', target: 'X', value: 5 },
                { source: 'C', target: 'X', value: 2 },
              ],
            },
            {
              name: 'nodeConfig',
              values: [
                { name: 'A', depth: 0, order: 0 },
                { name: 'B', depth: 0, order: 1 },
                { name: 'C', depth: 0, order: 2 },
                { name: 'X', depth: 1, order: 0 },
              ],
            },
          ],
        },
        rawSpec: {
          data: [
            {
              name: 'rawLinks',
              values: [
                { source: 'A', target: 'X', value: 10 },
                { source: 'B', target: 'X', value: 5 },
                { source: 'C', target: 'X', value: 2 },
              ],
            },
            {
              name: 'nodeConfig',
              values: [
                { name: 'A', depth: 0, order: 0 },
                { name: 'B', depth: 0, order: 1 },
                { name: 'C', depth: 0, order: 2 },
                { name: 'X', depth: 1, order: 0 },
              ],
            },
          ],
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            selectionRef,
            kind: 'point',
            sourceWidgetId: 'bar',
            predicates: [{ field: 'origin', op: 'equals', value: 'Japan' }],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/bar_collapse_sankey',
            kind: 'structure',
            effect: 'transformStructure',
            from: selectionRef,
            to: sankeyRef,
            sourceWidgetId: 'bar',
            targetWidgetId: 'sankey',
            responseSpec: {
              kind: 'collapse',
              params: {
                variant: 'collapseNodes',
                nodes: ['B', 'C'],
                aggregateName: 'Other Sources',
              },
            },
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
    },
  })

  const result = linkEngine.propagate({ sourceRef: selectionRef, state: currentState })

  assert.equal(result.links[0]?.appliedEffect, 'transformStructure')
  assert.equal(result.links[0]?.responseSpec?.kind, 'collapse')
  assert.equal(currentState.widgets?.[sankeyRef]?.rawSpec?.data?.[1]?.values?.some?.((node) => node.name === 'Other Sources'), true)
  assert.deepEqual(currentState.widgets?.[sankeyRef]?.rawSpec?._sankey_state?.collapsed_groups?.['Other Sources'], ['B', 'C'])
  assert.equal(currentState.widgets?.[sankeyRef]?.feedback?.advancedActionName, 'sankey.collapseNodes')
})

test('LinkEngine.propagate applies structure expand responses to sankey widget specs', () => {
  const sankeyRef = makeWidgetRef({ widgetId: 'sankey' })
  const selectionRef = makeSelectionRef({ widgetId: 'bar', selectionId: 'origin_pick' })

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [sankeyRef]: {
        ref: sankeyRef,
        widgetId: 'sankey',
        kind: 'sankey',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {},
        encodings: {},
        transforms: [],
        view: {},
        selections: {},
        feedback: {},
        currentSpec: {
          data: [
            {
              name: 'rawLinks',
              values: [
                { source: 'A', target: 'X', value: 10 },
                { source: 'Other Sources', target: 'X', value: 7 },
              ],
            },
            {
              name: 'nodeConfig',
              values: [
                { name: 'A', depth: 0, order: 0 },
                { name: 'Other Sources', depth: 0, order: 3, _is_aggregate: true, _collapsed_nodes: ['B', 'C'] },
                { name: 'X', depth: 1, order: 0 },
              ],
            },
          ],
          _sankey_state: {
            original_nodes: [
              { name: 'A', depth: 0, order: 0 },
              { name: 'B', depth: 0, order: 1 },
              { name: 'C', depth: 0, order: 2 },
              { name: 'X', depth: 1, order: 0 },
            ],
            original_links: [
              { source: 'A', target: 'X', value: 10 },
              { source: 'B', target: 'X', value: 5 },
              { source: 'C', target: 'X', value: 2 },
            ],
            collapsed_groups: {
              'Other Sources': ['B', 'C'],
            },
          },
        },
        rawSpec: {
          data: [
            {
              name: 'rawLinks',
              values: [
                { source: 'A', target: 'X', value: 10 },
                { source: 'Other Sources', target: 'X', value: 7 },
              ],
            },
            {
              name: 'nodeConfig',
              values: [
                { name: 'A', depth: 0, order: 0 },
                { name: 'Other Sources', depth: 0, order: 3, _is_aggregate: true, _collapsed_nodes: ['B', 'C'] },
                { name: 'X', depth: 1, order: 0 },
              ],
            },
          ],
          _sankey_state: {
            original_nodes: [
              { name: 'A', depth: 0, order: 0 },
              { name: 'B', depth: 0, order: 1 },
              { name: 'C', depth: 0, order: 2 },
              { name: 'X', depth: 1, order: 0 },
            ],
            original_links: [
              { source: 'A', target: 'X', value: 10 },
              { source: 'B', target: 'X', value: 5 },
              { source: 'C', target: 'X', value: 2 },
            ],
            collapsed_groups: {
              'Other Sources': ['B', 'C'],
            },
          },
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            selectionRef,
            kind: 'point',
            sourceWidgetId: 'bar',
            predicates: [{ field: 'origin', op: 'equals', value: 'Japan' }],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/bar_expand_sankey',
            kind: 'structure',
            effect: 'transformStructure',
            from: selectionRef,
            to: sankeyRef,
            sourceWidgetId: 'bar',
            targetWidgetId: 'sankey',
            responseSpec: {
              kind: 'expand',
              params: {
                variant: 'expandNode',
                aggregateName: 'Other Sources',
              },
            },
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
    },
  })

  const result = linkEngine.propagate({ sourceRef: selectionRef, state: currentState })

  assert.equal(result.links[0]?.appliedEffect, 'transformStructure')
  assert.equal(result.links[0]?.responseSpec?.kind, 'expand')
  assert.equal(currentState.widgets?.[sankeyRef]?.rawSpec?.data?.[1]?.values?.some?.((node) => node.name === 'B'), true)
  assert.equal(currentState.widgets?.[sankeyRef]?.rawSpec?.data?.[1]?.values?.some?.((node) => node.name === 'C'), true)
  assert.equal(Object.hasOwn(currentState.widgets?.[sankeyRef]?.rawSpec?._sankey_state?.collapsed_groups || {}, 'Other Sources'), false)
  assert.equal(currentState.widgets?.[sankeyRef]?.feedback?.advancedActionName, 'sankey.expandNode')
})

test('LinkEngine skips unsupported advanced responses cleanly', () => {
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [barRef]: {
        ref: barRef,
        widgetId: 'bar',
        kind: 'bar',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {},
        encodings: {},
        transforms: [],
        view: {},
        selections: {},
        feedback: {},
        rawSpec: {
          data: { values: [{ Origin: 'USA' }] },
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            selectionRef,
            kind: 'point',
            sourceWidgetId: 'scatter',
            predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_expand_bar',
            kind: 'structure',
            effect: 'transformStructure',
            from: selectionRef,
            to: barRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'bar',
            responseSpec: {
              kind: 'expand',
              params: {
                target: 'group',
                keyField: 'Origin',
              },
            },
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
    },
  })

  const result = linkEngine.propagate({ sourceRef: selectionRef, state: currentState })

  assert.equal(result.links.length, 0)
  assert.equal(result.skippedTargets.length, 1)
  assert.equal(result.skippedTargets[0]?.appliedEffect, 'transformStructure')
  assert.equal(result.skippedTargets[0]?.responseSpec?.kind, 'expand')
  assert.equal(result.skippedTargets[0]?.reason, 'unsupported_advanced_response')
})

test('LinkEngine explains skipped propagation targets when a link is manual', () => {
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
            kind: 'filter',
            from: selectionRef,
            to: barRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'bar',
            activationPolicy: 'manual',
          },
        ]
      },
      readState() {
        return makeWorkspaceState({
          stateId: 'main:s1',
          createdAt: '2026-01-01T00:00:00.000Z',
          widgets: {
            [barRef]: {
              ref: barRef,
              widgetId: 'bar',
              kind: 'bar',
              version: 1,
              updatedAt: '2026-01-01T00:00:00.000Z',
              data: {},
              encodings: {},
              transforms: [],
              view: {},
              selections: {},
              feedback: {},
            },
          },
          shared: {
            selections: {
              registry: {
                [selectionRef]: {
                  kind: 'point',
                  predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
                },
              },
              views: {
                primary: null,
                byWidget: {},
              },
            },
          },
        })
      },
      getWidgetState(ref) {
        return this.readState().widgets?.[ref] || null
      },
      clearWidgetPatches() {},
    },
  })

  const description = linkEngine.describePropagation({ sourceRef: selectionRef })
  const propagation = linkEngine.propagate({ sourceRef: selectionRef, state: linkEngine.store.readState() })

  assert.equal(description[0]?.canApply, false)
  assert.equal(description[0]?.skippedReason, 'manual_activation_policy')
  assert.deepEqual(propagation.affectedRefs, [])
  assert.equal(propagation.skippedTargets[0]?.reason, 'manual_activation_policy')
  assert.equal(propagation.appliedLinkCount, 0)
})

test('LinkEngine normalizes documented plural link kinds for propagation descriptions and execution', () => {
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/bar_visible'

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [barRef]: {
        ref: barRef,
        widgetId: 'bar',
        kind: 'bar',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {
          currentDataRef: visibleDataRef,
          visibleCount: 2,
          selectedCount: 0,
        },
        encodings: {},
        transforms: [],
        view: {},
        selections: {},
        feedback: {},
        rawSpec: {
          data: {
            values: [
              { Origin: 'USA', Horsepower: 130 },
              { Origin: 'Japan', Horsepower: 95 },
            ],
          },
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            kind: 'point',
            predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const runtimeData = {
    [visibleDataRef]: {
      ref: visibleDataRef,
      rows: [
        { Origin: 'USA', Horsepower: 130 },
        { Origin: 'Japan', Horsepower: 95 },
      ],
      baseRows: [
        { Origin: 'USA', Horsepower: 130 },
        { Origin: 'Japan', Horsepower: 95 },
      ],
      handle: {
        ref: visibleDataRef,
        stats: {
          rowCount: 2,
          visibleCount: 2,
          selectedCount: 0,
        },
      },
      widgetRef: barRef,
    },
  }

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
            kind: 'filters',
            from: selectionRef,
            to: barRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'bar',
            automatic: true,
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      readRuntimeData(ref) {
        return runtimeData[ref] || null
      },
      updateRuntimeData(ref, updater) {
        runtimeData[ref] = updater(runtimeData[ref])
      },
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
      syncSelectionRuntimeData() {},
    },
  })

  const propagation = linkEngine.describePropagation({ sourceRef: selectionRef })
  const effects = linkEngine.collectEffects({ sourceRef: selectionRef })
  const result = linkEngine.propagate({ sourceRef: selectionRef, state: currentState })

  assert.equal(propagation[0]?.primitive, 'filter')
  assert.equal(propagation[0]?.effect?.kind, 'filtersWidget')
  assert.equal(effects[0]?.kind, 'filtersWidget')
  assert.deepEqual(result.affectedRefs, [barRef])
  assert.equal(currentState.widgets?.[barRef]?.transforms?.[0]?.kind, 'filter')
})

test('LinkEngine.propagate preserves filter transform provenance in target widget state', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/bar_visible'

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [barRef]: {
        ref: barRef,
        widgetId: 'bar',
        kind: 'bar',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {
          currentDataRef: visibleDataRef,
          visibleCount: 2,
          selectedCount: 0,
        },
        encodings: {},
        transforms: [],
        view: {},
        selections: {},
        feedback: {},
        rawSpec: {
          data: {
            values: [
              { Origin: 'USA', Horsepower: 130 },
              { Origin: 'Japan', Horsepower: 95 },
            ],
          },
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            kind: 'point',
            predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const runtimeData = {
    [visibleDataRef]: {
      ref: visibleDataRef,
      rows: [
        { Origin: 'USA', Horsepower: 130 },
        { Origin: 'Japan', Horsepower: 95 },
      ],
      baseRows: [
        { Origin: 'USA', Horsepower: 130 },
        { Origin: 'Japan', Horsepower: 95 },
      ],
      handle: {
        ref: visibleDataRef,
        stats: {
          rowCount: 2,
          visibleCount: 2,
          selectedCount: 0,
        },
      },
      widgetRef: barRef,
    },
  }

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
            kind: 'filter',
            from: selectionRef,
            to: barRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'bar',
            propagationPolicy: 'automatic',
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      readRuntimeData(ref) {
        return runtimeData[ref] || null
      },
      updateRuntimeData(ref, updater) {
        runtimeData[ref] = updater(runtimeData[ref])
      },
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
      syncSelectionRuntimeData() {},
    },
  })

  const propagation = linkEngine.propagate({ sourceRef: selectionRef, state: currentState })

  const nextTransforms = currentState.widgets?.[barRef]?.transforms || []
  assert.equal(nextTransforms[0]?.kind, 'filter')
  assert.equal(nextTransforms[0]?.source, selectionRef)
  assert.equal(nextTransforms[0]?.sourceSelectionRef, selectionRef)
  assert.equal(nextTransforms[0]?.linkId, 'scatter_filters_bar')
  assert.equal(nextTransforms[0]?.spec?.linkRef, 'wl://widgetva-app/workspace/main/link/scatter_filters_bar')
})

test('LinkEngine.propagate accepts a direct sourceRef and returns affected refs for doc-style callers', () => {
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
            kind: 'filter',
            from: selectionRef,
            to: barRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'bar',
            propagationPolicy: 'automatic',
          },
        ]
      },
      readState() {
        return makeWorkspaceState({
          stateId: 'main:s1',
          createdAt: '2026-01-01T00:00:00.000Z',
          widgets: {
            [barRef]: {
              ref: barRef,
              widgetId: 'bar',
              kind: 'bar',
              version: 1,
              updatedAt: '2026-01-01T00:00:00.000Z',
              data: {},
              encodings: {},
              transforms: [],
              view: {},
              selections: {},
              feedback: {},
            },
          },
          shared: {
            selections: {
              registry: {
                [selectionRef]: {
                  kind: 'point',
                  predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
                },
              },
              views: {
                primary: null,
                byWidget: {},
              },
            },
          },
        })
      },
      getWidgetState(ref) {
        return this.readState().widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      readRuntimeData() {
        return null
      },
      updateRuntimeData() {},
      patchWidget(_ref, patch) {
        return {
          widgets: {
            [barRef]: patch,
          },
        }
      },
      syncSelectionRuntimeData() {},
    },
  })

  const affectedRefs = linkEngine.propagate(selectionRef)

  assert.deepEqual(affectedRefs, [barRef])
})

test('LinkEngine.propagate syncs zoom metadata together with view domains', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const detailRef = makeWidgetRef({ widgetId: 'detail' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [detailRef]: {
        ref: detailRef,
        widgetId: 'detail',
        kind: 'scatter',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {},
        encodings: {},
        transforms: [],
        view: {},
        selections: {},
        feedback: {},
        rawSpec: {
          data: {
            values: [
              { Horsepower: 90, Miles_per_Gallon: 32 },
              { Horsepower: 130, Miles_per_Gallon: 24 },
              { Horsepower: 160, Miles_per_Gallon: 18 },
            ],
          },
          encoding: {
            x: { field: 'Horsepower', type: 'quantitative' },
            y: { field: 'Miles_per_Gallon', type: 'quantitative' },
          },
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            kind: 'interval',
            domain: {
              xDomain: [100, 150],
              yDomain: [20, 30],
            },
            predicates: [],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_syncs_detail',
            kind: 'syncDomain',
            from: selectionRef,
            to: detailRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'detail',
            propagationPolicy: 'automatic',
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
    },
  })

  const propagation = linkEngine.propagate({ sourceRef: selectionRef, state: currentState })

  const view = currentState.widgets?.[detailRef]?.view
  assert.deepEqual(view?.xDomain, [100, 150])
  assert.deepEqual(view?.yDomain, [20, 30])
  assert.deepEqual(view?.zoom?.center, [125, 25])
  assert.equal(view?.zoom?.level, 1.4)
})

test('LinkEngine.propagate applies highlight feedback and marked rows for cross-widget highlight links', () => {
  const summaryRef = makeWidgetRef({ widgetId: 'summary' })
  const tableRef = makeWidgetRef({ widgetId: 'table' })
  const selectionRef = makeSelectionRef({ widgetId: 'summary', selectionId: 'category' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/table_visible'

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [tableRef]: {
        ref: tableRef,
        widgetId: 'table',
        kind: 'table',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {
          currentDataRef: visibleDataRef,
          visibleCount: 2,
          selectedCount: 0,
        },
        encodings: {},
        transforms: [],
        view: {},
        selections: {},
        feedback: {},
        rawSpec: {
          data: {
            values: [
              { Origin: 'USA', Model: 'ford' },
              { Origin: 'Japan', Model: 'toyota' },
            ],
          },
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            kind: 'point',
            predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const runtimeData = {
    [visibleDataRef]: {
      ref: visibleDataRef,
      rows: [
        { Origin: 'USA', Model: 'ford' },
        { Origin: 'Japan', Model: 'toyota' },
      ],
      handle: {
        ref: visibleDataRef,
      },
      widgetRef: tableRef,
    },
  }

  const linkRef = 'wl://widgetva-app/workspace/main/link/summary_highlights_table'
  const store = {
      listLinks() {
        return [
          {
            ref: linkRef,
            kind: 'highlight',
            from: selectionRef,
            to: tableRef,
            sourceWidgetId: 'summary',
            targetWidgetId: 'table',
            fieldMapping: [{ sourceField: 'Origin', targetField: 'Origin' }],
            propagationPolicy: 'automatic',
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      readRuntimeData(ref) {
        return runtimeData[ref] || null
      },
      updateRuntimeData(ref, updater) {
        runtimeData[ref] = updater(runtimeData[ref])
      },
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
      commitState(nextState) {
        currentState = nextState
        this.shared = nextState.shared
        return nextState
      },
      shared: currentState.shared,
    }
  const linkEngine = new LinkEngine({ store })

  const propagation = linkEngine.propagate({ sourceRef: selectionRef, state: currentState })

  const targetState = currentState.widgets?.[tableRef]
  const highlightedRows = targetState?.rawSpec?.data?.values?.filter((row) => row?.__widgetva_highlight === true) || []

  assert.deepEqual(targetState?.feedback?.inboundLinkIds, ['summary_highlights_table'])
  assert.deepEqual(targetState?.feedback?.linkedSourceRefs, [selectionRef])
  assert.deepEqual(targetState?.feedback?.highlightedKeys, ['USA'])
  assert.deepEqual(propagation?.nextState?.shared?.highlight, {
    entries: [{
      widgetRef: tableRef,
      widgetId: 'table',
      sourceWidgetRef: null,
      sourceWidgetId: null,
      selectionRef: null,
      summary: null,
      predicates: [],
      highlightedKeys: ['USA'],
      inboundLinkIds: ['summary_highlights_table'],
      highlightLinkIds: [],
      linkedSourceRefs: [selectionRef],
    }],
    activeWidgetRefs: [tableRef],
  })
  assert.equal(highlightedRows.length, 1)
  assert.equal(highlightedRows[0]?.Origin, 'USA')
  assert.equal(runtimeData[visibleDataRef]?.rows?.[0]?.__widgetva_highlight, true)
  assert.equal(runtimeData[visibleDataRef]?.rows?.[1]?.__widgetva_highlight, false)
})

test('LinkEngine.propagate mirrors shared selections and selected-row feedback for cross-widget selection sharing', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const tableRef = makeWidgetRef({ widgetId: 'table' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/table_visible'

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [tableRef]: {
        ref: tableRef,
        widgetId: 'table',
        kind: 'table',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {
          currentDataRef: visibleDataRef,
          visibleCount: 2,
          selectedCount: 0,
        },
        encodings: {},
        transforms: [],
        view: {},
        selections: {
          [`${tableRef}/selection/local_focus`]: {
            kind: 'point',
            predicates: [{ field: 'Origin', op: 'equals', value: 'Japan' }],
            summary: 'local',
          },
        },
        feedback: {},
        rawSpec: {
          data: {
            values: [
              { Origin: 'USA', Model: 'ford' },
              { Origin: 'Japan', Model: 'toyota' },
            ],
          },
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            kind: 'point',
            predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
            summary: 'USA only',
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const runtimeData = {
    [visibleDataRef]: {
      ref: visibleDataRef,
      rows: [
        { Origin: 'USA', Model: 'ford' },
        { Origin: 'Japan', Model: 'toyota' },
      ],
      handle: {
        ref: visibleDataRef,
        stats: {
          selectedCount: 0,
        },
      },
      widgetRef: tableRef,
    },
  }

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_shares_table_selection',
            kind: 'sharesSelection',
            from: selectionRef,
            to: tableRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'table',
            fieldMapping: [{ sourceField: 'Origin', targetField: 'Origin' }],
            propagationPolicy: 'automatic',
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      readRuntimeData(ref) {
        return runtimeData[ref] || null
      },
      updateRuntimeData(ref, updater) {
        runtimeData[ref] = updater(runtimeData[ref])
      },
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
      syncSelectionRuntimeData() {},
    },
  })

  linkEngine.propagate({ sourceRef: selectionRef, state: currentState })

  const targetState = currentState.widgets?.[tableRef]
  const mirroredSelectionRef = `${tableRef}/selection/shared_brush`
  const mirroredSelection = targetState?.selections?.[mirroredSelectionRef]
  const localSelection = targetState?.selections?.[`${tableRef}/selection/local_focus`]
  const selectedRows = targetState?.rawSpec?.data?.values?.filter((row) => row?.__widgetva_selected === true) || []

  assert.ok(mirroredSelection)
  assert.deepEqual(mirroredSelection?.predicates, [{ field: 'Origin', op: 'equals', value: 'USA' }])
  assert.equal(mirroredSelection?.summary, 'USA only')
  assert.ok(localSelection)
  assert.equal(targetState?.data?.selectedCount, 1)
  assert.equal(targetState?.feedback?.sharedSelectionSourceWidgetId, 'scatter')
  assert.deepEqual(targetState?.feedback?.linkedSourceRefs, [selectionRef])
  assert.equal(selectedRows.length, 1)
  assert.equal(selectedRows[0]?.Origin, 'USA')
  assert.equal(runtimeData[visibleDataRef]?.rows?.[0]?.__widgetva_selected, true)
  assert.equal(runtimeData[visibleDataRef]?.rows?.[1]?.__widgetva_selected, false)
  assert.equal(runtimeData[visibleDataRef]?.handle?.stats?.selectedCount, 1)
})

test('LinkEngine.evaluatePropagation reports highlight consistency checks after cross-widget highlighting', () => {
  const tableRef = makeWidgetRef({ widgetId: 'table' })
  const selectionRef = makeSelectionRef({ widgetId: 'summary', selectionId: 'category' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/table_visible'

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [tableRef]: {
        ref: tableRef,
        widgetId: 'table',
        kind: 'table',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {
          currentDataRef: visibleDataRef,
          visibleCount: 2,
          selectedCount: 0,
        },
        encodings: {},
        transforms: [],
        view: {},
        selections: {},
        feedback: {},
        rawSpec: {
          data: {
            values: [
              { Origin: 'USA', Model: 'ford' },
              { Origin: 'Japan', Model: 'toyota' },
            ],
          },
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            kind: 'point',
            predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const runtimeData = {
    [visibleDataRef]: {
      ref: visibleDataRef,
      rows: [
        { Origin: 'USA', Model: 'ford' },
        { Origin: 'Japan', Model: 'toyota' },
      ],
      handle: {
        ref: visibleDataRef,
      },
      widgetRef: tableRef,
    },
  }

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/summary_highlights_table',
            kind: 'highlight',
            from: selectionRef,
            to: tableRef,
            sourceWidgetId: 'summary',
            targetWidgetId: 'table',
            fieldMapping: [{ sourceField: 'Origin', targetField: 'Origin' }],
            propagationPolicy: 'automatic',
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      readRuntimeData(ref) {
        return runtimeData[ref] || null
      },
      updateRuntimeData(ref, updater) {
        runtimeData[ref] = updater(runtimeData[ref])
      },
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
    },
  })

  linkEngine.propagate({ sourceRef: selectionRef, state: currentState })
  const evaluation = linkEngine.evaluatePropagation({ sourceRef: selectionRef, state: currentState })
  const result = evaluation.results[0]
  const checksByName = Object.fromEntries((result?.checks || []).map((check) => [check.name, check]))

  assert.equal(evaluation.ok, true)
  assert.equal(result?.primitive, 'highlight')
  assert.equal(checksByName.linkCanApply?.passed, true)
  assert.equal(checksByName.targetExists?.passed, true)
  assert.equal(checksByName.inboundLinkRegistered?.passed, true)
  assert.equal(checksByName.highlightFeedbackPresent?.passed, true)
  assert.deepEqual(checksByName.highlightFeedbackPresent?.actual, {
    highlightedKeys: 1,
    highlightedRows: 1,
  })
})

test('LinkEngine.evaluatePropagation reports mirrored selection consistency after selection sharing', () => {
  const tableRef = makeWidgetRef({ widgetId: 'table' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/table_visible'

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [tableRef]: {
        ref: tableRef,
        widgetId: 'table',
        kind: 'table',
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: {
          currentDataRef: visibleDataRef,
          visibleCount: 2,
          selectedCount: 0,
        },
        encodings: {},
        transforms: [],
        view: {},
        selections: {},
        feedback: {},
        rawSpec: {
          data: {
            values: [
              { Origin: 'USA', Model: 'ford' },
              { Origin: 'Japan', Model: 'toyota' },
            ],
          },
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            kind: 'point',
            predicates: [{ field: 'Origin', op: 'equals', value: 'USA' }],
            summary: 'USA only',
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const runtimeData = {
    [visibleDataRef]: {
      ref: visibleDataRef,
      rows: [
        { Origin: 'USA', Model: 'ford' },
        { Origin: 'Japan', Model: 'toyota' },
      ],
      handle: {
        ref: visibleDataRef,
        stats: {
          selectedCount: 0,
        },
      },
      widgetRef: tableRef,
    },
  }

  const linkEngine = new LinkEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_shares_table_selection',
            kind: 'sharesSelection',
            from: selectionRef,
            to: tableRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'table',
            fieldMapping: [{ sourceField: 'Origin', targetField: 'Origin' }],
            propagationPolicy: 'automatic',
          },
        ]
      },
      readState() {
        return currentState
      },
      getWidgetState(ref) {
        return currentState.widgets?.[ref] || null
      },
      clearWidgetPatches() {},
      readRuntimeData(ref) {
        return runtimeData[ref] || null
      },
      updateRuntimeData(ref, updater) {
        runtimeData[ref] = updater(runtimeData[ref])
      },
      patchWidget(ref, patch) {
        currentState = makeWorkspaceState({
          ...currentState,
          widgets: {
            ...currentState.widgets,
            [ref]: {
              ...(currentState.widgets?.[ref] || {}),
              ...patch,
            },
          },
        })
        return currentState
      },
      syncSelectionRuntimeData() {},
    },
  })

  linkEngine.propagate({ sourceRef: selectionRef, state: currentState })
  const evaluation = linkEngine.evaluatePropagation({ sourceRef: selectionRef, state: currentState })
  const result = evaluation.results[0]
  const checksByName = Object.fromEntries((result?.checks || []).map((check) => [check.name, check]))

  assert.equal(evaluation.ok, true)
  assert.equal(result?.primitive, 'sharesSelection')
  assert.equal(checksByName.linkCanApply?.passed, true)
  assert.equal(checksByName.targetExists?.passed, true)
  assert.equal(checksByName.inboundLinkRegistered?.passed, true)
  assert.equal(checksByName.mirroredSelectionExists?.passed, true)
  assert.equal(checksByName.mirroredSelectionCountMatches?.passed, true)
  assert.equal(checksByName.mirroredSelectionCountMatches?.actual, 1)
  assert.equal(checksByName.mirroredSelectionCountMatches?.expected, 1)
})
