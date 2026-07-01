import { listStoreActions, listStoreWidgets, readWorkspaceDescriptionFromStore, resolveWidgetRecordFromStore } from './workspaceStoreReaders.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.length > 0))]
}

function readRootEncoding(spec) {
  const layerEncoding = Array.isArray(spec?.layer) ? spec.layer.find((layer) => layer?.encoding)?.encoding : null
  return layerEncoding || spec?.encoding || {}
}

function cloneEncoding(encoding) {
  return encoding && typeof encoding === 'object' && !Array.isArray(encoding) ? clone(encoding) : null
}

function listParamNames(schema) {
  return Object.keys(schema?.properties || {}).filter((name) => name !== 'queryScope')
}

function listRequiredParamNames(schema) {
  return (Array.isArray(schema?.required) ? schema.required : []).filter((name) => name !== 'queryScope')
}

function buildBaseFieldRoles() {
  return {
    resolved: {
      xField: null,
      yField: null,
      colorField: null,
      categoryField: null,
      measureField: null,
      subCategoryField: null,
    },
    candidates: {
      xFields: [],
      yFields: [],
      categoryFields: [],
      measureFields: [],
      groupFields: [],
    },
    explanations: [],
  }
}

function pushFieldExplanation(fieldRoles, role, value, reason) {
  fieldRoles.explanations.push({
    role,
    value: value ?? null,
    reason,
  })
}

function detectBarChannels(encoding = {}) {
  const xType = encoding?.x?.type || null
  const yType = encoding?.y?.type || null

  if ((yType === 'nominal' || yType === 'ordinal') && xType === 'quantitative') {
    return { categoryChannel: 'y', valueChannel: 'x' }
  }
  return { categoryChannel: 'x', valueChannel: 'y' }
}

function inferFieldRoles({ widgetKind, spec, rows = [] }) {
  const fieldRoles = buildBaseFieldRoles()
  const encoding = readRootEncoding(spec)
  const xEncoding = encoding?.x || null
  const yEncoding = encoding?.y || null
  const colorEncoding = encoding?.color || null
  const sizeEncoding = encoding?.size || null
  const shapeEncoding = encoding?.shape || null
  const xOffsetEncoding = encoding?.xOffset || null

  const xField = typeof xEncoding?.field === 'string' ? xEncoding.field : null
  const yField = typeof yEncoding?.field === 'string' ? yEncoding.field : null
  const colorField = typeof colorEncoding?.field === 'string' ? colorEncoding.field : null
  const xType = xEncoding?.type || null
  const yType = yEncoding?.type || null

  fieldRoles.resolved.xField = xField
  fieldRoles.resolved.yField = yField
  fieldRoles.resolved.colorField = colorField
  fieldRoles.candidates.xFields = uniqueStrings([xField])
  fieldRoles.candidates.yFields = uniqueStrings([yField])
  fieldRoles.candidates.groupFields = uniqueStrings([
    typeof xOffsetEncoding?.field === 'string' ? xOffsetEncoding.field : null,
    colorField,
  ])

  if (xField) {
      pushFieldExplanation(fieldRoles, 'xField', xField, `encoding.x.field is "${xField}".`)
  }
  if (yField) {
      pushFieldExplanation(fieldRoles, 'yField', yField, `encoding.y.field is "${yField}".`)
  }
  if (colorField) {
      pushFieldExplanation(fieldRoles, 'colorField', colorField, `encoding.color.field is "${colorField}".`)
  }

  if (widgetKind === 'bar') {
    const { categoryChannel, valueChannel } = detectBarChannels(encoding)
    const categoryEncoding = encoding?.[categoryChannel] || null
    const valueEncoding = encoding?.[valueChannel] || null
    const categoryField = typeof categoryEncoding?.field === 'string' ? categoryEncoding.field : null
    const measureField = typeof valueEncoding?.field === 'string' ? valueEncoding.field : null
    const subCategoryField = typeof xOffsetEncoding?.field === 'string'
      ? xOffsetEncoding.field
      : colorField

    fieldRoles.resolved.categoryField = categoryField
    fieldRoles.resolved.measureField = measureField
    fieldRoles.resolved.subCategoryField = subCategoryField
    fieldRoles.candidates.categoryFields = uniqueStrings([
      (xType === 'nominal' || xType === 'ordinal') ? xField : null,
      (yType === 'nominal' || yType === 'ordinal') ? yField : null,
      categoryField,
    ])
    fieldRoles.candidates.measureFields = uniqueStrings([
      xType === 'quantitative' ? xField : null,
      yType === 'quantitative' ? yField : null,
      measureField,
    ])

    if (categoryField) {
      pushFieldExplanation(
        fieldRoles,
        'categoryField',
        categoryField,
        `Bar charts use the ${categoryChannel} channel as the categorical axis because encoding.${categoryChannel}.type is "${categoryEncoding?.type || 'unknown'}".`,
      )
    }
    if (measureField) {
      pushFieldExplanation(
        fieldRoles,
        'measureField',
        measureField,
        `Bar charts use the ${valueChannel} channel as the quantitative measure because encoding.${valueChannel}.type is "${valueEncoding?.type || 'unknown'}".`,
      )
    }
    if (subCategoryField) {
      pushFieldExplanation(
        fieldRoles,
        'subCategoryField',
        subCategoryField,
        typeof xOffsetEncoding?.field === 'string'
          ? `encoding.xOffset.field is "${subCategoryField}", so grouped members can be addressed by that field.`
          : `encoding.color.field is "${subCategoryField}", so stacked or grouped members can be addressed by that field.`,
      )
    }
  } else if (widgetKind === 'scatter') {
    fieldRoles.resolved.categoryField = colorField
    fieldRoles.candidates.categoryFields = uniqueStrings([
      colorField,
    ])
    fieldRoles.candidates.measureFields = uniqueStrings([
      xType === 'quantitative' ? xField : null,
      yType === 'quantitative' ? yField : null,
    ])
  } else {
    fieldRoles.candidates.categoryFields = uniqueStrings([
      (xType === 'nominal' || xType === 'ordinal') ? xField : null,
      (yType === 'nominal' || yType === 'ordinal') ? yField : null,
    ])
    fieldRoles.candidates.measureFields = uniqueStrings([
      xType === 'quantitative' ? xField : null,
      yType === 'quantitative' ? yField : null,
    ])
  }

  if (fieldRoles.candidates.categoryFields.length === 0 && rows.length > 0) {
    const firstRow = rows.find((row) => row && typeof row === 'object') || null
    if (firstRow) {
      const fallbackCategories = Object.keys(firstRow).filter((field) => {
        const values = rows.map((row) => row?.[field]).filter((value) => value != null)
        if (values.length === 0) return false
        const uniqueCount = new Set(values.map((value) => JSON.stringify(value))).size
        return uniqueCount > 1 && uniqueCount <= Math.max(12, Math.ceil(values.length / 2))
      })
      fieldRoles.candidates.categoryFields = uniqueStrings(fallbackCategories)
    }
  }

  return {
    fieldRoles,
    encodingSummary: {
      x: cloneEncoding(xEncoding),
      y: cloneEncoding(yEncoding),
      color: cloneEncoding(colorEncoding),
      size: cloneEncoding(sizeEncoding),
      shape: cloneEncoding(shapeEncoding),
    },
  }
}

function buildSpecContext(spec, rows = []) {
  const { encodingSummary } = inferFieldRoles({ widgetKind: null, spec, rows })
  let dataSourceKind = null
  if (Array.isArray(spec?.data?.values)) {
    dataSourceKind = 'inline_values'
  } else if (typeof spec?.data?.url === 'string' && spec.data.url.trim().length > 0) {
    dataSourceKind = 'url'
  } else if (Array.isArray(rows) && rows.length > 0) {
    dataSourceKind = 'runtime_only'
  }

  return {
    hasCurrentSpec: Boolean(spec && typeof spec === 'object' && !Array.isArray(spec)),
    dataSourceKind,
    runtimeRowCount: Array.isArray(rows) ? rows.length : 0,
    encodings: encodingSummary,
  }
}

function isContinuousDomainEncoding(channelEncoding) {
  const type = channelEncoding?.type || null
  return type === 'quantitative' || type === 'temporal'
}

function inferLineGroupingField(spec) {
  const encoding = readRootEncoding(spec)
  return encoding?.color?.field || encoding?.detail?.field || null
}

function inferLineDimensionContext(spec, rows = []) {
  const encoding = readRootEncoding(spec)
  const xField = typeof encoding?.x?.field === 'string' ? encoding.x.field : null
  const yField = typeof encoding?.y?.field === 'string' ? encoding.y.field : null
  const lineField = inferLineGroupingField(spec)
  const categoryField = lineField || xField
  const fallbackCategoryField = categoryField
    || Object.keys(rows.find((row) => row && typeof row === 'object') || {})
      .find((field) => rows.some((row) => typeof row?.[field] === 'string')) || null
  return {
    xField,
    yField,
    lineField: lineField || fallbackCategoryField,
  }
}

function inferHeatmapFieldContext(spec) {
  const encoding = readRootEncoding(spec)
  return {
    xField: typeof encoding?.x?.field === 'string' ? encoding.x.field : null,
    yField: typeof encoding?.y?.field === 'string' ? encoding.y.field : null,
    colorField: typeof encoding?.color?.field === 'string' ? encoding.color.field : null,
  }
}

function inferParallelDimensions(spec, rows = []) {
  const transforms = Array.isArray(spec?.transform) ? spec.transform : []
  const foldTransform = transforms.find((transform) => Array.isArray(transform?.fold))
  if (foldTransform?.fold?.length > 0) return [...foldTransform.fold]
  const firstRow = rows.find((row) => row && typeof row === 'object') || null
  return firstRow ? Object.keys(firstRow) : []
}

function inferPrimaryCategoryFieldFromRows(rows = []) {
  const firstRow = rows.find((row) => row && typeof row === 'object') || null
  if (!firstRow) return null
  return Object.keys(firstRow).find((field) => {
    const values = rows.map((row) => row?.[field]).filter((value) => value != null)
    return values.length > 0 && values.every((value) => typeof value === 'string')
  }) || null
}

function inferSankeyContext(rows = []) {
  const firstRow = rows.find((row) => row && typeof row === 'object') || null
  const fieldCandidates = firstRow
    ? Object.keys(firstRow).filter((field) => field !== 'value')
    : []
  return {
    field: fieldCandidates[0] || null,
  }
}

function setParamRole(paramRoles, param, role) {
  if (!param || typeof param !== 'string') return
  paramRoles[param] = role
}

function setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param, value, role = 'structural', diagnostic = null }) {
  if (value == null) {
    if (diagnostic) diagnostics.push(diagnostic)
    return
  }
  suggestedParams[param] = value
  setParamRole(paramRoles, param, role)
}

function buildActionUsageModel({ descriptor, targetWidget, fieldRoles, spec, rows = [] }) {
  const suggestedParams = {}
  const diagnostics = []
  const requiredParams = listRequiredParamNames(descriptor?.paramsSchema)
  const paramNames = listParamNames(descriptor?.paramsSchema)
  const paramRoles = Object.fromEntries(
    paramNames.map((param) => [param, requiredParams.includes(param) ? 'intent' : 'optional']),
  )
  const actionName = descriptor?.name || ''
  const encoding = readRootEncoding(spec)
  const lineContext = inferLineDimensionContext(spec, rows)
  const heatmapContext = inferHeatmapFieldContext(spec)
  const parallelDimensions = inferParallelDimensions(spec, rows)
  const fallbackCategoryField = inferPrimaryCategoryFieldFromRows(rows)
  const sankeyContext = inferSankeyContext(rows)

  if (actionName === 'bar.sortBars') {
    const { categoryChannel, valueChannel } = detectBarChannels(encoding)
    const measureField = fieldRoles.resolved.measureField
    const currentAggregate = encoding?.[valueChannel]?.aggregate || 'mean'
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      diagnostics,
      param: 'channel',
      value: categoryChannel,
      diagnostic: 'Could not resolve the categorical channel for bar.sortBars from the current encoding.',
    })
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      diagnostics,
      param: 'field',
      value: measureField,
      diagnostic: 'Could not resolve the quantitative field for bar.sortBars from the current encoding.',
    })
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      diagnostics,
      param: 'aggregate',
      value: currentAggregate,
      role: 'optional',
    })
    setParamRole(paramRoles, 'bySubcategory', 'optional')
  } else if (actionName === 'bar.highlightTopN') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      diagnostics,
      param: 'categoryField',
      value: fieldRoles.resolved.categoryField,
      diagnostic: 'Could not resolve categoryField for bar.highlightTopN from the current bar spec.',
    })
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      diagnostics,
      param: 'measureField',
      value: fieldRoles.resolved.measureField,
      diagnostic: 'Could not resolve measureField for bar.highlightTopN from the current bar spec.',
    })
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'order', value: 'descending', role: 'optional' })
  } else if (actionName === 'bar.filterCategories') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      diagnostics,
      param: 'field',
      value: fieldRoles.resolved.categoryField,
      diagnostic: 'Could not resolve the categorical field for bar.filterCategories from the current bar spec.',
    })
  } else if (actionName === 'scatter.brushRegion') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      diagnostics,
      param: 'xField',
      value: fieldRoles.resolved.xField,
      diagnostic: 'Could not resolve xField for scatter.brushRegion from the current scatter spec.',
    })
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      diagnostics,
      param: 'yField',
      value: fieldRoles.resolved.yField,
      diagnostic: 'Could not resolve yField for scatter.brushRegion from the current scatter spec.',
    })
  } else if (actionName === 'scatter.zoomDomain') {
    const xEncoding = encoding?.x || null
    const yEncoding = encoding?.y || null
    setParamRole(paramRoles, 'xDomain', 'intent')
    setParamRole(paramRoles, 'yDomain', 'intent')
    if (!isContinuousDomainEncoding(xEncoding)) {
      diagnostics.push('The current scatter x channel is not continuous, so xDomain zoom may not be valid.')
    }
    if (!isContinuousDomainEncoding(yEncoding)) {
      diagnostics.push('The current scatter y channel is not continuous, so yDomain zoom may not be valid.')
    }
    diagnostics.push('Provide at least one of xDomain or yDomain when calling scatter.zoomDomain.')
  } else if (actionName === 'bar.selectCategory') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      diagnostics,
      param: 'field',
      value: fieldRoles.resolved.categoryField,
      diagnostic: 'Could not resolve the categorical field for bar.selectCategory from the current bar spec.',
    })
  } else if (actionName === 'bar.addBars' || actionName === 'bar.removeBars') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      param: 'field',
      value: fieldRoles.resolved.categoryField,
      diagnostic: `Could not resolve the categorical field for ${actionName} from the current bar spec.`,
    })
  } else if (actionName === 'bar.addBarItems' || actionName === 'bar.removeBarItems') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      param: 'xField',
      value: fieldRoles.resolved.categoryField,
      diagnostic: `Could not resolve xField for ${actionName} from the current bar spec.`,
    })
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      param: 'subField',
      value: fieldRoles.resolved.subCategoryField,
      diagnostic: `Could not resolve subField for ${actionName} from the current bar spec.`,
    })
  } else if (actionName === 'bar.filterSubcategories') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      param: 'subField',
      value: fieldRoles.resolved.subCategoryField,
      diagnostic: 'Could not resolve subField for bar.filterSubcategories from the current bar spec.',
    })
  } else if (actionName === 'scatter.identifyClusters') {
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'method', value: 'kmeans', role: 'optional' })
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'nClusters', value: 3, role: 'optional' })
  } else if (actionName === 'scatter.showRegression') {
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'method', value: 'linear', role: 'optional' })
  } else if (actionName === 'line.selectSeries') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      param: 'field',
      value: lineContext.lineField,
      diagnostic: 'Could not resolve field for line.selectSeries from the current line spec.',
    })
  } else if (actionName === 'line.selectXValue') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      param: 'field',
      value: lineContext.xField,
      diagnostic: 'Could not resolve field for line.selectXValue from the current line spec.',
    })
  } else if (actionName === 'line.zoomXRegion') {
    setParamRole(paramRoles, 'start', 'intent')
    setParamRole(paramRoles, 'end', 'intent')
  } else if (actionName === 'line.focusLines') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      param: 'lineField',
      value: lineContext.lineField,
      diagnostic: 'Could not resolve lineField for line.focusLines from the current line spec.',
    })
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'dimOpacity', value: 0.08, role: 'optional' })
  } else if (actionName === 'line.highlightTrend') {
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'trendType', value: 'increasing', role: 'optional' })
  } else if (actionName === 'line.showMovingAverage') {
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'windowSize', value: 3, role: 'optional' })
  } else if (actionName === 'line.drillDownXAxis') {
    setParamRole(paramRoles, 'level', 'intent')
    setParamRole(paramRoles, 'value', 'intent')
    setParamRole(paramRoles, 'parent', 'optional')
  } else if (actionName === 'line.resampleXAxis') {
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'agg', value: 'mean', role: 'optional' })
  } else if (actionName === 'line.boldLines') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      param: 'lineField',
      value: lineContext.lineField,
      diagnostic: 'Could not resolve lineField for line.boldLines from the current line spec.',
    })
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'boldWidth', value: 4, role: 'optional' })
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'baseWidth', value: 1, role: 'optional' })
  } else if (actionName === 'line.filterLines') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      param: 'lineField',
      value: lineContext.lineField,
      diagnostic: 'Could not resolve lineField for line.filterLines from the current line spec.',
    })
  } else if (actionName === 'heatmap.filterCells' || actionName === 'heatmap.selectCell') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      param: 'xField',
      value: heatmapContext.xField,
      diagnostic: `Could not resolve xField for ${actionName} from the current heatmap spec.`,
    })
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      param: 'yField',
      value: heatmapContext.yField,
      diagnostic: `Could not resolve yField for ${actionName} from the current heatmap spec.`,
    })
  } else if (actionName === 'heatmap.selectSubmatrix' || actionName === 'heatmap.highlightRegion') {
    diagnostics.push(`Provide at least one of ${actionName === 'heatmap.selectSubmatrix' ? 'xValues or yValues' : 'xValues or yValues'} when calling ${actionName}.`)
  } else if (actionName === 'heatmap.drilldownAxis') {
    setParamRole(paramRoles, 'level', 'intent')
    setParamRole(paramRoles, 'value', 'intent')
    setParamRole(paramRoles, 'parent', 'optional')
  } else if (actionName === 'heatmap.addMarginalBars') {
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'op', value: 'mean', role: 'optional' })
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'showTop', value: true, role: 'optional' })
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'showRight', value: true, role: 'optional' })
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'barSize', value: 70, role: 'optional' })
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'barColor', value: '#666666', role: 'optional' })
  } else if (actionName === 'heatmap.adjustColorScale') {
    setParamRole(paramRoles, 'scheme', 'intent')
    setParamRole(paramRoles, 'domain', 'optional')
  } else if (actionName === 'heatmap.thresholdMask') {
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'outsideOpacity', value: 0.1, role: 'optional' })
  } else if (actionName === 'heatmap.filterCellsByRegion') {
    diagnostics.push('Provide at least one of xValue/xValues or yValue/yValues when calling heatmap.filterCellsByRegion.')
  } else if (actionName === 'heatmap.highlightRegionByValue') {
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'outsideOpacity', value: 0.12, role: 'optional' })
    diagnostics.push('Provide at least one of minValue or maxValue when calling heatmap.highlightRegionByValue.')
  } else if (actionName === 'heatmap.clusterRowsCols') {
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'clusterRows', value: true, role: 'optional' })
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'clusterCols', value: true, role: 'optional' })
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'method', value: 'sum', role: 'optional' })
  } else if (actionName === 'parallelCoordinates.selectRecord') {
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'field', value: 'id', role: 'structural' })
  } else if (actionName === 'parallelCoordinates.filterByCategory' || actionName === 'parallelCoordinates.highlightCategory') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      diagnostics,
      param: 'field',
      value: fallbackCategoryField,
      diagnostic: `Could not resolve field for ${actionName} from the current parallel-coordinates rows.`,
    })
  } else if (actionName === 'parallelCoordinates.hideDimensions') {
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'mode', value: 'hide', role: 'optional' })
    if (parallelDimensions.length > 0) {
      diagnostics.push(`Current visible dimensions: ${parallelDimensions.join(', ')}`)
    }
  } else if (actionName === 'sankey.focusFlow') {
    setSuggestedParam({
      suggestedParams,
      paramRoles,
      diagnostics,
      param: 'field',
      value: sankeyContext.field,
      diagnostic: 'Could not resolve field for sankey.focusFlow from the current Sankey rows.',
    })
  } else if (actionName === 'sankey.collapseNodes') {
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'aggregateName', value: 'Other', role: 'optional' })
  } else if (actionName === 'sankey.colorFlows') {
    setSuggestedParam({ suggestedParams, paramRoles, diagnostics, param: 'color', value: '#e74c3c', role: 'optional' })
  }

  const recommendedCall = {
    name: descriptor?.name || null,
    targetRef: targetWidget?.ref || null,
    queryScope: targetWidget?.ref ? { widgetRef: targetWidget.ref } : undefined,
    params: {
      ...Object.fromEntries(requiredParams.map((param) => [param, `<required:${param}>`])),
      ...clone(suggestedParams),
    },
  }

  return {
    requiredParams,
    paramRoles,
    suggestedParams,
    recommendedCall,
    diagnostics,
  }
}

function buildActionUsageEntry({ descriptor, targetWidget, fieldRoles, spec, rows, includeSchemas, includeExamples }) {
  const parameterResolution = buildActionUsageModel({
    descriptor,
    targetWidget,
    fieldRoles,
    spec,
    rows,
  })

  return {
    name: descriptor?.name || null,
    title: descriptor?.title || null,
    description: descriptor?.description || null,
    primitive: descriptor?.primitive || null,
    category: descriptor?.category || null,
    targetRef: descriptor?.targetRef || null,
    supportedWidgetKinds: Array.isArray(descriptor?.supportedWidgetKinds) ? [...descriptor.supportedWidgetKinds] : null,
    requiredParams: parameterResolution.requiredParams,
    paramRoles: parameterResolution.paramRoles,
    suggestedParams: parameterResolution.suggestedParams,
    recommendedCall: parameterResolution.recommendedCall,
    diagnostics: parameterResolution.diagnostics,
    ...(includeSchemas ? { paramsSchema: clone(descriptor?.paramsSchema || null) } : {}),
    ...(includeExamples ? { examples: clone(Array.isArray(descriptor?.examples) ? descriptor.examples : []) } : {}),
    actionDescriptor: clone(descriptor || null),
  }
}

function resolveTargetWidget({ store, description, targetRef, widgetId, actionName }) {
  const explicitRef = normalizeString(targetRef)
  const explicitWidgetId = normalizeString(widgetId)

  if (explicitRef) {
    return resolveWidgetRecordFromStore(store, explicitRef)
  }

  const widgets = Array.isArray(description?.widgets) && description.widgets.length > 0
    ? description.widgets
    : listStoreWidgets(store)

  if (explicitWidgetId) {
    return widgets.find((entry) => entry?.widgetId === explicitWidgetId) || null
  }

  if (actionName) {
    const descriptors = listStoreActions(store).filter((descriptor) => descriptor?.name === actionName)
    const uniqueTargetRefs = uniqueStrings(descriptors.map((descriptor) => descriptor?.targetRef || null))
    if (uniqueTargetRefs.length === 1) {
      return resolveWidgetRecordFromStore(store, uniqueTargetRefs[0])
    }
  }

  return widgets.length === 1 ? widgets[0] : null
}

export function describeActionUsageSurface({ actionExecutor, options = {}, contextOverride = null } = {}) {
  const includeSchemas = options?.includeSchemas !== false
  const includeExamples = options?.includeExamples !== false
  const actionName = normalizeString(options?.actionName)
  const description = readWorkspaceDescriptionFromStore(actionExecutor?.store, {
    actionExecutor,
  })
  const targetWidget = resolveTargetWidget({
    store: actionExecutor?.store,
    description,
    targetRef: options?.targetRef || options?.widgetRef || null,
    widgetId: options?.widgetId || null,
    actionName,
  })

  const diagnostics = []
  const syntheticCall = {
    name: actionName || 'describeActionUsage',
    params: {},
    queryScope: targetWidget?.ref ? { widgetRef: targetWidget.ref } : {},
  }
  const ctx = typeof actionExecutor?.createContext === 'function'
    ? actionExecutor.createContext(syntheticCall, null, contextOverride)
    : null
  const spec = ctx?.readCurrentSpec?.() || null
  const rowResult = targetWidget?.ref && typeof ctx?.readRowsForWidget === 'function'
    ? ctx.readRowsForWidget(targetWidget.ref)
    : { rows: [] }
  const rows = Array.isArray(rowResult?.rows) ? rowResult.rows : []
  const { fieldRoles } = inferFieldRoles({
    widgetKind: targetWidget?.kind || null,
    spec,
    rows,
  })

  if (!targetWidget) {
    diagnostics.push(
      actionName
        ? `Could not resolve a target widget for "${actionName}". Pass targetRef/widgetRef explicitly when multiple widgets are present.`
        : 'Could not resolve a target widget. Pass targetRef/widgetRef explicitly when multiple widgets are present.',
    )
  }
  if (!spec) {
    diagnostics.push('No current spec is available from the runtime host bridge, so field-role inference is limited.')
  }

  const baseActions = Array.isArray(description?.actions) && description.actions.length > 0
    ? description.actions
    : listStoreActions(actionExecutor?.store, actionExecutor)
  const scopedActions = baseActions.filter((descriptor) => {
    if (actionName && descriptor?.name !== actionName) return false
    if (!targetWidget?.ref) return true
    if (!descriptor?.targetRef) return true
    return descriptor.targetRef === targetWidget.ref
  })

  const actions = scopedActions.map((descriptor) => buildActionUsageEntry({
    descriptor,
    targetWidget,
    fieldRoles,
    spec,
    rows,
    includeSchemas,
    includeExamples,
  }))

  if (actionName && actions.length === 0) {
    diagnostics.push(`No declared action descriptor matched "${actionName}" for the resolved widget scope.`)
  }

  return {
    targetRef: targetWidget?.ref || null,
    widgetId: targetWidget?.widgetId || null,
    widgetKind: targetWidget?.kind || null,
    title: targetWidget?.title || null,
    diagnostics,
    specContext: buildSpecContext(spec, rows),
    fieldRoles,
    actions,
  }
}
