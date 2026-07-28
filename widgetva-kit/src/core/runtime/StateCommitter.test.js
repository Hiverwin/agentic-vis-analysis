import test from 'node:test'
import assert from 'node:assert/strict'

import {
  commitActionPatch,
  enrichActionOutputWithPropagation,
  finalizeActionCommit,
} from './StateCommitter.js'
import { WidgetVARuntimeStore } from './RuntimeStore.js'

test('commitActionPatch applies widget and shared semantic patches through the runtime store', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const store = {
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        view: {},
      },
    },
    shared: {
      focusedWidget: null,
    },
  }
  const ctx = {
    store,
    readCurrentState() {
      return {
        stateId: 'main:s1',
        widgets: store.widgets,
        shared: store.shared,
      }
    },
  }

  const output = commitActionPatch({
    patch: {
      [widgetRef]: {
        view: {
          xDomain: [0, 10],
        },
      },
      shared: {
        focusedWidget: widgetRef,
      },
    },
  }, ctx)

  assert.deepEqual(store.widgets[widgetRef].view.xDomain, [0, 10])
  assert.equal(store.shared.focusedWidget, widgetRef)
  assert.deepEqual(output.updatedRefs, [widgetRef])
  assert.equal(output.nextState.widgets[widgetRef].view.xDomain[1], 10)
})

test('commitActionPatch commits multi-widget and shared patches as one runtime state step', () => {
  const store = new WidgetVARuntimeStore({ appId: 'demo', workspaceId: 'main' })
  const scatterRef = 'wl://demo/workspace/main/widget/scatter_a'
  const barRef = 'wl://demo/workspace/main/widget/bar_a'
  store.registerWidget(
    { ref: scatterRef, widgetId: 'scatter_a', kind: 'scatter', title: 'Scatter A' },
    { ref: scatterRef, widgetId: 'scatter_a', kind: 'scatter', version: 1, view: {}, data: {} },
  )
  store.registerWidget(
    { ref: barRef, widgetId: 'bar_a', kind: 'bar', title: 'Bar A' },
    { ref: barRef, widgetId: 'bar_a', kind: 'bar', version: 1, view: {}, data: {} },
  )
  const snapshotCountBefore = store.stateSnapshots.length
  const ctx = {
    store,
    readCurrentState(options = {}) {
      return store.readState(options)
    },
  }

  const output = commitActionPatch({
    patch: {
      [scatterRef]: { view: { xDomain: [0, 10] } },
      [barRef]: { feedback: { linked: true } },
      shared: { focusedWidget: scatterRef },
    },
  }, ctx)

  assert.equal(store.stateSnapshots.length, snapshotCountBefore + 1)
  assert.equal(store.readState().stateId, output.nextState.stateId)
  assert.deepEqual(store.readState().widgets[scatterRef].view.xDomain, [0, 10])
  assert.equal(store.readState().widgets[barRef].feedback.linked, true)
  assert.equal(store.readState().shared.focusedWidget, scatterRef)
  assert.deepEqual(output.updatedRefs, [scatterRef, barRef])
})

test('commitActionPatch merges incremental shared selection patches without replacing the registry', () => {
  const scatterRef = 'wl://demo/workspace/main/widget/scatter_a'
  const barRef = 'wl://demo/workspace/main/widget/bar_a'
  const oldSelectionRef = `${barRef}/selection/category`
  const newSelectionRef = `${scatterRef}/selection/brush`
  const oldSelection = {
    selectionRef: oldSelectionRef,
    selectionId: 'category',
    sourceWidgetRef: barRef,
    sourceWidgetId: 'bar_a',
    summary: 'Origin: Europe',
    predicates: [{ field: 'Origin', op: 'in', value: ['Europe'] }],
  }
  const newSelection = {
    selectionRef: newSelectionRef,
    selectionId: 'brush',
    sourceWidgetRef: scatterRef,
    sourceWidgetId: 'scatter_a',
    summary: 'x 0~10; y 0~10',
    predicates: [{ field: 'x', op: 'between', value: [0, 10] }],
  }
  const store = {
    widgets: {
      [scatterRef]: {
        ref: scatterRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        selections: {},
      },
      [barRef]: {
        ref: barRef,
        widgetId: 'bar_a',
        kind: 'bar',
        selections: {
          [oldSelectionRef]: oldSelection,
        },
      },
    },
    shared: {
      focusedWidget: barRef,
      activeSelections: {
        [oldSelectionRef]: oldSelection,
      },
      primarySelectionRef: oldSelectionRef,
      selections: {
        registry: {
          [oldSelectionRef]: oldSelection,
        },
        views: {
          primary: oldSelection,
          byWidget: {
            bar_a: oldSelection,
          },
        },
      },
    },
  }
  const ctx = {
    store,
    readCurrentState() {
      return {
        stateId: 'main:s2',
        widgets: store.widgets,
        shared: store.shared,
      }
    },
  }

  commitActionPatch({
    patch: {
      [scatterRef]: {
        selections: {
          [newSelectionRef]: newSelection,
        },
      },
      shared: {
        __widgetvaPatchMode: 'widgetva.mergeSharedPatch',
        focusedWidget: scatterRef,
        activeSelections: {
          [newSelectionRef]: newSelection,
        },
        primarySelectionRef: newSelectionRef,
        selections: {
          registry: {
            [newSelectionRef]: newSelection,
          },
          views: {
            primary: newSelection,
            byWidget: {
              scatter_a: newSelection,
            },
          },
        },
      },
    },
  }, ctx)

  assert.equal(store.shared.focusedWidget, scatterRef)
  assert.equal(store.shared.selections.registry[oldSelectionRef].selectionId, 'category')
  assert.equal(store.shared.selections.registry[newSelectionRef].selectionId, 'brush')
  assert.equal(store.shared.selections.views.primary.selectionRef, newSelectionRef)
  assert.equal(store.shared.selections.views.byWidget.bar_a.selectionRef, oldSelectionRef)
  assert.equal(store.shared.selections.views.byWidget.scatter_a.selectionRef, newSelectionRef)
  assert.equal(store.widgets[scatterRef].selections[newSelectionRef].selectionId, 'brush')
})

test('finalizeActionCommit owns action trace, state patch, and result shaping after commit', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/bar_a'
  const traceEvents = []
  const systemTransitions = []
  const store = {
    buildStatePatch(refs) {
      return Object.fromEntries(refs.map((ref) => [ref, { ref, committed: true }]))
    },
  }
  const traceRecorder = {
    recordAction(event) {
      traceEvents.push(event)
    },
    recordSystemTransition(event) {
      systemTransitions.push(event)
    },
  }

  const result = finalizeActionCommit({
    store,
    traceRecorder,
    call: {
      callId: 'call_finalize',
      name: 'bar.selectCategory',
      actor: 'agent',
    },
    descriptor: {
      name: 'bar.selectCategory',
    },
    output: {
      affectedRefs: [widgetRef],
      result: { selectedCount: 3 },
      transition: {
        type: 'continue',
        notes: { userVisibleSummary: 'Selected a category.' },
      },
    },
    nextState: {
      stateId: 'main:s2',
      widgets: {
        [widgetRef]: { ref: widgetRef },
      },
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.callId, 'call_finalize')
  assert.equal(result.actionName, 'bar.selectCategory')
  assert.deepEqual(result.updatedRefs, [widgetRef])
  assert.deepEqual(result.statePatch, {
    [widgetRef]: { ref: widgetRef, committed: true },
  })
  assert.deepEqual(result.result, { selectedCount: 3 })
  assert.equal(traceEvents.length, 1)
  assert.equal(traceEvents[0].stateId, 'main:s2')
  assert.deepEqual(traceEvents[0].updatedRefs, [widgetRef])
  assert.equal(systemTransitions.length, 1)
  assert.equal(systemTransitions[0].transitionType, 'continue')
})

test('enrichActionOutputWithPropagation owns selection-driven link propagation after commit', () => {
  const scatterRef = 'wl://demo/workspace/main/widget/scatter_a'
  const barRef = 'wl://demo/workspace/main/widget/bar_a'
  const selectionRef = `${scatterRef}/selection/brush`
  const previousState = {
    stateId: 'main:s1',
    widgets: {
      [scatterRef]: { ref: scatterRef, widgetId: 'scatter_a', kind: 'scatter' },
    },
    shared: {
      selections: {
        registry: {},
      },
    },
  }
  const nextState = {
    stateId: 'main:s2',
    widgets: {
      [scatterRef]: {
        ref: scatterRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        selections: {
          [selectionRef]: { kind: 'interval' },
        },
      },
    },
    shared: {
      selections: {
        registry: {
          [selectionRef]: { kind: 'interval' },
        },
      },
    },
  }
  const propagatedState = {
    ...nextState,
    widgets: {
      ...nextState.widgets,
      [barRef]: {
        ref: barRef,
        widgetId: 'bar_a',
        kind: 'bar',
        transforms: [{ kind: 'filter', source: selectionRef }],
      },
    },
  }
  const propagatedSources = []
  const output = enrichActionOutputWithPropagation({
    output: {
      updatedRefs: [scatterRef],
      propagateFromSelection: true,
      result: { selectedCount: 4 },
    },
    descriptor: {
      name: 'scatter.brushRegion',
      category: 'selection',
      supportedWidgetKinds: ['scatter'],
    },
    call: {
      name: 'scatter.brushRegion',
      target: { widgetRef: scatterRef },
    },
    ctx: {
      store: {
        widgets: nextState.widgets,
      },
      resolveTargetWidget() {
        return nextState.widgets[scatterRef]
      },
      readCurrentState() {
        return nextState
      },
    },
    coordinationEngine: {
      propagate({ sourceRef }) {
        propagatedSources.push(sourceRef)
        return {
          nextState: propagatedState,
          affectedRefs: [barRef],
          links: [{ linkRef: 'link://scatter_to_bar' }],
          effects: ['filter'],
        }
      },
    },
    previousState,
    nextState,
  })

  assert.deepEqual(propagatedSources, [selectionRef])
  assert.equal(output.nextState, propagatedState)
  assert.deepEqual(output.updatedRefs, [scatterRef, barRef])
  assert.deepEqual(output.result.propagated, [{ linkRef: 'link://scatter_to_bar' }])
  assert.deepEqual(output.result.propagationEffects, ['filter'])
})

test('enrichActionOutputWithPropagation uses explicit propagateFromRef for view-state coordination', () => {
  const scatterRef = 'wl://demo/workspace/main/widget/scatter_a'
  const barRef = 'wl://demo/workspace/main/widget/bar_a'
  const zoomStateRef = `${scatterRef}/view/zoom`
  const nextState = {
    stateId: 'main:s2',
    widgets: {
      [scatterRef]: {
        ref: scatterRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
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
      },
    },
  }
  const propagatedState = {
    ...nextState,
    widgets: {
      ...nextState.widgets,
      [barRef]: {
        ref: barRef,
        widgetId: 'bar_a',
        kind: 'bar',
        transforms: [{
          ref: `${barRef}/transform/scatter-visible-region-filter`,
          kind: 'filter',
        }],
      },
    },
  }
  const propagatedSources = []

  const output = enrichActionOutputWithPropagation({
    output: {
      updatedRefs: [scatterRef],
      propagateFromRef: zoomStateRef,
      result: { xDomain: [3000, 4500], yDomain: [9000, 11000] },
    },
    descriptor: {
      name: 'scatter.zoomDomain',
      supportedWidgetKinds: ['scatter'],
    },
    call: {
      name: 'scatter.zoomDomain',
      target: { widgetRef: scatterRef },
    },
    ctx: {
      resolveTargetWidget() {
        return nextState.widgets[scatterRef]
      },
      readCurrentState() {
        return nextState
      },
    },
    coordinationEngine: {
      propagate({ sourceRef }) {
        propagatedSources.push(sourceRef)
        return {
          nextState: propagatedState,
          affectedRefs: [barRef],
          links: [{ linkRef: 'link://scatter_zoom_to_bar_filter' }],
          effects: ['filter'],
        }
      },
    },
    previousState: {
      stateId: 'main:s1',
      widgets: {
        [scatterRef]: { ref: scatterRef, widgetId: 'scatter_a', kind: 'scatter' },
      },
    },
    nextState,
  })

  assert.deepEqual(propagatedSources, [zoomStateRef])
  assert.equal(output.nextState, propagatedState)
  assert.deepEqual(output.updatedRefs, [scatterRef, barRef])
  assert.deepEqual(output.result.propagated, [{ linkRef: 'link://scatter_zoom_to_bar_filter' }])
  assert.deepEqual(output.result.propagationEffects, ['filter'])
})

test('enrichActionOutputWithPropagation propagates every explicit source ref for reset actions', () => {
  const scatterRef = 'wl://demo/workspace/main/widget/scatter_a'
  const barRef = 'wl://demo/workspace/main/widget/bar_a'
  const lineRef = 'wl://demo/workspace/main/widget/line_a'
  const selectionRef = `${scatterRef}/selection/brush`
  const zoomRef = `${scatterRef}/view/zoom`
  const afterSelectionPropagation = {
    stateId: 'main:s2',
    widgets: {
      [scatterRef]: { ref: scatterRef, widgetId: 'scatter_a', kind: 'scatter', view: {}, selections: {} },
      [barRef]: { ref: barRef, widgetId: 'bar_a', kind: 'bar', transforms: [] },
    },
  }
  const afterZoomPropagation = {
    ...afterSelectionPropagation,
    widgets: {
      ...afterSelectionPropagation.widgets,
      [lineRef]: { ref: lineRef, widgetId: 'line_a', kind: 'line', transforms: [] },
    },
  }
  const propagatedSources = []

  const output = enrichActionOutputWithPropagation({
    output: {
      updatedRefs: [scatterRef],
      propagateFromRefs: [selectionRef, zoomRef],
      result: { reset: true },
    },
    descriptor: {
      name: 'widget.resetView',
      supportedWidgetKinds: ['scatter'],
    },
    call: {
      name: 'widget.resetView',
      target: { widgetRef: scatterRef },
    },
    ctx: {
      resolveTargetWidget() {
        return { ref: scatterRef, widgetId: 'scatter_a', kind: 'scatter' }
      },
      readCurrentState() {
        return afterZoomPropagation
      },
    },
    coordinationEngine: {
      propagate({ sourceRef }) {
        propagatedSources.push(sourceRef)
        if (sourceRef === selectionRef) {
          return {
            nextState: afterSelectionPropagation,
            affectedRefs: [barRef],
            links: [{ linkRef: 'link://scatter_selection_to_bar' }],
            effects: ['filter'],
          }
        }
        return {
          nextState: afterZoomPropagation,
          affectedRefs: [lineRef],
          links: [{ linkRef: 'link://scatter_zoom_to_line' }],
          effects: ['filter'],
        }
      },
    },
    previousState: {
      stateId: 'main:s1',
      widgets: {
        [scatterRef]: {
          ref: scatterRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          view: { xDomain: [1, 2] },
          selections: { [selectionRef]: { selectionRef } },
        },
      },
    },
    nextState: {
      stateId: 'main:s2',
      widgets: {
        [scatterRef]: { ref: scatterRef, widgetId: 'scatter_a', kind: 'scatter', view: {}, selections: {} },
      },
    },
  })

  assert.deepEqual(propagatedSources, [selectionRef, zoomRef])
  assert.equal(output.nextState, afterZoomPropagation)
  assert.deepEqual(output.updatedRefs, [scatterRef, barRef, lineRef])
  assert.equal(output.result.propagationSourceRef, selectionRef)
  assert.deepEqual(output.result.propagationSourceRefs, [selectionRef, zoomRef])
  assert.deepEqual(output.result.propagated, [
    { linkRef: 'link://scatter_selection_to_bar' },
    { linkRef: 'link://scatter_zoom_to_line' },
  ])
  assert.deepEqual(output.result.propagationEffects, ['filter'])
})
