import { useMemo } from 'react'
import { useAppStore } from '../app/appStore.js'
import { createFirstPartyRuntimeSessionFacade } from '../runtime/runtimeBridge.js'

export function ControlsPanel() {
  const runtimeSessionKey = useAppStore((state) => state.runtimeSessionKey)
  const activeCaseId = useAppStore((state) => state.activeCaseId)
  const coordinationVersion = useAppStore((state) => state.coordinationVersion)
  const resetWorkspaceView = useAppStore((state) => state.resetWorkspaceView)
  const clearFilters = useAppStore((state) => state.clearFilters)
  const clearSelection = useAppStore((state) => state.clearSelection)
  const clearHighlight = useAppStore((state) => state.clearHighlight)
  const promoteSelectionToFilter = useAppStore((state) => state.promoteSelectionToFilter)
  const promoteSelectionToHighlight = useAppStore((state) => state.promoteSelectionToHighlight)
  const runWidgetAnalyticalAction = useAppStore((state) => state.runWidgetAnalyticalAction)
  const undoSelectionHistory = useAppStore((state) => state.undoSelectionHistory)
  const redoSelectionHistory = useAppStore((state) => state.redoSelectionHistory)
  const resetWorkspaceInteractions = useAppStore((state) => state.resetWorkspaceInteractions)
  const restorePreviousWorkspaceState = useAppStore((state) => state.restorePreviousWorkspaceState)
  const restoreEarliestWorkspaceState = useAppStore((state) => state.restoreEarliestWorkspaceState)
  const setAnalysisOrigin = useAppStore((state) => state.setAnalysisOrigin)
  const setAnalysisYear = useAppStore((state) => state.setAnalysisYear)
  const toggleCylinder = useAppStore((state) => state.toggleCylinder)
  const setWidgetActionOverride = useAppStore((state) => state.setWidgetActionOverride)
  const selectedWidgetId = useAppStore((state) => state.selectedWidgetId)
  const widgets = useAppStore((state) => state.widgets)
  const analysisOrigin = useAppStore((state) => state.analysisOrigin)
  const analysisYear = useAppStore((state) => state.analysisYear)
  const analysisCylinders = useAppStore((state) => state.analysisCylinders)
  const dataset = useAppStore((state) => state.dataset)
  const widgetActionOverrides = useAppStore((state) => state.widgetActionOverrides)
  const runtime = useMemo(
    () => createFirstPartyRuntimeSessionFacade(runtimeSessionKey || activeCaseId),
    [activeCaseId, runtimeSessionKey],
  )
  const coordinationState = useMemo(
    () => runtime.readCoordinationState(),
    [coordinationVersion, runtime],
  )
  const stateHistory = useMemo(
    () => runtime.readStateHistory({ limit: 12 }),
    [coordinationVersion, runtime],
  )
  const primarySelection = coordinationState?.selections?.views?.primary || null
  const hasHighlight = Array.isArray(coordinationState?.highlight?.entries) && coordinationState.highlight.entries.length > 0
  const canRestorePreviousState = stateHistory.length > 1
  const canRestoreEarliestState = stateHistory.length > 0
  const heatmapHotspotThreshold = Array.isArray(dataset?.horsepowerDomain) && dataset.horsepowerDomain.length === 2
    ? Math.round(dataset.horsepowerDomain[0] + ((dataset.horsepowerDomain[1] - dataset.horsepowerDomain[0]) * 0.75))
    : 150
  const selectedAggregateName = selectedWidgetId === 'w_sankey_cars'
    && primarySelection?.sourceWidgetId === 'w_sankey_cars'
    && typeof primarySelection?.aggregateName === 'string'
      ? primarySelection.aggregateName
      : null
  const selectedSankeyNodeName = selectedWidgetId === 'w_sankey_cars'
    && primarySelection?.sourceWidgetId === 'w_sankey_cars'
    && typeof primarySelection?.aggregateName !== 'string'
    && typeof primarySelection?.selectionId === 'string'
      ? primarySelection.selectionId
      : null
  const selectedHeatmapRegion = selectedWidgetId === 'w_heatmap_origin_cyl'
    && primarySelection?.sourceWidgetId === 'w_heatmap_origin_cyl'
      ? {
          xValues: Array.isArray(primarySelection?.predicates)
            ? primarySelection.predicates.find((predicate) => predicate?.field === 'cylinders' && predicate?.op === 'in')?.value || []
            : [],
          yValues: Array.isArray(primarySelection?.predicates)
            ? primarySelection.predicates.find((predicate) => predicate?.field === 'origin' && predicate?.op === 'in')?.value || []
            : [],
        }
      : null
  const sankeyRuntimeState = useMemo(
    () => selectedWidgetId === 'w_sankey_cars'
      ? runtime.readWidgetRuntimeState('w_sankey_cars')
      : null,
    [coordinationVersion, runtime, selectedWidgetId],
  )
  const sankeySelectedLayerReorder = useMemo(() => {
    if (!selectedSankeyNodeName) return null
    const nodeConfig = Array.isArray(sankeyRuntimeState?.rawSpec?.data)
      ? sankeyRuntimeState.rawSpec.data.find((entry) => entry?.name === 'nodeConfig')?.values || []
      : []
    const rawLinks = Array.isArray(sankeyRuntimeState?.rawSpec?.data)
      ? sankeyRuntimeState.rawSpec.data.find((entry) => entry?.name === 'rawLinks')?.values || []
      : []
    const selectedNode = nodeConfig.find((node) => node?.name === selectedSankeyNodeName)
    if (!selectedNode || !Number.isFinite(selectedNode.depth)) return null
    const layerNodes = nodeConfig.filter((node) => Number(node?.depth) === Number(selectedNode.depth))
    const flowTotals = new Map()
    for (const link of rawLinks) {
      const value = Number(link?.value || 0)
      flowTotals.set(link?.source, (flowTotals.get(link?.source) || 0) + value)
      flowTotals.set(link?.target, (flowTotals.get(link?.target) || 0) + value)
    }
    const order = [...layerNodes]
      .sort((left, right) => (flowTotals.get(right?.name) || 0) - (flowTotals.get(left?.name) || 0))
      .map((node) => node?.name)
      .filter(Boolean)
    return order.length > 0
      ? { depth: Number(selectedNode.depth), order }
      : null
  }, [sankeyRuntimeState, selectedSankeyNodeName])
  const selectedWidget = (widgets || []).find((widget) => widget.id === selectedWidgetId) || null
  const selectedWidgetOverride = selectedWidgetId ? widgetActionOverrides?.[selectedWidgetId] || null : null
  const canCommitSelectionAsFilter = Boolean(primarySelection?.selectionRef) && Array.isArray(primarySelection?.predicates) && primarySelection.predicates.length > 0
    && primarySelection.predicates.every((predicate) => (
      (predicate?.field === 'origin' && predicate?.op === 'equals' && typeof predicate?.value === 'string')
      || (predicate?.field === 'year' && predicate?.op === 'equals' && Number.isFinite(predicate?.value))
      || (predicate?.field === 'cylinders' && predicate?.op === 'equals' && Number.isFinite(predicate?.value))
      || (predicate?.field === 'horsepower' && predicate?.op === 'between' && Array.isArray(predicate?.value) && predicate.value.length === 2)
    ))

  async function handleRunAction(action) {
    await runWidgetAnalyticalAction(action)
  }

  return (
    <div className="analysis-stack">
      <section className="info-block">
        <h4>Category filters</h4>
        <div className="control-stack">
          <span>Origin</span>
          <div className="chip-row">
            <button type="button" className={`filter-chip ${analysisOrigin === 'All' ? 'active' : ''}`} onClick={() => setAnalysisOrigin('All')}>All</button>
            {(dataset?.origins || []).map((origin) => (
              <button
                key={origin}
                type="button"
                className={`filter-chip ${analysisOrigin === origin ? 'active' : ''}`}
                onClick={() => setAnalysisOrigin(origin)}
              >
                {origin}
              </button>
            ))}
          </div>
          <span>Year</span>
          <select
            className="control-input"
            value={analysisYear}
            onChange={(event) => setAnalysisYear(event.target.value === 'All' ? 'All' : Number(event.target.value))}
          >
            <option value="All">All years</option>
            {(dataset?.years || []).map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <span>Cylinders</span>
          <div className="chip-row">
            {(dataset?.cylinders || []).map((cylinder) => (
              <button
                key={cylinder}
                type="button"
                className={`filter-chip ${analysisCylinders.includes(cylinder) ? 'active' : ''}`}
                onClick={() => toggleCylinder(cylinder)}
              >
                {cylinder} cyl
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="info-block">
        <h4>Interaction state</h4>
        <div className="button-grid">
          <button type="button" className="primary-button" onClick={promoteSelectionToFilter} disabled={!canCommitSelectionAsFilter}>Filter to current selection</button>
          <button type="button" className="primary-button" onClick={promoteSelectionToHighlight} disabled={!primarySelection}>Highlight current selection</button>
          <button type="button" className="ghost-toggle block" onClick={clearSelection} disabled={!primarySelection}>Clear selection only</button>
          <button type="button" className="ghost-toggle block" onClick={clearHighlight} disabled={!hasHighlight}>Clear highlight</button>
          <button type="button" className="primary-button" onClick={clearFilters}>Clear active filters</button>
          <button type="button" className="ghost-toggle block" onClick={() => void undoSelectionHistory()}>Undo selection</button>
          <button type="button" className="ghost-toggle block" onClick={() => void redoSelectionHistory()}>Redo selection</button>
          <button type="button" className="ghost-toggle block" onClick={() => void resetWorkspaceInteractions()}>Reset interaction state</button>
          <button type="button" className="ghost-toggle block" onClick={() => void restorePreviousWorkspaceState()} disabled={!canRestorePreviousState}>Back to previous state</button>
          <button type="button" className="ghost-toggle block" onClick={() => void restoreEarliestWorkspaceState()} disabled={!canRestoreEarliestState}>Restore earliest state</button>
          <button type="button" className="ghost-toggle block" onClick={resetWorkspaceView}>Rebuild workspace view</button>
          {selectedWidgetOverride ? (
            <button
              type="button"
              className="ghost-toggle block"
              onClick={() => setWidgetActionOverride(selectedWidgetId, null)}
            >
              Clear selected widget overlay
            </button>
          ) : null}
        </div>
      </section>
      {selectedWidget?.id === 'w_scatter_cars' ? (
        <section className="info-block">
          <h4>Scatter analysis</h4>
          <div className="button-column">
            <button
              type="button"
              className="ghost-toggle block"
              onClick={() => void handleRunAction({
                widgetId: 'w_scatter_cars',
                actionName: 'scatter.showRegression',
                params: { method: 'linear' },
                summary: 'Added scatter regression overlay',
                detail: 'The analyst overlaid a regression line on the scatterplot through the shared runtime action path.',
                override: { kind: 'scatterRegression', method: 'linear' },
              })}
            >
              Show regression line
            </button>
            <button
              type="button"
              className="ghost-toggle block"
              onClick={() => void handleRunAction({
                widgetId: 'w_scatter_cars',
                actionName: 'scatter.identifyClusters',
                params: { nClusters: 2, method: 'kmeans' },
                summary: 'Identified scatter clusters',
                detail: 'The analyst recolored the scatterplot by inferred clusters through the shared runtime action path.',
                override: { kind: 'scatterClusters', nClusters: 2 },
              })}
            >
              Identify clusters
            </button>
          </div>
        </section>
      ) : null}
      {selectedWidget?.id === 'w_bar_origin' ? (
        <section className="info-block">
          <h4>Bar analysis</h4>
          <div className="button-column">
            <button
              type="button"
              className="ghost-toggle block"
              onClick={() => void handleRunAction({
                widgetId: 'w_bar_origin',
                actionName: 'bar.highlightTopN',
                params: { n: 2, order: 'descending' },
                summary: 'Highlighted top origins',
                detail: 'The analyst emphasized the strongest origin bars through the shared runtime action path.',
                override: { kind: 'barHighlightTopN', n: 2, order: 'descending' },
              })}
            >
              Highlight top 2 origins
            </button>
          </div>
        </section>
      ) : null}
      {selectedWidget?.id === 'w_line_year' ? (
        <section className="info-block">
          <h4>Line analysis</h4>
          <div className="button-column">
            <button
              type="button"
              className="ghost-toggle block"
              onClick={() => void handleRunAction({
                widgetId: 'w_line_year',
                actionName: 'line.highlightTrend',
                params: { trendType: 'regression' },
                summary: 'Highlighted overall trend',
                detail: 'The analyst overlaid a trend line on the yearly MPG chart through the shared runtime action path.',
                override: { kind: 'lineTrendHighlight', trendType: 'regression' },
              })}
            >
              Highlight trend line
            </button>
            <button
              type="button"
              className="ghost-toggle block"
              onClick={() => void handleRunAction({
                widgetId: 'w_line_year',
                actionName: 'line.showMovingAverage',
                params: { windowSize: 3 },
                summary: 'Added moving-average overlay',
                detail: 'The analyst added a trailing moving-average overlay to the line chart through the shared runtime action path.',
                override: { kind: 'lineMovingAverage', windowSize: 3 },
              })}
            >
              Show moving average
            </button>
          </div>
        </section>
      ) : null}
      {selectedWidget?.id === 'w_heatmap_origin_cyl' ? (
        <section className="info-block">
          <h4>Heatmap analysis</h4>
          <div className="button-column">
            <button
              type="button"
              className="ghost-toggle block"
              disabled={!selectedHeatmapRegion || (selectedHeatmapRegion.xValues.length === 0 && selectedHeatmapRegion.yValues.length === 0)}
              onClick={() => void handleRunAction({
                widgetId: 'w_heatmap_origin_cyl',
                actionName: 'heatmap.highlightRegion',
                params: {
                  xValues: selectedHeatmapRegion?.xValues || [],
                  yValues: selectedHeatmapRegion?.yValues || [],
                },
                summary: 'Highlighted selected heatmap region',
                detail: 'The analyst emphasized the currently selected heatmap region through the shared runtime action path.',
                override: {
                  kind: 'heatmapHighlightRegion',
                  xValues: selectedHeatmapRegion?.xValues || [],
                  yValues: selectedHeatmapRegion?.yValues || [],
                },
              })}
            >
              Highlight selected region
            </button>
            <button
              type="button"
              className="ghost-toggle block"
              disabled={analysisOrigin === 'All'}
              onClick={() => void handleRunAction({
                widgetId: 'w_heatmap_origin_cyl',
                actionName: 'heatmap.highlightRegion',
                params: { yValues: [analysisOrigin] },
                summary: `Highlighted ${analysisOrigin} heatmap row`,
                detail: `The analyst emphasized the ${analysisOrigin} row in the heatmap through the shared runtime action path.`,
                override: {
                  kind: 'heatmapHighlightRegion',
                  xValues: [],
                  yValues: [analysisOrigin],
                },
              })}
            >
              Highlight current origin row
            </button>
            <button
              type="button"
              className="ghost-toggle block"
              disabled={analysisCylinders.length === 0}
              onClick={() => void handleRunAction({
                widgetId: 'w_heatmap_origin_cyl',
                actionName: 'heatmap.highlightRegion',
                params: { xValues: analysisCylinders },
                summary: 'Highlighted selected cylinder columns',
                detail: 'The analyst emphasized the currently selected cylinder columns in the heatmap through the shared runtime action path.',
                override: {
                  kind: 'heatmapHighlightRegion',
                  xValues: analysisCylinders,
                  yValues: [],
                },
              })}
            >
              Highlight selected cylinder columns
            </button>
            <button
              type="button"
              className="ghost-toggle block"
              onClick={() => void handleRunAction({
                widgetId: 'w_heatmap_origin_cyl',
                actionName: 'heatmap.highlightRegionByValue',
                params: { minValue: heatmapHotspotThreshold },
                summary: 'Highlighted high-horsepower heatmap cells',
                detail: 'The analyst emphasized the strongest horsepower cells in the heatmap through the shared runtime action path.',
                override: {
                  kind: 'heatmapHighlightByValue',
                  minValue: heatmapHotspotThreshold,
                },
              })}
            >
              Highlight high-power hotspots
            </button>
            <button
              type="button"
              className="ghost-toggle block"
              onClick={() => void handleRunAction({
                widgetId: 'w_heatmap_origin_cyl',
                actionName: 'heatmap.clusterRowsCols',
                params: { clusterRows: true, clusterCols: true, method: 'mean' },
                summary: 'Clustered heatmap rows and columns',
                detail: 'The analyst reordered the heatmap by aggregated value through the shared runtime action path.',
                override: { kind: 'heatmapCluster', clusterRows: true, clusterCols: true, method: 'mean' },
              })}
            >
              Cluster rows and columns
            </button>
          </div>
        </section>
      ) : null}
      {selectedWidget?.id === 'w_parallel_cars' ? (
        <section className="info-block">
          <h4>Parallel analysis</h4>
          <div className="button-column">
            <button
              type="button"
              className="ghost-toggle block"
              onClick={() => void handleRunAction({
                widgetId: 'w_parallel_cars',
                actionName: 'parallelCoordinates.hideDimensions',
                params: { dimensions: ['weight', 'acceleration'], mode: 'hide' },
                summary: 'Focused parallel view on power and efficiency',
                detail: 'The analyst hid weight and acceleration to compare horsepower and MPG more directly through the shared runtime action path.',
                override: { kind: 'parallelHiddenDimensions', hiddenDimensions: ['weight', 'acceleration'] },
              })}
            >
              Focus on power vs efficiency
            </button>
            <button
              type="button"
              className="ghost-toggle block"
              onClick={() => void handleRunAction({
                widgetId: 'w_parallel_cars',
                actionName: 'parallelCoordinates.resetHiddenDimensions',
                params: {},
                summary: 'Restored all parallel dimensions',
                detail: 'The analyst restored the full parallel-coordinate dimension set through the shared runtime action path.',
                override: null,
              })}
            >
              Restore all dimensions
            </button>
          </div>
        </section>
      ) : null}
      {selectedWidget?.id === 'w_sankey_cars' ? (
        <section className="info-block">
          <h4>Sankey analysis</h4>
          <div className="button-column">
            <button
              type="button"
              className="ghost-toggle block"
              onClick={() => void handleRunAction({
                widgetId: 'w_sankey_cars',
                actionName: 'sankey.autoCollapseByRank',
                params: { topN: 2 },
                summary: 'Collapsed low-rank sankey nodes',
                detail: 'The analyst kept the largest Sankey nodes per layer and grouped the rest through the shared runtime action path.',
                override: { kind: 'sankeyAutoCollapse', topN: 2, expandedAggregateIds: [] },
              })}
            >
              Keep top 2 nodes per layer
            </button>
            <button
              type="button"
              className="ghost-toggle block"
              disabled={!selectedAggregateName}
              onClick={() => void handleRunAction({
                widgetId: 'w_sankey_cars',
                actionName: 'sankey.expandNode',
                params: { aggregateName: selectedAggregateName },
                summary: 'Expanded selected sankey aggregate',
                detail: 'The analyst re-expanded one collapsed Sankey aggregate through the shared runtime action path.',
                override: {
                  kind: 'sankeyAutoCollapse',
                  topN: 2,
                  expandedAggregateIds: [selectedAggregateName],
                },
              })}
            >
              Expand selected aggregate
            </button>
            <button
              type="button"
              className="ghost-toggle block"
              disabled={!selectedSankeyNodeName}
              onClick={() => void handleRunAction({
                widgetId: 'w_sankey_cars',
                actionName: 'sankey.traceNode',
                params: { nodeName: selectedSankeyNodeName },
                summary: 'Traced selected sankey node',
                detail: 'The analyst traced the selected Sankey node and its immediate flows through the shared runtime action path.',
                override: {
                  kind: 'sankeyTraceNode',
                  nodeName: selectedSankeyNodeName,
                },
              })}
            >
              Trace selected node
            </button>
            <button
              type="button"
              className="ghost-toggle block"
              disabled={!selectedSankeyNodeName}
              onClick={() => void handleRunAction({
                widgetId: 'w_sankey_cars',
                actionName: 'sankey.collapseNodes',
                params: { nodes: [selectedSankeyNodeName], aggregateName: `Group ${selectedSankeyNodeName}` },
                summary: 'Collapsed selected sankey node',
                detail: 'The analyst collapsed the selected Sankey node into a temporary aggregate through the shared runtime action path.',
                override: {
                  kind: 'sankeyCollapseNodes',
                  nodes: [selectedSankeyNodeName],
                  aggregateName: `Group ${selectedSankeyNodeName}`,
                },
              })}
            >
              Collapse selected node
            </button>
            <button
              type="button"
              className="ghost-toggle block"
              disabled={!sankeySelectedLayerReorder}
              onClick={() => void handleRunAction({
                widgetId: 'w_sankey_cars',
                actionName: 'sankey.reorderNodesInLayer',
                params: sankeySelectedLayerReorder,
                summary: 'Ranked selected sankey layer by flow',
                detail: 'The analyst reordered the selected Sankey layer by current flow magnitude through the shared runtime action path.',
                override: {
                  kind: 'sankeyReorderLayer',
                  depth: sankeySelectedLayerReorder.depth,
                  order: sankeySelectedLayerReorder.order,
                },
              })}
            >
              Rank selected layer by flow
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
