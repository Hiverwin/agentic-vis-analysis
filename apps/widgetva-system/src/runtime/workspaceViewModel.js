import {
  buildSelectionAdvancedResponseContext,
  buildSelectionCoordinationContext,
  buildSelectionDomainCoordinationContext,
  resolveSelectionDrivenRows,
  resolveSelectionDrivenViewState,
} from '../../../../widgetva-kit/src/core/runtime/linkSemantics.js'
import {
  deriveHighlightedRows,
  deriveHighlightPredicatesFromState,
  deriveHighlightSummaryFromState,
  deriveSelectionFilteredRows,
} from '../../../../widgetva-kit/src/core/runtime/sharedStateDerivation.js'
import {
  autoCollapseSankeyGraph,
  buildSankeyData,
  collapseSankeyGraphNodes,
  reorderSankeyGraphLayer,
  summarizeOriginCylinderMatrix,
  summarizeOriginStats,
  summarizeYearTrend,
} from './carsWidgetDerivation.js'
import {
  deriveCarsActiveFilters,
  deriveCarsContextualRows,
  deriveCarsHorsepowerFilteredRows,
  deriveFocusedCar,
} from './viewModelDerivation.js'
import { projectWidgetRuntimeSurface } from '../workspace/providerPayloadBuilders.js'

function clampRange(minValue, maxValue, domain) {
  const [domainMin, domainMax] = domain
  const nextMin = Math.max(domainMin, Math.min(minValue, maxValue))
  const nextMax = Math.min(domainMax, Math.max(maxValue, nextMin))
  return [nextMin, nextMax]
}

function deriveLinkedAnalyticalOverlay(widgetId, advancedResponseContext) {
  const response = advancedResponseContext?.readResponseForWidget?.(widgetId) || null
  const responseSpec = response?.responseSpec && typeof response.responseSpec === 'object' ? response.responseSpec : null
  const params = responseSpec?.params && typeof responseSpec.params === 'object' ? responseSpec.params : {}
  if (widgetId === 'w_heatmap_origin_cyl' && response?.effect === 'transformView' && responseSpec?.kind === 'reencode' && params.variant === 'transpose') {
    return {
      kind: 'heatmapTranspose',
      transposed: params.transposed !== false,
    }
  }
  if (widgetId === 'w_sankey_cars' && response?.effect === 'transformView' && responseSpec?.kind === 'reencode' && params.variant === 'reorderLayer') {
    return {
      kind: 'sankeyReorderLayer',
      depth: Number.isFinite(params.depth) ? Number(params.depth) : 0,
      field: typeof params.field === 'string' ? params.field : 'origin',
      mode: params.mode === 'selected-first' ? 'selected-first' : 'selected-first',
    }
  }
  if (widgetId === 'w_line_year' && response?.effect === 'transformView' && responseSpec?.kind === 'drillDown' && params.variant === 'recordsByModel') {
    return {
      kind: 'lineDrillDownRecords',
      xField: typeof params.xField === 'string' ? params.xField : 'name',
      yField: typeof params.yField === 'string' ? params.yField : 'mpg',
    }
  }
  if (widgetId === 'w_sankey_cars' && response?.effect === 'transformStructure' && responseSpec?.kind === 'collapse' && params.variant === 'collapseNodes') {
    return {
      kind: 'sankeyCollapseNodes',
      nodes: Array.isArray(params.nodes) ? params.nodes : [],
      aggregateName: typeof params.aggregateName === 'string' && params.aggregateName.length > 0
        ? params.aggregateName
        : 'Other',
    }
  }
  if (widgetId === 'w_sankey_cars' && response?.effect === 'transformStructure' && responseSpec?.kind === 'expand' && params.variant === 'expandNode') {
    return {
      kind: 'sankeyAutoCollapse',
      topN: Number.isFinite(params.topN) ? Number(params.topN) : 2,
      expandedAggregateIds: [
        typeof params.aggregateName === 'string' && params.aggregateName.length > 0
          ? params.aggregateName
          : 'collapsed:0:other',
      ],
    }
  }
  if (widgetId === 'w_sankey_cars' && response?.effect === 'transformDataView' && responseSpec?.kind === 'aggregate' && params.variant === 'autoCollapseByRank') {
    return {
      kind: 'sankeyAutoCollapse',
      topN: Number.isFinite(params.topN) ? Number(params.topN) : 2,
      expandedAggregateIds: [],
    }
  }
  return null
}

export function createWorkspaceViewModel(state) {
  const rows = state.dataset.rowsData || []
  const domain = state.dataset.horsepowerDomain || [0, 1]
  const primarySelection = state.coordinationState?.selections?.views?.primary || null
  const highlightState = state.coordinationState?.highlight || null
  const highlightPredicates = deriveHighlightPredicatesFromState(highlightState)
  const highlightSummary = deriveHighlightSummaryFromState(highlightState)
  const linkDefinitions = state.coordinationState?.links?.definitions
    || state.links
    || state.workspaceComposition?.links
    || []
  const contextualRows = deriveCarsContextualRows(rows, {
    analysisOrigin: state.analysisOrigin,
    analysisYear: state.analysisYear,
    analysisCylinders: state.analysisCylinders,
  })
  const globallyFilteredRows = deriveCarsHorsepowerFilteredRows(contextualRows, {
    horsepowerMin: state.horsepowerMin,
    horsepowerMax: state.horsepowerMax,
  })
  const filteredRows = deriveSelectionFilteredRows(globallyFilteredRows, primarySelection)
  const baseWidgets = state.workspaceComposition?.widgets || state.widgets || []
  const widgetActionOverrides = state.widgetActionOverrides || {}
  const widgetMap = {}
  const selectionCoordination = buildSelectionCoordinationContext({
    primarySelection,
    links: linkDefinitions,
  })
  const selectionDomainCoordination = buildSelectionDomainCoordinationContext({
    primarySelection,
    links: linkDefinitions,
  })
  const advancedResponseContext = buildSelectionAdvancedResponseContext({
    primarySelection,
    links: linkDefinitions,
  })
  const widgetRows = (widgetId, fallbackRows = globallyFilteredRows) => resolveSelectionDrivenRows({
    widgetId,
    selectionCoordination,
    filteredRows,
    fallbackRows,
  })

  for (const widget of baseWidgets) {
    const actionOverride = widgetActionOverrides[widget.id] || null
    const linkedAnalyticalOverlay = deriveLinkedAnalyticalOverlay(widget.id, advancedResponseContext)
    const analyticalOverlay = actionOverride || linkedAnalyticalOverlay
    if (widget.id === 'w_scatter_cars') {
      const scatterRows = widgetRows(widget.id, contextualRows)
      const scatterViewport = state.scatterViewport || null
      widgetMap[widget.id] = {
        ...widget,
        derivedData: scatterRows,
        viewState: {
          horsepowerDomain: domain,
          activeRange: [state.horsepowerMin, state.horsepowerMax],
          xDomain: Array.isArray(scatterViewport?.xDomain) ? scatterViewport.xDomain : [state.horsepowerMin, state.horsepowerMax],
          yDomain: Array.isArray(scatterViewport?.yDomain) ? scatterViewport.yDomain : null,
          focusedCarId: state.focusedCarId,
          highlightPredicates,
          analyticalOverlay,
        },
      }
      widgetMap[widget.id] = projectWidgetRuntimeSurface(widgetMap[widget.id])
      continue
    }
    if (widget.id === 'w_bar_origin') {
      const barRows = widgetRows(widget.id)
      const selectionDrivenViewState = resolveSelectionDrivenViewState({
        widgetId: widget.id,
        responseSourceWidgetId: 'w_bar_origin',
        selectionCoordination,
        fields: [
          {
            viewKey: 'analysisOrigin',
            field: 'origin',
            fallbackValue: state.analysisOrigin,
            responseType: 'highlight',
          },
        ],
      })
      widgetMap[widget.id] = {
        ...widget,
        derivedData: summarizeOriginStats(barRows),
        viewState: {
          ...selectionDrivenViewState,
          highlightPredicates,
          analyticalOverlay,
        },
      }
      widgetMap[widget.id] = projectWidgetRuntimeSurface(widgetMap[widget.id])
      continue
    }
    if (widget.id === 'w_line_year') {
      const lineRows = widgetRows(widget.id)
      const selectionDrivenViewState = resolveSelectionDrivenViewState({
        widgetId: widget.id,
        responseSourceWidgetId: 'w_line_year',
        selectionCoordination,
        fields: [
          {
            viewKey: 'analysisYear',
            field: 'year',
            fallbackValue: state.analysisYear,
            responseType: 'highlight',
          },
        ],
      })
      widgetMap[widget.id] = {
        ...widget,
        derivedData: analyticalOverlay?.kind === 'lineDrillDownRecords'
          ? lineRows
          : summarizeYearTrend(lineRows),
        viewState: {
          ...selectionDrivenViewState,
          highlightPredicates,
          ...(selectionDomainCoordination.shouldSyncDomain(widget.id)
            ? {
                xDomain: selectionDomainCoordination.readDomainForWidget(widget.id)?.xDomain || null,
                yDomain: selectionDomainCoordination.readDomainForWidget(widget.id)?.yDomain || null,
              }
            : {}),
          analyticalOverlay,
        },
      }
      widgetMap[widget.id] = projectWidgetRuntimeSurface(widgetMap[widget.id])
      continue
    }
    if (widget.id === 'w_heatmap_origin_cyl') {
      const heatmapRows = widgetRows(widget.id)
      const selectionDrivenViewState = resolveSelectionDrivenViewState({
        widgetId: widget.id,
        responseSourceWidgetId: 'w_heatmap_origin_cyl',
        selectionCoordination,
        fields: [
          {
            viewKey: 'analysisOrigin',
            field: 'origin',
            fallbackValue: state.analysisOrigin,
            responseType: 'highlight',
          },
          {
            viewKey: 'analysisCylinders',
            field: 'cylinders',
            fallbackValue: state.analysisCylinders,
            responseType: 'highlight',
            mapValue: (value) => [value],
          },
        ],
      })
      widgetMap[widget.id] = {
        ...widget,
        derivedData: summarizeOriginCylinderMatrix(heatmapRows),
        viewState: {
          ...selectionDrivenViewState,
          highlightPredicates,
          analyticalOverlay,
        },
      }
      widgetMap[widget.id] = projectWidgetRuntimeSurface(widgetMap[widget.id])
      continue
    }
    if (widget.id === 'w_parallel_cars') {
      const parallelRows = widgetRows(widget.id)
      const selectionDrivenViewState = resolveSelectionDrivenViewState({
        widgetId: widget.id,
        responseSourceWidgetId: 'w_parallel_cars',
        selectionCoordination,
        fields: [
          {
            viewKey: 'focusedCarId',
            field: 'id',
            fallbackValue: state.focusedCarId,
            responseType: 'focus',
          },
        ],
      })
      const visibleDimensionKeys = actionOverride?.kind === 'parallelHiddenDimensions'
        ? ['horsepower', 'mpg', 'weight', 'acceleration'].filter((dimension) => !actionOverride.hiddenDimensions?.includes?.(dimension))
        : null
      widgetMap[widget.id] = {
        ...widget,
        derivedData: parallelRows,
        viewState: {
          ...selectionDrivenViewState,
          highlightPredicates,
          visibleDimensionKeys,
          analyticalOverlay,
        },
      }
      widgetMap[widget.id] = projectWidgetRuntimeSurface(widgetMap[widget.id])
      continue
    }
    if (widget.id === 'w_sankey_cars') {
      const sankeyRows = widgetRows(widget.id)
      const sankeyGraph = buildSankeyData(sankeyRows)
      const resolvedReorderOrder = analyticalOverlay?.kind === 'sankeyReorderLayer'
        ? Array.isArray(analyticalOverlay.order) && analyticalOverlay.order.length > 0
          ? analyticalOverlay.order
          : (() => {
              const selectedOrigin = primarySelection?.predicates?.find?.(
                (entry) => entry?.field === (analyticalOverlay.field || 'origin'),
              )?.value
              if (analyticalOverlay.mode === 'selected-first' && typeof selectedOrigin === 'string') {
                const originIds = sankeyGraph.nodes
                  .filter((node) => node.column === analyticalOverlay.depth)
                  .map((node) => node.id)
                const selectedId = `${analyticalOverlay.field || 'origin'}:${selectedOrigin}`
                if (originIds.includes(selectedId)) {
                  return [selectedId, ...originIds.filter((id) => id !== selectedId)]
                }
              }
              return []
            })()
        : null
      const runtimeGraph = analyticalOverlay?.kind === 'sankeyCollapseNodes'
        ? collapseSankeyGraphNodes(sankeyGraph, analyticalOverlay.nodes || [], analyticalOverlay.aggregateName || 'Other')
        : analyticalOverlay?.kind === 'sankeyReorderLayer'
          ? reorderSankeyGraphLayer(
              sankeyGraph,
              analyticalOverlay.depth,
              resolvedReorderOrder || [],
            )
          : sankeyGraph
      widgetMap[widget.id] = {
        ...widget,
        derivedData: analyticalOverlay?.kind === 'sankeyAutoCollapse'
          ? autoCollapseSankeyGraph(runtimeGraph, analyticalOverlay.topN || 2, analyticalOverlay.expandedAggregateIds || [])
          : runtimeGraph,
        viewState: {
          analysisOrigin: state.analysisOrigin,
          analysisYear: state.analysisYear,
          analysisCylinders: state.analysisCylinders,
          highlightPredicates,
          analyticalOverlay: analyticalOverlay?.kind === 'sankeyReorderLayer'
            ? {
                ...analyticalOverlay,
                order: resolvedReorderOrder || [],
              }
            : analyticalOverlay,
        },
      }
      widgetMap[widget.id] = projectWidgetRuntimeSurface(widgetMap[widget.id])
      continue
    }
    widgetMap[widget.id] = widget
  }

  const focusedCar = deriveFocusedCar(filteredRows, state.focusedCarId)
  const activeFilters = deriveCarsActiveFilters({
    analysisOrigin: state.analysisOrigin,
    analysisYear: state.analysisYear,
    analysisCylinders: state.analysisCylinders,
    horsepowerMin: state.horsepowerMin,
    horsepowerMax: state.horsepowerMax,
    horsepowerDomain: domain,
    primarySelectionSummary: primarySelection?.summary || null,
    highlightSummary,
  })

  return {
    widgetMap,
    contextualRows,
    filteredRows,
    highlightedRows: deriveHighlightedRows(globallyFilteredRows, highlightState),
    focusedCar,
    activeFilters,
    linkedSelectionCount: filteredRows.length,
  }
}

export function cycleAnalysisOrigin(state) {
  const current = state.analysisOrigin
  const origins = ['All', ...(state.dataset.origins || [])]
  const nextIndex = (origins.indexOf(current) + 1) % origins.length
  return origins[nextIndex]
}

export function clearAnalysisFilters(state) {
  return {
    analysisOrigin: 'All',
    analysisYear: 'All',
    analysisCylinders: [],
    horsepowerMin: state.dataset.horsepowerDomain[0],
    horsepowerMax: state.dataset.horsepowerDomain[1],
    focusedCarId: null,
  }
}

export function clampHorsepowerRange(minValue, maxValue, domain) {
  return clampRange(Number(minValue), Number(maxValue), domain)
}
