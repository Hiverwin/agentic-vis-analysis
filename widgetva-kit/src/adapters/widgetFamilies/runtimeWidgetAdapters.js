import { makeWidgetDescription } from '../../core/protocol/description.js'
import { parseRef } from '../../core/protocol/refs.js'
import { makeSelectionState, makeWidgetState } from '../../core/protocol/state.js'
import { buildSelectionStateInput } from '../../core/runtime/materializers/selectionStateShape.js'
import {
  resolveAddRemoveStatePayload,
  resolveAggregateStatePayload,
  resolveAnnotateStatePayload,
  resolveDrillDownStatePayload,
  resolveFocusPayload,
  resolveHighlightStatePayload,
  resolveNavigateStatePayload,
  resolveReencodeStatePayload,
  resolveSortPayload,
} from '../providerFamilyBehavior.js'
import { buildSelectionActionResult } from '../widgets/shared/selectionResult.js'
import { buildScatterActionDescriptors } from '../../widgets/scatter/index.js'
import { barWidgetAdapter } from './barWidgetAdapter.js'
import { heatmapWidgetAdapter } from './heatmapWidgetAdapter.js'
import { lineWidgetAdapter } from './lineWidgetAdapter.js'
import { parallelCoordinatesWidgetAdapter } from './parallelCoordinatesWidgetAdapter.js'
import { sankeyWidgetAdapter } from './sankeyWidgetAdapter.js'
import { scatterWidgetAdapter } from './scatterWidgetAdapter.js'
import { tableWidgetAdapter } from './tableWidgetAdapter.js'

function buildWidgetDescription({ widgetRef, dataRef, kind, title, description, analyticRoles, actionNames, perceptionQueryNames, humanInteraction }) {
  const parts = parseRef(widgetRef) || {}
  return makeWidgetDescription({
    ref: widgetRef,
    widgetId: parts.widgetId || null,
    kind,
    title,
    description,
    analyticRoles,
    primaryDataRef: dataRef || null,
    actionNames,
    perceptionQueryNames,
    humanInteraction,
  })
}

function buildWidgetState({ widgetRef, dataRef, kind, chart, humanInteraction }) {
  const parts = parseRef(widgetRef) || {}
  return makeWidgetState({
    ref: widgetRef,
    widgetId: parts.widgetId || null,
    kind,
    ...(typeof chart?.getState === 'function' ? chart.getState() : {}),
    data: {
      sourceDataRef: dataRef || null,
      currentDataRef: dataRef || null,
      ...((typeof chart?.getState === 'function' ? chart.getState()?.data : null) || {}),
    },
    humanInteraction,
  })
}

function looksLikeWidgetState(value) {
  return value != null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      typeof value.widgetId === 'string'
      || typeof value.ref === 'string'
      || typeof value.kind === 'string'
      || value.view != null
      || value.selections != null
      || value.data != null
      || value.feedback != null
    )
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function resolveRepresentativeSelection(widgetState) {
  const normalizedSelections = Object.values(widgetState?.selections || {}).filter(Boolean)
  if (normalizedSelections.length === 1) return normalizedSelections[0] || null
  const pointSelections = normalizedSelections.filter((selection) => selection?.kind === 'point')
  if (pointSelections.length === 1) return pointSelections[0] || null
  return normalizedSelections[0] || null
}

function resolvePrimaryIntervalSelection(widgetState) {
  return Object.values(widgetState?.selections || {}).find((selection) => selection?.kind === 'interval') || null
}

class BaseFamilyRuntimeWidgetAdapter {
  constructor({ widgetRef, chart, dataRef, createInstance, getDescription, getState }) {
    this.widgetRef = widgetRef
    this.chart = chart
    this.dataRef = dataRef
    this._instance = createInstance({
      widgetRef,
      dataRef,
      getDescription: () => getDescription(),
      getState: () => getState(),
    })
  }

  getDescription() {
    return this._instance.getDescription()
  }

  getState() {
    return this._instance.getState()
  }

  buildActionDescriptors(args) {
    return this._instance.buildActionDescriptors(args)
  }

  buildPerceptionDescriptors(args) {
    return this._instance.buildPerceptionDescriptors(args)
  }

  registerActions(actionExecutor) {
    return this._instance.registerActions(actionExecutor)
  }

  registerPerceptionQueries(perceptionRegistry) {
    return this._instance.registerPerceptionQueries(perceptionRegistry)
  }

  getHumanInteractionConfig() {
    return this._instance.getHumanInteractionConfig()
  }

  bindHumanInteractions(args = {}) {
    return this._instance.bindHumanInteractions(args)
  }

  applyEncodingChange(channel, field, options = {}) {
    if (typeof this.chart?.changeEncoding === 'function') {
      this.chart.changeEncoding(channel, field, options)
      return
    }
    if (typeof this.chart?.applyAction === 'function') {
      this.chart.applyAction('widget.changeEncoding', { channel, field, ...options })
    }
  }

  applySelectionClear(options = {}) {
    if (typeof this.chart?.clearSelection === 'function') {
      this.chart.clearSelection(options)
      return
    }
    if (typeof this.chart?.applyAction === 'function') {
      this.chart.applyAction('widget.clearSelection', options)
    }
  }

  applyDomainZoom({ xDomain = null, yDomain = null, options = {} } = {}) {
    if (
      Array.isArray(xDomain)
      && Array.isArray(yDomain)
      && typeof this.chart?.setDomain === 'function'
    ) {
      this.chart.setDomain(xDomain, yDomain, options)
      return
    }
    if (typeof this.chart?.applyAction === 'function') {
      this.chart.applyAction('widget.zoomDomain', { xDomain, yDomain, ...options })
    }
  }

  applyChartState(widgetState = {}) {
    const selection = resolveRepresentativeSelection(widgetState)
    const intervalSelection = resolvePrimaryIntervalSelection(widgetState)
    const xDomain = widgetState?.view?.xDomain || intervalSelection?.domain?.xDomain || null
    const yDomain = widgetState?.view?.yDomain || intervalSelection?.domain?.yDomain || null
    const highlightState = resolveHighlightStatePayload(widgetState)
    const aggregateState = resolveAggregateStatePayload(widgetState)
    const addRemoveState = resolveAddRemoveStatePayload(widgetState)
    const annotateState = resolveAnnotateStatePayload(widgetState)
    const drillDownState = resolveDrillDownStatePayload(widgetState)
    const focusPayload = resolveFocusPayload(widgetState)
    const navigateState = resolveNavigateStatePayload(widgetState)
    const reencodeState = resolveReencodeStatePayload(widgetState)
    const sortPayload = resolveSortPayload(widgetState)
    const highlightedKeys = Array.isArray(widgetState?.feedback?.highlightedKeys)
      ? [...widgetState.feedback.highlightedKeys]
      : []

    if (typeof this.chart?.setBrush === 'function') {
      this.chart.setBrush(intervalSelection || null)
    }
    if (typeof this.chart?.setViewport === 'function') {
      this.chart.setViewport({
        ...(Array.isArray(xDomain) ? { xDomain: clone(xDomain) } : {}),
        ...(Array.isArray(yDomain) ? { yDomain: clone(yDomain) } : {}),
      })
    } else if ((Array.isArray(xDomain) || Array.isArray(yDomain)) && typeof this.chart?.setDomain === 'function') {
      this.chart.setDomain(
        Array.isArray(xDomain) ? xDomain : null,
        Array.isArray(yDomain) ? yDomain : null,
      )
    }
    if (typeof this.chart?.setSelection === 'function') {
      this.chart.setSelection(selection || null)
    }
    if (typeof this.chart?.setHighlights === 'function') {
      this.chart.setHighlights(highlightedKeys)
    }
    if (highlightState && typeof this.chart?.setHighlightState === 'function') {
      this.chart.setHighlightState(highlightState)
    }
    if (aggregateState && typeof this.chart?.setAggregateState === 'function') {
      this.chart.setAggregateState(aggregateState)
    }
    if (addRemoveState && typeof this.chart?.setAddRemoveState === 'function') {
      this.chart.setAddRemoveState(addRemoveState)
    }
    if (annotateState && typeof this.chart?.setAnnotateState === 'function') {
      this.chart.setAnnotateState(annotateState)
    }
    if (drillDownState && typeof this.chart?.setDrillDownState === 'function') {
      this.chart.setDrillDownState(drillDownState)
    }
    if (focusPayload && typeof this.chart?.setFocus === 'function') {
      this.chart.setFocus(focusPayload)
    }
    if (navigateState && typeof this.chart?.setNavigateState === 'function') {
      this.chart.setNavigateState(navigateState)
    }
    if (reencodeState && typeof this.chart?.setReencodeState === 'function') {
      this.chart.setReencodeState(reencodeState)
    }
    if (sortPayload && typeof this.chart?.setSort === 'function') {
      this.chart.setSort(sortPayload)
    }
  }

  applyState(args = {}) {
    if (looksLikeWidgetState(args) && typeof this.applyChartState === 'function') {
      return this.applyChartState(args)
    }
    if (looksLikeWidgetState(args) && typeof this.chart?.renderFromState === 'function') {
      return this.chart.renderFromState(args)
    }
    return this._instance.applyState(args)
  }
}

export class ScatterWidgetAdapter extends BaseFamilyRuntimeWidgetAdapter {
  constructor(widgetRef, chart, dataRef) {
    const interactionConfig = scatterWidgetAdapter.getHumanInteractionConfig()
    super({
      widgetRef,
      chart,
      dataRef,
      createInstance: (args) => scatterWidgetAdapter.createInstance(args),
      getDescription: () => buildWidgetDescription({
        widgetRef,
        dataRef,
        kind: 'scatter',
        title: 'Scatterplot Widget',
        description: 'A scatterplot that supports brushing, zooming, and encoding changes.',
        analyticRoles: ['correlate', 'cluster', 'outlier'],
        actionNames: ['scatter.brushRegion', 'scatter.zoomDomain', 'widget.changeEncoding', 'widget.clearSelection'],
        perceptionQueryNames: [
          'perception.inspectVisibleRows',
          'perception.summarizeSelection',
          'perception.computeCorrelation',
          'perception.findOutliers',
          'perception.findExtremes',
        ],
        humanInteraction: interactionConfig,
      }),
      getState: () => buildWidgetState({
        widgetRef,
        dataRef,
        kind: 'scatter',
        chart,
        humanInteraction: interactionConfig,
      }),
    })
  }

  async applyChartState(widgetState) {
    return super.applyChartState(widgetState)
  }

  applySelectionClear() {
    if (typeof this.chart?.setBrush === 'function') {
      this.chart.setBrush(null)
      return
    }
    super.applySelectionClear()
  }

  applyDomainZoom({ xDomain = null, yDomain = null, options = {} } = {}) {
    if (
      Array.isArray(xDomain)
      && Array.isArray(yDomain)
      && typeof this.chart?.setDomain === 'function'
    ) {
      this.chart.setDomain(xDomain, yDomain, options)
      return
    }
    super.applyDomainZoom({ xDomain, yDomain, options })
  }

  registerActions(actionExecutor) {
    const selectionRef = `${this.widgetRef}/selection/brush`
    if (!actionExecutor.has('scatter.brushRegion')) {
      const descriptor = buildScatterActionDescriptors({
        widgetRef: this.widgetRef,
        selectionRef,
        scope: 'local',
        affectedRefs: [this.widgetRef],
      })[0]
      actionExecutor.register(
        descriptor,
        async (call, ctx) => {
          const params = call?.params || {}
          const targetWidget = ctx.requireTargetWidget({
            targetRef: call?.queryScope?.widgetRef || null,
            kind: 'scatter',
          })
          const xRange = Array.isArray(params.xRange) ? params.xRange : null
          const yRange = Array.isArray(params.yRange) ? params.yRange : null
          if (!targetWidget || !params.xField || !params.yField || !xRange || !yRange) {
            throw new Error('scatter.brushRegion requires a scatter target, xField, yField, xRange, and yRange.')
          }

          const { rows } = ctx.readRowsForWidget(targetWidget.ref)
          const [xMin, xMax] = [Math.min(...xRange), Math.max(...xRange)]
          const [yMin, yMax] = [Math.min(...yRange), Math.max(...yRange)]
          const filtered = rows.filter((row) => {
            const x = row?.[params.xField]
            const y = row?.[params.yField]
            return typeof x === 'number' && typeof y === 'number' && x >= xMin && x <= xMax && y >= yMin && y <= yMax
          })

          const selectionState = makeSelectionState(buildSelectionStateInput({
            selection_id: 'brush',
            selection_type: 'interval',
            fields: [params.xField, params.yField],
            value: {
              [params.xField]: [xMin, xMax],
              [params.yField]: [yMin, yMax],
            },
            domain: {
              xDomain: [xMin, xMax],
              yDomain: [yMin, yMax],
            },
            predicates: [
              { field: params.xField, op: 'between', value: [xMin, xMax] },
              { field: params.yField, op: 'between', value: [yMin, yMax] },
            ],
            count: filtered.length,
            summary: `${params.xField} ${xMin}~${xMax}; ${params.yField} ${yMin}~${yMax}`,
          }))

          if (typeof this.chart?.setBrush === 'function') {
            this.chart.setBrush(selectionState)
          }

          const nextState = ctx.commitSelection({
            selection_id: 'brush',
            source_widget_id: targetWidget.widgetId || undefined,
            selection_type: 'interval',
            fields: [params.xField, params.yField],
            value: {
              [params.xField]: [xMin, xMax],
              [params.yField]: [yMin, yMax],
            },
            domain: {
              xDomain: [xMin, xMax],
              yDomain: [yMin, yMax],
            },
            predicates: [
              { field: params.xField, op: 'between', value: [xMin, xMax] },
              { field: params.yField, op: 'between', value: [yMin, yMax] },
            ],
            count: filtered.length,
            summary: `${params.xField} ${xMin}~${xMax}; ${params.yField} ${yMin}~${yMax}`,
          })

          return buildSelectionActionResult({
            ctx,
            nextState,
            selectedCount: filtered.length,
            verificationHints: [
              'Read the updated scatter selection state.',
              'Query the current_selection query to confirm selectedCount.',
              'Read linked bar/table states to confirm filter propagation.',
            ],
          })
        },
      )
    }

    if (!actionExecutor.has('scatter.zoomDomain')) {
      const descriptor = buildScatterActionDescriptors({
        widgetRef: this.widgetRef,
        selectionRef,
        scope: 'local',
        affectedRefs: [this.widgetRef],
      })[1]
      actionExecutor.register(
        descriptor,
        async (call, ctx) => {
          const params = call?.params || {}
          const targetWidget = ctx.requireTargetWidget({
            targetRef: call?.queryScope?.widgetRef || null,
            kind: 'scatter',
            message: 'scatter.zoomDomain requires a valid scatter target widget.',
          })
          const xDomain = Array.isArray(params.xDomain) ? params.xDomain : null
          const yDomain = Array.isArray(params.yDomain) ? params.yDomain : null
          if (!targetWidget || (!xDomain && !yDomain)) {
            throw new Error('scatter.zoomDomain requires a scatter target and at least one domain range.')
          }

          if (Array.isArray(xDomain) && Array.isArray(yDomain) && typeof this.chart?.setDomain === 'function') {
            this.chart.setDomain(xDomain, yDomain)
          }

          const nextState = ctx.updateCurrentSpec((spec) => {
            if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
              throw new Error('No active base spec is available for scatter domain updates.')
            }

            const nextEncoding = { ...(spec.encoding || {}) }
            if (xDomain && nextEncoding.x) {
              nextEncoding.x = {
                ...nextEncoding.x,
                scale: {
                  ...(nextEncoding.x.scale || {}),
                  domain: xDomain,
                },
              }
            }
            if (yDomain && nextEncoding.y) {
              nextEncoding.y = {
                ...nextEncoding.y,
                scale: {
                  ...(nextEncoding.y.scale || {}),
                  domain: yDomain,
                },
              }
            }

            return {
              ...spec,
              encoding: nextEncoding,
            }
          })

          return {
            nextState,
            result: {
              widgetId: targetWidget.widgetId,
              ...(xDomain ? { xDomain } : {}),
              ...(yDomain ? { yDomain } : {}),
            },
            verificationHints: [
              'Call perception.inspectViewConfig to verify the scatterplot domain was updated.',
              'Read the target widget view state to confirm the new x/y domain values.',
            ],
          }
        },
      )
    }
  }

  bindHumanInteractions(args = {}) {
    if (!args?.view && typeof this.chart?.onBrush === 'function') {
      const {
        actionTargetRef,
        onActionCall,
        onSelectionChange,
        selectionSourceWidgetId,
      } = args
      const cleanup = this.chart.onBrush((selection) => {
        const normalizedSelection = selection || null
        const fields = Array.isArray(normalizedSelection?.fields) ? normalizedSelection.fields : []
        const [xField, yField] = fields
        const xRange = xField ? normalizedSelection?.value?.[xField] : null
        const yRange = yField ? normalizedSelection?.value?.[yField] : null

        if (
          typeof onActionCall === 'function'
          && xField
          && yField
          && Array.isArray(xRange)
          && Array.isArray(yRange)
        ) {
          onActionCall({
            callId: `human_${Date.now()}`,
            name: 'scatter.brushRegion',
            actor: 'human',
            targetRef: actionTargetRef || this.widgetRef,
            params: {
              targetRef: actionTargetRef || this.widgetRef,
              xField,
              yField,
              xRange,
              yRange,
            },
          })
          return
        }

        if (typeof onSelectionChange === 'function') {
          onSelectionChange(
            normalizedSelection
              ? {
                  ...normalizedSelection,
                  source_widget_id: selectionSourceWidgetId || undefined,
                }
              : null,
          )
        }
      })
      return typeof cleanup === 'function' ? cleanup : () => {}
    }
    return super.bindHumanInteractions(args)
  }
}

export class BarWidgetAdapter extends BaseFamilyRuntimeWidgetAdapter {
  constructor(widgetRef, chart, dataRef) {
    const interactionConfig = barWidgetAdapter.getHumanInteractionConfig()
    super({
      widgetRef,
      chart,
      dataRef,
      createInstance: (args) => barWidgetAdapter.createInstance(args),
      getDescription: () => buildWidgetDescription({
        widgetRef,
        dataRef,
        kind: 'bar',
        title: 'Bar Chart Widget',
        description: 'A bar chart that supports category selection and comparison.',
        analyticRoles: ['compare', 'rank', 'distribution'],
        actionNames: ['bar.selectCategory', 'bar.sortBars', 'widget.changeEncoding', 'widget.clearSelection'],
        perceptionQueryNames: ['perception.inspectVisibleRows', 'perception.summarizeSelection', 'perception.compareGroups', 'perception.findExtremes'],
        humanInteraction: interactionConfig,
      }),
      getState: () => buildWidgetState({
        widgetRef,
        dataRef,
        kind: 'bar',
        chart,
        humanInteraction: interactionConfig,
      }),
    })
  }

  bindHumanInteractions(args = {}) {
    if (!args?.view && typeof this.chart?.onCategoryClick === 'function') {
      const { actionTargetRef, onActionCall } = args
      const cleanup = this.chart.onCategoryClick((selection) => {
        const field = typeof selection?.field === 'string' ? selection.field : null
        const values = Array.isArray(selection?.values) ? selection.values.filter((value) => typeof value === 'string') : []
        if (!field || values.length === 0 || typeof onActionCall !== 'function') return

        onActionCall({
          callId: `human_${Date.now()}`,
          name: 'bar.selectCategory',
          actor: 'human',
          targetRef: actionTargetRef || this.widgetRef,
          params: {
            targetRef: actionTargetRef || this.widgetRef,
            field,
            values,
          },
        })
      })
      return typeof cleanup === 'function' ? cleanup : () => {}
    }
    return super.bindHumanInteractions(args)
  }
}

export class HeatmapWidgetAdapter extends BaseFamilyRuntimeWidgetAdapter {
  constructor(widgetRef, chart, dataRef) {
    const interactionConfig = heatmapWidgetAdapter.getHumanInteractionConfig()
    super({
      widgetRef,
      chart,
      dataRef,
      createInstance: (args) => heatmapWidgetAdapter.createInstance(args),
      getDescription: () => buildWidgetDescription({
        widgetRef,
        dataRef,
        kind: 'heatmap',
        title: 'Heatmap Widget',
        description: 'A heatmap that supports cell filtering and linked detail inspection.',
        analyticRoles: ['compare', 'cluster', 'distribution'],
        actionNames: ['heatmap.filterCells', 'widget.changeEncoding', 'widget.clearSelection'],
        perceptionQueryNames: [
          'perception.inspectVisibleRows',
          'perception.summarizeSelection',
          'perception.findExtremes',
          'perception.findOutliers',
        ],
        humanInteraction: interactionConfig,
      }),
      getState: () => buildWidgetState({
        widgetRef,
        dataRef,
        kind: 'heatmap',
        chart,
        humanInteraction: interactionConfig,
      }),
    })
  }

  bindHumanInteractions(args = {}) {
    if (!args?.view && typeof this.chart?.onCellClick === 'function') {
      const { actionTargetRef, onActionCall } = args
      const cleanup = this.chart.onCellClick((selection) => {
        const xField = typeof selection?.xField === 'string' ? selection.xField : null
        const yField = typeof selection?.yField === 'string' ? selection.yField : null
        const xValue = typeof selection?.xValue === 'string' ? selection.xValue : null
        const yValue = typeof selection?.yValue === 'string' ? selection.yValue : null
        if (!xField || !yField || xValue == null || yValue == null || typeof onActionCall !== 'function') return

        onActionCall({
          callId: `human_${Date.now()}`,
          name: 'heatmap.filterCells',
          actor: 'human',
          targetRef: actionTargetRef || this.widgetRef,
          params: {
            targetRef: actionTargetRef || this.widgetRef,
            xField,
            yField,
            xValue,
            yValue,
          },
        })
      })
      return typeof cleanup === 'function' ? cleanup : () => {}
    }
    return super.bindHumanInteractions(args)
  }
}

export class LineWidgetAdapter extends BaseFamilyRuntimeWidgetAdapter {
  constructor(widgetRef, chart, dataRef) {
    const interactionConfig = lineWidgetAdapter.getHumanInteractionConfig()
    super({
      widgetRef,
      chart,
      dataRef,
      createInstance: (args) => lineWidgetAdapter.createInstance(args),
      getDescription: () => buildWidgetDescription({
        widgetRef,
        dataRef,
        kind: 'line',
        title: 'Line Chart Widget',
        description: 'A line chart that supports zooming, focus, filtering, and temporal trend inspection.',
        analyticRoles: ['trend', 'compare', 'sequence'],
        actionNames: [
          'line.selectSeries',
          'line.selectXValue',
          'line.zoomXRegion',
          'line.focusLines',
          'line.highlightTrend',
          'line.showMovingAverage',
          'line.drillDownXAxis',
          'line.resetDrilldownXAxis',
          'line.resampleXAxis',
          'line.resetResampleXAxis',
          'line.boldLines',
          'line.filterLines',
          'widget.changeEncoding',
          'widget.clearSelection',
        ],
        perceptionQueryNames: [
          'perception.inspectVisibleRows',
          'perception.summarizeSelection',
          'perception.detectAnomalies',
          'perception.findExtremes',
          'perception.compareGroups',
        ],
        humanInteraction: interactionConfig,
      }),
      getState: () => buildWidgetState({
        widgetRef,
        dataRef,
        kind: 'line',
        chart,
        humanInteraction: interactionConfig,
      }),
    })
  }
}

export class ParallelCoordinatesWidgetAdapter extends BaseFamilyRuntimeWidgetAdapter {
  constructor(widgetRef, chart, dataRef) {
    const interactionConfig = parallelCoordinatesWidgetAdapter.getHumanInteractionConfig()
    super({
      widgetRef,
      chart,
      dataRef,
      createInstance: (args) => parallelCoordinatesWidgetAdapter.createInstance(args),
      getDescription: () => buildWidgetDescription({
        widgetRef,
        dataRef,
        kind: 'parallelCoordinates',
        title: 'Parallel Coordinates Widget',
        description: 'A parallel-coordinates chart that supports brushing, dimension filtering, and category highlighting.',
        analyticRoles: ['multivariate-compare', 'filter', 'outlier'],
        actionNames: [
          'parallelCoordinates.brushAxes',
          'parallelCoordinates.selectRecord',
          'parallelCoordinates.reorderDimensions',
          'parallelCoordinates.filterDimension',
          'parallelCoordinates.filterByCategory',
          'parallelCoordinates.highlightCategory',
          'parallelCoordinates.hideDimensions',
          'parallelCoordinates.resetHiddenDimensions',
          'widget.changeEncoding',
          'widget.clearSelection',
        ],
        perceptionQueryNames: [
          'perception.inspectVisibleRows',
          'perception.summarizeSelection',
          'perception.findOutliers',
        ],
        humanInteraction: interactionConfig,
      }),
      getState: () => buildWidgetState({
        widgetRef,
        dataRef,
        kind: 'parallelCoordinates',
        chart,
        humanInteraction: interactionConfig,
      }),
    })
  }
}

export class SankeyWidgetAdapter extends BaseFamilyRuntimeWidgetAdapter {
  constructor(widgetRef, chart, dataRef) {
    const interactionConfig = sankeyWidgetAdapter.getHumanInteractionConfig()
    super({
      widgetRef,
      chart,
      dataRef,
      createInstance: (args) => sankeyWidgetAdapter.createInstance(args),
      getDescription: () => buildWidgetDescription({
        widgetRef,
        dataRef,
        kind: 'sankey',
        title: 'Sankey Widget',
        description: 'A sankey diagram that supports filtering, tracing, collapsing, and conversion analysis.',
        analyticRoles: ['flow', 'conversion', 'funnel'],
        actionNames: [
          'sankey.focusFlow',
          'sankey.selectAggregateNode',
          'sankey.filterFlow',
          'sankey.collapseNodes',
          'sankey.expandNode',
          'sankey.highlightPath',
          'sankey.traceNode',
          'sankey.colorFlows',
          'sankey.reorderNodesInLayer',
          'sankey.autoCollapseByRank',
          'widget.clearSelection',
        ],
        perceptionQueryNames: [
          'perception.inspectVisibleRows',
          'perception.getNodeOptions',
          'perception.calculateConversionRate',
          'perception.findBottleneck',
          'perception.findExtremes',
          'perception.compareGroups',
        ],
        humanInteraction: interactionConfig,
      }),
      getState: () => buildWidgetState({
        widgetRef,
        dataRef,
        kind: 'sankey',
        chart,
        humanInteraction: interactionConfig,
      }),
    })
  }
}

export class TableWidgetAdapter extends BaseFamilyRuntimeWidgetAdapter {
  constructor(widgetRef, chart, dataRef) {
    const interactionConfig = tableWidgetAdapter.getHumanInteractionConfig()
    super({
      widgetRef,
      chart,
      dataRef,
      createInstance: (args) => tableWidgetAdapter.createInstance(args),
      getDescription: () => buildWidgetDescription({
        widgetRef,
        dataRef,
        kind: 'table',
        title: 'Table Widget',
        description: 'A detail table that supports row focus and direct record inspection.',
        analyticRoles: ['lookup', 'compare', 'rank'],
        actionNames: ['table.focusRows', 'widget.clearSelection'],
        perceptionQueryNames: [
          'perception.inspectVisibleRows',
          'perception.summarizeSelection',
          'perception.findExtremes',
          'perception.compareGroups',
        ],
        humanInteraction: interactionConfig,
      }),
      getState: () => buildWidgetState({
        widgetRef,
        dataRef,
        kind: 'table',
        chart,
        humanInteraction: interactionConfig,
      }),
    })
  }

  bindHumanInteractions(args = {}) {
    if (!args?.surface && typeof this.chart?.onRowClick === 'function') {
      const { actionTargetRef, onActionCall } = args
      const cleanup = this.chart.onRowClick((selection) => {
        const keyField = typeof selection?.keyField === 'string' ? selection.keyField : null
        const keys = Array.isArray(selection?.keys) ? selection.keys.filter((key) => key != null) : []
        if (!keyField || keys.length === 0 || typeof onActionCall !== 'function') return

        onActionCall({
          callId: `human_${Date.now()}`,
          name: 'table.focusRows',
          actor: 'human',
          targetRef: actionTargetRef || this.widgetRef,
          params: {
            targetRef: actionTargetRef || this.widgetRef,
            keyField,
            keys,
          },
        })
      })
      return typeof cleanup === 'function' ? cleanup : () => {}
    }
    return super.bindHumanInteractions(args)
  }
}
