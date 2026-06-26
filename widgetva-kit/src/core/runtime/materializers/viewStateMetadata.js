function isNumericDomain(domain) {
  return Array.isArray(domain)
    && domain.length >= 2
    && typeof domain[0] === 'number'
    && typeof domain[1] === 'number'
}

function midpoint(domain) {
  if (!isNumericDomain(domain)) return null
  return (domain[0] + domain[1]) / 2
}

function span(domain) {
  if (!isNumericDomain(domain)) return null
  return Math.abs(domain[1] - domain[0])
}

function getDataExtent(rows, field) {
  if (!Array.isArray(rows) || typeof field !== 'string' || field.length === 0) return null
  const values = rows
    .map((row) => row?.[field])
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
  if (values.length === 0) return null
  return [Math.min(...values), Math.max(...values)]
}

function inferZoomLevel({ currentDomain, baselineDomain }) {
  const currentSpan = span(currentDomain)
  const baselineSpan = span(baselineDomain)
  if (!currentSpan || !baselineSpan || currentSpan <= 0 || baselineSpan <= 0) return null
  return Number((baselineSpan / currentSpan).toFixed(4))
}

function stableSerialize(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function appendHighlightEntry(entries, nextEntry) {
  const signature = stableSerialize(nextEntry)
  if (entries.some((entry) => stableSerialize(entry) === signature)) {
    return
  }
  entries.push(nextEntry)
}

export function buildViewZoomState({ widgetSpec, xDomain, yDomain }) {
  const nextXDomain = Array.isArray(xDomain) ? xDomain : null
  const nextYDomain = Array.isArray(yDomain) ? yDomain : null
  if (!nextXDomain && !nextYDomain) return null

  const rows = Array.isArray(widgetSpec?.data?.values) ? widgetSpec.data.values : []
  const xField = widgetSpec?.encoding?.x?.field
  const yField = widgetSpec?.encoding?.y?.field

  const baselineXDomain = getDataExtent(rows, xField)
  const baselineYDomain = getDataExtent(rows, yField)

  const centerX = midpoint(nextXDomain)
  const centerY = midpoint(nextYDomain)
  const xLevel = inferZoomLevel({ currentDomain: nextXDomain, baselineDomain: baselineXDomain })
  const yLevel = inferZoomLevel({ currentDomain: nextYDomain, baselineDomain: baselineYDomain })
  const levelCandidates = [xLevel, yLevel].filter((value) => typeof value === 'number' && Number.isFinite(value))

  const zoom = {}
  if (centerX != null && centerY != null) {
    zoom.center = [centerX, centerY]
  }
  if (levelCandidates.length > 0) {
    zoom.level = Number((levelCandidates.reduce((sum, value) => sum + value, 0) / levelCandidates.length).toFixed(4))
  }

  return Object.keys(zoom).length > 0 ? zoom : null
}

export function buildViewHighlightState({ widgetSpec }) {
  const entries = []

  const inspectEncoding = (encoding, scope = 'root', layerIndex = null) => {
    if (!encoding || typeof encoding !== 'object' || Array.isArray(encoding)) return
    for (const [channel, channelSpec] of Object.entries(encoding)) {
      if (!channelSpec || typeof channelSpec !== 'object' || Array.isArray(channelSpec)) continue
      if (!Object.prototype.hasOwnProperty.call(channelSpec, 'condition')) continue
      appendHighlightEntry(entries, {
        source: 'encoding',
        channel,
        scope,
        ...(layerIndex != null ? { layerIndex } : {}),
      })
    }
  }

  inspectEncoding(widgetSpec?.encoding, 'root', null)

  if (Array.isArray(widgetSpec?.layer)) {
    widgetSpec.layer.forEach((layer, layerIndex) => {
      inspectEncoding(layer?.encoding, 'layer', layerIndex)
    })
  }

  for (const mark of Array.isArray(widgetSpec?.marks) ? widgetSpec.marks : []) {
    const updateEncoding = mark?.encode?.update
    if (!updateEncoding || typeof updateEncoding !== 'object' || Array.isArray(updateEncoding)) continue
    for (const [channel, channelSpec] of Object.entries(updateEncoding)) {
      if (!channelSpec || typeof channelSpec !== 'object' || Array.isArray(channelSpec)) continue
      if (!Object.prototype.hasOwnProperty.call(channelSpec, 'signal')) continue
      appendHighlightEntry(entries, {
        source: 'mark',
        channel,
        markName: typeof mark?.name === 'string' ? mark.name : null,
      })
    }
  }

  if (entries.length === 0) return null

  return {
    channels: [...new Set(entries.map((entry) => entry.channel))],
    entries,
  }
}

function normalizeDrillParent(parent) {
  if (!parent || typeof parent !== 'object' || Array.isArray(parent)) return null
  const nextParent = {}
  if (Number.isFinite(parent.year)) nextParent.year = Number(parent.year)
  if (Number.isFinite(parent.month)) nextParent.month = Number(parent.month)
  if (Number.isFinite(parent.date)) nextParent.date = Number(parent.date)
  return Object.keys(nextParent).length > 0 ? nextParent : null
}

function inferDrillLevel(parent) {
  if (!parent || typeof parent !== 'object') return null
  if (Number.isFinite(parent.date)) return 'date'
  if (Number.isFinite(parent.month)) return 'month'
  if (Number.isFinite(parent.year)) return 'year'
  return null
}

export function buildViewDrillDownState({ widgetSpec }) {
  const lineDrillState = widgetSpec?._line_drilldown_state
  if (lineDrillState && typeof lineDrillState === 'object') {
    const parent = normalizeDrillParent(lineDrillState.parent)
    const level = inferDrillLevel(parent)
    const targetField = typeof widgetSpec?.encoding?.x?.field === 'string'
      ? widgetSpec.encoding.x.field
      : null
    if (!level || !targetField) return null
    return {
      axis: 'x',
      active: true,
      level,
      parent,
      targetField,
    }
  }

  const heatmapState = widgetSpec?._heatmap_state
  if (heatmapState && typeof heatmapState === 'object') {
    const parent = normalizeDrillParent(heatmapState.parent)
    const level = inferDrillLevel(parent)
    const targetField = typeof widgetSpec?.encoding?.x?.field === 'string'
      ? widgetSpec.encoding.x.field
      : null
    if (!level || !targetField) return null
    return {
      axis: 'x',
      active: true,
      level,
      parent,
      targetField,
    }
  }

  return null
}

export function buildViewAggregateState({ widgetSpec }) {
  const resampleState = widgetSpec?._resample_state
  if (resampleState && typeof resampleState === 'object') {
    const granularity = typeof resampleState.current_granularity === 'string'
      ? resampleState.current_granularity
      : null
    const agg = typeof resampleState.current_agg === 'string'
      ? resampleState.current_agg
      : null
    const timeField = typeof widgetSpec?.encoding?.x?.field === 'string'
      ? widgetSpec.encoding.x.field
      : null
    const valueField = typeof widgetSpec?.encoding?.y?.field === 'string'
      ? widgetSpec.encoding.y.field
      : null
    if (!granularity || !agg || !timeField || !valueField) return null
    return {
      mode: 'resample',
      axis: 'x',
      granularity,
      agg,
      timeField,
      valueField,
    }
  }

  const clusterState = widgetSpec?._cluster_rows_cols_state
  if (clusterState && typeof clusterState === 'object') {
    const method = typeof clusterState.method === 'string' ? clusterState.method : null
    const colorField = typeof clusterState.color_field === 'string' ? clusterState.color_field : null
    if (!method || !colorField) return null
    return {
      mode: 'clusterRowsCols',
      clusterRows: clusterState.cluster_rows !== false,
      clusterCols: clusterState.cluster_cols !== false,
      method,
      colorField,
    }
  }

  const sankeyAggregateState = widgetSpec?._sankey_aggregate_state
  if (sankeyAggregateState && typeof sankeyAggregateState === 'object') {
    const mode = typeof sankeyAggregateState.mode === 'string' ? sankeyAggregateState.mode : null
    if (!mode) return null
    if (mode === 'collapseNodes') {
      return {
        mode,
        aggregateName: sankeyAggregateState.aggregate_name || null,
        collapsedNodes: Array.isArray(sankeyAggregateState.collapsed_nodes)
          ? [...sankeyAggregateState.collapsed_nodes]
          : [],
      }
    }
    if (mode === 'autoCollapseByRank') {
      return {
        mode,
        topN: Number.isFinite(sankeyAggregateState.top_n) ? sankeyAggregateState.top_n : null,
        collapsedGroups: Array.isArray(sankeyAggregateState.collapsed_groups)
          ? sankeyAggregateState.collapsed_groups.map((group) => ({
              depth: group?.depth,
              aggregateName: group?.aggregate_name || null,
              collapsedNodes: Array.isArray(group?.collapsed_nodes) ? [...group.collapsed_nodes] : [],
            }))
          : [],
      }
    }
  }

  return null
}

export function buildViewReencodeState({ widgetSpec }) {
  const stackMode = typeof widgetSpec?._stack_mode === 'string'
    ? widgetSpec._stack_mode
    : null
  if (stackMode) {
    return {
      mode: 'stackMode',
      layout: stackMode,
      colorField: typeof widgetSpec?.encoding?.color?.field === 'string'
        ? widgetSpec.encoding.color.field
        : null,
    }
  }

  const colorScaleState = widgetSpec?._color_scale_state
  if (colorScaleState && typeof colorScaleState === 'object') {
    const scheme = typeof colorScaleState.scheme === 'string' ? colorScaleState.scheme : null
    const channel = typeof colorScaleState.channel === 'string' ? colorScaleState.channel : 'color'
    const domain = Array.isArray(colorScaleState.domain) ? [...colorScaleState.domain] : null
    if (!scheme) return null
    return {
      mode: 'colorScale',
      channel,
      scheme,
      ...(domain ? { domain } : {}),
    }
  }

  const transposeState = widgetSpec?._transpose_state
  if (transposeState && typeof transposeState === 'object' && transposeState.transposed === true) {
    return {
      mode: 'transpose',
      transposed: true,
    }
  }

  const barExpandStackState = widgetSpec?._bar_expand_stack_state
  if (barExpandStackState && typeof barExpandStackState === 'object') {
    return {
      mode: 'expandStack',
      category: barExpandStackState.category ?? null,
      categoryField: barExpandStackState.category_field || null,
      groupField: barExpandStackState.group_field || null,
    }
  }

  const parallelReencodeState = widgetSpec?._pc_reencode_state
  if (parallelReencodeState && typeof parallelReencodeState === 'object') {
    return {
      mode: parallelReencodeState.mode || 'dimensionVisibility',
      sourceAction: parallelReencodeState.sourceAction || null,
      operation: parallelReencodeState.operation || null,
      hiddenDimensions: Array.isArray(parallelReencodeState.hidden_dimensions)
        ? [...parallelReencodeState.hidden_dimensions]
        : [],
      visibleDimensions: Array.isArray(parallelReencodeState.visible_dimensions)
        ? [...parallelReencodeState.visible_dimensions]
        : [],
    }
  }

  const sankeyReencodeState = widgetSpec?._sankey_reencode_state
  if (sankeyReencodeState && typeof sankeyReencodeState === 'object') {
    const mode = typeof sankeyReencodeState.mode === 'string' ? sankeyReencodeState.mode : null
    if (!mode) return null
    if (mode === 'colorFlows') {
      return {
        mode,
        nodes: Array.isArray(sankeyReencodeState.nodes) ? [...sankeyReencodeState.nodes] : [],
        color: sankeyReencodeState.color || null,
      }
    }
    if (mode === 'reorderNodesInLayer') {
      return {
        mode,
        depth: Number.isFinite(sankeyReencodeState.depth) ? sankeyReencodeState.depth : null,
        order: Array.isArray(sankeyReencodeState.order) ? [...sankeyReencodeState.order] : [],
      }
    }
  }

  return null
}

export function buildViewAnnotateState({ widgetSpec }) {
  const layers = Array.isArray(widgetSpec?.layer) ? widgetSpec.layer : []
  if (layers.some((layer) => layer?._widgetvaTag === 'line.highlightTrend')) {
    return {
      mode: 'regressionOverlay',
      sourceAction: 'line.highlightTrend',
    }
  }
  if (layers.some((layer) => layer?._widgetvaTag === 'scatter.showRegression')) {
    return {
      mode: 'regressionOverlay',
      sourceAction: 'scatter.showRegression',
    }
  }
  if (layers.some((layer) => layer?._widgetvaTag === 'line.showMovingAverage')) {
    return {
      mode: 'movingAverageOverlay',
      sourceAction: 'line.showMovingAverage',
    }
  }

  const scatterClusterState = widgetSpec?._scatter_cluster_state
  if (scatterClusterState && typeof scatterClusterState === 'object') {
    return {
      mode: 'clusterAnnotation',
      method: scatterClusterState.method || null,
      clusterField: scatterClusterState.cluster_field || null,
      nClusters: Number.isFinite(scatterClusterState.n_clusters) ? scatterClusterState.n_clusters : null,
    }
  }

  const marginalBarsState = widgetSpec?._marginal_bars_state
  if (marginalBarsState && typeof marginalBarsState === 'object' && marginalBarsState.enabled === true) {
    return {
      mode: 'marginalBars',
      op: marginalBarsState.op || 'sum',
      showTop: marginalBarsState.show_top !== false,
      showRight: marginalBarsState.show_right !== false,
      valueField: marginalBarsState.value_field || null,
    }
  }

  return null
}

export function buildViewAddRemoveState({ widgetSpec }) {
  const visibilityState = widgetSpec?._bar_visibility_state
  if (!visibilityState || typeof visibilityState !== 'object') return null

  if (visibilityState.mode === 'x' && typeof visibilityState.x_field === 'string' && Array.isArray(visibilityState.visible_x)) {
    return {
      mode: 'categoryVisibility',
      operation: visibilityState.last_operation === 'add' ? 'add' : 'remove',
      field: visibilityState.x_field,
      visibleValues: [...visibilityState.visible_x],
    }
  }

  if (visibilityState.mode === 'item' && typeof visibilityState.x_field === 'string' && typeof visibilityState.sub_field === 'string' && Array.isArray(visibilityState.visible_items)) {
    return {
      mode: 'itemVisibility',
      operation: visibilityState.last_operation === 'add' ? 'add' : 'remove',
      xField: visibilityState.x_field,
      subField: visibilityState.sub_field,
      visibleItems: visibilityState.visible_items.map((pair) => Array.isArray(pair) ? [...pair] : pair),
    }
  }

  return null
}

export function buildViewFocusState({ widgetSpec }) {
  const lineFocusState = widgetSpec?._line_focus_state
  if (lineFocusState && typeof lineFocusState === 'object' && Array.isArray(lineFocusState.lines) && lineFocusState.lines.length > 0) {
    const focusedSeries = [...lineFocusState.lines]
    return {
      focusedSeries,
      focusKeys: {
        focusedSeries,
      },
    }
  }

  const sankeyFocusState = widgetSpec?._sankey_focus_state
  if (sankeyFocusState && typeof sankeyFocusState === 'object' && typeof sankeyFocusState.node_name === 'string') {
    const focusedNode = sankeyFocusState.node_name
    return {
      focusedNode,
      focusKeys: {
        focusedNode,
      },
    }
  }

  return {}
}

export function buildViewNavigateState({ widgetSpec }) {
  const navigationState = widgetSpec?._navigation_state
  if (!navigationState || typeof navigationState !== 'object') return null
  if (typeof navigationState.sourceAction !== 'string' || typeof navigationState.mode !== 'string') {
    return null
  }
  return {
    mode: navigationState.mode,
    sourceAction: navigationState.sourceAction,
  }
}

export function buildViewSortState({ widgetSpec }) {
  const encoding = widgetSpec?.encoding
  if (!encoding || typeof encoding !== 'object') return null

  for (const [channel, channelSpec] of Object.entries(encoding)) {
    if (!channelSpec || typeof channelSpec !== 'object') continue
    const sort = channelSpec.sort
    const field = typeof channelSpec.field === 'string' && channelSpec.field.length > 0
      ? channelSpec.field
      : null

    if (Array.isArray(sort) && sort.length > 0) {
      return {
        channel,
        field,
        mode: 'explicitOrder',
        values: [...sort],
      }
    }

    if (typeof sort === 'string') {
      if (sort !== 'ascending' && sort !== 'descending') continue
      if (!field) continue
      return {
        channel,
        field,
        mode: 'direction',
        order: sort,
      }
    }
    if (sort && typeof sort === 'object' && !Array.isArray(sort)) {
      const sortField = typeof sort.field === 'string' && sort.field.length > 0
        ? sort.field
        : field
      const order = typeof sort.order === 'string' ? sort.order : null
      if (!sortField || (order !== 'ascending' && order !== 'descending')) continue
      return {
        channel,
        field: sortField,
        mode: 'direction',
        order,
        ...(typeof sort.op === 'string' && sort.op.length > 0 ? { aggregate: sort.op } : {}),
      }
    }
  }

  return null
}
