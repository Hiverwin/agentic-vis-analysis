import test from 'node:test'
import assert from 'node:assert/strict'

import { makeWorkspaceState } from '../../contracts/state-contracts.js'
import { makeWidgetRef, makeSelectionRef } from '../../contracts/refs-contracts.js'
import { CoordinationEngine } from './CoordinationEngine.js'

function makeMutableTestStore({ state, links = [], runtimeData = {} } = {}) {
  let currentState = makeWorkspaceState(state || {})
  return {
    store: {
      listLinks() {
        return links
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
    readState() {
      return currentState
    },
    runtimeData,
  }
}

test('CoordinationEngine.describeEngine derives T6 topology for one-to-many coordinated workspaces', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const detailRef = makeWidgetRef({ widgetId: 'detail' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  const coordinationEngine = new CoordinationEngine({
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
            ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_detail',
            kind: 'filter',
            from: selectionRef,
            to: detailRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'detail',
            propagationPolicy: 'automatic',
          },
        ]
      },
      readDescription() {
        return {
          widgets: [
            { ref: scatterRef, widgetId: 'scatter', role: 'primary' },
            { ref: barRef, widgetId: 'bar', role: 'summary' },
            { ref: detailRef, widgetId: 'detail', role: 'detail' },
          ],
        }
      },
    },
  })

  const summary = coordinationEngine.describeEngine()
  const filterLinkKind = summary.linkKinds.find((entry) => entry.name === 'filter')

  assert.equal(summary.topology.topology, 'T6')
  assert.equal(summary.topology.widgetCount, 3)
  assert.equal(summary.topology.maxOutDegree, 2)
  assert.equal(summary.topology.targetWidgetCount, 2)
  assert.equal(Object.hasOwn(summary, 'primitives'), false)
  assert.deepEqual(filterLinkKind?.appliedStatePaths, ['transforms', 'data.currentDataRef', 'feedback.inboundLinkIds'])
})

test('CoordinationEngine.describeEngine derives T2 topology for two-widget coordinated pairs', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  const coordinationEngine = new CoordinationEngine({
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

  const summary = coordinationEngine.describeEngine()

  assert.equal(summary.topology.topology, 'T2')
  assert.equal(summary.topology.widgetCount, 2)
  assert.equal(summary.topology.edgeCount, 1)
})

test('CoordinationEngine.describeEngine counts canonical state-to-state relations', () => {
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const selectionRef = makeSelectionRef({ widgetId: 'bar', selectionId: 'region' })

  const coordinationEngine = new CoordinationEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/bar_filters_scatter',
            sourceStateRef: selectionRef,
            targetStateRef: `${scatterRef}/transform/region-filter`,
            relation: 'controls',
            transform: {
              kind: 'selectionToFilter',
              fieldMapping: [{ sourceField: 'region', targetField: 'region' }],
            },
            activation: 'automatic',
          },
        ]
      },
      readDescription() {
        return {
          widgets: [
            { ref: barRef, widgetId: 'bar', role: 'primary' },
            { ref: scatterRef, widgetId: 'scatter', role: 'detail' },
          ],
        }
      },
    },
  })

  const summary = coordinationEngine.describeEngine()

  assert.equal(summary.coordinationLinkCount, 1)
  assert.equal(summary.structuralLinkCount, 0)
  assert.equal(summary.topology.topology, 'T3')
  assert.equal(summary.topology.edgeCount, 1)
  assert.equal(summary.topology.sourceWidgetCount, 1)
  assert.equal(summary.topology.targetWidgetCount, 1)
})

test('CoordinationEngine.describeEngine excludes structural links from topology counts', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/scatter_visible'

  const coordinationEngine = new CoordinationEngine({
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

  const summary = coordinationEngine.describeEngine()

  assert.equal(summary.linkCount, 2)
  assert.equal(summary.coordinationLinkCount, 0)
  assert.equal(summary.structuralLinkCount, 2)
  assert.equal(summary.topology.topology, 'T1')
  assert.equal(summary.topology.edgeCount, 0)
})

test('CoordinationEngine treats explicit automatic false links as manual when propagationPolicy is omitted', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  const coordinationEngine = new CoordinationEngine({
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

  const summary = coordinationEngine.describeEngine()
  const propagation = coordinationEngine.describePropagation({ sourceRef: selectionRef })

  assert.equal(summary.automaticLinkCount, 0)
  assert.equal(summary.manualLinkCount, 1)
  assert.equal(propagation[0]?.activationPolicy, 'manual')
  assert.equal(propagation[0]?.effectConstraint, null)
})

test('CoordinationEngine.describeLinks returns a compact agent-facing coordination summary', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  const coordinationEngine = new CoordinationEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_filters_bar',
            linkId: 'scatter_filters_bar',
            kind: 'filter',
            from: selectionRef,
            to: barRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'bar',
            targetWidgetKind: 'bar',
            activationPolicy: 'manual',
            fieldMapping: [{ sourceField: 'Origin', targetField: 'Origin' }],
            responseSpec: { kind: 'linkedFilter' },
            description: 'Scatter brush filters the bar chart.',
          },
        ]
      },
      readDescription() {
        return {
          widgets: [
            { ref: scatterRef, widgetId: 'scatter', kind: 'scatter' },
            { ref: barRef, widgetId: 'bar', kind: 'bar' },
          ],
        }
      },
    },
  })

  const summaries = coordinationEngine.describeLinks()

  assert.equal(summaries.length, 1)
  assert.equal(summaries[0]?.linkId, 'scatter_filters_bar')
  assert.equal(summaries[0]?.sourceWidgetKind, 'scatter')
  assert.equal(summaries[0]?.targetWidgetKind, 'bar')
  assert.equal(summaries[0]?.targetEffect, 'applyFilter')
  assert.equal(summaries[0]?.triggerSummary, 'scatter selection drives bar applyFilter')
  assert.equal(summaries[0]?.description, 'Scatter brush filters the bar chart.')
  assert.equal(Object.hasOwn(summaries[0] || {}, 'fieldMapping'), false)
  assert.equal(Object.hasOwn(summaries[0] || {}, 'responseSpec'), false)

  const internalSummaries = coordinationEngine.describeLinks({ includeInternal: true })
  assert.deepEqual(internalSummaries[0]?.fieldMapping, [{ sourceField: 'Origin', targetField: 'Origin' }])
  assert.deepEqual(internalSummaries[0]?.responseSpec, { kind: 'linkedFilter' })
})

test('CoordinationEngine.applyLink explicitly applies a manual coordination link without enabling automatic propagation', () => {
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/bar_visible'
  const linkRef = 'wl://widgetva-app/workspace/main/link/scatter_filters_bar'

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
        transforms: [],
        selections: {},
        feedback: {},
        rawSpec: {
          data: {
            values: [
              { Origin: 'USA', count: 1 },
              { Origin: 'Japan', count: 1 },
            ],
          },
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: {
            selectionRef,
            sourceWidgetId: 'scatter',
            kind: 'point',
            predicates: [{ field: 'Origin', op: 'equals', value: 'Japan' }],
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
        { Origin: 'USA', count: 1 },
        { Origin: 'Japan', count: 1 },
      ],
      baseRows: [
        { Origin: 'USA', count: 1 },
        { Origin: 'Japan', count: 1 },
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

  const coordinationEngine = new CoordinationEngine({
    store: {
      listLinks() {
        return [
          {
            ref: linkRef,
            linkId: 'scatter_filters_bar',
            kind: 'filter',
            effect: 'applyFilter',
            from: selectionRef,
            to: barRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'bar',
            activationPolicy: 'manual',
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

  const automaticResult = coordinationEngine.propagate({ sourceRef: selectionRef, state: currentState })
  assert.equal(automaticResult.appliedLinkCount, 0)
  assert.equal(automaticResult.skippedTargets[0]?.reason, 'manual_activation_policy')
  assert.equal(currentState.widgets?.[barRef]?.data?.visibleCount, 2)

  const explicitResult = coordinationEngine.applyLink({ linkRef, state: currentState })

  assert.equal(explicitResult.ok, true)
  assert.equal(explicitResult.appliedLinkCount, 1)
  assert.deepEqual(explicitResult.affectedRefs, [barRef])
  assert.equal(explicitResult.patch?.[barRef]?.data?.visibleCount, 1)
  assert.equal(explicitResult.patch?.[barRef]?.transforms?.[0]?.kind, 'filter')
  assert.equal(currentState.widgets?.[barRef]?.data?.visibleCount, 1)
  assert.equal(runtimeData[visibleDataRef]?.rows?.[0]?.Origin, 'Japan')
})

test('CoordinationEngine.propagate clears target filter projection when the source selection was reset', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/bar_visible'
  const linkRef = 'wl://widgetva-app/workspace/main/coordination/scatter_to_bar'
  const transformRef = `${barRef}/transform/scatter_to_bar`
  const runtimeData = {
    [visibleDataRef]: {
      ref: visibleDataRef,
      rows: [{ Origin: 'Japan', count: 1 }],
      baseRows: [
        { Origin: 'USA', count: 1 },
        { Origin: 'Japan', count: 1 },
      ],
      handle: {
        ref: visibleDataRef,
        stats: {
          rowCount: 2,
          visibleCount: 1,
          selectedCount: 0,
        },
      },
      widgetRef: barRef,
    },
  }
  const { store } = makeMutableTestStore({
    runtimeData,
    state: {
      widgets: {
        [scatterRef]: {
          ref: scatterRef,
          widgetId: 'scatter',
          kind: 'scatter',
          selections: {},
        },
        [barRef]: {
          ref: barRef,
          widgetId: 'bar',
          kind: 'bar',
          transforms: [{
            ref: transformRef,
            kind: 'filter',
            sourceRef: selectionRef,
            spec: {
              linkRef,
              sourceSelectionRef: selectionRef,
            },
          }],
          data: {
            currentDataRef: visibleDataRef,
            rowCount: 2,
            visibleCount: 1,
            selectedCount: 0,
          },
        },
      },
      shared: {
        selections: {
          registry: {},
          views: {
            primary: null,
            byWidget: {},
          },
        },
      },
    },
    links: [{
      ref: linkRef,
      linkId: 'scatter_to_bar',
      kind: 'filter',
      effect: 'applyFilter',
      from: selectionRef,
      to: barRef,
      sourceWidgetId: 'scatter',
      targetWidgetId: 'bar',
      activationPolicy: 'automatic',
    }],
  })

  const coordinationEngine = new CoordinationEngine({ store })
  const result = coordinationEngine.propagate({ sourceRef: selectionRef, state: store.readState() })

  assert.equal(result.appliedLinkCount, 1)
  assert.deepEqual(store.readState().widgets[barRef].transforms, [])
  assert.equal(store.readState().widgets[barRef].data.visibleCount, 2)
  assert.deepEqual(runtimeData[visibleDataRef].rows, runtimeData[visibleDataRef].baseRows)
})

test('CoordinationEngine preserves activationPolicy and effectConstraint in propagation descriptions', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  const coordinationEngine = new CoordinationEngine({
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

  const propagation = coordinationEngine.describePropagation({ sourceRef: selectionRef })

  assert.equal(propagation[0]?.activationPolicy, 'automatic')
  assert.equal(propagation[0]?.effectConstraint, null)
  assert.equal(propagation[0]?.declaredEffect, 'transformView')
  assert.equal(propagation[0]?.appliedEffect, 'transformView')
  assert.equal(propagation[0]?.responseSpec?.kind, 'drillDown')
})

test('CoordinationEngine resolves outgoing links by primary selection sourceWidgetId when links are widget-scoped', () => {
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
  const coordinationEngine = new CoordinationEngine({
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

  const propagation = coordinationEngine.describePropagation({ sourceRef: selectionRef })

  assert.equal(propagation.length, 1)
  assert.equal(propagation[0]?.targetRef, targetWidgetRef)
  assert.equal(propagation[0]?.sourceWidgetId, 'scatter')
  assert.equal(propagation[0]?.canApply, true)
})

test('CoordinationEngine applies highlight semantics when a filter link is constrained to highlightOnly', () => {
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

  const coordinationEngine = new CoordinationEngine({
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

  const result = coordinationEngine.propagate({ sourceRef: selectionRef, state: currentState })

  assert.equal(result.links[0]?.declaredEffect, 'applyFilter')
  assert.equal(result.links[0]?.appliedEffect, 'applyHighlight')
  assert.deepEqual(result.links[0]?.appliedStatePaths, ['feedback.highlightedKeys', 'feedback.inboundLinkIds'])
  assert.deepEqual(result.patch?.[barRef]?.feedback?.highlightedKeys || [], ['USA'])
  assert.deepEqual(result.patch?.shared?.highlight?.activeWidgetRefs || [], [barRef])
  assert.equal(currentState.widgets?.[barRef]?.transforms?.length || 0, 0)
  assert.deepEqual(currentState.widgets?.[barRef]?.feedback?.highlightedKeys || [], ['USA'])
  assert.equal(currentState.widgets?.[barRef]?.rawSpec?.data?.values?.[0]?.__widgetva_highlight, true)
  assert.equal(currentState.widgets?.[barRef]?.rawSpec?.data?.values?.[1]?.__widgetva_highlight, false)
})

test('CoordinationEngine applies focusTarget semantics through effect constraints at the library layer', () => {
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

  const coordinationEngine = new CoordinationEngine({
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

  const result = coordinationEngine.propagate({ sourceRef: selectionRef, state: currentState })
  const evaluation = coordinationEngine.evaluatePropagation({ sourceRef: selectionRef, state: currentState })

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

test('CoordinationEngine skips unsupported advanced responses cleanly', () => {
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

  const coordinationEngine = new CoordinationEngine({
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

  const result = coordinationEngine.propagate({ sourceRef: selectionRef, state: currentState })

  assert.equal(result.links.length, 0)
  assert.equal(result.skippedTargets.length, 1)
  assert.equal(result.skippedTargets[0]?.appliedEffect, 'transformStructure')
  assert.equal(result.skippedTargets[0]?.responseSpec?.kind, 'expand')
  assert.equal(result.skippedTargets[0]?.reason, 'unsupported_advanced_response')
})

test('CoordinationEngine explains skipped propagation targets when a link is manual', () => {
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  const coordinationEngine = new CoordinationEngine({
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

  const description = coordinationEngine.describePropagation({ sourceRef: selectionRef })
  const propagation = coordinationEngine.propagate({ sourceRef: selectionRef, state: coordinationEngine.store.readState() })

  assert.equal(description[0]?.canApply, false)
  assert.equal(description[0]?.skippedReason, 'manual_activation_policy')
  assert.deepEqual(propagation.affectedRefs, [])
  assert.equal(propagation.skippedTargets[0]?.reason, 'manual_activation_policy')
  assert.equal(propagation.appliedLinkCount, 0)
})

test('CoordinationEngine normalizes documented plural link kinds for propagation descriptions and execution', () => {
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

  const coordinationEngine = new CoordinationEngine({
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
      commitState(nextState) {
        currentState = makeWorkspaceState(nextState)
        return currentState
      },
      syncSelectionRuntimeData() {},
    },
  })

  const propagation = coordinationEngine.describePropagation({ sourceRef: selectionRef })
  const effects = coordinationEngine.collectEffects({ sourceRef: selectionRef })
  const result = coordinationEngine.propagate({ sourceRef: selectionRef, state: currentState })

  assert.equal(propagation[0]?.linkKind, 'filter')
  assert.equal(Object.hasOwn(propagation[0] || {}, 'primitive'), false)
  assert.equal(propagation[0]?.effect?.kind, 'filtersWidget')
  assert.equal(effects[0]?.kind, 'filtersWidget')
  assert.deepEqual(result.affectedRefs, [barRef])
  assert.equal(currentState.widgets?.[barRef]?.transforms?.[0]?.kind, 'filter')
})

test('CoordinationEngine.propagate preserves filter transform provenance in target widget state', () => {
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

  const coordinationEngine = new CoordinationEngine({
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

  const propagation = coordinationEngine.propagate({ sourceRef: selectionRef, state: currentState })

  const nextTransforms = currentState.widgets?.[barRef]?.transforms || []
  assert.equal(nextTransforms[0]?.kind, 'filter')
  assert.equal(nextTransforms[0]?.source, selectionRef)
  assert.equal(nextTransforms[0]?.sourceSelectionRef, selectionRef)
  assert.equal(nextTransforms[0]?.linkId, 'scatter_filters_bar')
  assert.equal(nextTransforms[0]?.spec?.linkRef, 'wl://widgetva-app/workspace/main/link/scatter_filters_bar')
  assert.deepEqual(nextTransforms[0]?.spec?.predicates, [{ field: 'Origin', op: 'equals', value: 'USA' }])
})

test('CoordinationEngine.propagate applies state-to-state coordination relations', () => {
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const selectionRef = `${barRef}/selection/region`
  const targetTransformRef = `${scatterRef}/transform/region-filter`

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [scatterRef]: {
        ref: scatterRef,
        widgetId: 'scatter',
        kind: 'scatter',
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
            ref: selectionRef,
            kind: 'point',
            sourceWidgetRef: barRef,
            field: 'region',
            values: ['Downtown'],
            predicates: [{ field: 'region', op: 'in', value: ['Downtown'] }],
            summary: 'region: Downtown',
          },
        },
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
  })

  const coordinationEngine = new CoordinationEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/coordination/bar-region-to-scatter-filter',
            sourceStateRef: selectionRef,
            targetStateRef: targetTransformRef,
            relation: 'controls',
            transform: {
              kind: 'selectionToFilter',
              fieldMapping: [
                { sourceField: 'region', targetField: 'region' },
              ],
            },
            activation: 'automatic',
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

  const propagation = coordinationEngine.propagate({ sourceRef: selectionRef, state: currentState })

  const nextTransforms = currentState.widgets?.[scatterRef]?.transforms || []
  assert.equal(propagation.appliedLinkCount, 1)
  assert.deepEqual(propagation.affectedRefs, [scatterRef])
  assert.equal(nextTransforms[0]?.ref, targetTransformRef)
  assert.equal(nextTransforms[0]?.kind, 'filter')
  assert.equal(nextTransforms[0]?.source, 'coordination')
  assert.equal(nextTransforms[0]?.sourceRef, selectionRef)
  assert.deepEqual(nextTransforms[0]?.predicate, {
    field: 'region',
    op: 'in',
    value: ['Downtown'],
  })
  assert.equal(nextTransforms[0]?.params?.relationRef, 'wl://widgetva-app/workspace/main/coordination/bar-region-to-scatter-filter')
})

test('CoordinationEngine.propagate maps interval selections to target filter transforms', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = `${scatterRef}/selection/date-brush`
  const targetTransformRef = `${barRef}/transform/date-filter`
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/bar_visible'
  const rows = [
    { date: '2024-01-15', weather: 'sun', count: 4 },
    { date: '2024-03-15', weather: 'rain', count: 7 },
    { date: '2024-05-15', weather: 'sun', count: 9 },
  ]
  const { store, readState, runtimeData } = makeMutableTestStore({
    state: {
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [barRef]: {
          ref: barRef,
          widgetId: 'bar',
          kind: 'bar',
          data: {
            currentDataRef: visibleDataRef,
            visibleCount: rows.length,
            selectedCount: 0,
          },
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
              ref: selectionRef,
              kind: 'interval',
              sourceWidgetRef: scatterRef,
              channels: {
                x: { field: 'date', domain: ['2024-01-01', '2024-03-31'] },
              },
            },
          },
          views: { primary: null, byWidget: {} },
        },
      },
    },
    runtimeData: {
      [visibleDataRef]: {
        ref: visibleDataRef,
        rows,
        baseRows: rows,
        handle: { ref: visibleDataRef, stats: { rowCount: rows.length, visibleCount: rows.length, selectedCount: 0 } },
        widgetRef: barRef,
      },
    },
    links: [{
      ref: 'wl://widgetva-app/workspace/main/coordination/scatter-brush-to-bar-date-filter',
      sourceStateRef: selectionRef,
      targetStateRef: targetTransformRef,
      relation: 'controls',
      transform: {
        kind: 'intervalToFilter',
        channelMapping: [{ sourceChannel: 'x', targetField: 'date' }],
      },
      activation: 'automatic',
    }],
  })
  const coordinationEngine = new CoordinationEngine({ store })

  const propagation = coordinationEngine.propagate({ sourceRef: selectionRef, state: readState() })
  const nextState = readState()
  const transform = nextState.widgets?.[barRef]?.transforms?.[0]

  assert.equal(propagation.appliedLinkCount, 1)
  assert.equal(transform?.ref, targetTransformRef)
  assert.deepEqual(transform?.predicate, {
    field: 'date',
    op: 'between',
    value: ['2024-01-01', '2024-03-31'],
  })
  assert.equal(nextState.widgets?.[barRef]?.data?.visibleCount, 2)
  assert.deepEqual(runtimeData[visibleDataRef]?.rows?.map((row) => row.date), ['2024-01-15', '2024-03-15'])
})

test('CoordinationEngine.propagate maps interval selections to target view domains', () => {
  const overviewRef = makeWidgetRef({ widgetId: 'overview' })
  const detailRef = makeWidgetRef({ widgetId: 'detail' })
  const selectionRef = `${overviewRef}/selection/time-brush`
  const targetStateRef = `${detailRef}/view/xDomain`
  const { store, readState } = makeMutableTestStore({
    state: {
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [detailRef]: {
          ref: detailRef,
          widgetId: 'detail',
          kind: 'line',
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
              ref: selectionRef,
              kind: 'interval',
              sourceWidgetRef: overviewRef,
              channels: {
                x: { field: 'month', domain: ['2024-01', '2024-06'] },
              },
            },
          },
          views: { primary: null, byWidget: {} },
        },
      },
    },
    links: [{
      ref: 'wl://widgetva-app/workspace/main/coordination/overview-brush-to-detail-domain',
      sourceStateRef: selectionRef,
      targetStateRef,
      relation: 'controls',
      transform: {
        kind: 'intervalToDomain',
        channelMapping: [{ sourceChannel: 'x', targetChannel: 'x' }],
      },
      activation: 'automatic',
    }],
  })
  const coordinationEngine = new CoordinationEngine({ store })

  const propagation = coordinationEngine.propagate({ sourceRef: selectionRef, state: readState() })
  const view = readState().widgets?.[detailRef]?.view

  assert.equal(propagation.appliedLinkCount, 1)
  assert.deepEqual(view?.xDomain, ['2024-01', '2024-06'])
})

test('CoordinationEngine.propagate maps canonical coordination relations from source view domains to target filter transforms', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const sourceStateRef = `${scatterRef}/view/zoom`
  const targetTransformRef = `${barRef}/transform/scatter-visible-region-filter`
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/bar_visible'
  const relationRef = 'wl://widgetva-app/workspace/main/coordination/scatter-zoom-to-bar-distribution'
  const rows = [
    { marketing_spend: 2500, visitors: 7000, region: 'Central' },
    { marketing_spend: 3600, visitors: 9500, region: 'Downtown' },
    { marketing_spend: 4200, visitors: 8500, region: 'Harbor' },
  ]
  const { store, readState, runtimeData } = makeMutableTestStore({
    state: {
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [scatterRef]: {
          ref: scatterRef,
          widgetId: 'scatter',
          kind: 'scatter',
          data: {},
          encodings: {},
          transforms: [],
          view: {
            xDomain: [3000, 4500],
            yDomain: [9000, 11000],
            zoom: {
              domain: {
                xDomain: [3000, 4500],
                yDomain: [9000, 11000],
              },
            },
          },
          selections: {},
          feedback: {},
        },
        [barRef]: {
          ref: barRef,
          widgetId: 'bar',
          kind: 'bar',
          data: {
            currentDataRef: visibleDataRef,
            visibleCount: rows.length,
            selectedCount: 0,
          },
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
          feedback: {},
        },
      },
      coordination: {
        relations: {
          [relationRef]: {
            ref: relationRef,
            sourceStateRef,
            targetStateRef: targetTransformRef,
            relation: 'controls',
            transform: {
              kind: 'domainToFilter',
              channelMapping: [
                { sourceChannel: 'x', targetField: 'marketing_spend' },
                { sourceChannel: 'y', targetField: 'visitors' },
              ],
            },
            activation: 'automatic',
          },
        },
      },
    },
    runtimeData: {
      [visibleDataRef]: {
        ref: visibleDataRef,
        rows,
        baseRows: rows,
        handle: { ref: visibleDataRef, stats: { rowCount: rows.length, visibleCount: rows.length, selectedCount: 0 } },
        widgetRef: barRef,
      },
    },
  })
  const coordinationEngine = new CoordinationEngine({ store })

  const propagation = coordinationEngine.propagate({ sourceRef: sourceStateRef, state: readState() })
  const nextState = readState()
  const transform = nextState.widgets?.[barRef]?.transforms?.[0]

  assert.equal(propagation.appliedLinkCount, 1)
  assert.equal(transform?.ref, targetTransformRef)
  assert.deepEqual(transform?.predicate, [
    { field: 'marketing_spend', op: 'between', value: [3000, 4500] },
    { field: 'visitors', op: 'between', value: [9000, 11000] },
  ])
  assert.equal(nextState.widgets?.[barRef]?.data?.visibleCount, 1)
  assert.deepEqual(runtimeData[visibleDataRef]?.rows?.map((row) => row.region), ['Downtown'])
})

test('CoordinationEngine.propagate maps source view domains to target view reencode state', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const sourceStateRef = `${scatterRef}/view/zoom`
  const targetStateRef = `${barRef}/view/reencode`
  const relationRef = 'wl://widgetva-app/workspace/main/coordination/scatter-zoom-to-bar-reencode'
  const { store, readState } = makeMutableTestStore({
    state: {
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [scatterRef]: {
          ref: scatterRef,
          widgetId: 'scatter',
          kind: 'scatter',
          data: {},
          encodings: {},
          transforms: [],
          view: {
            xDomain: [3000, 4500],
            zoom: { domain: { xDomain: [3000, 4500] } },
          },
          selections: {},
          feedback: {},
        },
        [barRef]: {
          ref: barRef,
          widgetId: 'bar',
          kind: 'bar',
          data: {},
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
          feedback: {},
        },
      },
    },
    links: [{
      ref: relationRef,
      sourceStateRef,
      targetStateRef,
      relation: 'controls',
      transform: {
        kind: 'domainToReencode',
        channelMapping: [{ sourceChannel: 'x', targetField: 'marketing_spend' }],
        reencode: { channel: 'opacity', mode: 'emphasizeDomain' },
      },
      activation: 'automatic',
    }],
  })
  const coordinationEngine = new CoordinationEngine({ store })

  const propagation = coordinationEngine.propagate({ sourceRef: sourceStateRef, state: readState() })
  const reencode = readState().widgets?.[barRef]?.view?.reencode

  assert.equal(propagation.appliedLinkCount, 1)
  assert.equal(reencode?.sourceAction, 'coordination.domainToReencode')
  assert.equal(reencode?.mode, 'emphasizeDomain')
  assert.deepEqual(reencode?.sourcePredicate, {
    field: 'marketing_spend',
    op: 'between',
    value: [3000, 4500],
  })
})

test('CoordinationEngine.propagate maps selections to target view reencode state', () => {
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const selectionRef = `${barRef}/selection/region`
  const targetStateRef = `${scatterRef}/view/reencode`
  const relationRef = 'wl://widgetva-app/workspace/main/coordination/bar-region-to-scatter-reencode'
  const { store, readState } = makeMutableTestStore({
    state: {
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [scatterRef]: {
          ref: scatterRef,
          widgetId: 'scatter',
          kind: 'scatter',
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
              ref: selectionRef,
              kind: 'point',
              sourceWidgetRef: barRef,
              field: 'region',
              values: ['Central'],
              predicates: [{ field: 'region', op: 'in', value: ['Central'] }],
              summary: 'region: Central',
            },
          },
          views: { primary: null, byWidget: {} },
        },
      },
    },
    links: [{
      ref: relationRef,
      sourceStateRef: selectionRef,
      targetStateRef,
      relation: 'controls',
      transform: {
        kind: 'selectionToReencode',
        fieldMapping: [{ sourceField: 'region', targetField: 'region' }],
        reencode: { channel: 'color', mode: 'emphasizeSelection' },
      },
      activation: 'automatic',
    }],
  })
  const coordinationEngine = new CoordinationEngine({ store })

  const propagation = coordinationEngine.propagate({ sourceRef: selectionRef, state: readState() })
  const reencode = readState().widgets?.[scatterRef]?.view?.reencode

  assert.equal(propagation.appliedLinkCount, 1)
  assert.equal(reencode?.sourceAction, 'coordination.selectionToReencode')
  assert.equal(reencode?.channel, 'color')
  assert.deepEqual(reencode?.sourceSelection?.predicates, [
    { field: 'region', op: 'in', value: ['Central'] },
  ])
})

test('CoordinationEngine.propagate maps reencode state to target reencode state', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const sourceStateRef = `${scatterRef}/view/reencode`
  const targetStateRef = `${barRef}/view/reencode`
  const relationRef = 'wl://widgetva-app/workspace/main/coordination/scatter-reencode-to-bar-reencode'
  const { store, readState } = makeMutableTestStore({
    state: {
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [scatterRef]: {
          ref: scatterRef,
          widgetId: 'scatter',
          kind: 'scatter',
          data: {},
          encodings: {},
          transforms: [],
          view: {
            reencode: {
              sourceAction: 'scatter.reencodeColor',
              channel: 'color',
              field: 'cluster',
              mode: 'semanticColor',
            },
          },
          selections: {},
          feedback: {},
        },
        [barRef]: {
          ref: barRef,
          widgetId: 'bar',
          kind: 'bar',
          data: {},
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
          feedback: {},
        },
      },
    },
    links: [{
      ref: relationRef,
      sourceStateRef,
      targetStateRef,
      relation: 'controls',
      transform: {
        kind: 'reencodeToReencode',
        reencodeMapping: [{ sourceChannel: 'color', targetChannel: 'color' }],
      },
      activation: 'automatic',
    }],
  })
  const coordinationEngine = new CoordinationEngine({ store })

  const propagation = coordinationEngine.propagate({ sourceRef: sourceStateRef, state: readState() })
  const reencode = readState().widgets?.[barRef]?.view?.reencode

  assert.equal(propagation.appliedLinkCount, 1)
  assert.equal(reencode?.sourceAction, 'coordination.reencodeToReencode')
  assert.equal(reencode?.channel, 'color')
  assert.equal(reencode?.field, 'cluster')
  assert.deepEqual(reencode?.mapping, [{ sourceChannel: 'color', targetChannel: 'color' }])
})

test('CoordinationEngine.propagate maps bar sort state to target reencode state', () => {
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const heatmapRef = makeWidgetRef({ widgetId: 'heatmap' })
  const sourceStateRef = `${barRef}/view/sort`
  const targetStateRef = `${heatmapRef}/view/reencode`
  const relationRef = 'wl://widgetva-app/workspace/main/coordination/bar-sort-to-heatmap-reencode'
  const { store, readState } = makeMutableTestStore({
    state: {
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [barRef]: {
          ref: barRef,
          widgetId: 'bar',
          kind: 'bar',
          data: {},
          encodings: {},
          transforms: [],
          view: {
            sort: {
              sourceAction: 'bar.sortBars',
              channel: 'x',
              order: 'descending',
              categoryField: 'region',
              field: 'visitors',
              sortField: 'visitors',
              aggregate: 'sum',
            },
          },
          selections: {},
          feedback: {},
        },
        [heatmapRef]: {
          ref: heatmapRef,
          widgetId: 'heatmap',
          kind: 'heatmap',
          data: {},
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
          feedback: {},
        },
      },
    },
    links: [{
      ref: relationRef,
      sourceStateRef,
      targetStateRef,
      relation: 'controls',
      transform: {
        kind: 'reencodeToReencode',
        fieldMapping: [{ sourceField: 'region', targetField: 'region' }],
        reencodeMapping: [{ sourceChannel: 'order', targetChannel: 'opacity' }],
        reencode: {
          channel: 'opacity',
          mode: 'alignSortOrder',
          sourceSlot: 'view.sort',
        },
      },
      activation: 'automatic',
    }],
  })
  const coordinationEngine = new CoordinationEngine({ store })

  const propagation = coordinationEngine.propagate({ sourceRef: sourceStateRef, state: readState() })
  const reencode = readState().widgets?.[heatmapRef]?.view?.reencode

  assert.equal(propagation.appliedLinkCount, 1)
  assert.equal(reencode?.sourceAction, 'coordination.reencodeToReencode')
  assert.equal(reencode?.mode, 'alignSortOrder')
  assert.equal(reencode?.sourceSlot, 'view.sort')
  assert.equal(reencode?.field, 'region')
  assert.equal(reencode?.sortField, 'visitors')
  assert.equal(reencode?.order, 'descending')
  assert.deepEqual(reencode?.mapping, [{ sourceChannel: 'order', targetChannel: 'opacity' }])
})

test('CoordinationEngine.findOutgoing does not trigger canonical view links from a widget selection', () => {
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const heatmapRef = makeWidgetRef({ widgetId: 'heatmap' })
  const selectionRef = `${barRef}/selection/region`
  const sortRef = `${barRef}/view/sort`
  const sortRelationRef = 'wl://widgetva-app/workspace/main/coordination/bar-sort-to-heatmap-reencode'
  const { store, readState } = makeMutableTestStore({
    state: {
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [barRef]: {
          ref: barRef,
          widgetId: 'bar',
          kind: 'bar',
          data: {},
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
          feedback: {},
        },
        [heatmapRef]: {
          ref: heatmapRef,
          widgetId: 'heatmap',
          kind: 'heatmap',
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
              ref: selectionRef,
              kind: 'point',
              sourceWidgetRef: barRef,
              sourceWidgetId: 'bar',
              predicates: [{ field: 'region', op: 'in', value: ['Central'] }],
            },
          },
          views: { primary: null, byWidget: {} },
        },
      },
    },
    links: [{
      ref: sortRelationRef,
      sourceStateRef: sortRef,
      targetStateRef: `${heatmapRef}/view/reencode`,
      relation: 'controls',
      transform: {
        kind: 'reencodeToReencode',
        reencode: {
          channel: 'opacity',
          mode: 'alignSortOrder',
          sourceSlot: 'view.sort',
        },
      },
      activation: 'automatic',
    }],
  })
  const coordinationEngine = new CoordinationEngine({ store })

  assert.deepEqual(coordinationEngine.findOutgoing({ sourceRef: selectionRef, state: readState() }), [])
  assert.equal(coordinationEngine.findOutgoing({ sourceRef: sortRef, state: readState() }).length, 1)
})

test('CoordinationEngine.propagate maps sankey structure state to target reencode state', () => {
  const sankeyRef = makeWidgetRef({ widgetId: 'sankey' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const sourceStateRef = `${sankeyRef}/view/addRemove`
  const targetStateRef = `${barRef}/view/reencode`
  const relationRef = 'wl://widgetva-app/workspace/main/coordination/sankey-structure-to-bar-reencode'
  const { store, readState } = makeMutableTestStore({
    state: {
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [sankeyRef]: {
          ref: sankeyRef,
          widgetId: 'sankey',
          kind: 'sankey',
          data: {},
          encodings: {},
          transforms: [],
          view: {
            addRemove: {
              sourceAction: 'sankey.collapseNodes',
              mode: 'nodeCollapse',
              nodes: ['A', 'B'],
              aggregateName: 'Other',
            },
          },
          selections: {},
          feedback: {},
        },
        [barRef]: {
          ref: barRef,
          widgetId: 'bar',
          kind: 'bar',
          data: {},
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
          feedback: {},
        },
      },
    },
    links: [{
      ref: relationRef,
      sourceStateRef,
      targetStateRef,
      relation: 'controls',
      transform: {
        kind: 'reencodeToReencode',
        fieldMapping: [{ sourceField: 'region', targetField: 'region' }],
        reencodeMapping: [{ sourceChannel: 'grouping', targetChannel: 'color' }],
        reencode: {
          channel: 'color',
          mode: 'projectGrouping',
          sourceSlot: 'view.addRemove',
        },
      },
      activation: 'automatic',
    }],
  })
  const coordinationEngine = new CoordinationEngine({ store })

  const propagation = coordinationEngine.propagate({ sourceRef: sourceStateRef, state: readState() })
  const reencode = readState().widgets?.[barRef]?.view?.reencode

  assert.equal(propagation.appliedLinkCount, 1)
  assert.equal(reencode?.sourceAction, 'coordination.reencodeToReencode')
  assert.equal(reencode?.mode, 'projectGrouping')
  assert.equal(reencode?.sourceSlot, 'view.addRemove')
  assert.equal(reencode?.aggregateName, 'Other')
  assert.deepEqual(reencode?.nodes, ['A', 'B'])
  assert.deepEqual(reencode?.mapping, [{ sourceChannel: 'grouping', targetChannel: 'color' }])
})

test('CoordinationEngine.propagate maps open source view domains to one-sided target filter transforms', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const sourceStateRef = `${scatterRef}/view/zoom`
  const targetTransformRef = `${barRef}/transform/scatter-visible-region-filter`
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/bar_visible'
  const relationRef = 'wl://widgetva-app/workspace/main/coordination/scatter-zoom-to-bar-distribution'
  const rows = [
    { marketing_spend: 2500, visitors: 7000, region: 'Central' },
    { marketing_spend: 3600, visitors: 9500, region: 'Downtown' },
    { marketing_spend: 4200, visitors: 8500, region: 'Harbor' },
  ]
  const { store, readState, runtimeData } = makeMutableTestStore({
    state: {
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [scatterRef]: {
          ref: scatterRef,
          widgetId: 'scatter',
          kind: 'scatter',
          data: {},
          encodings: {},
          transforms: [],
          view: {
            xDomain: [3500, null],
            yDomain: [null, null],
            zoom: {
              domain: {
                xDomain: [3500, null],
                yDomain: [null, null],
              },
            },
          },
          selections: {},
          feedback: {},
        },
        [barRef]: {
          ref: barRef,
          widgetId: 'bar',
          kind: 'bar',
          data: {
            currentDataRef: visibleDataRef,
            visibleCount: rows.length,
            selectedCount: 0,
          },
          encodings: {},
          transforms: [],
          view: {},
          selections: {},
          feedback: {},
        },
      },
      coordination: {
        relations: {
          [relationRef]: {
            ref: relationRef,
            sourceStateRef,
            targetStateRef: targetTransformRef,
            relation: 'controls',
            transform: {
              kind: 'domainToFilter',
              channelMapping: [
                { sourceChannel: 'x', targetField: 'marketing_spend' },
              ],
            },
            activation: 'automatic',
          },
        },
      },
    },
    runtimeData: {
      [visibleDataRef]: {
        ref: visibleDataRef,
        rows,
        baseRows: rows,
        handle: { ref: visibleDataRef, stats: { rowCount: rows.length, visibleCount: rows.length, selectedCount: 0 } },
        widgetRef: barRef,
      },
    },
  })
  const coordinationEngine = new CoordinationEngine({ store })

  const propagation = coordinationEngine.propagate({ sourceRef: sourceStateRef, state: readState() })
  const nextState = readState()
  const transform = nextState.widgets?.[barRef]?.transforms?.[0]

  assert.equal(propagation.appliedLinkCount, 1)
  assert.equal(transform?.ref, targetTransformRef)
  assert.deepEqual(transform?.predicate, { field: 'marketing_spend', op: 'gte', value: 3500 })
  assert.equal(nextState.widgets?.[barRef]?.data?.visibleCount, 2)
  assert.deepEqual(runtimeData[visibleDataRef]?.rows?.map((row) => row.region), ['Downtown', 'Harbor'])
})

test('CoordinationEngine.propagate maps selections to target view highlight state', () => {
  const lineRef = makeWidgetRef({ widgetId: 'line' })
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const selectionRef = `${lineRef}/selection/region-series`
  const targetStateRef = `${scatterRef}/view/highlight`
  const { store, readState } = makeMutableTestStore({
    state: {
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [scatterRef]: {
          ref: scatterRef,
          widgetId: 'scatter',
          kind: 'scatter',
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
              ref: selectionRef,
              kind: 'point',
              sourceWidgetRef: lineRef,
              predicates: [{ field: 'region', op: 'in', value: ['Downtown'] }],
            },
          },
          views: { primary: null, byWidget: {} },
        },
      },
    },
    links: [{
      ref: 'wl://widgetva-app/workspace/main/coordination/line-series-to-scatter-highlight',
      sourceStateRef: selectionRef,
      targetStateRef,
      relation: 'controls',
      transform: {
        kind: 'selectionToHighlight',
        fieldMapping: [{ sourceField: 'region', targetField: 'region' }],
      },
      activation: 'automatic',
    }],
  })
  const coordinationEngine = new CoordinationEngine({ store })

  const propagation = coordinationEngine.propagate({ sourceRef: selectionRef, state: readState() })
  const highlight = readState().widgets?.[scatterRef]?.view?.highlight

  assert.equal(propagation.appliedLinkCount, 1)
  assert.equal(highlight?.targetStateRef, targetStateRef)
  assert.deepEqual(highlight?.predicates, [{ field: 'region', op: 'in', value: ['Downtown'] }])
  assert.deepEqual(highlight?.values, ['Downtown'])
})

test('CoordinationEngine.propagate maps selections to target selection refs', () => {
  const tableRef = makeWidgetRef({ widgetId: 'table' })
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const selectionRef = `${tableRef}/selection/rows`
  const targetSelectionRef = `${scatterRef}/selection/points`
  const { store, readState } = makeMutableTestStore({
    state: {
      stateId: 'main:s1',
      createdAt: '2026-01-01T00:00:00.000Z',
      widgets: {
        [scatterRef]: {
          ref: scatterRef,
          widgetId: 'scatter',
          kind: 'scatter',
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
              ref: selectionRef,
              kind: 'point',
              sourceWidgetRef: tableRef,
              predicates: [{ field: 'record_id', op: 'in', value: ['r1', 'r2'] }],
            },
          },
          views: { primary: null, byWidget: {} },
        },
      },
    },
    links: [{
      ref: 'wl://widgetva-app/workspace/main/coordination/table-row-to-scatter-selection',
      sourceStateRef: selectionRef,
      targetStateRef: targetSelectionRef,
      relation: 'controls',
      transform: {
        kind: 'selectionToSelection',
        fieldMapping: [{ sourceField: 'record_id', targetField: 'record_id' }],
      },
      activation: 'automatic',
    }],
  })
  const coordinationEngine = new CoordinationEngine({ store })

  const propagation = coordinationEngine.propagate({ sourceRef: selectionRef, state: readState() })
  const targetSelection = readState().widgets?.[scatterRef]?.selections?.[targetSelectionRef]

  assert.equal(propagation.appliedLinkCount, 1)
  assert.ok(targetSelection)
  assert.equal(targetSelection?.ref, targetSelectionRef)
  assert.deepEqual(targetSelection?.predicates, [{ field: 'record_id', op: 'in', value: ['r1', 'r2'] }])
})

test('CoordinationEngine.propagate accepts a direct sourceRef and returns affected refs for doc-style callers', () => {
  const barRef = makeWidgetRef({ widgetId: 'bar' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })

  const coordinationEngine = new CoordinationEngine({
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

  const affectedRefs = coordinationEngine.propagate(selectionRef)

  assert.deepEqual(affectedRefs, [barRef])
})

test('CoordinationEngine.propagate syncs zoom metadata together with view domains', () => {
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

  const coordinationEngine = new CoordinationEngine({
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

  const propagation = coordinationEngine.propagate({ sourceRef: selectionRef, state: currentState })

  const view = currentState.widgets?.[detailRef]?.view
  assert.deepEqual(view?.xDomain, [100, 150])
  assert.deepEqual(view?.yDomain, [20, 30])
  assert.deepEqual(view?.zoom?.center, [125, 25])
  assert.equal(view?.zoom?.level, 1.4)
})

test('CoordinationEngine.propagate applies highlight feedback and marked rows for cross-widget highlight links', () => {
  const summaryRef = makeWidgetRef({ widgetId: 'summary' })
  const detailRef = makeWidgetRef({ widgetId: 'detail' })
  const selectionRef = makeSelectionRef({ widgetId: 'summary', selectionId: 'category' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/table_visible'

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [detailRef]: {
        ref: detailRef,
        widgetId: 'detail',
        kind: 'detail',
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
      widgetRef: detailRef,
    },
  }

  const linkRef = 'wl://widgetva-app/workspace/main/link/summary_highlights_detail'
  const store = {
      listLinks() {
        return [
          {
            ref: linkRef,
            kind: 'highlight',
            from: selectionRef,
            to: detailRef,
            sourceWidgetId: 'summary',
            targetWidgetId: 'detail',
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
  const coordinationEngine = new CoordinationEngine({ store })

  const propagation = coordinationEngine.propagate({ sourceRef: selectionRef, state: currentState })

  const targetState = currentState.widgets?.[detailRef]
  const highlightedRows = targetState?.rawSpec?.data?.values?.filter((row) => row?.__widgetva_highlight === true) || []

  assert.deepEqual(targetState?.feedback?.inboundLinkIds, ['summary_highlights_detail'])
  assert.deepEqual(targetState?.feedback?.linkedSourceRefs, [selectionRef])
  assert.deepEqual(targetState?.feedback?.highlightedKeys, ['USA'])
  assert.deepEqual(propagation?.nextState?.shared?.highlight, {
    entries: [{
      widgetRef: detailRef,
      widgetId: 'detail',
      sourceWidgetRef: null,
      sourceWidgetId: null,
      selectionRef: null,
      summary: null,
      predicates: [],
      highlightedKeys: ['USA'],
      inboundLinkIds: ['summary_highlights_detail'],
      highlightLinkIds: [],
      linkedSourceRefs: [selectionRef],
    }],
    activeWidgetRefs: [detailRef],
  })
  assert.equal(highlightedRows.length, 1)
  assert.equal(highlightedRows[0]?.Origin, 'USA')
  assert.equal(runtimeData[visibleDataRef]?.rows?.[0]?.__widgetva_highlight, true)
  assert.equal(runtimeData[visibleDataRef]?.rows?.[1]?.__widgetva_highlight, false)
})

test('CoordinationEngine.propagate mirrors shared selections and selected-row feedback for cross-widget selection sharing', () => {
  const scatterRef = makeWidgetRef({ widgetId: 'scatter' })
  const detailRef = makeWidgetRef({ widgetId: 'detail' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/table_visible'

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [detailRef]: {
        ref: detailRef,
        widgetId: 'detail',
        kind: 'detail',
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
          [`${detailRef}/selection/local_focus`]: {
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
      widgetRef: detailRef,
    },
  }

  const coordinationEngine = new CoordinationEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_shares_detail_selection',
            kind: 'sharesSelection',
            from: selectionRef,
            to: detailRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'detail',
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
        currentState = makeWorkspaceState(nextState)
        return currentState
      },
      syncSelectionRuntimeData() {},
    },
  })

  coordinationEngine.propagate({ sourceRef: selectionRef, state: currentState })

  const targetState = currentState.widgets?.[detailRef]
  const mirroredSelectionRef = `${detailRef}/selection/shared_brush`
  const mirroredSelection = targetState?.selections?.[mirroredSelectionRef]
  const sharedMirroredSelection = currentState.shared?.selections?.registry?.[mirroredSelectionRef]
  const sharedDetailSelectionView = currentState.shared?.selections?.views?.byWidget?.detail
  const localSelection = targetState?.selections?.[`${detailRef}/selection/local_focus`]
  const selectedRows = targetState?.rawSpec?.data?.values?.filter((row) => row?.__widgetva_selected === true) || []

  assert.ok(mirroredSelection)
  assert.deepEqual(mirroredSelection?.predicates, [{ field: 'Origin', op: 'equals', value: 'USA' }])
  assert.equal(mirroredSelection?.summary, 'USA only')
  assert.ok(sharedMirroredSelection)
  assert.deepEqual(sharedMirroredSelection?.predicates, [{ field: 'Origin', op: 'equals', value: 'USA' }])
  assert.equal(sharedDetailSelectionView?.selectionRef, mirroredSelectionRef)
  assert.deepEqual(sharedDetailSelectionView?.predicates, [{ field: 'Origin', op: 'equals', value: 'USA' }])
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

test('CoordinationEngine.evaluatePropagation reports highlight consistency checks after cross-widget highlighting', () => {
  const detailRef = makeWidgetRef({ widgetId: 'detail' })
  const selectionRef = makeSelectionRef({ widgetId: 'summary', selectionId: 'category' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/table_visible'

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [detailRef]: {
        ref: detailRef,
        widgetId: 'detail',
        kind: 'detail',
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
      widgetRef: detailRef,
    },
  }

  const coordinationEngine = new CoordinationEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/summary_highlights_detail',
            kind: 'highlight',
            from: selectionRef,
            to: detailRef,
            sourceWidgetId: 'summary',
            targetWidgetId: 'detail',
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

  coordinationEngine.propagate({ sourceRef: selectionRef, state: currentState })
  const evaluation = coordinationEngine.evaluatePropagation({ sourceRef: selectionRef, state: currentState })
  const result = evaluation.results[0]
  const checksByName = Object.fromEntries((result?.checks || []).map((check) => [check.name, check]))

  assert.equal(evaluation.ok, true)
  assert.equal(result?.linkKind, 'highlight')
  assert.equal(Object.hasOwn(result || {}, 'primitive'), false)
  assert.equal(checksByName.linkCanApply?.passed, true)
  assert.equal(checksByName.targetExists?.passed, true)
  assert.equal(checksByName.inboundLinkRegistered?.passed, true)
  assert.equal(checksByName.highlightFeedbackPresent?.passed, true)
  assert.deepEqual(checksByName.highlightFeedbackPresent?.actual, {
    highlightedKeys: 1,
    highlightedRows: 1,
  })
})

test('CoordinationEngine.evaluatePropagation reports mirrored selection consistency after selection sharing', () => {
  const detailRef = makeWidgetRef({ widgetId: 'detail' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter', selectionId: 'brush' })
  const visibleDataRef = 'wl://widgetva-app/workspace/main/data/table_visible'

  let currentState = makeWorkspaceState({
    stateId: 'main:s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    widgets: {
      [detailRef]: {
        ref: detailRef,
        widgetId: 'detail',
        kind: 'detail',
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
      widgetRef: detailRef,
    },
  }

  const coordinationEngine = new CoordinationEngine({
    store: {
      listLinks() {
        return [
          {
            ref: 'wl://widgetva-app/workspace/main/link/scatter_shares_detail_selection',
            kind: 'sharesSelection',
            from: selectionRef,
            to: detailRef,
            sourceWidgetId: 'scatter',
            targetWidgetId: 'detail',
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

  coordinationEngine.propagate({ sourceRef: selectionRef, state: currentState })
  const evaluation = coordinationEngine.evaluatePropagation({ sourceRef: selectionRef, state: currentState })
  const result = evaluation.results[0]
  const checksByName = Object.fromEntries((result?.checks || []).map((check) => [check.name, check]))

  assert.equal(evaluation.ok, true)
  assert.equal(result?.linkKind, 'sharesSelection')
  assert.equal(Object.hasOwn(result || {}, 'primitive'), false)
  assert.equal(checksByName.linkCanApply?.passed, true)
  assert.equal(checksByName.targetExists?.passed, true)
  assert.equal(checksByName.inboundLinkRegistered?.passed, true)
  assert.equal(checksByName.mirroredSelectionExists?.passed, true)
  assert.equal(checksByName.mirroredSelectionCountMatches?.passed, true)
  assert.equal(checksByName.mirroredSelectionCountMatches?.actual, 1)
  assert.equal(checksByName.mirroredSelectionCountMatches?.expected, 1)
})
