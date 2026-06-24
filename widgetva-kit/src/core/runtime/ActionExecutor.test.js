import test from 'node:test'
import assert from 'node:assert/strict'

import { ActionExecutor } from './ActionExecutor.js'
import { ActionContext } from './ActionContext.js'
import { registerBarActions } from '../../widgets/bar/actions.js'
import { registerHeatmapActions } from '../../widgets/heatmap/actions.js'
import { registerLineActions } from '../../widgets/line/actions.js'
import { registerParallelCoordinatesActions } from '../../widgets/parallelCoordinates/actions.js'
import { registerSankeyActions } from '../../widgets/sankey/actions.js'
import { registerScatterActions } from '../../widgets/scatter/actions.js'

function createSingleWidgetStore({
  widgetRef,
  widgetId,
  kind,
  title,
  currentDataRef = null,
  runtimeRows = null,
}) {
  const widgetRecord = {
    ref: widgetRef,
    widgetId,
    kind,
    title,
    selections: {},
    view: {},
    ...(currentDataRef
      ? {
          data: {
            currentDataRef,
          },
        }
      : {}),
  }

  return {
    widgets: {
      [widgetRef]: widgetRecord,
    },
    ...(currentDataRef && Array.isArray(runtimeRows)
      ? {
          runtimeData: {
            [currentDataRef]: {
              rows: runtimeRows,
            },
          },
        }
      : {}),
    listActions() {
      return []
    },
    listWidgetDescriptions() {
      return [widgetRecord]
    },
    getResolvedWidgetForTarget(ref) {
      return ref === widgetRef ? widgetRecord : null
    },
    getResolvedWidget(ref) {
      return this.getResolvedWidgetForTarget(ref)
    },
    getWidgetDescription(ref) {
      return this.getResolvedWidgetForTarget(ref)
    },
    getWidgetState(ref) {
      return ref === widgetRef ? widgetRecord : null
    },
    readState() {
      return {
        stateId: 'main:s1',
        widgets: {
          [widgetRef]: widgetRecord,
        },
        shared: {
          activeSelections: {},
          globalFilters: {},
          focusedWidget: widgetRef,
        },
      }
    },
    buildStatePatch(refs) {
      return { refs }
    },
  }
}

test('ActionExecutor.describeExecutor exposes verification and precondition coverage metadata', () => {
  const executor = new ActionExecutor({
    store: {
      listActions() {
        return []
      },
    },
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
    traceRecorder: null,
  })

  executor.register(
    {
      name: 'scatter.brushRegion',
      title: 'Brush scatterplot region',
      description: 'Select a scatterplot interval.',
      primitive: 'select',
      category: 'selection',
      supportedWidgetKinds: ['scatter'],
      targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
      affectedRefs: ['wl://widgetva-app/workspace/main/widget/scatter_a'],
      affectedStatePaths: ['selections'],
      preconditions: [{ description: 'scatter exists' }],
      postconditions: [{ description: 'selection exists', checkHint: 'inspect selection state' }],
      effects: [{ kind: 'updatesSelection', ref: 'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush' }],
      reversible: true,
    },
    async () => ({ ok: true }),
  )
  executor.registerPrecondition('scatter.brushRegion', () => true)

  const summary = executor.describeExecutor()
  const action = summary.actions.find((entry) => entry.name === 'scatter.brushRegion')

  assert.deepEqual(action?.supportedWidgetKinds, ['scatter'])
  assert.deepEqual(action?.affectedRefs, ['wl://widgetva-app/workspace/main/widget/scatter_a'])
  assert.deepEqual(action?.affectedStatePaths, ['selections'])
  assert.equal(action?.hasPreconditions, true)
  assert.equal(action?.preconditionDescriptorCount, 1)
  assert.equal(action?.preconditionHandlerRegistered, true)
  assert.equal(action?.postconditionCount, 1)
  assert.equal(action?.reversible, true)
  assert.equal(action?.effectCount, 1)
  assert.deepEqual(action?.effectKinds, ['updatesSelection'])
})

test('ActionExecutor supports no-arg construction for manual runtime assembly', () => {
  const executor = new ActionExecutor()

  assert.equal(Array.isArray(executor.list()), true)
  assert.equal(executor.list().length >= 0, true)
})

test('registerScatterActions exposes scatter.zoomDomain as a widget binding action', () => {
  const executor = new ActionExecutor()

  registerScatterActions(executor)

  assert.equal(executor.has('scatter.brushRegion'), true)
  assert.equal(executor.has('scatter.zoomDomain'), true)
  assert.equal(executor.has('scatter.identifyClusters'), true)
  assert.equal(executor.has('scatter.showRegression'), true)
})

test('registerParallelCoordinatesActions exposes reorderDimensions as a widget binding action', () => {
  const executor = new ActionExecutor()

  registerParallelCoordinatesActions(executor)

  assert.equal(executor.has('parallelCoordinates.brushAxes'), true)
  assert.equal(executor.has('parallelCoordinates.selectRecord'), true)
  assert.equal(executor.has('parallelCoordinates.reorderDimensions'), true)
  assert.equal(executor.has('parallelCoordinates.filterDimension'), true)
  assert.equal(executor.has('parallelCoordinates.filterByCategory'), true)
  assert.equal(executor.has('parallelCoordinates.highlightCategory'), true)
  assert.equal(executor.has('parallelCoordinates.hideDimensions'), true)
  assert.equal(executor.has('parallelCoordinates.resetHiddenDimensions'), true)
})

test('registerBarActions exposes bar.sortBars as a widget binding action', () => {
  const executor = new ActionExecutor()

  registerBarActions(executor)

  assert.equal(executor.has('bar.selectCategory'), true)
  assert.equal(executor.has('bar.sortBars'), true)
  assert.equal(executor.has('bar.highlightTopN'), true)
  assert.equal(executor.has('bar.filterCategories'), true)
  assert.equal(executor.has('bar.addBars'), true)
  assert.equal(executor.has('bar.removeBars'), true)
  assert.equal(executor.has('bar.addBarItems'), true)
  assert.equal(executor.has('bar.removeBarItems'), true)
  assert.equal(executor.has('bar.filterSubcategories'), true)
  assert.equal(executor.has('bar.expandStack'), true)
  assert.equal(executor.has('bar.toggleStackMode'), true)
})

test('registerSankeyActions exposes sankey.collapseNodes as a widget binding action', () => {
  const executor = new ActionExecutor()

  registerSankeyActions(executor)

  assert.equal(executor.has('sankey.focusFlow'), true)
  assert.equal(executor.has('sankey.selectAggregateNode'), true)
  assert.equal(executor.has('sankey.filterFlow'), true)
  assert.equal(executor.has('sankey.collapseNodes'), true)
  assert.equal(executor.has('sankey.expandNode'), true)
  assert.equal(executor.has('sankey.highlightPath'), true)
  assert.equal(executor.has('sankey.traceNode'), true)
  assert.equal(executor.has('sankey.colorFlows'), true)
  assert.equal(executor.has('sankey.reorderNodesInLayer'), true)
  assert.equal(executor.has('sankey.autoCollapseByRank'), true)
})

test('sankey.selectAggregateNode commits a selection that preserves aggregateName without row-level predicates', async () => {
  const executor = new ActionExecutor()
  registerSankeyActions(executor)

  const storeState = {
    shared: {
      focusedWidgetRef: 'widget://workspace/widget/w_sankey_cars',
      selections: {
        registry: {},
        views: {
          primary: null,
          byWidget: {},
        },
      },
    },
    widgets: {
      'widget://workspace/widget/w_sankey_cars': {
        currentSpec: {
          data: [
            { name: 'rawLinks', values: [{ source: 'origin:USA', target: 'cylinders:8', value: 12 }] },
            { name: 'nodeConfig', values: [{ name: 'collapsed:1:other', depth: 1, order: 0 }] },
          ],
        },
        baselineSpec: {
          data: [
            { name: 'rawLinks', values: [{ source: 'origin:USA', target: 'cylinders:8', value: 12 }] },
            { name: 'nodeConfig', values: [{ name: 'collapsed:1:other', depth: 1, order: 0 }] },
          ],
        },
        selections: {},
      },
    },
    descriptions: {
      'widget://workspace/widget/w_sankey_cars': {
        ref: 'widget://workspace/widget/w_sankey_cars',
        widgetId: 'w_sankey_cars',
        kind: 'sankey',
        title: 'Origin to Cylinders to Year',
      },
    },
  }

  const widgetIndex = new Map([
    ['widget://workspace/widget/w_sankey_cars', {
      ref: 'widget://workspace/widget/w_sankey_cars',
      widgetId: 'w_sankey_cars',
      kind: 'sankey',
      describe: () => ({ widgetId: 'w_sankey_cars', kind: 'sankey' }),
      readState: () => storeState.widgets['widget://workspace/widget/w_sankey_cars'],
    }],
  ])

  const workspace = {
    getWidgetByRef(ref) {
      return widgetIndex.get(ref) || null
    },
    getWidget(refOrId) {
      if (widgetIndex.has(refOrId)) return widgetIndex.get(refOrId)
      for (const widget of widgetIndex.values()) {
        if (widget.widgetId === refOrId) return widget
      }
      return null
    },
  }

  const runtimeStore = {
    state: storeState,
    shared: storeState.shared,
    widgets: storeState.widgets,
    descriptions: storeState.descriptions,
    getState: () => storeState,
    readState() {
      return this.state
    },
    commitState(nextState) {
      this.state = nextState
      Object.assign(storeState, nextState)
      this.shared = nextState.shared
      this.widgets = nextState.widgets
      this.descriptions = nextState.descriptions || this.descriptions
      return nextState
    },
    patchWidget(ref, patch) {
      const currentWidgetState = this.state.widgets[ref]
      const nextWidgetState = {
        ...currentWidgetState,
        ...patch,
        data: {
          ...(currentWidgetState?.data || {}),
          ...(patch?.data || {}),
        },
        selections: {
          ...(currentWidgetState?.selections || {}),
          ...(patch?.selections || {}),
        },
      }
      this.state = {
        ...this.state,
        widgets: {
          ...this.state.widgets,
          [ref]: nextWidgetState,
        },
      }
      storeState.widgets = this.state.widgets
      this.widgets = this.state.widgets
      return this.state
    },
    setState(nextState) {
      Object.assign(storeState, nextState)
      this.state = storeState
      if (nextState?.shared) {
        this.shared = nextState.shared
      }
      if (nextState?.widgets) {
        this.widgets = nextState.widgets
      }
      if (nextState?.descriptions) {
        this.descriptions = nextState.descriptions
      }
    },
    getWidgetDescription(ref) {
      return storeState.descriptions[ref] || null
    },
  }

  const actionContext = new ActionContext({
    workspace,
    store: runtimeStore,
  })

  const result = await executor.run({
    callId: 'call_sankey_select_aggregate',
    name: 'sankey.selectAggregateNode',
    queryScope: { widgetRef: 'widget://workspace/widget/w_sankey_cars' },
    params: { aggregateName: 'collapsed:1:other' },
  }, actionContext)

  assert.equal(result.ok, true)
  const primaryRef = storeState.shared.selections.views.primary?.selectionRef
  assert.equal(typeof primaryRef, 'string')
  const selectionState = storeState.shared.selections.registry[primaryRef]
  assert.equal(selectionState.aggregateName, 'collapsed:1:other')
  assert.deepEqual(selectionState.predicates, [])
})

test('parallelCoordinates.reorderDimensions rewrites fold order and matching x-domain metadata', async () => {
  const executor = new ActionExecutor()
  registerParallelCoordinatesActions(executor)

  const state = {
    currentSpec: {
      transform: [
        { fold: ['Horsepower', 'Weight', 'Miles_per_Gallon'] },
      ],
      encoding: {
        x: {
          field: 'key',
          type: 'nominal',
          scale: {
            domain: ['Horsepower', 'Weight', 'Miles_per_Gallon'],
          },
        },
      },
      layer: [
        {
          encoding: {
            x: {
              field: 'key',
              type: 'nominal',
              scale: {
                domain: ['Horsepower', 'Weight', 'Miles_per_Gallon'],
              },
            },
          },
        },
      ],
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/pc_reorder'
  const result = await executor.run(
    {
      callId: 'pc_reorder_001',
      name: 'parallelCoordinates.reorderDimensions',
      targetRef: widgetRef,
      params: {
        dimensionOrder: ['Weight', 'Miles_per_Gallon', 'Horsepower'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'pc_reorder',
            kind: 'parallelCoordinates',
            title: 'Parallel Reorder',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'pc_reorder',
                kind: 'parallelCoordinates',
                title: 'Parallel Reorder',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'pc_reorder',
                kind: 'parallelCoordinates',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'parallelCoordinates.reorderDimensions')
  assert.deepEqual(state.currentSpec.transform[0].fold, ['Weight', 'Miles_per_Gallon', 'Horsepower'])
  assert.deepEqual(state.currentSpec.encoding.x.scale.domain, ['Weight', 'Miles_per_Gallon', 'Horsepower'])
  assert.deepEqual(state.currentSpec.encoding.x.sort, ['Weight', 'Miles_per_Gallon', 'Horsepower'])
  assert.deepEqual(state.currentSpec.layer[0].encoding.x.scale.domain, ['Weight', 'Miles_per_Gallon', 'Horsepower'])
})

test('parallelCoordinates.filterDimension inserts a tagged numeric range filter before the fold transform', async () => {
  const executor = new ActionExecutor()
  registerParallelCoordinatesActions(executor)

  const state = {
    currentSpec: {
      transform: [
        { calculate: '1', as: 'helper' },
        { fold: ['Horsepower', 'Weight', 'Miles_per_Gallon'] },
      ],
      encoding: {
        x: {
          field: 'key',
          type: 'nominal',
        },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/pc_filter'
  const result = await executor.run(
    {
      callId: 'pc_filter_001',
      name: 'parallelCoordinates.filterDimension',
      targetRef: widgetRef,
      params: {
        dimension: 'Horsepower',
        range: [80, 160],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'pc_filter',
            kind: 'parallelCoordinates',
            title: 'Parallel Filter',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'pc_filter',
                kind: 'parallelCoordinates',
                title: 'Parallel Filter',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'pc_filter',
                kind: 'parallelCoordinates',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'parallelCoordinates.filterDimension')
  assert.deepEqual(state.currentSpec.transform, [
    { calculate: '1', as: 'helper' },
    {
      filter: `datum['Horsepower'] >= 80 && datum['Horsepower'] <= 160`,
      _widgetvaTag: 'parallelCoordinates.filterDimension',
    },
    { fold: ['Horsepower', 'Weight', 'Miles_per_Gallon'] },
  ])
})

test('parallelCoordinates.filterByCategory inserts a tagged categorical exclusion filter before the fold transform', async () => {
  const executor = new ActionExecutor()
  registerParallelCoordinatesActions(executor)

  const state = {
    currentSpec: {
      transform: [
        { calculate: '1', as: 'helper' },
        { fold: ['Horsepower', 'Weight', 'Miles_per_Gallon'] },
      ],
      encoding: {
        x: {
          field: 'key',
          type: 'nominal',
        },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/pc_category_filter'
  const result = await executor.run(
    {
      callId: 'pc_category_filter_001',
      name: 'parallelCoordinates.filterByCategory',
      targetRef: widgetRef,
      params: {
        field: 'Origin',
        values: ['USA', 'Japan'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'pc_category_filter',
            kind: 'parallelCoordinates',
            title: 'Parallel Category Filter',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'pc_category_filter',
                kind: 'parallelCoordinates',
                title: 'Parallel Category Filter',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'pc_category_filter',
                kind: 'parallelCoordinates',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'parallelCoordinates.filterByCategory')
  assert.deepEqual(state.currentSpec.transform, [
    { calculate: '1', as: 'helper' },
    {
      filter: `indexof([\"USA\",\"Japan\"], datum['Origin']) < 0`,
      _widgetvaTag: 'parallelCoordinates.filterByCategory',
    },
    { fold: ['Horsepower', 'Weight', 'Miles_per_Gallon'] },
  ])
})

test('parallelCoordinates.highlightCategory writes an opacity condition that highlights matching categories and dims the rest', async () => {
  const executor = new ActionExecutor()
  registerParallelCoordinatesActions(executor)

  const state = {
    currentSpec: {
      layer: [
        {
          mark: 'line',
          encoding: {
            x: { field: 'key', type: 'nominal' },
            y: { field: 'value', type: 'quantitative' },
          },
        },
      ],
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/pc_highlight_category'
  const result = await executor.run(
    {
      callId: 'pc_highlight_category_001',
      name: 'parallelCoordinates.highlightCategory',
      targetRef: widgetRef,
      params: {
        field: 'Origin',
        values: ['USA', 'Japan'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'pc_highlight_category',
            kind: 'parallelCoordinates',
            title: 'Parallel Highlight Category',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'pc_highlight_category',
                kind: 'parallelCoordinates',
                title: 'Parallel Highlight Category',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'pc_highlight_category',
                kind: 'parallelCoordinates',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'parallelCoordinates.highlightCategory')
  assert.deepEqual(state.currentSpec.layer[0].encoding.opacity, {
    condition: {
      test: `indexof([\"USA\",\"Japan\"], datum['Origin']) >= 0`,
      value: 1,
    },
    value: 0.1,
  })
})

test('parallelCoordinates.hideDimensions removes hidden dimensions from fold and matching x-domain metadata', async () => {
  const executor = new ActionExecutor()
  registerParallelCoordinatesActions(executor)

  const state = {
    currentSpec: {
      transform: [
        { fold: ['Horsepower', 'Weight', 'Miles_per_Gallon'] },
      ],
      encoding: {
        x: {
          field: 'key',
          type: 'nominal',
          scale: {
            domain: ['Horsepower', 'Weight', 'Miles_per_Gallon'],
          },
        },
      },
      layer: [
        {
          encoding: {
            x: {
              field: 'key',
              type: 'nominal',
              scale: {
                domain: ['Horsepower', 'Weight', 'Miles_per_Gallon'],
              },
            },
          },
        },
      ],
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/pc_hide'
  const result = await executor.run(
    {
      callId: 'pc_hide_001',
      name: 'parallelCoordinates.hideDimensions',
      targetRef: widgetRef,
      params: {
        dimensions: ['Weight'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'pc_hide',
            kind: 'parallelCoordinates',
            title: 'Parallel Hide',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'pc_hide',
                kind: 'parallelCoordinates',
                title: 'Parallel Hide',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'pc_hide',
                kind: 'parallelCoordinates',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'parallelCoordinates.hideDimensions')
  assert.deepEqual(state.currentSpec.transform[0].fold, ['Horsepower', 'Miles_per_Gallon'])
  assert.deepEqual(state.currentSpec.encoding.x.scale.domain, ['Horsepower', 'Miles_per_Gallon'])
  assert.deepEqual(state.currentSpec.encoding.x.sort, ['Horsepower', 'Miles_per_Gallon'])
  assert.deepEqual(state.currentSpec.layer[0].encoding.x.scale.domain, ['Horsepower', 'Miles_per_Gallon'])
  assert.deepEqual(state.currentSpec._pc_hidden_state, {
    hidden: ['Weight'],
    all_dimensions: ['Horsepower', 'Weight', 'Miles_per_Gallon'],
  })
})

test('parallelCoordinates.resetHiddenDimensions restores the full fold order and clears hidden-dimension state', async () => {
  const executor = new ActionExecutor()
  registerParallelCoordinatesActions(executor)

  const state = {
    currentSpec: {
      transform: [
        { fold: ['Horsepower', 'Miles_per_Gallon'] },
      ],
      encoding: {
        x: {
          field: 'key',
          type: 'nominal',
          sort: ['Horsepower', 'Miles_per_Gallon'],
          scale: {
            domain: ['Horsepower', 'Miles_per_Gallon'],
          },
        },
      },
      layer: [
        {
          encoding: {
            x: {
              field: 'key',
              type: 'nominal',
              sort: ['Horsepower', 'Miles_per_Gallon'],
              scale: {
                domain: ['Horsepower', 'Miles_per_Gallon'],
              },
            },
          },
        },
      ],
      _pc_hidden_state: {
        hidden: ['Weight'],
        all_dimensions: ['Horsepower', 'Weight', 'Miles_per_Gallon'],
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/pc_reset_hide'
  const result = await executor.run(
    {
      callId: 'pc_reset_hide_001',
      name: 'parallelCoordinates.resetHiddenDimensions',
      targetRef: widgetRef,
      params: {},
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'pc_reset_hide',
            kind: 'parallelCoordinates',
            title: 'Parallel Reset Hide',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'pc_reset_hide',
                kind: 'parallelCoordinates',
                title: 'Parallel Reset Hide',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'pc_reset_hide',
                kind: 'parallelCoordinates',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'parallelCoordinates.resetHiddenDimensions')
  assert.deepEqual(state.currentSpec.transform[0].fold, ['Horsepower', 'Weight', 'Miles_per_Gallon'])
  assert.deepEqual(state.currentSpec.encoding.x.scale.domain, ['Horsepower', 'Weight', 'Miles_per_Gallon'])
  assert.deepEqual(state.currentSpec.encoding.x.sort, ['Horsepower', 'Weight', 'Miles_per_Gallon'])
  assert.deepEqual(state.currentSpec.layer[0].encoding.x.scale.domain, ['Horsepower', 'Weight', 'Miles_per_Gallon'])
  assert.equal(state.currentSpec._pc_hidden_state, undefined)
})

test('sankey.collapseNodes aggregates nodes into one replacement node and rewrites rawLinks/nodeConfig', async () => {
  const executor = new ActionExecutor()
  registerSankeyActions(executor)

  const state = {
    currentSpec: {
      data: [
        {
          name: 'rawLinks',
          values: [
            { source: 'A', target: 'X', value: 5 },
            { source: 'B', target: 'X', value: 7 },
            { source: 'X', target: 'Sink', value: 12 },
          ],
        },
        {
          name: 'nodeConfig',
          values: [
            { name: 'A', depth: 0, order: 0 },
            { name: 'B', depth: 0, order: 1 },
            { name: 'X', depth: 1, order: 0 },
            { name: 'Sink', depth: 2, order: 0 },
          ],
        },
      ],
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/sankey_collapse'
  const result = await executor.run(
    {
      callId: 'sankey_collapse_001',
      name: 'sankey.collapseNodes',
      targetRef: widgetRef,
      params: {
        nodes: ['A', 'B'],
        aggregateName: 'Other Sources',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'sankey_collapse',
            kind: 'sankey',
            title: 'Sankey Collapse',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'sankey_collapse',
                kind: 'sankey',
                title: 'Sankey Collapse',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'sankey_collapse',
                kind: 'sankey',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'sankey.collapseNodes')
  const rawLinks = state.currentSpec.data.find((entry) => entry.name === 'rawLinks')?.values
  const nodeConfig = state.currentSpec.data.find((entry) => entry.name === 'nodeConfig')?.values
  assert.deepEqual(rawLinks, [
    { source: 'Other Sources', target: 'X', value: 12 },
    { source: 'X', target: 'Sink', value: 12 },
  ])
  assert.deepEqual(nodeConfig, [
    { name: 'X', depth: 1, order: 0 },
    { name: 'Sink', depth: 2, order: 0 },
    {
      name: 'Other Sources',
      depth: 0,
      order: 2,
      _is_aggregate: true,
      _collapsed_nodes: ['A', 'B'],
    },
  ])
  assert.deepEqual(state.currentSpec._sankey_state, {
    original_nodes: [
      { name: 'A', depth: 0, order: 0 },
      { name: 'B', depth: 0, order: 1 },
      { name: 'X', depth: 1, order: 0 },
      { name: 'Sink', depth: 2, order: 0 },
    ],
    original_links: [
      { source: 'A', target: 'X', value: 5 },
      { source: 'B', target: 'X', value: 7 },
      { source: 'X', target: 'Sink', value: 12 },
    ],
    collapsed_groups: {
      'Other Sources': ['A', 'B'],
    },
  })
})

test('sankey.filterFlow updates the threshold signal when one exists', async () => {
  const executor = new ActionExecutor()
  registerSankeyActions(executor)

  const state = {
    currentSpec: {
      signals: [
        {
          name: 'threshold',
          value: 5,
          bind: { input: 'range', min: 0, max: 10, step: 1 },
        },
      ],
      data: [
        {
          name: 'rawLinks',
          values: [
            { source: 'A', target: 'B', value: 12 },
            { source: 'A', target: 'C', value: 3 },
            { source: 'B', target: 'D', value: 18 },
          ],
        },
        {
          name: 'nodeConfig',
          values: [
            { name: 'A', depth: 0, order: 0 },
            { name: 'B', depth: 1, order: 0 },
            { name: 'C', depth: 1, order: 1 },
            { name: 'D', depth: 2, order: 0 },
          ],
        },
      ],
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/sankey_filter_flow'
  const result = await executor.run(
    {
      callId: 'sankey_filter_flow_001',
      name: 'sankey.filterFlow',
      targetRef: widgetRef,
      params: {
        minValue: 14,
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'sankey_filter_flow',
            kind: 'sankey',
            title: 'Sankey Filter Flow',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'sankey_filter_flow',
                kind: 'sankey',
                title: 'Sankey Filter Flow',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'sankey_filter_flow',
                kind: 'sankey',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'sankey.filterFlow')
  assert.equal(state.currentSpec.signals[0].value, 14)
  assert.equal(state.currentSpec.signals[0].bind.max, 21)
  assert.equal(state.currentSpec.data.find((entry) => entry.name === 'rawLinks')?.values.length, 3)
})

test('sankey.expandNode restores original nodes and links for one collapsed aggregate group', async () => {
  const executor = new ActionExecutor()
  registerSankeyActions(executor)

  const state = {
    currentSpec: {
      data: [
        {
          name: 'rawLinks',
          values: [
            { source: 'Other Sources', target: 'X', value: 12 },
            { source: 'X', target: 'Sink', value: 12 },
          ],
        },
        {
          name: 'nodeConfig',
          values: [
            { name: 'X', depth: 1, order: 0 },
            { name: 'Sink', depth: 2, order: 0 },
            {
              name: 'Other Sources',
              depth: 0,
              order: 2,
              _is_aggregate: true,
              _collapsed_nodes: ['A', 'B'],
            },
          ],
        },
      ],
      _sankey_state: {
        original_nodes: [
          { name: 'A', depth: 0, order: 0 },
          { name: 'B', depth: 0, order: 1 },
          { name: 'X', depth: 1, order: 0 },
          { name: 'Sink', depth: 2, order: 0 },
        ],
        original_links: [
          { source: 'A', target: 'X', value: 5 },
          { source: 'B', target: 'X', value: 7 },
          { source: 'X', target: 'Sink', value: 12 },
        ],
        collapsed_groups: {
          'Other Sources': ['A', 'B'],
        },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/sankey_expand'
  const result = await executor.run(
    {
      callId: 'sankey_expand_001',
      name: 'sankey.expandNode',
      targetRef: widgetRef,
      params: {
        aggregateName: 'Other Sources',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'sankey_expand',
            kind: 'sankey',
            title: 'Sankey Expand',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'sankey_expand',
                kind: 'sankey',
                title: 'Sankey Expand',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'sankey_expand',
                kind: 'sankey',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'sankey.expandNode')
  const rawLinks = state.currentSpec.data.find((entry) => entry.name === 'rawLinks')?.values
  const nodeConfig = state.currentSpec.data.find((entry) => entry.name === 'nodeConfig')?.values
  assert.deepEqual(rawLinks, [
    { source: 'A', target: 'X', value: 5 },
    { source: 'B', target: 'X', value: 7 },
    { source: 'X', target: 'Sink', value: 12 },
  ])
  assert.deepEqual(nodeConfig, [
    { name: 'X', depth: 1, order: 0 },
    { name: 'Sink', depth: 2, order: 0 },
    { name: 'A', depth: 0, order: 0 },
    { name: 'B', depth: 0, order: 1 },
  ])
  assert.deepEqual(state.currentSpec._sankey_state, {
    original_nodes: [
      { name: 'A', depth: 0, order: 0 },
      { name: 'B', depth: 0, order: 1 },
      { name: 'X', depth: 1, order: 0 },
      { name: 'Sink', depth: 2, order: 0 },
    ],
    original_links: [
      { source: 'A', target: 'X', value: 5 },
      { source: 'B', target: 'X', value: 7 },
      { source: 'X', target: 'Sink', value: 12 },
    ],
    collapsed_groups: {},
  })
})

test('sankey.highlightPath dims unrelated edges/nodes and emphasizes the requested path', async () => {
  const executor = new ActionExecutor()
  registerSankeyActions(executor)

  const state = {
    currentSpec: {
      data: [
        {
          name: 'rawLinks',
          values: [
            { source: 'A', target: 'B', value: 5 },
            { source: 'B', target: 'C', value: 7 },
            { source: 'B', target: 'D', value: 2 },
          ],
        },
      ],
      marks: [
        {
          name: 'edgeMark',
          encode: {
            update: {},
          },
        },
        {
          name: 'nodeRect',
          encode: {
            update: {},
          },
        },
      ],
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/sankey_highlight_path'
  const result = await executor.run(
    {
      callId: 'sankey_highlight_path_001',
      name: 'sankey.highlightPath',
      targetRef: widgetRef,
      params: {
        path: ['A', 'B', 'C'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'sankey_highlight_path',
            kind: 'sankey',
            title: 'Sankey Highlight Path',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'sankey_highlight_path',
                kind: 'sankey',
                title: 'Sankey Highlight Path',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'sankey_highlight_path',
                kind: 'sankey',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'sankey.highlightPath')
  const edgeUpdate = state.currentSpec.marks[0].encode.update
  const nodeUpdate = state.currentSpec.marks[1].encode.update
  assert.deepEqual(edgeUpdate.fillOpacity, {
    signal: "((datum.source === 'A' && datum.target === 'B') || (datum.source === 'B' && datum.target === 'C')) ? 0.75 : 0.06",
  })
  assert.deepEqual(edgeUpdate.strokeOpacity, {
    signal: "((datum.source === 'A' && datum.target === 'B') || (datum.source === 'B' && datum.target === 'C')) ? 0.5 : 0.02",
  })
  assert.deepEqual(nodeUpdate.fillOpacity, {
    signal: "(datum.name === 'A' || datum.name === 'B' || datum.name === 'C') ? 1.0 : 0.15",
  })
  assert.deepEqual(nodeUpdate.strokeWidth, {
    signal: "(datum.name === 'A' || datum.name === 'B' || datum.name === 'C') ? 2.5 : 0.5",
  })
})

test('sankey.traceNode highlights edges touching one node and emphasizes the selected node', async () => {
  const executor = new ActionExecutor()
  registerSankeyActions(executor)

  const state = {
    currentSpec: {
      data: [
        {
          name: 'rawLinks',
          values: [
            { source: 'A', target: 'B', value: 5 },
            { source: 'B', target: 'C', value: 7 },
            { source: 'D', target: 'E', value: 2 },
          ],
        },
      ],
      marks: [
        {
          name: 'edgeMark',
          encode: {
            update: {},
          },
        },
        {
          name: 'nodeRect',
          encode: {
            update: {},
          },
        },
      ],
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/sankey_trace_node'
  const result = await executor.run(
    {
      callId: 'sankey_trace_node_001',
      name: 'sankey.traceNode',
      targetRef: widgetRef,
      params: {
        nodeName: 'B',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'sankey_trace_node',
            kind: 'sankey',
            title: 'Sankey Trace Node',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'sankey_trace_node',
                kind: 'sankey',
                title: 'Sankey Trace Node',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'sankey_trace_node',
                kind: 'sankey',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'sankey.traceNode')
  const edgeUpdate = state.currentSpec.marks[0].encode.update
  const nodeUpdate = state.currentSpec.marks[1].encode.update
  assert.deepEqual(edgeUpdate.fillOpacity, {
    signal: "datum.source === 'B' || datum.target === 'B' ? 0.75 : 0.08",
  })
  assert.deepEqual(nodeUpdate.fillOpacity, {
    signal: "datum.name === 'B' ? 1.0 : 0.2",
  })
})

test('sankey.colorFlows recolors edges connected to the requested nodes while preserving a fallback edge color signal', async () => {
  const executor = new ActionExecutor()
  registerSankeyActions(executor)

  const state = {
    currentSpec: {
      data: [
        {
          name: 'rawLinks',
          values: [
            { source: 'A', target: 'B', value: 5 },
            { source: 'B', target: 'C', value: 7 },
            { source: 'D', target: 'E', value: 2 },
          ],
        },
      ],
      marks: [
        {
          name: 'edgeMark',
          encode: {
            update: {
              fill: {
                scale: 'color',
                field: 'source',
              },
            },
          },
        },
      ],
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/sankey_color_flows'
  const result = await executor.run(
    {
      callId: 'sankey_color_flows_001',
      name: 'sankey.colorFlows',
      targetRef: widgetRef,
      params: {
        nodes: ['B'],
        color: '#ff0000',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'sankey_color_flows',
            kind: 'sankey',
            title: 'Sankey Color Flows',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'sankey_color_flows',
                kind: 'sankey',
                title: 'Sankey Color Flows',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'sankey_color_flows',
                kind: 'sankey',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'sankey.colorFlows')
  const edgeUpdate = state.currentSpec.marks[0].encode.update
  assert.deepEqual(edgeUpdate.fill, {
    signal: "((datum.source === 'A' && datum.target === 'B') || (datum.source === 'B' && datum.target === 'C')) ? '#ff0000' : scale('color', datum.source)",
  })
})

test('sankey.reorderNodesInLayer rewrites node order for one depth using an explicit order list', async () => {
  const executor = new ActionExecutor()
  registerSankeyActions(executor)

  const state = {
    currentSpec: {
      data: [
        {
          name: 'rawLinks',
          values: [
            { source: 'A', target: 'X', value: 5 },
            { source: 'B', target: 'X', value: 7 },
            { source: 'C', target: 'X', value: 3 },
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
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/sankey_reorder_layer'
  const result = await executor.run(
    {
      callId: 'sankey_reorder_layer_001',
      name: 'sankey.reorderNodesInLayer',
      targetRef: widgetRef,
      params: {
        depth: 0,
        order: ['C', 'A', 'B'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'sankey_reorder_layer',
            kind: 'sankey',
            title: 'Sankey Reorder Layer',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'sankey_reorder_layer',
                kind: 'sankey',
                title: 'Sankey Reorder Layer',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'sankey_reorder_layer',
                kind: 'sankey',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'sankey.reorderNodesInLayer')
  const nodeConfig = state.currentSpec.data.find((entry) => entry.name === 'nodeConfig')?.values
  assert.deepEqual(nodeConfig, [
    { name: 'A', depth: 0, order: 1 },
    { name: 'B', depth: 0, order: 2 },
    { name: 'C', depth: 0, order: 0 },
    { name: 'X', depth: 1, order: 0 },
  ])
})

test('sankey.autoCollapseByRank keeps top N nodes per layer and collapses the rest into layer-specific aggregates', async () => {
  const executor = new ActionExecutor()
  registerSankeyActions(executor)

  const state = {
    currentSpec: {
      data: [
        {
          name: 'rawLinks',
          values: [
            { source: 'A', target: 'X', value: 10 },
            { source: 'B', target: 'X', value: 7 },
            { source: 'C', target: 'X', value: 2 },
            { source: 'X', target: 'Sink', value: 19 },
          ],
        },
        {
          name: 'nodeConfig',
          values: [
            { name: 'A', depth: 0, order: 0 },
            { name: 'B', depth: 0, order: 1 },
            { name: 'C', depth: 0, order: 2 },
            { name: 'X', depth: 1, order: 0 },
            { name: 'Sink', depth: 2, order: 0 },
          ],
        },
      ],
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/sankey_auto_collapse'
  const result = await executor.run(
    {
      callId: 'sankey_auto_collapse_001',
      name: 'sankey.autoCollapseByRank',
      targetRef: widgetRef,
      params: {
        topN: 2,
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'sankey_auto_collapse',
            kind: 'sankey',
            title: 'Sankey Auto Collapse',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'sankey_auto_collapse',
                kind: 'sankey',
                title: 'Sankey Auto Collapse',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'sankey_auto_collapse',
                kind: 'sankey',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'sankey.autoCollapseByRank')
  const rawLinks = state.currentSpec.data.find((entry) => entry.name === 'rawLinks')?.values
  const nodeConfig = state.currentSpec.data.find((entry) => entry.name === 'nodeConfig')?.values
  assert.deepEqual(rawLinks, [
    { source: 'A', target: 'X', value: 10 },
    { source: 'B', target: 'X', value: 7 },
    { source: 'Others (Layer 0)', target: 'X', value: 2 },
    { source: 'X', target: 'Sink', value: 19 },
  ])
  assert.deepEqual(nodeConfig, [
    { name: 'A', depth: 0, order: 0 },
    { name: 'B', depth: 0, order: 1 },
    { name: 'X', depth: 1, order: 0 },
    { name: 'Sink', depth: 2, order: 0 },
    {
      name: 'Others (Layer 0)',
      depth: 0,
      order: 3,
      _is_aggregate: true,
      _collapsed_nodes: ['C'],
    },
  ])
  assert.deepEqual(state.currentSpec._sankey_state, {
    original_nodes: [
      { name: 'A', depth: 0, order: 0 },
      { name: 'B', depth: 0, order: 1 },
      { name: 'C', depth: 0, order: 2 },
      { name: 'X', depth: 1, order: 0 },
      { name: 'Sink', depth: 2, order: 0 },
    ],
    original_links: [
      { source: 'A', target: 'X', value: 10 },
      { source: 'B', target: 'X', value: 7 },
      { source: 'C', target: 'X', value: 2 },
      { source: 'X', target: 'Sink', value: 19 },
    ],
    collapsed_groups: {
      'Others (Layer 0)': ['C'],
    },
  })
})

test('bar.sortBars writes an explicit category sort array using aggregated stacked totals', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { category: 'A', value: 10, type: 'Type1' },
          { category: 'A', value: 20, type: 'Type2' },
          { category: 'B', value: 30, type: 'Type1' },
          { category: 'B', value: 5, type: 'Type2' },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative', aggregate: 'sum' },
        color: { field: 'type', type: 'nominal' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_sort'
  const result = await executor.run(
    {
      callId: 'bar_sort_001',
      name: 'bar.sortBars',
      targetRef: widgetRef,
      params: {
        channel: 'x',
        order: 'descending',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'bar_sort',
            kind: 'bar',
            title: 'Bar Sort',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'bar_sort',
                kind: 'bar',
                title: 'Bar Sort',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'bar_sort',
                kind: 'bar',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'bar.sortBars')
  assert.deepEqual(state.currentSpec.encoding.x.sort, ['B', 'A'])
})

test('bar.sortBars can rank categories by one specific grouped or stacked subcategory', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { category: 'A', value: 10, type: 'Type1' },
          { category: 'A', value: 20, type: 'Type2' },
          { category: 'B', value: 30, type: 'Type1' },
          { category: 'B', value: 5, type: 'Type2' },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative', aggregate: 'sum' },
        color: { field: 'type', type: 'nominal' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_sort_sub'
  const result = await executor.run(
    {
      callId: 'bar_sort_sub_001',
      name: 'bar.sortBars',
      targetRef: widgetRef,
      params: {
        channel: 'x',
        order: 'ascending',
        bySubcategory: 'Type1',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'bar_sort_sub',
            kind: 'bar',
            title: 'Bar Sort Subcategory',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'bar_sort_sub',
                kind: 'bar',
                title: 'Bar Sort Subcategory',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'bar_sort_sub',
                kind: 'bar',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'bar.sortBars')
  assert.deepEqual(state.currentSpec.encoding.x.sort, ['A', 'B'])
})

test('bar.sortBars uses runtime rows when the active bar spec is URL-backed', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const runtimeRows = [
    { category: 'A', value: 10 },
    { category: 'B', value: 30 },
    { category: 'C', value: 20 },
  ]
  const state = {
    currentSpec: {
      data: {
        url: 'https://example.com/bar.json',
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_sort_url'
  const store = createSingleWidgetStore({
    widgetRef,
    widgetId: 'bar_sort_url',
    kind: 'bar',
    title: 'Bar Sort URL',
    currentDataRef: 'data://bar/sort-url',
    runtimeRows,
  })
  const result = await executor.run(
    {
      callId: 'bar_sort_url_001',
      name: 'bar.sortBars',
      targetRef: widgetRef,
      params: {
        channel: 'x',
        order: 'descending',
      },
    },
    {
      getAppState: () => state,
      store,
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'bar.sortBars')
  assert.deepEqual(state.currentSpec.encoding.x.sort, ['B', 'C', 'A'])
})

test('bar.highlightTopN writes an opacity highlight condition for the top categories by measure', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { category: 'A', value: 10 },
          { category: 'B', value: 30 },
          { category: 'C', value: 20 },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_topn'
  const result = await executor.run(
    {
      callId: 'bar_topn_001',
      name: 'bar.highlightTopN',
      targetRef: widgetRef,
      params: {
        n: 2,
        categoryField: 'category',
        measureField: 'value',
        order: 'descending',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'bar_topn',
            kind: 'bar',
            title: 'Bar TopN',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'bar_topn',
                kind: 'bar',
                title: 'Bar TopN',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'bar_topn',
                kind: 'bar',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'bar.highlightTopN')
  assert.equal(typeof state.currentSpec.encoding.opacity.condition.test, 'string')
  assert.match(state.currentSpec.encoding.opacity.condition.test, /datum\['category'\]/)
  assert.equal(state.currentSpec.encoding.opacity.condition.value, 1)
  assert.equal(state.currentSpec.encoding.opacity.value, 0.2)
})

test('bar.highlightTopN uses runtime rows when the active bar spec is URL-backed', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const runtimeRows = [
    { category: 'A', value: 10 },
    { category: 'B', value: 30 },
    { category: 'C', value: 20 },
  ]
  const state = {
    currentSpec: {
      data: {
        url: 'https://example.com/bar-topn.json',
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_topn_url'
  const store = createSingleWidgetStore({
    widgetRef,
    widgetId: 'bar_topn_url',
    kind: 'bar',
    title: 'Bar TopN URL',
    currentDataRef: 'data://bar/topn-url',
    runtimeRows,
  })
  const result = await executor.run(
    {
      callId: 'bar_topn_url_001',
      name: 'bar.highlightTopN',
      targetRef: widgetRef,
      params: {
        n: 1,
        categoryField: 'category',
        measureField: 'value',
        order: 'descending',
      },
    },
    {
      getAppState: () => state,
      store,
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'bar.highlightTopN')
  assert.match(state.currentSpec.encoding.opacity.condition.test, /datum\['category'\] == 'B'/)
})

test('bar.filterCategories writes a categorical filter transform that keeps only the requested categories', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { category: 'A', value: 10 },
          { category: 'B', value: 30 },
          { category: 'C', value: 20 },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_filter'
  const result = await executor.run(
    {
      callId: 'bar_filter_001',
      name: 'bar.filterCategories',
      targetRef: widgetRef,
      params: {
        categories: ['A', 'C'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'bar_filter',
            kind: 'bar',
            title: 'Bar Filter',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'bar_filter',
                kind: 'bar',
                title: 'Bar Filter',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'bar_filter',
                kind: 'bar',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'bar.filterCategories')
  assert.deepEqual(state.currentSpec.transform, [
    {
      filter: {
        field: 'category',
        oneOf: ['A', 'C'],
      },
    },
  ])
})

test('bar.addBars expands the managed visibility filter and records the updated visible category set', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { category: 'A', value: 10 },
          { category: 'B', value: 30 },
          { category: 'C', value: 20 },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
      transform: [
        {
          filter: `indexof(["A","B"], datum['category']) >= 0`,
          _widgetvaTag: 'bar.addBars',
        },
      ],
      _bar_visibility_state: {
        mode: 'x',
        x_field: 'category',
        visible_x: ['A', 'B'],
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_add'
  const result = await executor.run(
    {
      callId: 'bar_add_001',
      name: 'bar.addBars',
      targetRef: widgetRef,
      params: {
        values: ['C'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'bar_add',
            kind: 'bar',
            title: 'Bar Add',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'bar_add',
                kind: 'bar',
                title: 'Bar Add',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'bar_add',
                kind: 'bar',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'bar.addBars')
  assert.deepEqual(state.currentSpec.transform, [
    {
      filter: `indexof(["A","B","C"], datum['category']) >= 0`,
      _widgetvaTag: 'bar.addBars',
    },
  ])
  assert.deepEqual(state.currentSpec._bar_visibility_state, {
    mode: 'x',
    x_field: 'category',
    visible_x: ['A', 'B', 'C'],
  })
})

test('bar.removeBars contracts the managed visibility filter and records the reduced visible category set', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { category: 'A', value: 10 },
          { category: 'B', value: 30 },
          { category: 'C', value: 20 },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
      transform: [
        {
          filter: `indexof(["A","B","C"], datum['category']) >= 0`,
          _widgetvaTag: 'bar.addBars',
        },
      ],
      _bar_visibility_state: {
        mode: 'x',
        x_field: 'category',
        visible_x: ['A', 'B', 'C'],
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_remove'
  const result = await executor.run(
    {
      callId: 'bar_remove_001',
      name: 'bar.removeBars',
      targetRef: widgetRef,
      params: {
        values: ['B'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'bar_remove',
            kind: 'bar',
            title: 'Bar Remove',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'bar_remove',
                kind: 'bar',
                title: 'Bar Remove',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'bar_remove',
                kind: 'bar',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'bar.removeBars')
  assert.deepEqual(state.currentSpec.transform, [
    {
      filter: `indexof(["A","C"], datum['category']) >= 0`,
      _widgetvaTag: 'bar.addBars',
    },
  ])
  assert.deepEqual(state.currentSpec._bar_visibility_state, {
    mode: 'x',
    x_field: 'category',
    visible_x: ['A', 'C'],
  })
})

test('bar.addBars uses runtime rows when the active bar spec is URL-backed', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const runtimeRows = [
    { category: 'A', value: 10 },
    { category: 'B', value: 30 },
    { category: 'C', value: 20 },
  ]
  const state = {
    currentSpec: {
      data: {
        url: 'https://example.com/bar-add.json',
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
      transform: [
        {
          filter: `indexof(["A","B"], datum['category']) >= 0`,
          _widgetvaTag: 'bar.addBars',
        },
      ],
      _bar_visibility_state: {
        mode: 'x',
        x_field: 'category',
        visible_x: ['A', 'B'],
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_add_url'
  const store = createSingleWidgetStore({
    widgetRef,
    widgetId: 'bar_add_url',
    kind: 'bar',
    title: 'Bar Add URL',
    currentDataRef: 'data://bar/add-url',
    runtimeRows,
  })
  const result = await executor.run(
    {
      callId: 'bar_add_url_001',
      name: 'bar.addBars',
      targetRef: widgetRef,
      params: {
        values: ['C'],
      },
    },
    {
      getAppState: () => state,
      store,
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'bar.addBars')
  assert.deepEqual(state.currentSpec._bar_visibility_state.visible_x, ['A', 'B', 'C'])
})

test('bar.addBarItems expands the managed visibility filter for grouped or stacked members and records the updated visible item set', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { category: 'A', value: 10, type: 'Type1' },
          { category: 'A', value: 20, type: 'Type2' },
          { category: 'B', value: 15, type: 'Type1' },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'type', type: 'nominal' },
      },
      transform: [
        {
          filter: `(datum['category'] == "A" && datum['type'] == "Type1") || (datum['category'] == "B" && datum['type'] == "Type1")`,
          _widgetvaTag: 'bar.addBarItems',
        },
      ],
      _bar_visibility_state: {
        mode: 'item',
        x_field: 'category',
        sub_field: 'type',
        visible_items: [['A', 'Type1'], ['B', 'Type1']],
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_add_items'
  const result = await executor.run(
    {
      callId: 'bar_add_items_001',
      name: 'bar.addBarItems',
      targetRef: widgetRef,
      params: {
        items: [{ x: 'A', sub: 'Type2' }],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'bar_add_items',
            kind: 'bar',
            title: 'Bar Add Items',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'bar_add_items',
                kind: 'bar',
                title: 'Bar Add Items',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'bar_add_items',
                kind: 'bar',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'bar.addBarItems')
  assert.deepEqual(state.currentSpec.transform, [
    {
      filter: `(datum['category'] == "A" && datum['type'] == "Type1") || (datum['category'] == "A" && datum['type'] == "Type2") || (datum['category'] == "B" && datum['type'] == "Type1")`,
      _widgetvaTag: 'bar.addBarItems',
    },
  ])
  assert.deepEqual(state.currentSpec._bar_visibility_state, {
    mode: 'item',
    x_field: 'category',
    sub_field: 'type',
    visible_items: [['A', 'Type1'], ['A', 'Type2'], ['B', 'Type1']],
  })
})

test('bar.removeBarItems contracts the managed visibility filter for grouped or stacked members and records the reduced visible item set', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { category: 'A', value: 10, type: 'Type1' },
          { category: 'A', value: 20, type: 'Type2' },
          { category: 'B', value: 15, type: 'Type1' },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'type', type: 'nominal' },
      },
      transform: [
        {
          filter: `(datum['category'] == "A" && datum['type'] == "Type1") || (datum['category'] == "A" && datum['type'] == "Type2") || (datum['category'] == "B" && datum['type'] == "Type1")`,
          _widgetvaTag: 'bar.addBarItems',
        },
      ],
      _bar_visibility_state: {
        mode: 'item',
        x_field: 'category',
        sub_field: 'type',
        visible_items: [['A', 'Type1'], ['A', 'Type2'], ['B', 'Type1']],
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_remove_items'
  const result = await executor.run(
    {
      callId: 'bar_remove_items_001',
      name: 'bar.removeBarItems',
      targetRef: widgetRef,
      params: {
        items: [{ x: 'A', sub: 'Type2' }],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'bar_remove_items',
            kind: 'bar',
            title: 'Bar Remove Items',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'bar_remove_items',
                kind: 'bar',
                title: 'Bar Remove Items',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'bar_remove_items',
                kind: 'bar',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'bar.removeBarItems')
  assert.deepEqual(state.currentSpec.transform, [
    {
      filter: `(datum['category'] == "A" && datum['type'] == "Type1") || (datum['category'] == "B" && datum['type'] == "Type1")`,
      _widgetvaTag: 'bar.addBarItems',
    },
  ])
  assert.deepEqual(state.currentSpec._bar_visibility_state, {
    mode: 'item',
    x_field: 'category',
    sub_field: 'type',
    visible_items: [['A', 'Type1'], ['B', 'Type1']],
  })
})

test('bar.addBarItems uses runtime rows when the active bar spec is URL-backed', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const runtimeRows = [
    { category: 'A', value: 10, type: 'Type1' },
    { category: 'A', value: 20, type: 'Type2' },
    { category: 'B', value: 15, type: 'Type1' },
  ]
  const state = {
    currentSpec: {
      data: {
        url: 'https://example.com/bar-items.json',
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'type', type: 'nominal' },
      },
      transform: [
        {
          filter: `(datum['category'] == "A" && datum['type'] == "Type1") || (datum['category'] == "B" && datum['type'] == "Type1")`,
          _widgetvaTag: 'bar.addBarItems',
        },
      ],
      _bar_visibility_state: {
        mode: 'item',
        x_field: 'category',
        sub_field: 'type',
        visible_items: [['A', 'Type1'], ['B', 'Type1']],
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_add_items_url'
  const store = createSingleWidgetStore({
    widgetRef,
    widgetId: 'bar_add_items_url',
    kind: 'bar',
    title: 'Bar Add Items URL',
    currentDataRef: 'data://bar/add-items-url',
    runtimeRows,
  })
  const result = await executor.run(
    {
      callId: 'bar_add_items_url_001',
      name: 'bar.addBarItems',
      targetRef: widgetRef,
      params: {
        items: [{ x: 'A', sub: 'Type2' }],
      },
    },
    {
      getAppState: () => state,
      store,
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'bar.addBarItems')
  assert.deepEqual(state.currentSpec._bar_visibility_state.visible_items, [['A', 'Type1'], ['A', 'Type2'], ['B', 'Type1']])
})

test('bar.filterSubcategories writes a tagged transform that excludes grouped or stacked subcategories and trims the color domain', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { category: 'A', value: 10, type: 'Type1' },
          { category: 'A', value: 20, type: 'Type2' },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
        color: {
          field: 'type',
          type: 'nominal',
          scale: {
            domain: ['Type1', 'Type2'],
          },
        },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_sub_filter'
  const result = await executor.run(
    {
      callId: 'bar_sub_filter_001',
      name: 'bar.filterSubcategories',
      targetRef: widgetRef,
      params: {
        subcategoriesToRemove: ['Type2'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'bar_sub_filter',
            kind: 'bar',
            title: 'Bar Subcategory Filter',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'bar_sub_filter',
                kind: 'bar',
                title: 'Bar Subcategory Filter',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'bar_sub_filter',
                kind: 'bar',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'bar.filterSubcategories')
  assert.deepEqual(state.currentSpec.transform, [
    {
      filter: `datum['type'] != \"Type2\"`,
      _widgetvaTag: 'bar.filterSubcategories',
    },
  ])
  assert.deepEqual(state.currentSpec.encoding.color.scale.domain, ['Type1'])
})

test('bar.expandStack filters to one category, moves the color field onto x, and removes stacking', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { region: 'East China', value: 10, type: 'Type1' },
          { region: 'East China', value: 20, type: 'Type2' },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'region', type: 'nominal' },
        y: { field: 'value', type: 'quantitative', stack: 'zero' },
        color: {
          field: 'type',
          type: 'nominal',
          title: 'Type',
          scale: {
            domain: ['Type1', 'Type2'],
          },
        },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_expand_stack'
  const result = await executor.run(
    {
      callId: 'bar_expand_stack_001',
      name: 'bar.expandStack',
      targetRef: widgetRef,
      params: {
        category: 'East China',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'bar_expand_stack',
            kind: 'bar',
            title: 'Bar Expand Stack',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'bar_expand_stack',
                kind: 'bar',
                title: 'Bar Expand Stack',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'bar_expand_stack',
                kind: 'bar',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'bar.expandStack')
  assert.deepEqual(state.currentSpec.transform, [
    {
      filter: `datum['region'] == \"East China\"`,
      _widgetvaTag: 'bar.expandStack',
    },
  ])
  assert.deepEqual(state.currentSpec.encoding.x, {
    field: 'type',
    type: 'nominal',
    title: 'Type',
    axis: { labelAngle: -45 },
    sort: ['Type1', 'Type2'],
  })
  assert.equal(Object.prototype.hasOwnProperty.call(state.currentSpec.encoding.y, 'stack'), false)
})

test('bar.toggleStackMode switches between grouped and stacked encodings and records the current mode', async () => {
  const executor = new ActionExecutor()
  registerBarActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { category: 'A', value: 10, type: 'Type1' },
          { category: 'A', value: 20, type: 'Type2' },
        ],
      },
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative', stack: 'zero' },
        color: { field: 'type', type: 'nominal' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/bar_toggle_stack'
  const groupedResult = await executor.run(
    {
      callId: 'bar_toggle_stack_001',
      name: 'bar.toggleStackMode',
      targetRef: widgetRef,
      params: {
        mode: 'grouped',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'bar_toggle_stack',
            kind: 'bar',
            title: 'Bar Toggle Stack',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'bar_toggle_stack',
                kind: 'bar',
                title: 'Bar Toggle Stack',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'bar_toggle_stack',
                kind: 'bar',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(groupedResult.ok, true)
  assert.equal(state.currentSpec.encoding.xOffset.field, 'type')
  assert.equal(Object.prototype.hasOwnProperty.call(state.currentSpec.encoding.y, 'stack'), false)
  assert.equal(state.currentSpec._stack_mode, 'grouped')

  const stackedResult = await executor.run(
    {
      callId: 'bar_toggle_stack_002',
      name: 'bar.toggleStackMode',
      targetRef: widgetRef,
      params: {
        mode: 'stacked',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'bar_toggle_stack',
            kind: 'bar',
            title: 'Bar Toggle Stack',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'bar_toggle_stack',
                kind: 'bar',
                title: 'Bar Toggle Stack',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s2',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'bar_toggle_stack',
                kind: 'bar',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(stackedResult.ok, true)
  assert.equal(Object.prototype.hasOwnProperty.call(state.currentSpec.encoding, 'xOffset'), false)
  assert.equal(state.currentSpec.encoding.y.stack, 'zero')
  assert.equal(state.currentSpec._stack_mode, 'stacked')
})

test('registerLineActions exposes line.zoomXRegion as a widget binding action', () => {
  const executor = new ActionExecutor()

  registerLineActions(executor)

  assert.equal(executor.has('line.selectSeries'), true)
  assert.equal(executor.has('line.selectXValue'), true)
  assert.equal(executor.has('line.zoomXRegion'), true)
  assert.equal(executor.has('line.focusLines'), true)
  assert.equal(executor.has('line.highlightTrend'), true)
  assert.equal(executor.has('line.showMovingAverage'), true)
  assert.equal(executor.has('line.drillDownXAxis'), true)
  assert.equal(executor.has('line.resetDrilldownXAxis'), true)
  assert.equal(executor.has('line.resampleXAxis'), true)
  assert.equal(executor.has('line.resetResampleXAxis'), true)
  assert.equal(executor.has('line.boldLines'), true)
  assert.equal(executor.has('line.filterLines'), true)
})

test('line.focusLines writes an opacity focus condition for the requested line groups', async () => {
  const executor = new ActionExecutor()
  registerLineActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { date: '2024-01-01', value: 10, series: 'A' },
          { date: '2024-01-02', value: 20, series: 'B' },
        ],
      },
      mark: 'line',
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/line_focus'
  const result = await executor.run(
    {
      callId: 'line_focus_001',
      name: 'line.focusLines',
      targetRef: widgetRef,
      params: {
        lines: ['A'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'line_focus',
            kind: 'line',
            title: 'Line Focus',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'line_focus',
                kind: 'line',
                title: 'Line Focus',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'line_focus',
                kind: 'line',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'line.focusLines')
  assert.equal(typeof state.currentSpec.encoding.opacity.condition.test, 'string')
  assert.match(state.currentSpec.encoding.opacity.condition.test, /datum\['series'\]/)
  assert.equal(state.currentSpec.encoding.opacity.condition.value, 1)
  assert.equal(state.currentSpec.encoding.opacity.value, 0.08)
})

test('line.highlightTrend adds a regression trend layer over the current x/y encoding', async () => {
  const executor = new ActionExecutor()
  registerLineActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { date: '2024-01-01', value: 10, series: 'A' },
          { date: '2024-01-02', value: 20, series: 'A' },
        ],
      },
      mark: 'line',
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/line_trend'
  const result = await executor.run(
    {
      callId: 'line_trend_001',
      name: 'line.highlightTrend',
      targetRef: widgetRef,
      params: {
        trendType: 'increasing',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'line_trend',
            kind: 'line',
            title: 'Line Trend',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'line_trend',
                kind: 'line',
                title: 'Line Trend',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'line_trend',
                kind: 'line',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'line.highlightTrend')
  assert.equal(Array.isArray(state.currentSpec.layer), true)
  assert.equal(state.currentSpec.layer.length, 2)
  assert.equal(state.currentSpec.layer[1]._widgetvaTag, 'line.highlightTrend')
  assert.deepEqual(state.currentSpec.layer[1].transform, [{ regression: 'value', on: 'date' }])
  assert.equal(state.currentSpec.layer[1].mark.color, 'red')
})

test('line.showMovingAverage adds a tagged moving-average overlay layer with a grouped window transform', async () => {
  const executor = new ActionExecutor()
  registerLineActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { date: '2024-01-01', value: 10, series: 'A' },
          { date: '2024-01-02', value: 14, series: 'A' },
          { date: '2024-01-03', value: 8, series: 'A' },
        ],
      },
      mark: 'line',
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/line_moving_average'
  const result = await executor.run(
    {
      callId: 'line_moving_average_001',
      name: 'line.showMovingAverage',
      targetRef: widgetRef,
      params: {
        windowSize: 3,
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'line_moving_average',
            kind: 'line',
            title: 'Line Moving Average',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'line_moving_average',
                kind: 'line',
                title: 'Line Moving Average',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'line_moving_average',
                kind: 'line',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'line.showMovingAverage')
  assert.equal(Array.isArray(state.currentSpec.layer), true)
  assert.equal(state.currentSpec.layer.length, 2)
  assert.equal(state.currentSpec.layer[1]._widgetvaTag, 'line.showMovingAverage')
  assert.deepEqual(state.currentSpec.layer[1].transform, [{
    window: [{
      op: 'mean',
      field: 'value',
      as: 'value_ma',
    }],
    frame: [-2, 0],
    sort: [{ field: 'date', order: 'ascending' }],
    groupby: ['series'],
  }])
  assert.deepEqual(state.currentSpec.layer[1].encoding, {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value_ma', type: 'quantitative' },
    color: { field: 'series', type: 'nominal' },
  })
  assert.equal(state.currentSpec.layer[1].mark.color, 'orange')
})

test('line.drillDownXAxis rewrites transforms and encodings for a finer temporal aggregation', async () => {
  const executor = new ActionExecutor()
  registerLineActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { date: '2024-01-01', sales: 10, series: 'A' },
          { date: '2024-02-01', sales: 20, series: 'A' },
        ],
      },
      transform: [{
        timeUnit: 'year',
        field: 'date',
        as: 'year_date',
      }, {
        aggregate: [{ op: 'sum', field: 'sales', as: 'total_sales' }],
        groupby: ['year_date', 'series'],
      }],
      mark: 'line',
      encoding: {
        x: { field: 'year_date', type: 'temporal' },
        y: { field: 'total_sales', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
      title: 'Annual sales trend',
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/line_drill'
  const result = await executor.run(
    {
      callId: 'line_drill_001',
      name: 'line.drillDownXAxis',
      targetRef: widgetRef,
      params: {
        level: 'year',
        value: 2024,
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'line_drill',
            kind: 'line',
            title: 'Line Drill',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'line_drill',
                kind: 'line',
                title: 'Line Drill',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'line_drill',
                kind: 'line',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'line.drillDownXAxis')
  assert.deepEqual(state.currentSpec.transform, [
    {
      filter: 'year(datum.date) == 2024',
      _widgetvaTag: 'line.drillDownXAxis',
    },
    {
      timeUnit: 'yearmonth',
      field: 'date',
      as: 'month_date',
      _widgetvaTag: 'line.drillDownXAxis',
    },
    {
      aggregate: [{ op: 'sum', field: 'sales', as: 'total_value' }],
      groupby: ['month_date', 'series'],
      _widgetvaTag: 'line.drillDownXAxis',
    },
  ])
  assert.equal(state.currentSpec.encoding.x.field, 'month_date')
  assert.equal(state.currentSpec.encoding.y.field, 'total_value')
  assert.equal(state.currentSpec._line_drilldown_state.parent.year, 2024)
})

test('line.resetDrilldownXAxis restores the original line transforms, encoding, and title', async () => {
  const executor = new ActionExecutor()
  registerLineActions(executor)

  const originalTransform = [{
    timeUnit: 'year',
    field: 'date',
    as: 'year_date',
  }]
  const originalEncoding = {
    x: { field: 'year_date', type: 'temporal' },
    y: { field: 'total_sales', type: 'quantitative' },
    color: { field: 'series', type: 'nominal' },
  }
  const state = {
    currentSpec: {
      data: {
        values: [
          { date: '2024-01-01', sales: 10, series: 'A' },
          { date: '2024-02-01', sales: 20, series: 'A' },
        ],
      },
      transform: [{
        filter: 'year(datum.date) == 2024',
        _widgetvaTag: 'line.drillDownXAxis',
      }],
      encoding: {
        x: { field: 'month_date', type: 'temporal' },
        y: { field: 'total_value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
      title: '2024 monthly trend',
      _line_drilldown_state: {
        original_transform: originalTransform,
        original_encoding: originalEncoding,
        original_title: 'Annual sales trend',
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/line_reset_drill'
  const result = await executor.run(
    {
      callId: 'line_reset_drill_001',
      name: 'line.resetDrilldownXAxis',
      targetRef: widgetRef,
      params: {},
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'line_reset_drill',
            kind: 'line',
            title: 'Line Reset Drill',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'line_reset_drill',
                kind: 'line',
                title: 'Line Reset Drill',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'line_reset_drill',
                kind: 'line',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'line.resetDrilldownXAxis')
  assert.deepEqual(state.currentSpec.transform, originalTransform)
  assert.deepEqual(state.currentSpec.encoding, originalEncoding)
  assert.equal(state.currentSpec.title, 'Annual sales trend')
  assert.equal('_line_drilldown_state' in state.currentSpec, false)
})

test('line.resampleXAxis rewrites timeUnit and value aggregation while recording resample state', async () => {
  const executor = new ActionExecutor()
  registerLineActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { date: '2024-01-01', sales: 10, series: 'A' },
          { date: '2024-01-02', sales: 20, series: 'A' },
        ],
      },
      mark: 'line',
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'sales', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/line_resample'
  const result = await executor.run(
    {
      callId: 'line_resample_001',
      name: 'line.resampleXAxis',
      targetRef: widgetRef,
      params: {
        granularity: 'month',
        agg: 'sum',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'line_resample',
            kind: 'line',
            title: 'Line Resample',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'line_resample',
                kind: 'line',
                title: 'Line Resample',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'line_resample',
                kind: 'line',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'line.resampleXAxis')
  assert.equal(state.currentSpec.encoding.x.timeUnit, 'yearmonth')
  assert.equal(state.currentSpec.encoding.y.aggregate, 'sum')
  assert.equal(state.currentSpec._resample_state.current_granularity, 'month')
  assert.equal(state.currentSpec._resample_state.current_agg, 'sum')
  assert.deepEqual(state.currentSpec._resample_state.original_encoding, {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'sales', type: 'quantitative' },
    color: { field: 'series', type: 'nominal' },
  })
})

test('line.resetResampleXAxis restores the original encoding and clears the resample state', async () => {
  const executor = new ActionExecutor()
  registerLineActions(executor)

  const originalEncoding = {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'sales', type: 'quantitative' },
    color: { field: 'series', type: 'nominal' },
  }
  const state = {
    currentSpec: {
      data: {
        values: [
          { date: '2024-01-01', sales: 10, series: 'A' },
          { date: '2024-01-02', sales: 20, series: 'A' },
        ],
      },
      mark: 'line',
      encoding: {
        x: { field: 'date', type: 'temporal', timeUnit: 'yearmonth' },
        y: { field: 'sales', type: 'quantitative', aggregate: 'sum' },
        color: { field: 'series', type: 'nominal' },
      },
      _resample_state: {
        original_encoding: originalEncoding,
        current_granularity: 'month',
        current_agg: 'sum',
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/line_reset_resample'
  const result = await executor.run(
    {
      callId: 'line_reset_resample_001',
      name: 'line.resetResampleXAxis',
      targetRef: widgetRef,
      params: {},
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'line_reset_resample',
            kind: 'line',
            title: 'Line Reset Resample',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'line_reset_resample',
                kind: 'line',
                title: 'Line Reset Resample',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'line_reset_resample',
                kind: 'line',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'line.resetResampleXAxis')
  assert.deepEqual(state.currentSpec.encoding, originalEncoding)
  assert.equal('_resample_state' in state.currentSpec, false)
})

test('line.boldLines writes a strokeWidth condition for the requested line groups', async () => {
  const executor = new ActionExecutor()
  registerLineActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { date: '2024-01-01', value: 10, series: 'A' },
          { date: '2024-01-02', value: 20, series: 'B' },
        ],
      },
      mark: 'line',
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/line_bold'
  const result = await executor.run(
    {
      callId: 'line_bold_001',
      name: 'line.boldLines',
      targetRef: widgetRef,
      params: {
        lineNames: ['A'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'line_bold',
            kind: 'line',
            title: 'Line Bold',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'line_bold',
                kind: 'line',
                title: 'Line Bold',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'line_bold',
                kind: 'line',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'line.boldLines')
  assert.equal(typeof state.currentSpec.encoding.strokeWidth.condition.test, 'string')
  assert.match(state.currentSpec.encoding.strokeWidth.condition.test, /datum\['series'\]/)
  assert.equal(state.currentSpec.encoding.strokeWidth.condition.value, 4)
  assert.equal(state.currentSpec.encoding.strokeWidth.value, 1)
})

test('line.filterLines writes a tagged transform that excludes the requested line series', async () => {
  const executor = new ActionExecutor()
  registerLineActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { date: '2024-01-01', value: 10, series: 'A' },
          { date: '2024-01-02', value: 20, series: 'B' },
        ],
      },
      mark: 'line',
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/line_filter'
  const result = await executor.run(
    {
      callId: 'line_filter_001',
      name: 'line.filterLines',
      targetRef: widgetRef,
      params: {
        linesToRemove: ['B'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'line_filter',
            kind: 'line',
            title: 'Line Filter',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'line_filter',
                kind: 'line',
                title: 'Line Filter',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'line_filter',
                kind: 'line',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'line.filterLines')
  assert.deepEqual(state.currentSpec.transform, [
    {
      filter: {
        field: 'series',
        notOneOf: ['B'],
      },
      _widgetvaTag: 'line.filterLines',
    },
  ])
})

test('registerHeatmapActions exposes heatmap.filterCells while preserving heatmap.selectCell compatibility', () => {
  const executor = new ActionExecutor()

  registerHeatmapActions(executor)

  assert.equal(executor.has('heatmap.filterCells'), true)
  assert.equal(executor.has('heatmap.selectCell'), true)
  assert.equal(executor.has('heatmap.selectSubmatrix'), true)
  assert.equal(executor.has('heatmap.drilldownAxis'), true)
  assert.equal(executor.has('heatmap.resetDrilldown'), true)
  assert.equal(executor.has('heatmap.addMarginalBars'), true)
  assert.equal(executor.has('heatmap.highlightRegion'), true)
  assert.equal(executor.has('heatmap.adjustColorScale'), true)
  assert.equal(executor.has('heatmap.clusterRowsCols'), true)
  assert.equal(executor.has('heatmap.transpose'), true)
})

test('heatmap.selectSubmatrix commits a region selection over x/y coordinates without mutating the spec', async () => {
  const executor = new ActionExecutor()
  registerHeatmapActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { row: 'A', col: 'Q1', value: 10 },
          { row: 'A', col: 'Q2', value: 20 },
          { row: 'B', col: 'Q1', value: 30 },
        ],
      },
      mark: 'rect',
      encoding: {
        x: { field: 'col', type: 'nominal' },
        y: { field: 'row', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/heatmap_submatrix'
  const widgets = {
    [widgetRef]: {
      ref: widgetRef,
      widgetId: 'heatmap_submatrix',
      kind: 'heatmap',
      selections: {},
      view: {},
      data: {
        currentDataRef: 'data://heatmap/submatrix',
      },
    },
  }
  const runtimeData = {
    'data://heatmap/submatrix': {
      rows: state.currentSpec.data.values,
    },
  }
  const result = await executor.run(
    {
      callId: 'heatmap_submatrix_001',
      name: 'heatmap.selectSubmatrix',
      targetRef: widgetRef,
      params: {
        xValues: ['Q1', 'Q2'],
        yValues: ['A'],
      },
    },
    {
      getAppState: () => state,
      store: {
        widgets,
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'heatmap_submatrix',
            kind: 'heatmap',
            title: 'Heatmap Submatrix',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'heatmap_submatrix',
                kind: 'heatmap',
                title: 'Heatmap Submatrix',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetState(ref) {
          return widgets[ref] || null
        },
        runtimeData,
        readState() {
          return {
            stateId: 'main:s1',
            widgets,
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'heatmap.selectSubmatrix')
  assert.equal(result.result?.selectedCount, 2)
  assert.deepEqual(state.currentSpec.encoding, {
    x: { field: 'col', type: 'nominal' },
    y: { field: 'row', type: 'nominal' },
    color: { field: 'value', type: 'quantitative' },
  })
})

test('heatmap.drilldownAxis rewrites the temporal x-axis timeUnit and adds a tagged drill-down filter', async () => {
  const executor = new ActionExecutor()
  registerHeatmapActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { date: '2024-01-01', row: 'A', value: 10 },
          { date: '2024-02-01', row: 'B', value: 20 },
        ],
      },
      mark: 'rect',
      encoding: {
        x: { field: 'date', type: 'temporal', timeUnit: 'year' },
        y: { field: 'row', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/heatmap_drill'
  const result = await executor.run(
    {
      callId: 'heatmap_drill_001',
      name: 'heatmap.drilldownAxis',
      targetRef: widgetRef,
      params: {
        level: 'year',
        value: 2024,
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'heatmap_drill',
            kind: 'heatmap',
            title: 'Heatmap Drill',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'heatmap_drill',
                kind: 'heatmap',
                title: 'Heatmap Drill',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'heatmap_drill',
                kind: 'heatmap',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'heatmap.drilldownAxis')
  assert.equal(state.currentSpec.encoding.x.timeUnit, 'month')
  assert.deepEqual(state.currentSpec.transform, [
    {
      filter: `year(datum['date']) == 2024`,
      _widgetvaTag: 'heatmap.drilldownAxis',
    },
  ])
  assert.deepEqual(state.currentSpec._heatmap_state.parent, { year: 2024 })
})

test('heatmap.resetDrilldown restores the original x encoding and removes tagged drill-down filters', async () => {
  const executor = new ActionExecutor()
  registerHeatmapActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { date: '2024-01-01', row: 'A', value: 10 },
          { date: '2024-02-01', row: 'B', value: 20 },
        ],
      },
      mark: 'rect',
      transform: [{
        filter: `year(datum['date']) == 2024`,
        _widgetvaTag: 'heatmap.drilldownAxis',
      }],
      encoding: {
        x: { field: 'date', type: 'temporal', timeUnit: 'month' },
        y: { field: 'row', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
      _heatmap_state: {
        original_x_encoding: { field: 'date', type: 'temporal', timeUnit: 'year' },
        parent: { year: 2024 },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/heatmap_reset_drill'
  const result = await executor.run(
    {
      callId: 'heatmap_reset_drill_001',
      name: 'heatmap.resetDrilldown',
      targetRef: widgetRef,
      params: {},
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'heatmap_reset_drill',
            kind: 'heatmap',
            title: 'Heatmap Reset Drill',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'heatmap_reset_drill',
                kind: 'heatmap',
                title: 'Heatmap Reset Drill',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'heatmap_reset_drill',
                kind: 'heatmap',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'heatmap.resetDrilldown')
  assert.deepEqual(state.currentSpec.transform, [])
  assert.deepEqual(state.currentSpec.encoding.x, { field: 'date', type: 'temporal', timeUnit: 'year' })
  assert.equal('_heatmap_state' in state.currentSpec, false)
})

test('heatmap.addMarginalBars composes the heatmap with top/right marginal bar charts and records marginal state', async () => {
  const executor = new ActionExecutor()
  registerHeatmapActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { col: 'Q1', row: 'A', value: 10 },
          { col: 'Q2', row: 'B', value: 20 },
        ],
      },
      mark: 'rect',
      width: 320,
      height: 240,
      encoding: {
        x: { field: 'col', type: 'nominal' },
        y: { field: 'row', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
      title: 'Heatmap Main',
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/heatmap_marginal'
  const result = await executor.run(
    {
      callId: 'heatmap_marginal_001',
      name: 'heatmap.addMarginalBars',
      targetRef: widgetRef,
      params: {
        op: 'mean',
        showTop: true,
        showRight: true,
        barSize: 60,
        barColor: '#444444',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'heatmap_marginal',
            kind: 'heatmap',
            title: 'Heatmap Marginal',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'heatmap_marginal',
                kind: 'heatmap',
                title: 'Heatmap Marginal',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'heatmap_marginal',
                kind: 'heatmap',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'heatmap.addMarginalBars')
  assert.equal(Array.isArray(state.currentSpec.vconcat), true)
  assert.equal(state.currentSpec.vconcat.length, 2)
  assert.equal(state.currentSpec.vconcat[0].mark.type, 'bar')
  assert.equal(state.currentSpec.vconcat[1].hconcat[1].mark.type, 'bar')
  assert.deepEqual(state.currentSpec._marginal_bars_state, {
    enabled: true,
    op: 'mean',
    show_top: true,
    show_right: true,
    value_field: 'value',
    x_field: 'col',
    y_field: 'row',
  })
})

test('heatmap.adjustColorScale updates the heatmap color scale scheme and optional domain', async () => {
  const executor = new ActionExecutor()
  registerHeatmapActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { row: 'A', col: 'Q1', value: 10 },
          { row: 'B', col: 'Q2', value: 20 },
        ],
      },
      mark: 'rect',
      encoding: {
        x: { field: 'col', type: 'nominal' },
        y: { field: 'row', type: 'nominal' },
        color: { field: 'value', type: 'quantitative', scale: {} },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/heatmap_b'
  const result = await executor.run(
    {
      callId: 'heatmap_color_scale_001',
      name: 'heatmap.adjustColorScale',
      targetRef: widgetRef,
      params: {
        scheme: 'blues',
        domain: [0, 25],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'heatmap_b',
            kind: 'heatmap',
            title: 'Heatmap B',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'heatmap_b',
                kind: 'heatmap',
                title: 'Heatmap B',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'heatmap_b',
                kind: 'heatmap',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'heatmap.adjustColorScale')
  assert.equal(state.currentSpec.encoding.color.scale.scheme, 'blues')
  assert.deepEqual(state.currentSpec.encoding.color.scale.domain, [0, 25])
})

test('heatmap.thresholdMask writes an opacity threshold mask using the heatmap color field', async () => {
  const executor = new ActionExecutor()
  registerHeatmapActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { x: 'Q1', y: 'A', value: 10 },
          { x: 'Q1', y: 'B', value: 40 },
        ],
      },
      mark: 'rect',
      encoding: {
        x: { field: 'x', type: 'nominal' },
        y: { field: 'y', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/heatmap_threshold'
  const result = await executor.run(
    {
      callId: 'heatmap_threshold_001',
      name: 'heatmap.thresholdMask',
      targetRef: widgetRef,
      params: {
        minValue: 12,
        maxValue: 30,
        outsideOpacity: 0.05,
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'heatmap_threshold',
            kind: 'heatmap',
            title: 'Heatmap Threshold',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'heatmap_threshold',
                kind: 'heatmap',
                title: 'Heatmap Threshold',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'heatmap_threshold',
                kind: 'heatmap',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'heatmap.thresholdMask')
  assert.equal(state.currentSpec.encoding.opacity.condition.test, `datum['value'] >= 12 && datum['value'] <= 30`)
  assert.equal(state.currentSpec.encoding.opacity.condition.value, 1)
  assert.equal(state.currentSpec.encoding.opacity.value, 0.05)
})

test('heatmap.filterCellsByRegion writes a tagged transform that excludes the requested heatmap region', async () => {
  const executor = new ActionExecutor()
  registerHeatmapActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { x: 'Q1', y: 'A', value: 10 },
          { x: 'Q2', y: 'B', value: 40 },
        ],
      },
      mark: 'rect',
      encoding: {
        x: { field: 'x', type: 'nominal' },
        y: { field: 'y', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/heatmap_region_filter'
  const result = await executor.run(
    {
      callId: 'heatmap_region_filter_001',
      name: 'heatmap.filterCellsByRegion',
      targetRef: widgetRef,
      params: {
        xValues: ['Q1'],
        yValues: ['A'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'heatmap_region_filter',
            kind: 'heatmap',
            title: 'Heatmap Region Filter',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'heatmap_region_filter',
                kind: 'heatmap',
                title: 'Heatmap Region Filter',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'heatmap_region_filter',
                kind: 'heatmap',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'heatmap.filterCellsByRegion')
  assert.deepEqual(state.currentSpec.transform, [
    {
      filter: `!(indexof([\"Q1\"], datum['x']) >= 0 && indexof([\"A\"], datum['y']) >= 0)`,
      _widgetvaTag: 'heatmap.filterCellsByRegion',
    },
  ])
})

test('heatmap.highlightRegionByValue writes an opacity condition for a one-sided or two-sided value range', async () => {
  const executor = new ActionExecutor()
  registerHeatmapActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { x: 'Q1', y: 'A', value: 10 },
          { x: 'Q2', y: 'B', value: 40 },
        ],
      },
      mark: 'rect',
      encoding: {
        x: { field: 'x', type: 'nominal' },
        y: { field: 'y', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/heatmap_value_highlight'
  const result = await executor.run(
    {
      callId: 'heatmap_value_highlight_001',
      name: 'heatmap.highlightRegionByValue',
      targetRef: widgetRef,
      params: {
        minValue: 12,
        outsideOpacity: 0.08,
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'heatmap_value_highlight',
            kind: 'heatmap',
            title: 'Heatmap Value Highlight',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'heatmap_value_highlight',
                kind: 'heatmap',
                title: 'Heatmap Value Highlight',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'heatmap_value_highlight',
                kind: 'heatmap',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'heatmap.highlightRegionByValue')
  assert.equal(state.currentSpec.encoding.opacity.condition.test, `datum['value'] >= 12`)
  assert.equal(state.currentSpec.encoding.opacity.condition.value, 1)
  assert.equal(state.currentSpec.encoding.opacity.value, 0.08)
})

test('heatmap.clusterRowsCols writes aggregate-sort metadata for requested rows and columns', async () => {
  const executor = new ActionExecutor()
  registerHeatmapActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { x: 'A', y: 'r1', value: 10 },
          { x: 'B', y: 'r1', value: 30 },
          { x: 'A', y: 'r2', value: 20 },
          { x: 'B', y: 'r2', value: 40 },
        ],
      },
      mark: 'rect',
      encoding: {
        x: { field: 'x', type: 'nominal' },
        y: { field: 'y', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/heatmap_cluster_rows_cols'
  const result = await executor.run(
    {
      callId: 'heatmap_cluster_rows_cols_001',
      name: 'heatmap.clusterRowsCols',
      targetRef: widgetRef,
      params: {
        clusterRows: true,
        clusterCols: true,
        method: 'mean',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'heatmap_cluster_rows_cols',
            kind: 'heatmap',
            title: 'Heatmap Cluster Rows Cols',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'heatmap_cluster_rows_cols',
                kind: 'heatmap',
                title: 'Heatmap Cluster Rows Cols',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'heatmap_cluster_rows_cols',
                kind: 'heatmap',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'heatmap.clusterRowsCols')
  assert.deepEqual(state.currentSpec.encoding.y.sort, {
    op: 'mean',
    field: 'value',
    order: 'descending',
  })
  assert.deepEqual(state.currentSpec.encoding.x.sort, {
    op: 'mean',
    field: 'value',
    order: 'descending',
  })
  assert.equal(state.currentSpec._cluster_rows_cols_state.method, 'mean')
})

test('heatmap.transpose swaps x/y encodings, width/height, and toggles transpose state', async () => {
  const executor = new ActionExecutor()
  registerHeatmapActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { month: 'Jan', region: 'East', value: 10 },
        ],
      },
      mark: 'rect',
      width: 300,
      height: 180,
      encoding: {
        x: { field: 'month', type: 'ordinal' },
        y: { field: 'region', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/heatmap_transpose'
  const result = await executor.run(
    {
      callId: 'heatmap_transpose_001',
      name: 'heatmap.transpose',
      targetRef: widgetRef,
      params: {},
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'heatmap_transpose',
            kind: 'heatmap',
            title: 'Heatmap Transpose',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'heatmap_transpose',
                kind: 'heatmap',
                title: 'Heatmap Transpose',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'heatmap_transpose',
                kind: 'heatmap',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'heatmap.transpose')
  assert.deepEqual(state.currentSpec.encoding.x, { field: 'region', type: 'nominal' })
  assert.deepEqual(state.currentSpec.encoding.y, { field: 'month', type: 'ordinal' })
  assert.equal(state.currentSpec.width, 180)
  assert.equal(state.currentSpec.height, 300)
  assert.equal(state.currentSpec._transpose_state.transposed, true)
})

test('heatmap.highlightRegion writes an opacity highlight condition into the current heatmap spec', async () => {
  const executor = new ActionExecutor()
  registerHeatmapActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { row: 'A', col: 'Q1', value: 10 },
          { row: 'B', col: 'Q2', value: 20 },
        ],
      },
      mark: 'rect',
      encoding: {
        x: { field: 'col', type: 'nominal' },
        y: { field: 'row', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/heatmap_a'
  const result = await executor.run(
    {
      callId: 'heatmap_highlight_001',
      name: 'heatmap.highlightRegion',
      targetRef: widgetRef,
      params: {
        xValues: ['Q1'],
        yValues: ['A'],
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'heatmap_a',
            kind: 'heatmap',
            title: 'Heatmap A',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'heatmap_a',
                kind: 'heatmap',
                title: 'Heatmap A',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'heatmap_a',
                kind: 'heatmap',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'heatmap.highlightRegion')
  assert.equal(typeof state.currentSpec.encoding.opacity.condition.test, 'string')
  assert.match(state.currentSpec.encoding.opacity.condition.test, /datum\["col"\]/)
  assert.match(state.currentSpec.encoding.opacity.condition.test, /datum\["row"\]/)
  assert.equal(state.currentSpec.encoding.opacity.condition.value, 1)
  assert.equal(state.currentSpec.encoding.opacity.value, 0.15)
})

test('line.zoomXRegion updates the temporal x-domain on the current line spec', async () => {
  const executor = new ActionExecutor()
  registerLineActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { date: '2024-01-01', value: 10, series: 'A' },
          { date: '2024-02-01', value: 14, series: 'A' },
        ],
      },
      mark: 'line',
      encoding: {
        x: { field: 'date', type: 'temporal', scale: {} },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'series', type: 'nominal' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/line_a'
  const result = await executor.run(
    {
      callId: 'line_zoom_001',
      name: 'line.zoomXRegion',
      targetRef: widgetRef,
      params: {
        start: '2024-01-01',
        end: '2024-02-01',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'line_a',
            kind: 'line',
            title: 'Line A',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'line_a',
                kind: 'line',
                title: 'Line A',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'line_a',
                kind: 'line',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'line.zoomXRegion')
  assert.deepEqual(state.currentSpec.encoding.x.scale.domain, ['2024-01-01', '2024-02-01'])
  assert.equal(state.currentSpec.mark.clip, true)
})

test('scatter.showRegression adds a tagged regression overlay layer using the requested method', async () => {
  const executor = new ActionExecutor()
  registerScatterActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { horsepower: 90, mpg: 32 },
          { horsepower: 120, mpg: 27 },
          { horsepower: 150, mpg: 22 },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'horsepower', type: 'quantitative' },
        y: { field: 'mpg', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_regression'
  const result = await executor.run(
    {
      callId: 'scatter_regression_001',
      name: 'scatter.showRegression',
      targetRef: widgetRef,
      params: {
        method: 'quad',
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'scatter_regression',
            kind: 'scatter',
            title: 'Scatter Regression',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'scatter_regression',
                kind: 'scatter',
                title: 'Scatter Regression',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'scatter_regression',
                kind: 'scatter',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'scatter.showRegression')
  assert.equal(Array.isArray(state.currentSpec.layer), true)
  assert.equal(state.currentSpec.layer.length, 2)
  assert.equal(state.currentSpec.layer[1]._widgetvaTag, 'scatter.showRegression')
  assert.deepEqual(state.currentSpec.layer[1].transform, [{
    regression: 'mpg',
    on: 'horsepower',
    method: 'poly',
    order: 2,
  }])
  assert.deepEqual(state.currentSpec.layer[1].encoding, {
    x: { field: 'horsepower', type: 'quantitative' },
    y: { field: 'mpg', type: 'quantitative' },
  })
  assert.equal(state.currentSpec.layer[1].mark.color, 'red')
})

test('scatter.identifyClusters derives a cluster field and recolors the scatterplot by cluster labels', async () => {
  const executor = new ActionExecutor()
  registerScatterActions(executor)

  const state = {
    currentSpec: {
      data: {
        values: [
          { horsepower: 90, mpg: 31, name: 'a' },
          { horsepower: 95, mpg: 30, name: 'b' },
          { horsepower: 155, mpg: 20, name: 'c' },
          { horsepower: 160, mpg: 19, name: 'd' },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'horsepower', type: 'quantitative' },
        y: { field: 'mpg', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_clusters'
  const result = await executor.run(
    {
      callId: 'scatter_clusters_001',
      name: 'scatter.identifyClusters',
      targetRef: widgetRef,
      params: {
        nClusters: 2,
      },
    },
    {
      getAppState: () => state,
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: widgetRef,
            widgetId: 'scatter_clusters',
            kind: 'scatter',
            title: 'Scatter Clusters',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef
            ? {
                ref,
                widgetId: 'scatter_clusters',
                kind: 'scatter',
                title: 'Scatter Clusters',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'scatter_clusters',
                kind: 'scatter',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'scatter.identifyClusters')
  assert.equal(result.result.clusterField, 'cluster_2')
  assert.equal(result.result.clusterStatistics.length, 2)
  assert.equal(state.currentSpec.encoding.color.field, 'cluster_2')
  assert.equal(state.currentSpec.encoding.color.type, 'nominal')
  assert.equal(state.currentSpec.data.values.every((row) => Number.isInteger(row.cluster_2)), true)
  assert.equal(state.currentSpec._scatter_cluster_state.n_clusters, 2)
})

test('scatter.identifyClusters materializes clustered rows from runtime data when the active scatter spec is URL-backed', async () => {
  const executor = new ActionExecutor()
  registerScatterActions(executor)

  const runtimeRows = [
    { horsepower: 90, mpg: 31, name: 'a' },
    { horsepower: 95, mpg: 30, name: 'b' },
    { horsepower: 155, mpg: 20, name: 'c' },
    { horsepower: 160, mpg: 19, name: 'd' },
  ]
  const state = {
    currentSpec: {
      data: {
        url: 'https://example.com/scatter.json',
      },
      mark: 'point',
      encoding: {
        x: { field: 'horsepower', type: 'quantitative' },
        y: { field: 'mpg', type: 'quantitative' },
      },
    },
    setCurrentSpec(nextSpec) {
      this.currentSpec = nextSpec
    },
  }

  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_clusters_url'
  const store = createSingleWidgetStore({
    widgetRef,
    widgetId: 'scatter_clusters_url',
    kind: 'scatter',
    title: 'Scatter Clusters URL',
    currentDataRef: 'data://scatter/clusters-url',
    runtimeRows,
  })
  const result = await executor.run(
    {
      callId: 'scatter_clusters_url_001',
      name: 'scatter.identifyClusters',
      targetRef: widgetRef,
      params: {
        nClusters: 2,
      },
    },
    {
      getAppState: () => state,
      store,
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'scatter.identifyClusters')
  assert.equal(Array.isArray(state.currentSpec.data.values), true)
  assert.equal(state.currentSpec.data.values.length, 4)
  assert.equal(state.currentSpec.data.values.every((row) => Number.isInteger(row.cluster_2)), true)
  assert.equal(state.currentSpec.encoding.color.field, 'cluster_2')
})

test('ActionExecutor supports documented params-first action handlers for manual runtime assembly', async () => {
  const executor = new ActionExecutor()
  let receivedParams = null
  let receivedTargetWidgetRef = null

  executor.register(
    {
      name: 'scatter.brushRegion',
      paramsSchema: {
        type: 'object',
        properties: {
          xField: { type: 'string' },
          yField: { type: 'string' },
        },
        required: ['xField', 'yField'],
      },
    },
    async (params, ctx) => {
      receivedParams = params
      receivedTargetWidgetRef = ctx.requireTargetWidget({ kind: 'scatter' })?.ref || null
      return {
        nextState: {
          stateId: 'main:s2',
          widgets: {
            'wl://demo/workspace/main/widget/scatter_a': {
              ref: 'wl://demo/workspace/main/widget/scatter_a',
              kind: 'scatter',
              selections: {},
              view: {},
            },
          },
          shared: {
            activeSelections: {},
            globalFilters: {},
            focusedWidget: 'wl://demo/workspace/main/widget/scatter_a',
          },
        },
        updatedRefs: ['wl://demo/workspace/main/widget/scatter_a'],
        result: {
          ok: true,
        },
      }
    },
  )

  const result = await executor.run(
    {
      callId: 'doc_style_scatter_brush',
      name: 'scatter.brushRegion',
      queryScope: {
        widgetRef: 'wl://demo/workspace/main/widget/scatter_a',
      },
      params: {
        xField: 'Horsepower',
        yField: 'MPG',
      },
    },
    {
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{
            ref: 'wl://demo/workspace/main/widget/scatter_a',
            widgetId: 'scatter_a',
            kind: 'scatter',
            title: 'Scatter A',
          }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === 'wl://demo/workspace/main/widget/scatter_a'
            ? {
                ref,
                widgetId: 'scatter_a',
                kind: 'scatter',
                title: 'Scatter A',
              }
            : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetDescription(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {
              'wl://demo/workspace/main/widget/scatter_a': {
                ref: 'wl://demo/workspace/main/widget/scatter_a',
                widgetId: 'scatter_a',
                kind: 'scatter',
                selections: {},
                view: {},
              },
            },
            shared: {
              activeSelections: {},
              globalFilters: {},
              focusedWidget: 'wl://demo/workspace/main/widget/scatter_a',
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(receivedTargetWidgetRef, 'wl://demo/workspace/main/widget/scatter_a')
  assert.equal(receivedParams?.xField, 'Horsepower')
  assert.equal(receivedParams?.yField, 'MPG')
  assert.deepEqual(receivedParams?.params, {
    xField: 'Horsepower',
    yField: 'MPG',
    queryScope: {
      widgetRef: 'wl://demo/workspace/main/widget/scatter_a',
      dataRef: null,
      selectionRef: null,
      focusRef: null,
      viewportRef: null,
    },
  })
  assert.equal(receivedParams?.name, 'scatter.brushRegion')
  assert.equal(receivedParams?.targetRef, 'wl://demo/workspace/main/widget/scatter_a')
  assert.deepEqual(receivedParams?.queryScope, {
    widgetRef: 'wl://demo/workspace/main/widget/scatter_a',
    dataRef: null,
    selectionRef: null,
    focusRef: null,
    viewportRef: null,
  })
})

test('ActionExecutor records verification hints and a concise verification note into the action trace record', async () => {
  let actionRecord = null
  const executor = new ActionExecutor({
    store: {
      listActions() {
        return []
      },
    },
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
    traceRecorder: {
      recordAction(entry) {
        actionRecord = entry
      },
    },
  })

  executor.register(
    {
      name: 'workspace.testTraceHints',
      primitive: 'annotate',
      postconditions: [
        {
          description: 'The updated scatter selection should be visible in widget state.',
        },
      ],
      paramsSchema: {
        type: 'object',
      },
    },
    async () => ({
      nextState: {
        stateId: 'main:s2',
        widgets: {},
        shared: {},
      },
      updatedRefs: ['wl://demo/workspace/main/widget/scatter_a'],
      verificationHints: ['Read the updated scatter selection state.'],
      notes: {
        userVisibleSummary: 'Scatter brush updated.',
      },
    }),
  )

  const result = await executor.run(
    {
      callId: 'call_trace_hints',
      name: 'workspace.testTraceHints',
      actor: 'agent',
      params: {},
    },
    {
      store: {
        listActions() {
          return []
        },
        readState() {
          return {
            stateId: 'main:s1',
            widgets: {},
            shared: {},
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
    },
  )

  assert.equal(result.ok, true)
  assert.deepEqual(result.verificationHints, [
    'Check wl://demo/workspace/main/widget/scatter_a and confirm: The updated scatter selection should be visible in widget state.',
    'Read the updated scatter selection state.',
  ])
  assert.deepEqual(actionRecord?.notes?.verificationHints, [
    'Check wl://demo/workspace/main/widget/scatter_a and confirm: The updated scatter selection should be visible in widget state.',
    'Read the updated scatter selection state.',
  ])
  assert.equal(
    actionRecord?.notes?.verification,
    'Expected postcondition: The updated scatter selection should be visible in widget state.',
  )
  assert.equal(actionRecord?.notes?.userVisibleSummary, 'Scatter brush updated.')
})

test('ActionExecutor supports workspace.jumpToState for plain RuntimeStore facades without beginTransition', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  let transitionRecord = null
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    descriptions: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        title: 'Scatter A',
      },
    },
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        version: 1,
        data: {
          selectedCount: 0,
        },
        selections: {},
      },
    },
    stateId: 'main:s1',
    version: 1,
    shared: {
      activeSelections: {},
      globalFilters: {},
      focusedWidget: null,
    },
    readSnapshotEntry(stateId) {
      if (stateId !== 'main:s0') return null
      return {
        state: {
          widgets: {
            [widgetRef]: {
              ref: widgetRef,
              widgetId: 'scatter_a',
              kind: 'scatter',
              version: 5,
              data: {
                selectedCount: 3,
              },
              selections: {
                [`${widgetRef}/selection/brush`]: {
                  kind: 'interval',
                },
              },
            },
          },
          shared: {
            activeSelections: {
              [`${widgetRef}/selection/brush`]: {
                kind: 'interval',
              },
            },
            globalFilters: {
              region: 'west',
            },
            focusedWidget: widgetRef,
          },
        },
      }
    },
    listActions() {
      return []
    },
  }

  const executor = new ActionExecutor({
    store,
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
    traceRecorder: {
      recordAction() {},
      recordSystemTransition(entry) {
        transitionRecord = entry
      },
    },
  })

  const result = await executor.run({
    callId: 'call_jump_plain_store',
    name: 'workspace.jumpToState',
    actor: 'agent',
    params: {
      stateId: 'main:s0',
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'workspace.jumpToState')
  assert.equal(result.result?.restoredStateId, 'main:s0')
  assert.equal(store.shared.focusedWidget, widgetRef)
  assert.equal(store.shared.globalFilters?.region, 'west')
  assert.equal(store.widgets[widgetRef]?.data?.selectedCount, 3)
  assert.equal(transitionRecord?.transitionType, 'jump_back')
  assert.equal(transitionRecord?.stateId, result.stateId)
  assert.equal(transitionRecord?.notes?.userVisibleSummary, 'Jumped workspace state back to main:s0.')
})

test('ActionExecutor supports workspace.branchFromState for plain RuntimeStore facades without beginBranchFromState', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  let transitionRecord = null
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    descriptions: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        title: 'Scatter A',
      },
    },
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        version: 1,
        data: {
          selectedCount: 0,
        },
        selections: {},
      },
    },
    stateId: 'main:s1',
    version: 1,
    shared: {
      activeSelections: {},
      globalFilters: {},
      focusedWidget: null,
    },
    readSnapshotEntry(stateId) {
      if (stateId !== 'main:s0') return null
      return {
        state: {
          widgets: {
            [widgetRef]: {
              ref: widgetRef,
              widgetId: 'scatter_a',
              kind: 'scatter',
              version: 5,
              data: {
                selectedCount: 4,
              },
            },
          },
          shared: {
            activeSelections: {},
            globalFilters: {
              region: 'east',
            },
            focusedWidget: widgetRef,
          },
        },
        branchId: 'main',
      }
    },
    listActions() {
      return []
    },
  }

  const executor = new ActionExecutor({
    store,
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
    traceRecorder: {
      recordAction() {},
      recordSystemTransition(entry) {
        transitionRecord = entry
      },
    },
  })

  const result = await executor.run({
    callId: 'call_branch_plain_store',
    name: 'workspace.branchFromState',
    actor: 'agent',
    params: {
      stateId: 'main:s0',
      branchLabel: 'What-if branch',
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'workspace.branchFromState')
  assert.equal(result.result?.restoredStateId, 'main:s0')
  assert.equal(result.result?.branchLabel, 'What-if branch')
  assert.equal(typeof result.result?.branchId, 'string')
  assert.equal(store.shared.focusedWidget, widgetRef)
  assert.equal(store.shared.globalFilters?.region, 'east')
  assert.equal(store.widgets[widgetRef]?.data?.selectedCount, 4)
  assert.equal(transitionRecord?.transitionType, 'branch')
  assert.equal(transitionRecord?.stateId, result.stateId)
  assert.equal(
    transitionRecord?.notes?.userVisibleSummary,
    'Created branch What-if branch from main:s0.',
  )
})

test('ActionExecutor supports widget.undoSelection and widget.redoSelection for plain RuntimeStore facades', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const transitionRecords = []
  const store = {
    appId: 'demo',
    workspaceId: 'main',
    descriptions: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        title: 'Scatter A',
      },
    },
    widgets: {
      [widgetRef]: {
        ref: widgetRef,
        widgetId: 'scatter_a',
        kind: 'scatter',
        version: 1,
        data: {
          selectedCount: 0,
        },
        selections: {},
      },
    },
    stateId: 'main:s1',
    version: 1,
    shared: {
      activeSelections: {},
      globalFilters: {},
      focusedWidget: widgetRef,
    },
    listActions() {
      return []
    },
  }

  const selectionContext = new ActionContext({
    store,
    descriptor: { name: 'scatter.brushRegion' },
    call: {
      callId: 'call_seed_selection',
      name: 'scatter.brushRegion',
      targetRef: widgetRef,
      params: {},
    },
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
  })

  selectionContext.commitSelection({
    selection_id: 'brush',
    source_widget_id: 'scatter_a',
    selection_type: 'interval',
    fields: ['Horsepower'],
    value: {
      Horsepower: [60, 120],
    },
    count: 2,
    summary: 'Horsepower 60~120',
  })

  const selectionRef = `${widgetRef}/selection/brush`
  assert.equal(store.widgets[widgetRef]?.data?.selectedCount, 2)
  assert.equal(store.shared.selections?.registry?.[selectionRef]?.kind, 'interval')

  const executor = new ActionExecutor({
    store,
    sync() {},
    getAppState() {
      return {}
    },
    linkEngine: null,
    traceRecorder: {
      recordAction() {},
      recordSystemTransition(entry) {
        transitionRecords.push(entry)
      },
    },
  })

  const undoResult = await executor.run({
    callId: 'call_undo_plain_store',
    name: 'widget.undoSelection',
    actor: 'agent',
    targetRef: widgetRef,
    params: {},
  })

  assert.equal(undoResult.ok, true)
  assert.deepEqual(store.widgets[widgetRef]?.selections, {})
  assert.deepEqual(store.shared.activeSelections, {})
  assert.equal(store.widgets[widgetRef]?.data?.selectedCount, 0)
  assert.equal(transitionRecords[0]?.transitionType, 'undo')
  assert.equal(
    transitionRecords[0]?.notes?.userVisibleSummary,
    'Selection history was rolled back to the prior state.',
  )

  const redoResult = await executor.run({
    callId: 'call_redo_plain_store',
    name: 'widget.redoSelection',
    actor: 'agent',
    targetRef: widgetRef,
    params: {},
  })

  assert.equal(redoResult.ok, true)
  assert.equal(store.shared.activeSelections?.[selectionRef]?.kind, 'interval')
  assert.equal(store.widgets[widgetRef]?.data?.selectedCount, 2)
  assert.equal(transitionRecords[1]?.transitionType, 'redo')
  assert.equal(
    transitionRecords[1]?.notes?.userVisibleSummary,
    'Selection history was replayed to the next state.',
  )
})
