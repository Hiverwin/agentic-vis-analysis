import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BarWidgetAdapter,
  HeatmapWidgetAdapter,
  LineWidgetAdapter,
  ScatterWidgetAdapter,
  TableWidgetAdapter,
} from './runtimeWidgetAdapters.js'
import { ActionExecutor } from '../../core/runtime/ActionExecutor.js'
import { PerceptionQueryRegistry } from '../../core/runtime/PerceptionQueryRegistry.js'

test('ScatterWidgetAdapter exposes the documented widget-adapter surface', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_a'
  const dataRef = 'wl://demo/workspace/main/data/cars'
  const adapter = new ScatterWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
        view: {
          xDomain: [0, 10],
          yDomain: [0, 20],
        },
      }
    },
  }, dataRef)

  const description = adapter.getDescription()
  const state = adapter.getState()
  const actionDescriptors = adapter.buildActionDescriptors({
    widgetRef,
    selectionRef: `${widgetRef}/selection/brush`,
  })
  const perceptionDescriptors = adapter.buildPerceptionDescriptors({ dataRef })

  assert.equal(adapter.widgetRef, widgetRef)
  assert.equal(description.ref, widgetRef)
  assert.equal(description.kind, 'scatter')
  assert.equal(description.primaryDataRef, dataRef)
  assert.equal(description.actionNames.includes('scatter.brushRegion'), true)
  assert.equal(description.actionNames.includes('scatter.zoomDomain'), true)
  assert.equal(description.perceptionQueryNames.includes('perception.computeCorrelation'), true)
  assert.equal(description.perceptionQueryNames.includes('perception.findOutliers'), true)
  assert.equal(description.perceptionQueryNames.includes('perception.findExtremes'), true)
  assert.deepEqual(
    actionDescriptors.map((descriptor) => descriptor.name),
    ['scatter.brushRegion', 'scatter.zoomDomain', 'scatter.identifyClusters', 'scatter.showRegression'],
  )
  assert.deepEqual(
    perceptionDescriptors.map((descriptor) => descriptor.name),
    ['perception.computeCorrelation', 'perception.findOutliers', 'perception.findExtremes'],
  )
  assert.equal(state.ref, widgetRef)
  assert.equal(state.widgetId, 'scatter_a')
  assert.equal(state.kind, 'scatter')
  assert.equal(state.data.sourceDataRef, dataRef)
  assert.equal(state.humanInteraction?.mode, 'brush2d')
  assert.equal(typeof adapter.registerActions, 'function')
  assert.equal(typeof adapter.registerPerceptionQueries, 'function')
  assert.equal(typeof adapter.buildActionDescriptors, 'function')
  assert.equal(typeof adapter.buildPerceptionDescriptors, 'function')
  assert.equal(typeof adapter.bindHumanInteractions, 'function')
  assert.equal(typeof adapter.applyState, 'function')
})

test('ScatterWidgetAdapter.applyState accepts a direct WidgetState for documented imperative chart callers', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_apply'
  const dataRef = 'wl://demo/workspace/main/data/cars'
  let appliedSelection = null
  let appliedDomain = null
  const adapter = new ScatterWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
        view: {},
      }
    },
    setBrush(selection) {
      appliedSelection = selection
    },
    setDomain(xDomain, yDomain) {
      appliedDomain = { xDomain, yDomain }
    },
  }, dataRef)

  await adapter.applyState({
    ref: widgetRef,
    widgetId: 'scatter_apply',
    kind: 'scatter',
    selections: {
      [`${widgetRef}/selection/brush`]: {
        kind: 'interval',
        domain: {
          xDomain: [10, 20],
          yDomain: [30, 40],
        },
      },
    },
    view: {
      xDomain: [10, 20],
      yDomain: [30, 40],
    },
  })

  assert.deepEqual(appliedSelection, {
    kind: 'interval',
    domain: {
      xDomain: [10, 20],
      yDomain: [30, 40],
    },
  })
  assert.deepEqual(appliedDomain, {
    xDomain: [10, 20],
    yDomain: [30, 40],
  })
})

test('LineWidgetAdapter.applyState projects generic focus, highlight, sort, annotate, drill-down, and navigate state into the chart wrapper', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/line_apply'
  const dataRef = 'wl://demo/workspace/main/data/series'
  let selectedSelection = null
  let highlightedKeys = null
  let highlightState = null
  let focusedState = null
  let sortState = null
  let annotateState = null
  let drillDownState = null
  let navigateState = null
  let viewportState = null
  const adapter = new LineWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
        view: {},
      }
    },
    setSelection(selection) {
      selectedSelection = selection
    },
    setHighlights(keys) {
      highlightedKeys = keys
    },
    setHighlightState(highlight) {
      highlightState = highlight
    },
    setFocus(focus) {
      focusedState = focus
    },
    setSort(sort) {
      sortState = sort
    },
    setAnnotateState(annotate) {
      annotateState = annotate
    },
    setDrillDownState(drillDown) {
      drillDownState = drillDown
    },
    setNavigateState(navigate) {
      navigateState = navigate
    },
    setViewport(viewport) {
      viewportState = viewport
    },
  }, dataRef)

  await adapter.applyState({
    ref: widgetRef,
    widgetId: 'line_apply',
    kind: 'line',
    selections: {
      [`${widgetRef}/selection/focus`]: {
        kind: 'point',
        field: 'series',
        values: ['Revenue'],
        summary: 'Series: Revenue',
      },
    },
    view: {
      xDomain: [10, 20],
      highlight: {
        channels: ['strokeWidth'],
        entries: [{ source: 'encoding', channel: 'strokeWidth', scope: 'root' }],
      },
      focusedSeries: ['Revenue'],
      sort: {
        channel: 'x',
        field: 'date',
        mode: 'direction',
        order: 'ascending',
      },
      annotate: {
        mode: 'movingAverageOverlay',
        sourceAction: 'line.showMovingAverage',
      },
      drillDown: {
        axis: 'x',
        active: true,
        level: 'month',
        parent: { year: 2024 },
        targetField: 'date',
      },
      navigate: {
        mode: 'resetDrilldown',
        sourceAction: 'line.resetDrilldownXAxis',
      },
    },
    feedback: {
      highlightedKeys: ['series:Revenue'],
    },
  })

  assert.deepEqual(selectedSelection, {
    kind: 'point',
    field: 'series',
    values: ['Revenue'],
    summary: 'Series: Revenue',
  })
  assert.deepEqual(highlightedKeys, ['series:Revenue'])
  assert.deepEqual(highlightState, {
    channels: ['strokeWidth'],
    entries: [{ source: 'encoding', channel: 'strokeWidth', scope: 'root' }],
  })
  assert.deepEqual(focusedState, {
    focusedSeries: ['Revenue'],
  })
  assert.deepEqual(sortState, {
    channel: 'x',
    field: 'date',
    mode: 'direction',
    order: 'ascending',
  })
  assert.deepEqual(annotateState, {
    mode: 'movingAverageOverlay',
    sourceAction: 'line.showMovingAverage',
  })
  assert.deepEqual(drillDownState, {
    axis: 'x',
    active: true,
    level: 'month',
    parent: { year: 2024 },
    targetField: 'date',
  })
  assert.deepEqual(navigateState, {
    mode: 'resetDrilldown',
    sourceAction: 'line.resetDrilldownXAxis',
  })
  assert.deepEqual(viewportState, {
    xDomain: [10, 20],
  })
})

test('ScatterWidgetAdapter.bindHumanInteractions bridges chart.onBrush into a documented direct action call path', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_bind'
  let registeredBrushHandler = null
  let cleanedUp = false
  let receivedActionCall = null
  const adapter = new ScatterWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
        view: {},
      }
    },
    onBrush(handler) {
      registeredBrushHandler = handler
      return () => {
        cleanedUp = true
      }
    },
  }, 'wl://demo/workspace/main/data/cars')

  const cleanup = adapter.bindHumanInteractions({
    selectionSourceWidgetId: 'scatter_bind',
    actionTargetRef: widgetRef,
    onActionCall(call) {
      receivedActionCall = call
    },
  })

  assert.equal(typeof registeredBrushHandler, 'function')

  registeredBrushHandler({
    kind: 'interval',
    fields: ['Horsepower', 'Miles_per_Gallon'],
    value: {
      Horsepower: [80, 150],
      Miles_per_Gallon: [20, 35],
    },
  })

  assert.equal(receivedActionCall?.name, 'scatter.brushRegion')
  assert.equal(receivedActionCall?.actor, 'human')
  assert.equal(receivedActionCall?.targetRef, widgetRef)
  assert.deepEqual(receivedActionCall?.params, {
    targetRef: widgetRef,
    xField: 'Horsepower',
    yField: 'Miles_per_Gallon',
    xRange: [80, 150],
    yRange: [20, 35],
  })

  cleanup()
  assert.equal(cleanedUp, true)
})

test('ScatterWidgetAdapter.registerActions drives the underlying chart brush before committing runtime selection state', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_exec'
  const dataRef = 'wl://demo/workspace/main/data/cars'
  let brushedSelection = null
  const adapter = new ScatterWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
        view: {},
      }
    },
    setBrush(selection) {
      brushedSelection = selection
    },
  }, dataRef)
  const executor = new ActionExecutor()

  adapter.registerActions(executor)

  const result = await executor.run(
    {
      callId: 'scatter_exec_1',
      name: 'scatter.brushRegion',
      queryScope: {
        widgetRef,
      },
      params: {
        xField: 'Horsepower',
        yField: 'MPG',
        xRange: [60, 120],
        yRange: [20, 40],
      },
    },
    {
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{ ref: widgetRef, widgetId: 'scatter_exec', kind: 'scatter', title: 'Scatter Exec' }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef ? { ref: widgetRef, widgetId: 'scatter_exec', kind: 'scatter', title: 'Scatter Exec' } : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        readRuntimeData(ref) {
          return ref === dataRef
            ? {
                rows: [
                  { Horsepower: 70, MPG: 18 },
                  { Horsepower: 90, MPG: 24 },
                  { Horsepower: 110, MPG: 31 },
                ],
              }
            : null
        },
        readState() {
          return {
            stateId: 'main:s2',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'scatter_exec',
                kind: 'scatter',
                data: {
                  sourceDataRef: dataRef,
                  currentDataRef: dataRef,
                },
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
      patchWidget() {
        return {
          stateId: 'main:s2',
          widgets: {
            [widgetRef]: {
              ref: widgetRef,
              widgetId: 'scatter_exec',
              kind: 'scatter',
              data: {
                sourceDataRef: dataRef,
                currentDataRef: dataRef,
              },
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
      readStatePatch(refs) {
        return { refs }
      },
      readCurrentState() {
        return {
          stateId: 'main:s2',
          widgets: {
            [widgetRef]: {
              ref: widgetRef,
              widgetId: 'scatter_exec',
              kind: 'scatter',
              data: {
                sourceDataRef: dataRef,
                currentDataRef: dataRef,
              },
              selections: {
                [`${widgetRef}/selection/brush`]: {
                  kind: 'interval',
                  value: {
                    Horsepower: [60, 120],
                    MPG: [20, 40],
                  },
                },
              },
              view: {},
            },
          },
          shared: {
            activeSelections: {
              [`${widgetRef}/selection/brush`]: {
                kind: 'interval',
                value: {
                  Horsepower: [60, 120],
                  MPG: [20, 40],
                },
              },
            },
            globalFilters: {},
            focusedWidget: widgetRef,
          },
        }
      },
      commitSelection() {
        return this.readCurrentState()
      },
      propagate() {
        return []
      },
      getAppState() {
        return {}
      },
    },
  )

  assert.equal(result.ok, true)
  assert.deepEqual(brushedSelection?.domain, {
    xDomain: [60, 120],
    yDomain: [20, 40],
  })
})

test('ScatterWidgetAdapter drives the underlying chart encoding hook through generic widget.changeEncoding', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_encoding'
  const dataRef = 'wl://demo/workspace/main/data/cars'
  const chartCalls = []
  const adapter = new ScatterWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
        view: {},
      }
    },
    changeEncoding(channel, field, options) {
      chartCalls.push({ channel, field, options })
    },
  }, dataRef)
  const executor = new ActionExecutor()

  const result = await executor.run(
    {
      callId: 'scatter_encoding_1',
      name: 'widget.changeEncoding',
      targetRef: widgetRef,
      params: {
        channel: 'color',
        field: 'Origin',
        type: 'nominal',
      },
    },
    {
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{ ref: widgetRef, widgetId: 'scatter_encoding', kind: 'scatter', title: 'Scatter Encoding' }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef ? { ref: widgetRef, widgetId: 'scatter_encoding', kind: 'scatter', title: 'Scatter Encoding' } : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetAdapter(ref) {
          return ref === widgetRef ? adapter : null
        },
        readState() {
          return {
            stateId: 'main:s2',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'scatter_encoding',
                kind: 'scatter',
                data: {
                  sourceDataRef: dataRef,
                  currentDataRef: dataRef,
                },
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
      getAppState() {
        return {
          currentSpec: {
            mark: 'point',
            encoding: {
              x: { field: 'Horsepower', type: 'quantitative' },
              y: { field: 'Miles_per_Gallon', type: 'quantitative' },
              color: { field: 'Cylinders', type: 'ordinal' },
            },
          },
          setCurrentSpec(nextSpec) {
            this.currentSpec = nextSpec
          },
        }
      },
      sync() {},
      linkEngine: null,
    },
  )

  assert.deepEqual(chartCalls, [{
    channel: 'color',
    field: 'Origin',
    options: {
      channel: 'color',
      field: 'Origin',
      type: 'nominal',
    },
  }])
  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'widget.changeEncoding')
})

test('ScatterWidgetAdapter drives the underlying chart clear-selection hook through generic widget.clearSelection', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_clear'
  const dataRef = 'wl://demo/workspace/main/data/cars'
  const brushCalls = []
  const adapter = new ScatterWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
        view: {},
      }
    },
    setBrush(selection) {
      brushCalls.push(selection)
    },
  }, dataRef)
  const executor = new ActionExecutor()

  const result = await executor.run(
    {
      callId: 'scatter_clear_1',
      name: 'widget.clearSelection',
      targetRef: widgetRef,
      params: {},
    },
    {
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{ ref: widgetRef, widgetId: 'scatter_clear', kind: 'scatter', title: 'Scatter Clear' }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef ? { ref: widgetRef, widgetId: 'scatter_clear', kind: 'scatter', title: 'Scatter Clear' } : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetAdapter(ref) {
          return ref === widgetRef ? adapter : null
        },
        readState() {
          return {
            stateId: 'main:s3',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'scatter_clear',
                kind: 'scatter',
                data: {
                  sourceDataRef: dataRef,
                  currentDataRef: dataRef,
                },
                selections: {
                  [`${widgetRef}/selection/brush`]: {
                    kind: 'interval',
                    value: {
                      Horsepower: [60, 120],
                      MPG: [20, 40],
                    },
                  },
                },
                view: {},
              },
            },
            shared: {
              activeSelections: {
                [`${widgetRef}/selection/brush`]: {
                  kind: 'interval',
                  value: {
                    Horsepower: [60, 120],
                    MPG: [20, 40],
                  },
                },
              },
              globalFilters: {},
              focusedWidget: widgetRef,
            },
          }
        },
        buildStatePatch(refs) {
          return { refs }
        },
      },
      clearSelection() {
        return {
          stateId: 'main:s4',
          widgets: {
            [widgetRef]: {
              ref: widgetRef,
              widgetId: 'scatter_clear',
              kind: 'scatter',
              data: {
                sourceDataRef: dataRef,
                currentDataRef: dataRef,
              },
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
      getAppState() {
        return {}
      },
      sync() {},
      linkEngine: null,
    },
  )

  assert.deepEqual(brushCalls, [null])
  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'widget.clearSelection')
})

test('ScatterWidgetAdapter drives the underlying chart domain hook through generic widget.zoomDomain', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_zoom_generic'
  const dataRef = 'wl://demo/workspace/main/data/cars'
  const domainCalls = []
  const adapter = new ScatterWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
        view: {},
      }
    },
    setDomain(xDomain, yDomain, options) {
      domainCalls.push({ xDomain, yDomain, options })
    },
  }, dataRef)
  const executor = new ActionExecutor()

  const result = await executor.run(
    {
      callId: 'scatter_zoom_generic_1',
      name: 'widget.zoomDomain',
      targetRef: widgetRef,
      params: {
        xDomain: [80, 160],
        yDomain: [20, 35],
      },
    },
    {
      store: {
        listActions() {
          return []
        },
        listWidgetDescriptions() {
          return [{ ref: widgetRef, widgetId: 'scatter_zoom_generic', kind: 'scatter', title: 'Scatter Zoom Generic' }]
        },
        getResolvedWidgetForTarget(ref) {
          return ref === widgetRef ? { ref: widgetRef, widgetId: 'scatter_zoom_generic', kind: 'scatter', title: 'Scatter Zoom Generic' } : null
        },
        getResolvedWidget(ref) {
          return this.getResolvedWidgetForTarget(ref)
        },
        getWidgetAdapter(ref) {
          return ref === widgetRef ? adapter : null
        },
        readState() {
          return {
            stateId: 'main:s5',
            widgets: {
              [widgetRef]: {
                ref: widgetRef,
                widgetId: 'scatter_zoom_generic',
                kind: 'scatter',
                data: {
                  sourceDataRef: dataRef,
                  currentDataRef: dataRef,
                },
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
      getAppState() {
        return {
          currentSpec: {
            mark: 'point',
            encoding: {
              x: { field: 'Horsepower', type: 'quantitative', scale: {} },
              y: { field: 'Miles_per_Gallon', type: 'quantitative', scale: {} },
            },
          },
          setCurrentSpec(nextSpec) {
            this.currentSpec = nextSpec
          },
        }
      },
      sync() {},
      linkEngine: null,
    },
  )

  assert.deepEqual(domainCalls, [{
    xDomain: [80, 160],
    yDomain: [20, 35],
    options: {
      xDomain: [80, 160],
      yDomain: [20, 35],
    },
  }])
  assert.equal(result.ok, true)
  assert.equal(result.actionName, 'widget.zoomDomain')
})

test('BarWidgetAdapter exposes the documented widget-adapter surface', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/bar_b'
  const dataRef = 'wl://demo/workspace/main/data/cars_grouped'
  const adapter = new BarWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
      }
    },
  }, dataRef)

  const description = adapter.getDescription()
  const state = adapter.getState()

  assert.equal(adapter.widgetRef, widgetRef)
  assert.equal(description.ref, widgetRef)
  assert.equal(description.kind, 'bar')
  assert.equal(description.primaryDataRef, dataRef)
  assert.equal(description.actionNames.includes('bar.selectCategory'), true)
  assert.equal(description.actionNames.includes('bar.sortBars'), true)
  assert.equal(description.perceptionQueryNames.includes('perception.compareGroups'), true)
  assert.equal(description.perceptionQueryNames.includes('perception.findExtremes'), true)
  assert.equal(description.perceptionQueryNames.includes('perception.summarizeSelection'), true)
  assert.equal(state.ref, widgetRef)
  assert.equal(state.widgetId, 'bar_b')
  assert.equal(state.kind, 'bar')
  assert.equal(state.data.sourceDataRef, dataRef)
  assert.equal(state.humanInteraction?.mode, 'categoryClick')
})

test('ScatterWidgetAdapter.registerPerceptionQueries exposes family-specific compute queries through the runtime registry', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/scatter_query'
  const dataRef = 'wl://demo/workspace/main/data/cars'
  const adapter = new ScatterWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
        view: {},
      }
    },
  }, dataRef)
  const registry = new PerceptionQueryRegistry({
    store: {
      listPerceptionQueries() {
        return []
      },
      getPerceptionDescriptor() {
        return null
      },
      listWidgetDescriptions() {
        return [{
          ref: widgetRef,
          widgetId: 'scatter_query',
          kind: 'scatter',
          title: 'Scatter Query',
          primaryDataRef: dataRef,
          data: {
            currentDataRef: dataRef,
            sourceDataRef: dataRef,
          },
        }]
      },
      getResolvedWidgetForTarget(ref) {
        return ref === widgetRef
          ? {
              ref: widgetRef,
              widgetId: 'scatter_query',
              kind: 'scatter',
              title: 'Scatter Query',
              primaryDataRef: dataRef,
              data: {
                currentDataRef: dataRef,
                sourceDataRef: dataRef,
              },
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
          stateId: 'main:s6',
          widgets: {
            [widgetRef]: {
              ref: widgetRef,
              widgetId: 'scatter_query',
              kind: 'scatter',
              data: {
                sourceDataRef: dataRef,
                currentDataRef: dataRef,
              },
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
      readRuntimeData(ref) {
        return ref === dataRef
          ? {
              rows: [
                { Horsepower: 70, MPG: 18 },
                { Horsepower: 90, MPG: 24 },
                { Horsepower: 110, MPG: 31 },
              ],
            }
          : null
      },
    },
    dataQueryEngine: {
      kind: 'manual',
      computeCorrelation(rows, { xField, yField }) {
        return {
          coefficient: 0.82,
          sampleSize: rows.length,
          fields: [xField, yField],
        }
      },
    },
  })

  adapter.registerPerceptionQueries(registry)

  const result = await registry.query({
    callId: 'scatter_query_1',
    name: 'perception.computeCorrelation',
    targetRef: widgetRef,
    params: {
      xField: 'Horsepower',
      yField: 'MPG',
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.queryName, 'perception.computeCorrelation')
  assert.equal(result.result?.dataRef, dataRef)
  assert.equal(result.result?.correlation, 0.82)
  assert.equal(result.result?.sampleSize, 3)
  assert.equal(result.result?.xField, 'Horsepower')
  assert.equal(result.result?.yField, 'MPG')
})

test('BarWidgetAdapter.bindHumanInteractions bridges chart.onCategoryClick into a documented direct action call path', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/bar_bind'
  let registeredCategoryHandler = null
  let cleanedUp = false
  let receivedActionCall = null
  const adapter = new BarWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
      }
    },
    onCategoryClick(handler) {
      registeredCategoryHandler = handler
      return () => {
        cleanedUp = true
      }
    },
  }, 'wl://demo/workspace/main/data/cars_grouped')

  const cleanup = adapter.bindHumanInteractions({
    actionTargetRef: widgetRef,
    onActionCall(call) {
      receivedActionCall = call
    },
  })

  assert.equal(typeof registeredCategoryHandler, 'function')

  registeredCategoryHandler({
    field: 'Origin',
    values: ['Japan', 'USA'],
  })

  assert.equal(receivedActionCall?.name, 'bar.selectCategory')
  assert.equal(receivedActionCall?.actor, 'human')
  assert.equal(receivedActionCall?.targetRef, widgetRef)
  assert.deepEqual(receivedActionCall?.params, {
    targetRef: widgetRef,
    field: 'Origin',
    values: ['Japan', 'USA'],
  })

  cleanup()
  assert.equal(cleanedUp, true)
})

test('HeatmapWidgetAdapter exposes the documented widget-adapter surface', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/heatmap_c'
  const dataRef = 'wl://demo/workspace/main/data/heatmap_cells'
  const adapter = new HeatmapWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
      }
    },
  }, dataRef)

  const description = adapter.getDescription()
  const state = adapter.getState()

  assert.equal(adapter.widgetRef, widgetRef)
  assert.equal(description.ref, widgetRef)
  assert.equal(description.kind, 'heatmap')
  assert.equal(description.primaryDataRef, dataRef)
  assert.equal(description.actionNames.includes('heatmap.filterCells'), true)
  assert.equal(description.perceptionQueryNames.includes('perception.inspectVisibleRows'), true)
  assert.equal(description.perceptionQueryNames.includes('perception.summarizeSelection'), true)
  assert.equal(description.perceptionQueryNames.includes('perception.findOutliers'), true)
  assert.equal(state.ref, widgetRef)
  assert.equal(state.widgetId, 'heatmap_c')
  assert.equal(state.kind, 'heatmap')
  assert.equal(state.data.sourceDataRef, dataRef)
  assert.equal(state.humanInteraction?.actionName, 'heatmap.filterCells')
})

test('HeatmapWidgetAdapter.applyState projects aggregate, reencode, add/remove, and drill-down state into the chart wrapper', async () => {
  const widgetRef = 'wl://demo/workspace/main/widget/heatmap_apply'
  const dataRef = 'wl://demo/workspace/main/data/heatmap_cells'
  let aggregateState = null
  let reencodeState = null
  let addRemoveState = null
  let annotateState = null
  let drillDownState = null
  let navigateState = null
  const adapter = new HeatmapWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
        view: {},
      }
    },
    setAggregateState(aggregate) {
      aggregateState = aggregate
    },
    setReencodeState(reencode) {
      reencodeState = reencode
    },
    setAddRemoveState(addRemove) {
      addRemoveState = addRemove
    },
    setAnnotateState(annotate) {
      annotateState = annotate
    },
    setDrillDownState(drillDown) {
      drillDownState = drillDown
    },
    setNavigateState(navigate) {
      navigateState = navigate
    },
  }, dataRef)

  await adapter.applyState({
    ref: widgetRef,
    widgetId: 'heatmap_apply',
    kind: 'heatmap',
    view: {
      aggregate: {
        mode: 'clusterRowsCols',
        clusterRows: true,
        clusterCols: true,
        method: 'ward',
        colorField: 'Horsepower',
      },
      reencode: {
        mode: 'transpose',
        transposed: true,
      },
      addRemove: {
        mode: 'itemVisibility',
        operation: 'add',
        xField: 'Origin',
        subField: 'Cylinders',
        visibleItems: [['Japan', '4']],
      },
      annotate: {
        mode: 'marginalBars',
        op: 'sum',
        showTop: true,
        showRight: false,
        valueField: 'Horsepower',
      },
      drillDown: {
        axis: 'x',
        active: true,
        level: 'date',
        parent: { year: 2024, month: 2 },
        targetField: 'day',
      },
      navigate: {
        mode: 'resetDrilldown',
        sourceAction: 'heatmap.resetDrilldown',
      },
    },
  })

  assert.deepEqual(aggregateState, {
    mode: 'clusterRowsCols',
    clusterRows: true,
    clusterCols: true,
    method: 'ward',
    colorField: 'Horsepower',
  })
  assert.deepEqual(reencodeState, {
    mode: 'transpose',
    transposed: true,
  })
  assert.deepEqual(addRemoveState, {
    mode: 'itemVisibility',
    operation: 'add',
    xField: 'Origin',
    subField: 'Cylinders',
    visibleItems: [['Japan', '4']],
  })
  assert.deepEqual(annotateState, {
    mode: 'marginalBars',
    op: 'sum',
    showTop: true,
    showRight: false,
    valueField: 'Horsepower',
  })
  assert.deepEqual(drillDownState, {
    axis: 'x',
    active: true,
    level: 'date',
    parent: { year: 2024, month: 2 },
    targetField: 'day',
  })
  assert.deepEqual(navigateState, {
    mode: 'resetDrilldown',
    sourceAction: 'heatmap.resetDrilldown',
  })
})

test('HeatmapWidgetAdapter.bindHumanInteractions bridges chart.onCellClick into a documented direct action call path', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/heatmap_bind'
  let registeredCellHandler = null
  let cleanedUp = false
  let receivedActionCall = null
  const adapter = new HeatmapWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
      }
    },
    onCellClick(handler) {
      registeredCellHandler = handler
      return () => {
        cleanedUp = true
      }
    },
  }, 'wl://demo/workspace/main/data/heatmap_cells')

  const cleanup = adapter.bindHumanInteractions({
    actionTargetRef: widgetRef,
    onActionCall(call) {
      receivedActionCall = call
    },
  })

  assert.equal(typeof registeredCellHandler, 'function')

  registeredCellHandler({
    xField: 'Origin',
    yField: 'Cylinders',
    xValue: 'Japan',
    yValue: '4',
  })

  assert.equal(receivedActionCall?.name, 'heatmap.filterCells')
  assert.equal(receivedActionCall?.actor, 'human')
  assert.equal(receivedActionCall?.targetRef, widgetRef)
  assert.deepEqual(receivedActionCall?.params, {
    targetRef: widgetRef,
    xField: 'Origin',
    yField: 'Cylinders',
    xValue: 'Japan',
    yValue: '4',
  })

  cleanup()
  assert.equal(cleanedUp, true)
})

test('TableWidgetAdapter exposes the documented widget-adapter surface', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/table_d'
  const dataRef = 'wl://demo/workspace/main/data/detail_rows'
  const adapter = new TableWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
        rawSpec: {
          columns: ['Name', 'Origin'],
        },
      }
    },
  }, dataRef)

  const description = adapter.getDescription()
  const state = adapter.getState()

  assert.equal(adapter.widgetRef, widgetRef)
  assert.equal(description.ref, widgetRef)
  assert.equal(description.kind, 'table')
  assert.equal(description.primaryDataRef, dataRef)
  assert.equal(description.actionNames.includes('table.focusRows'), true)
  assert.equal(description.perceptionQueryNames.includes('perception.inspectVisibleRows'), true)
  assert.equal(description.perceptionQueryNames.includes('perception.summarizeSelection'), true)
  assert.equal(description.perceptionQueryNames.includes('perception.compareGroups'), true)
  assert.equal(state.ref, widgetRef)
  assert.equal(state.widgetId, 'table_d')
  assert.equal(state.kind, 'table')
  assert.equal(state.data.sourceDataRef, dataRef)
  assert.equal(state.humanInteraction?.actionName, 'table.focusRows')
})

test('TableWidgetAdapter.bindHumanInteractions bridges chart.onRowClick into a documented direct action call path', () => {
  const widgetRef = 'wl://demo/workspace/main/widget/table_bind'
  let registeredRowHandler = null
  let cleanedUp = false
  let receivedActionCall = null
  const adapter = new TableWidgetAdapter(widgetRef, {
    getState() {
      return {
        selections: {},
        rawSpec: {
          columns: ['Name', 'Origin'],
        },
      }
    },
    onRowClick(handler) {
      registeredRowHandler = handler
      return () => {
        cleanedUp = true
      }
    },
  }, 'wl://demo/workspace/main/data/detail_rows')

  const cleanup = adapter.bindHumanInteractions({
    actionTargetRef: widgetRef,
    onActionCall(call) {
      receivedActionCall = call
    },
  })

  assert.equal(typeof registeredRowHandler, 'function')

  registeredRowHandler({
    keyField: 'Name',
    keys: ['ford pinto', 'honda civic'],
  })

  assert.equal(receivedActionCall?.name, 'table.focusRows')
  assert.equal(receivedActionCall?.actor, 'human')
  assert.equal(receivedActionCall?.targetRef, widgetRef)
  assert.deepEqual(receivedActionCall?.params, {
    targetRef: widgetRef,
    keyField: 'Name',
    keys: ['ford pinto', 'honda civic'],
  })

  cleanup()
  assert.equal(cleanedUp, true)
})
