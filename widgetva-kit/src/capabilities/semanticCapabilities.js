const ALL_WIDGET_KINDS = Object.freeze([
  'bar',
  'line',
  'scatter',
  'parallelCoordinates',
  'sankey',
  'heatmap',
])

function freezeBinding(binding) {
  return Object.freeze({
    bindingKind: binding.bindingKind,
    name: binding.name,
    widgetKinds: Object.freeze([...(binding.widgetKinds || [])]),
  })
}

function freezeCapability(capability) {
  return Object.freeze({
    id: capability.id,
    title: capability.title,
    description: capability.description,
    semanticKind: capability.semanticKind,
    aliases: Object.freeze([...(capability.aliases || [])]),
    supportedWidgetKinds: Object.freeze([...(capability.supportedWidgetKinds || [])]),
    bindings: Object.freeze((capability.bindings || []).map(freezeBinding)),
  })
}

const SEMANTIC_CAPABILITIES = Object.freeze([
  freezeCapability({
    id: 'view.inspect',
    title: 'Inspect current view configuration',
    description: 'Read the current widget view configuration, encodings, transforms, and domains.',
    semanticKind: 'perception',
    aliases: ['view.describe', 'view.config.inspect'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'perception', name: 'perception.inspectViewConfig', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'data.visible.inspect',
    title: 'Inspect visible rows',
    description: 'Read the currently visible rows exposed by the widget.',
    semanticKind: 'perception',
    aliases: ['data.rows.inspect', 'data.visible.rows'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'perception', name: 'perception.inspectVisibleRows', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'data.rows.inspect',
    title: 'Inspect rows',
    description: 'Read row-oriented data exposed by the widget, optionally under a specific scope.',
    semanticKind: 'perception',
    aliases: ['data.inspect', 'data.get'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'perception', name: 'perception.inspectVisibleRows', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'data.visible.summarize',
    title: 'Summarize visible rows',
    description: 'Return an aggregate summary over the currently visible rows.',
    semanticKind: 'perception',
    aliases: ['data.summary.visible', 'data.inspect.summary'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'perception', name: 'perception.summarizeVisible', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'view.reset',
    title: 'Reset view state',
    description: 'Reset the current widget or workspace view back to its baseline state.',
    semanticKind: 'action',
    aliases: ['view.restoreDefault'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'workspace.resetWorkspace', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'history.undo',
    title: 'Undo prior state change',
    description: 'Navigate backward in the current interaction history.',
    semanticKind: 'action',
    aliases: ['view.undo', 'state.undo'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'workspace.jumpToState', widgetKinds: ALL_WIDGET_KINDS },
      { bindingKind: 'action', name: 'widget.undoSelection', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'selection.inspect',
    title: 'Inspect current selection',
    description: 'Read the active selection payload for a widget.',
    semanticKind: 'perception',
    aliases: ['selection.describe'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'perception', name: 'perception.inspectSelection', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'selection.summarize',
    title: 'Summarize selected rows',
    description: 'Return an aggregate summary for the active selection.',
    semanticKind: 'perception',
    aliases: ['selection.summary'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'perception', name: 'perception.summarizeSelection', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'selection.region.set',
    title: 'Set a region selection',
    description: 'Create or update a region-based selection on the current widget.',
    semanticKind: 'action',
    aliases: ['region.select', 'region.brush'],
    supportedWidgetKinds: ['scatter', 'heatmap', 'parallelCoordinates'],
    bindings: [
      { bindingKind: 'action', name: 'scatter.brushRegion', widgetKinds: ['scatter'] },
      { bindingKind: 'action', name: 'heatmap.selectSubmatrix', widgetKinds: ['heatmap'] },
      { bindingKind: 'action', name: 'parallelCoordinates.brushAxes', widgetKinds: ['parallelCoordinates'] },
      { bindingKind: 'action', name: 'widget.updateSelection', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'selection.point.set',
    title: 'Set a point or record selection',
    description: 'Create or update a discrete point/value/record selection on the current widget.',
    semanticKind: 'action',
    aliases: ['point.select', 'record.select'],
    supportedWidgetKinds: ['bar', 'line', 'heatmap', 'parallelCoordinates', 'sankey'],
    bindings: [
      { bindingKind: 'action', name: 'bar.selectCategory', widgetKinds: ['bar'] },
      { bindingKind: 'action', name: 'line.selectXValue', widgetKinds: ['line'] },
      { bindingKind: 'action', name: 'heatmap.selectCell', widgetKinds: ['heatmap'] },
      { bindingKind: 'action', name: 'parallelCoordinates.selectRecord', widgetKinds: ['parallelCoordinates'] },
      { bindingKind: 'action', name: 'sankey.focusFlow', widgetKinds: ['sankey'] },
      { bindingKind: 'action', name: 'sankey.selectAggregateNode', widgetKinds: ['sankey'] },
      { bindingKind: 'action', name: 'widget.updateSelection', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'selection.clear',
    title: 'Clear current selection',
    description: 'Remove the active widget selection.',
    semanticKind: 'action',
    aliases: ['selection.reset'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'widget.clearSelection', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'selection.undo',
    title: 'Undo selection state',
    description: 'Roll the widget selection state backward.',
    semanticKind: 'action',
    aliases: ['selection.history.undo'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'widget.undoSelection', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'selection.redo',
    title: 'Redo selection state',
    description: 'Re-apply the previously undone widget selection state.',
    semanticKind: 'action',
    aliases: ['selection.history.redo'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'widget.redoSelection', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'view.encoding.change',
    title: 'Change encoding channel',
    description: 'Rebind a visual encoding channel to a different field.',
    semanticKind: 'action',
    aliases: ['encoding.change', 'channel.rebind'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'widget.changeEncoding', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'view.domain.zoom',
    title: 'Zoom the view domain',
    description: 'Zoom a widget to a requested x and/or y domain.',
    semanticKind: 'action',
    aliases: ['domain.zoom', 'view.zoom'],
    supportedWidgetKinds: ['scatter', 'line'],
    bindings: [
      { bindingKind: 'action', name: 'widget.zoomDomain', widgetKinds: ALL_WIDGET_KINDS },
      { bindingKind: 'action', name: 'scatter.zoomDomain', widgetKinds: ['scatter'] },
      { bindingKind: 'action', name: 'line.zoomXRegion', widgetKinds: ['line'] },
    ],
  }),
  freezeCapability({
    id: 'data.aggregate',
    title: 'Aggregate visible data',
    description: 'Compute grouped aggregate rows inside the widget runtime.',
    semanticKind: 'action',
    aliases: ['data.groupby.aggregate', 'aggregate.apply'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'widget.aggregateData', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'data.filter.categorical',
    title: 'Filter by categorical values',
    description: 'Filter rows by explicit category membership.',
    semanticKind: 'action',
    aliases: ['filter.category', 'filter.values.include'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'widget.filterByValues', widgetKinds: ALL_WIDGET_KINDS },
      { bindingKind: 'action', name: 'bar.filterCategories', widgetKinds: ['bar'] },
      { bindingKind: 'action', name: 'parallelCoordinates.filterByCategory', widgetKinds: ['parallelCoordinates'] },
    ],
  }),
  freezeCapability({
    id: 'data.filter.range',
    title: 'Filter by numeric or temporal range',
    description: 'Filter rows by a continuous interval on one field.',
    semanticKind: 'action',
    aliases: ['filter.range', 'filter.interval'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'widget.filterByRange', widgetKinds: ALL_WIDGET_KINDS },
      { bindingKind: 'action', name: 'parallelCoordinates.filterDimension', widgetKinds: ['parallelCoordinates'] },
    ],
  }),
  freezeCapability({
    id: 'data.highlight.values',
    title: 'Highlight rows by values',
    description: 'Highlight data rows that match one or more requested values.',
    semanticKind: 'action',
    aliases: ['highlight.values', 'focus.values'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'widget.highlightValues', widgetKinds: ALL_WIDGET_KINDS },
      { bindingKind: 'action', name: 'parallelCoordinates.highlightCategory', widgetKinds: ['parallelCoordinates'] },
    ],
  }),
  freezeCapability({
    id: 'view.sort.encoding',
    title: 'Sort an encoding channel',
    description: 'Update ordering for an encoding channel or grouped bars.',
    semanticKind: 'action',
    aliases: ['encoding.sort', 'order.encoding'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'widget.sortEncoding', widgetKinds: ALL_WIDGET_KINDS },
      { bindingKind: 'action', name: 'bar.sortBars', widgetKinds: ['bar'] },
      { bindingKind: 'action', name: 'sankey.reorderNodesInLayer', widgetKinds: ['sankey'] },
      { bindingKind: 'action', name: 'parallelCoordinates.reorderDimensions', widgetKinds: ['parallelCoordinates'] },
    ],
  }),
  freezeCapability({
    id: 'analysis.distribution.inspect',
    title: 'Inspect distribution structure',
    description: 'Inspect the distributional shape, density, or spread of visible data.',
    semanticKind: 'perception',
    aliases: ['distribution.inspect', 'scatter.distribution.inspect'],
    supportedWidgetKinds: ['scatter'],
    bindings: [
      { bindingKind: 'perception', name: 'perception.summarizeVisible', widgetKinds: ['scatter'] },
      { bindingKind: 'perception', name: 'perception.inspectVisibleRows', widgetKinds: ['scatter'] },
    ],
  }),
  freezeCapability({
    id: 'analysis.extremes.find',
    title: 'Find extreme values',
    description: 'Locate highest, lowest, or both extremes from the visible data.',
    semanticKind: 'perception',
    aliases: ['extremes.find', 'values.extreme.inspect'],
    supportedWidgetKinds: ['bar', 'line', 'scatter', 'heatmap', 'sankey'],
    bindings: [
      { bindingKind: 'perception', name: 'perception.findExtremes', widgetKinds: ['bar', 'line', 'scatter', 'heatmap', 'sankey'] },
    ],
  }),
  freezeCapability({
    id: 'analysis.outliers.find',
    title: 'Find outliers',
    description: 'Locate outlier rows among the visible data.',
    semanticKind: 'perception',
    aliases: ['outliers.find'],
    supportedWidgetKinds: ['line', 'scatter', 'heatmap', 'parallelCoordinates'],
    bindings: [
      { bindingKind: 'perception', name: 'perception.findOutliers', widgetKinds: ['scatter', 'heatmap', 'parallelCoordinates'] },
    ],
  }),
  freezeCapability({
    id: 'analysis.compare.groups',
    title: 'Compare groups',
    description: 'Produce a grouped comparison summary from the visible data.',
    semanticKind: 'perception',
    aliases: ['groups.compare', 'comparison.groups'],
    supportedWidgetKinds: ['bar', 'line', 'sankey'],
    bindings: [
      { bindingKind: 'perception', name: 'perception.compareGroups', widgetKinds: ['bar', 'line', 'sankey'] },
    ],
  }),
  freezeCapability({
    id: 'analysis.correlation.compute',
    title: 'Compute correlation',
    description: 'Estimate the relationship strength between two quantitative fields.',
    semanticKind: 'perception',
    aliases: ['correlation.compute'],
    supportedWidgetKinds: ['scatter'],
    bindings: [
      { bindingKind: 'perception', name: 'perception.computeCorrelation', widgetKinds: ['scatter'] },
    ],
  }),
  freezeCapability({
    id: 'analysis.clusters.identify',
    title: 'Identify clusters',
    description: 'Derive cluster labels and project them back into the visualization.',
    semanticKind: 'action',
    aliases: ['clusters.identify', 'segmentation.identify'],
    supportedWidgetKinds: ['scatter', 'heatmap'],
    bindings: [
      { bindingKind: 'action', name: 'scatter.identifyClusters', widgetKinds: ['scatter'] },
      { bindingKind: 'action', name: 'heatmap.clusterRowsCols', widgetKinds: ['heatmap'] },
    ],
  }),
  freezeCapability({
    id: 'analysis.regression.show',
    title: 'Show regression overlay',
    description: 'Overlay a fitted regression line on the active chart.',
    semanticKind: 'action',
    aliases: ['regression.show', 'trendline.show'],
    supportedWidgetKinds: ['scatter'],
    bindings: [
      { bindingKind: 'action', name: 'scatter.showRegression', widgetKinds: ['scatter'] },
    ],
  }),
  freezeCapability({
    id: 'analysis.anomalies.detect',
    title: 'Detect anomalies',
    description: 'Detect anomalous points or segments in the visible series.',
    semanticKind: 'perception',
    aliases: ['anomalies.detect'],
    supportedWidgetKinds: ['line'],
    bindings: [
      { bindingKind: 'perception', name: 'perception.detectAnomalies', widgetKinds: ['line'] },
    ],
  }),
  freezeCapability({
    id: 'ranking.topN.highlight',
    title: 'Highlight top-N values',
    description: 'Highlight the top-ranked items under the current sort order.',
    semanticKind: 'action',
    aliases: ['topN.highlight', 'ranking.highlight'],
    supportedWidgetKinds: ['bar'],
    bindings: [
      { bindingKind: 'action', name: 'bar.highlightTopN', widgetKinds: ['bar'] },
    ],
  }),
  freezeCapability({
    id: 'view.stack.expand',
    title: 'Expand a stacked group',
    description: 'Explode one stacked category into a direct side-by-side comparison.',
    semanticKind: 'action',
    aliases: ['stack.expand'],
    supportedWidgetKinds: ['bar'],
    bindings: [
      { bindingKind: 'action', name: 'bar.expandStack', widgetKinds: ['bar'] },
    ],
  }),
  freezeCapability({
    id: 'view.stackMode.set',
    title: 'Set stack mode',
    description: 'Switch between grouped and stacked bar composition.',
    semanticKind: 'action',
    aliases: ['stackMode.set', 'bar.mode.set'],
    supportedWidgetKinds: ['bar'],
    bindings: [
      { bindingKind: 'action', name: 'bar.toggleStackMode', widgetKinds: ['bar'] },
    ],
  }),
  freezeCapability({
    id: 'data.category.add',
    title: 'Add categorical groups',
    description: 'Add back hidden top-level categories into the current view.',
    semanticKind: 'action',
    aliases: ['category.add', 'bars.add'],
    supportedWidgetKinds: ['bar'],
    bindings: [
      { bindingKind: 'action', name: 'bar.addBars', widgetKinds: ['bar'] },
    ],
  }),
  freezeCapability({
    id: 'data.category.remove',
    title: 'Remove categorical groups',
    description: 'Hide one or more top-level categories from the current view.',
    semanticKind: 'action',
    aliases: ['category.remove', 'bars.remove'],
    supportedWidgetKinds: ['bar'],
    bindings: [
      { bindingKind: 'action', name: 'bar.removeBars', widgetKinds: ['bar'] },
    ],
  }),
  freezeCapability({
    id: 'data.subcategory.add',
    title: 'Add grouped items',
    description: 'Add back grouped or stacked sub-items to the view.',
    semanticKind: 'action',
    aliases: ['subcategory.add', 'bar.items.add'],
    supportedWidgetKinds: ['bar'],
    bindings: [
      { bindingKind: 'action', name: 'bar.addBarItems', widgetKinds: ['bar'] },
    ],
  }),
  freezeCapability({
    id: 'data.subcategory.remove',
    title: 'Remove grouped items',
    description: 'Hide grouped or stacked sub-items from the view.',
    semanticKind: 'action',
    aliases: ['subcategory.remove', 'bar.items.remove'],
    supportedWidgetKinds: ['bar'],
    bindings: [
      { bindingKind: 'action', name: 'bar.removeBarItems', widgetKinds: ['bar'] },
    ],
  }),
  freezeCapability({
    id: 'data.filter.subcategory',
    title: 'Filter subcategories',
    description: 'Exclude one or more grouped/stacked subcategories.',
    semanticKind: 'action',
    aliases: ['filter.subcategory'],
    supportedWidgetKinds: ['bar'],
    bindings: [
      { bindingKind: 'action', name: 'bar.filterSubcategories', widgetKinds: ['bar'] },
    ],
  }),
  freezeCapability({
    id: 'line.series.focus',
    title: 'Focus line series',
    description: 'Bring one or more line series into focus while deemphasizing others.',
    semanticKind: 'action',
    aliases: ['series.focus', 'line.focus'],
    supportedWidgetKinds: ['line'],
    bindings: [
      { bindingKind: 'action', name: 'line.focusLines', widgetKinds: ['line'] },
      { bindingKind: 'action', name: 'line.boldLines', widgetKinds: ['line'] },
      { bindingKind: 'action', name: 'line.selectSeries', widgetKinds: ['line'] },
      { bindingKind: 'action', name: 'line.selectXValue', widgetKinds: ['line'] },
    ],
  }),
  freezeCapability({
    id: 'line.series.filter',
    title: 'Filter line series',
    description: 'Hide one or more named line series.',
    semanticKind: 'action',
    aliases: ['series.filter', 'line.filter'],
    supportedWidgetKinds: ['line'],
    bindings: [
      { bindingKind: 'action', name: 'line.filterLines', widgetKinds: ['line'] },
    ],
  }),
  freezeCapability({
    id: 'line.trend.highlight',
    title: 'Highlight trend segments',
    description: 'Highlight increasing, decreasing, or other trend signatures in a line chart.',
    semanticKind: 'action',
    aliases: ['trend.highlight', 'line.trend.highlight'],
    supportedWidgetKinds: ['line'],
    bindings: [
      { bindingKind: 'action', name: 'line.highlightTrend', widgetKinds: ['line'] },
    ],
  }),
  freezeCapability({
    id: 'line.movingAverage.show',
    title: 'Show moving average',
    description: 'Overlay a moving average series on top of the current line chart.',
    semanticKind: 'action',
    aliases: ['movingAverage.show', 'line.smooth.show'],
    supportedWidgetKinds: ['line'],
    bindings: [
      { bindingKind: 'action', name: 'line.showMovingAverage', widgetKinds: ['line'] },
    ],
  }),
  freezeCapability({
    id: 'axis.x.drilldown',
    title: 'Drill down x-axis granularity',
    description: 'Move from a coarse temporal grouping to a finer x-axis grouping.',
    semanticKind: 'action',
    aliases: ['xAxis.drilldown', 'axis.drilldown.x'],
    supportedWidgetKinds: ['line'],
    bindings: [
      { bindingKind: 'action', name: 'line.drillDownXAxis', widgetKinds: ['line'] },
    ],
  }),
  freezeCapability({
    id: 'axis.x.drilldown.reset',
    title: 'Reset x-axis drilldown',
    description: 'Restore the original x-axis temporal grouping.',
    semanticKind: 'action',
    aliases: ['xAxis.drilldown.reset'],
    supportedWidgetKinds: ['line'],
    bindings: [
      { bindingKind: 'action', name: 'line.resetDrilldownXAxis', widgetKinds: ['line'] },
    ],
  }),
  freezeCapability({
    id: 'axis.x.resample',
    title: 'Resample x-axis',
    description: 'Resample the x-axis to a different temporal bucket or stride.',
    semanticKind: 'action',
    aliases: ['xAxis.resample'],
    supportedWidgetKinds: ['line'],
    bindings: [
      { bindingKind: 'action', name: 'line.resampleXAxis', widgetKinds: ['line'] },
    ],
  }),
  freezeCapability({
    id: 'axis.x.resample.reset',
    title: 'Reset x-axis resampling',
    description: 'Restore the original x-axis resolution after resampling.',
    semanticKind: 'action',
    aliases: ['xAxis.resample.reset'],
    supportedWidgetKinds: ['line'],
    bindings: [
      { bindingKind: 'action', name: 'line.resetResampleXAxis', widgetKinds: ['line'] },
    ],
  }),
  freezeCapability({
    id: 'heatmap.cells.filter',
    title: 'Filter heatmap cells',
    description: 'Filter heatmap cells by explicit row/column membership or thresholds.',
    semanticKind: 'action',
    aliases: ['heatmap.filter.cells'],
    supportedWidgetKinds: ['heatmap'],
    bindings: [
      { bindingKind: 'action', name: 'heatmap.filterCells', widgetKinds: ['heatmap'] },
      { bindingKind: 'action', name: 'heatmap.filterCellsByRegion', widgetKinds: ['heatmap'] },
    ],
  }),
  freezeCapability({
    id: 'heatmap.region.highlight',
    title: 'Highlight heatmap region',
    description: 'Highlight a region or matching value pattern inside a heatmap.',
    semanticKind: 'action',
    aliases: ['heatmap.highlight.region'],
    supportedWidgetKinds: ['heatmap'],
    bindings: [
      { bindingKind: 'action', name: 'heatmap.highlightRegion', widgetKinds: ['heatmap'] },
      { bindingKind: 'action', name: 'heatmap.highlightRegionByValue', widgetKinds: ['heatmap'] },
    ],
  }),
  freezeCapability({
    id: 'heatmap.colorScale.adjust',
    title: 'Adjust heatmap color scale',
    description: 'Change the heatmap color scheme or domain.',
    semanticKind: 'action',
    aliases: ['colorScale.adjust', 'heatmap.scale.adjust'],
    supportedWidgetKinds: ['heatmap'],
    bindings: [
      { bindingKind: 'action', name: 'heatmap.adjustColorScale', widgetKinds: ['heatmap'] },
    ],
  }),
  freezeCapability({
    id: 'heatmap.threshold.mask',
    title: 'Mask by threshold',
    description: 'Mask or suppress heatmap cells based on a threshold rule.',
    semanticKind: 'action',
    aliases: ['threshold.mask'],
    supportedWidgetKinds: ['heatmap'],
    bindings: [
      { bindingKind: 'action', name: 'heatmap.thresholdMask', widgetKinds: ['heatmap'] },
    ],
  }),
  freezeCapability({
    id: 'heatmap.axis.drilldown',
    title: 'Drill down heatmap axis',
    description: 'Drill down one heatmap axis to a finer granularity.',
    semanticKind: 'action',
    aliases: ['heatmap.drilldown'],
    supportedWidgetKinds: ['heatmap'],
    bindings: [
      { bindingKind: 'action', name: 'heatmap.drilldownAxis', widgetKinds: ['heatmap'] },
      { bindingKind: 'action', name: 'heatmap.resetDrilldown', widgetKinds: ['heatmap'] },
    ],
  }),
  freezeCapability({
    id: 'heatmap.marginals.add',
    title: 'Add marginal summaries',
    description: 'Add marginal bar summaries to the heatmap.',
    semanticKind: 'action',
    aliases: ['marginals.add'],
    supportedWidgetKinds: ['heatmap'],
    bindings: [
      { bindingKind: 'action', name: 'heatmap.addMarginalBars', widgetKinds: ['heatmap'] },
    ],
  }),
  freezeCapability({
    id: 'heatmap.transpose',
    title: 'Transpose heatmap axes',
    description: 'Swap the row and column axes of the heatmap.',
    semanticKind: 'action',
    aliases: ['axes.transpose'],
    supportedWidgetKinds: ['heatmap'],
    bindings: [
      { bindingKind: 'action', name: 'heatmap.transpose', widgetKinds: ['heatmap'] },
    ],
  }),
  freezeCapability({
    id: 'parallel.dimensions.hide',
    title: 'Hide parallel dimensions',
    description: 'Temporarily hide one or more parallel-coordinate dimensions.',
    semanticKind: 'action',
    aliases: ['parallel.hide.dimensions'],
    supportedWidgetKinds: ['parallelCoordinates'],
    bindings: [
      { bindingKind: 'action', name: 'parallelCoordinates.hideDimensions', widgetKinds: ['parallelCoordinates'] },
      { bindingKind: 'action', name: 'parallelCoordinates.resetHiddenDimensions', widgetKinds: ['parallelCoordinates'] },
    ],
  }),
  freezeCapability({
    id: 'sankey.flow.filter',
    title: 'Filter sankey flows',
    description: 'Filter or focus flows in a sankey diagram based on value or path.',
    semanticKind: 'action',
    aliases: ['flow.filter', 'sankey.filter'],
    supportedWidgetKinds: ['sankey'],
    bindings: [
      { bindingKind: 'action', name: 'sankey.filterFlow', widgetKinds: ['sankey'] },
      { bindingKind: 'action', name: 'sankey.focusFlow', widgetKinds: ['sankey'] },
    ],
  }),
  freezeCapability({
    id: 'sankey.node.collapse',
    title: 'Collapse or expand sankey nodes',
    description: 'Collapse low-value sankey nodes or expand a previously collapsed node.',
    semanticKind: 'action',
    aliases: ['node.collapse', 'node.expand'],
    supportedWidgetKinds: ['sankey'],
    bindings: [
      { bindingKind: 'action', name: 'sankey.collapseNodes', widgetKinds: ['sankey'] },
      { bindingKind: 'action', name: 'sankey.expandNode', widgetKinds: ['sankey'] },
      { bindingKind: 'action', name: 'sankey.autoCollapseByRank', widgetKinds: ['sankey'] },
    ],
  }),
  freezeCapability({
    id: 'sankey.path.highlight',
    title: 'Highlight or trace sankey paths',
    description: 'Highlight a named path or trace neighborhood flows from a node.',
    semanticKind: 'action',
    aliases: ['path.highlight', 'path.trace'],
    supportedWidgetKinds: ['sankey'],
    bindings: [
      { bindingKind: 'action', name: 'sankey.highlightPath', widgetKinds: ['sankey'] },
      { bindingKind: 'action', name: 'sankey.traceNode', widgetKinds: ['sankey'] },
      { bindingKind: 'action', name: 'sankey.colorFlows', widgetKinds: ['sankey'] },
    ],
  }),
  freezeCapability({
    id: 'sankey.node.options',
    title: 'Inspect sankey node options',
    description: 'Return structural node options for the current sankey graph.',
    semanticKind: 'perception',
    aliases: ['node.options.inspect'],
    supportedWidgetKinds: ['sankey'],
    bindings: [
      { bindingKind: 'perception', name: 'perception.getNodeOptions', widgetKinds: ['sankey'] },
    ],
  }),
  freezeCapability({
    id: 'sankey.conversionRate.calculate',
    title: 'Calculate sankey conversion rates',
    description: 'Compute node-level conversion rates across the sankey flow network.',
    semanticKind: 'perception',
    aliases: ['conversionRate.calculate'],
    supportedWidgetKinds: ['sankey'],
    bindings: [
      { bindingKind: 'perception', name: 'perception.calculateConversionRate', widgetKinds: ['sankey'] },
    ],
  }),
  freezeCapability({
    id: 'sankey.bottleneck.find',
    title: 'Find sankey bottlenecks',
    description: 'Find high-loss or constrained nodes in the sankey flow network.',
    semanticKind: 'perception',
    aliases: ['bottleneck.find'],
    supportedWidgetKinds: ['sankey'],
    bindings: [
      { bindingKind: 'perception', name: 'perception.findBottleneck', widgetKinds: ['sankey'] },
    ],
  }),
  freezeCapability({
    id: 'workspace.focus',
    title: 'Focus one widget in the workspace',
    description: 'Set the workspace-level focused widget pointer.',
    semanticKind: 'action',
    aliases: ['workspace.focusWidget'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'workspace.focusWidget', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'workspace.annotation.write',
    title: 'Write workspace annotations',
    description: 'Create or clear workspace-level annotations.',
    semanticKind: 'action',
    aliases: ['workspace.annotation.add', 'workspace.annotation.clear'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'workspace.addAnnotation', widgetKinds: ALL_WIDGET_KINDS },
      { bindingKind: 'action', name: 'workspace.clearAnnotations', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'workspace.state.reset',
    title: 'Reset workspace state',
    description: 'Reset workspace coordination state to a clean baseline.',
    semanticKind: 'action',
    aliases: ['workspace.reset'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'workspace.resetWorkspace', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'workspace.history.navigate',
    title: 'Navigate workspace state history',
    description: 'Jump to or branch from a historical workspace state.',
    semanticKind: 'action',
    aliases: ['workspace.jump', 'workspace.branch'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'action', name: 'workspace.jumpToState', widgetKinds: ALL_WIDGET_KINDS },
      { bindingKind: 'action', name: 'workspace.branchFromState', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
  freezeCapability({
    id: 'action.effect.verify',
    title: 'Verify action effect',
    description: 'Check whether a prior action had the expected effect on state or visible output.',
    semanticKind: 'perception',
    aliases: ['effect.verify', 'action.verify'],
    supportedWidgetKinds: ALL_WIDGET_KINDS,
    bindings: [
      { bindingKind: 'perception', name: 'perception.verifyActionEffect', widgetKinds: ALL_WIDGET_KINDS },
    ],
  }),
])

const CAPABILITY_BY_ID = new Map()
for (const capability of SEMANTIC_CAPABILITIES) {
  CAPABILITY_BY_ID.set(capability.id, capability)
  for (const alias of capability.aliases) {
    CAPABILITY_BY_ID.set(alias, capability)
  }
}

const ADVANCED_RESPONSE_CAPABILITY_IDS = Object.freeze({
  drillDown: ['axis.x.drilldown', 'heatmap.axis.drilldown'],
  reencode: ['heatmap.transpose', 'view.sort.encoding'],
  aggregate: ['axis.x.resample', 'analysis.clusters.identify', 'sankey.node.collapse'],
  expand: ['sankey.node.collapse'],
  collapse: ['sankey.node.collapse'],
})

function matchesWidgetKind(candidateKinds, widgetKind) {
  if (!widgetKind) return true
  return Array.isArray(candidateKinds) && candidateKinds.includes(widgetKind)
}

export function listSemanticCapabilities({ widgetKind = null, semanticKind = null } = {}) {
  return SEMANTIC_CAPABILITIES.filter((capability) => {
    if (semanticKind && capability.semanticKind !== semanticKind) return false
    return matchesWidgetKind(capability.supportedWidgetKinds, widgetKind)
  })
}

export function getSemanticCapability(idOrAlias) {
  if (typeof idOrAlias !== 'string' || idOrAlias.length === 0) return null
  return CAPABILITY_BY_ID.get(idOrAlias) || null
}

export function resolveSemanticCapabilityBindings({ semanticId, widgetKind = null, bindingKind = null } = {}) {
  const capability = getSemanticCapability(semanticId)
  if (!capability) return []
  return capability.bindings.filter((binding) => {
    if (bindingKind && binding.bindingKind !== bindingKind) return false
    return matchesWidgetKind(binding.widgetKinds, widgetKind)
  })
}

export function resolveAdvancedResponseCapabilities({ widgetKind = null, responseKind = null } = {}) {
  const capabilityIds = ADVANCED_RESPONSE_CAPABILITY_IDS[responseKind] || []
  return capabilityIds
    .map((id) => getSemanticCapability(id))
    .filter((capability) => capability && matchesWidgetKind(capability.supportedWidgetKinds, widgetKind))
}

export function supportsAdvancedResponseCapability({ widgetKind = null, responseKind = null } = {}) {
  return resolveAdvancedResponseCapabilities({ widgetKind, responseKind }).length > 0
}

export function describeWidgetSemanticSurface(widgetKind) {
  return {
    widgetKind,
    capabilities: listSemanticCapabilities({ widgetKind }).map((capability) => ({
      ...capability,
      bindings: resolveSemanticCapabilityBindings({ semanticId: capability.id, widgetKind }),
    })),
  }
}

export {
  ALL_WIDGET_KINDS,
  SEMANTIC_CAPABILITIES,
}
