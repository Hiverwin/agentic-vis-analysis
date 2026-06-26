import { makeWorkspacePlanningResult } from '../../protocol/planning.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function getMarkType(spec) {
  return typeof spec?.mark === 'string' ? spec.mark : spec?.mark?.type
}

function inferWidgetKind(spec) {
  if (spec?.kind === 'map') return 'map'
  if (spec?.kind === 'parallelCoordinates') return 'parallelCoordinates'
  if (spec?.kind === 'sankey') return 'sankey'
  const mark = getMarkType(spec)
  if (mark === 'point' || mark === 'circle') return 'scatter'
  if (mark === 'bar') return 'bar'
  if (mark === 'line') return 'line'
  if (mark === 'rect') return 'heatmap'
  return 'custom'
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern))
}

function derivePlanningSignals({ task, userIntent, runMode, complexityBudget }) {
  const taskFamily = task?.taskFamily || null
  const coordinationScope = task?.coordinationScope || task?.taskMode || null
  const evidenceType = task?.evidenceType || null
  const interactionHorizon = task?.interactionHorizon || null
  const answerType = task?.answerType || task?.expectedAnswerType || null
  const queryText = normalizeText(task?.userQuery || userIntent)
  const expansiveMode = runMode === 'autonomous' || runMode === 'open_ended' || complexityBudget === 'extended'
  const asksForDetail = includesAny(queryText, ['detail', 'record', 'row', 'exact', 'which', 'list', 'show'])
  const asksForComparison = includesAny(queryText, ['compare', 'distribution', 'breakdown', 'summary', 'group'])
  const asksForCoordination = includesAny(queryText, ['linked', 'across views', 'cross-widget', 'shared selection', 'filter the other'])
  const wantsMultiWidget =
    coordinationScope === 'multi_widget' ||
    coordinationScope === 'workspace' ||
    evidenceType === 'cross_widget' ||
    taskFamily === 'multiViewCoordination' ||
    asksForCoordination
  const wantsDetailEvidence =
    answerType === 'exact' ||
    evidenceType === 'interaction_revealed' ||
    evidenceType === 'cross_widget' ||
    interactionHorizon === 'multi_step' ||
    asksForDetail
  const wantsSummaryContext =
    answerType === 'exploratory' ||
    taskFamily === 'compare' ||
    taskFamily === 'distribution' ||
    taskFamily === 'rank' ||
    taskFamily === 'trend' ||
    asksForComparison

  return {
    taskFamily,
    coordinationScope,
    evidenceType,
    interactionHorizon,
    answerType,
    wantsMultiWidget,
    wantsDetailEvidence,
    wantsSummaryContext,
    expansiveMode,
  }
}

function appendPlanningSignals(plan, signals, extras = []) {
  const rationale = Array.isArray(plan?.rationale) ? [...plan.rationale] : []
  if (signals.taskFamily) {
    rationale.push(`Planner considered task family "${signals.taskFamily}" when choosing topology ${plan.topology}.`)
  }
  if (signals.coordinationScope) {
    rationale.push(`Requested coordination scope "${signals.coordinationScope}" influenced the workspace layout.`)
  }
  if (signals.evidenceType) {
    rationale.push(`Evidence target "${signals.evidenceType}" guided the choice of summary/detail coordination surfaces.`)
  }
  if (signals.interactionHorizon) {
    rationale.push(`Interaction horizon "${signals.interactionHorizon}" informed the workspace complexity level.`)
  }
  return {
    ...plan,
    rationale: [...rationale, ...extras],
  }
}

function normalizeSchemaFieldKind(type) {
  const kind = normalizeText(type)
  if (
    kind === 'quantitative' ||
    kind === 'number' ||
    kind === 'integer' ||
    kind === 'float' ||
    kind === 'double' ||
    kind === 'numeric'
  ) {
    return 'quantitative'
  }
  return 'nominal'
}

function inferFieldKinds({ rows, datasetSchema }) {
  const fields = {}
  const sample = Array.isArray(rows) ? rows.slice(0, 50) : []
  for (const row of sample) {
    if (!row || typeof row !== 'object') continue
    for (const [field, value] of Object.entries(row)) {
      if (!(field in fields)) {
        fields[field] = { numeric: 0, string: 0, other: 0 }
      }
      if (isNumber(value)) fields[field].numeric += 1
      else if (typeof value === 'string') fields[field].string += 1
      else fields[field].other += 1
    }
  }
  if (sample.length === 0 && Array.isArray(datasetSchema?.fields)) {
    return datasetSchema.fields
      .filter((field) => typeof field?.name === 'string' && field.name)
      .map((field) => ({
        field: field.name,
        kind: normalizeSchemaFieldKind(field.type),
      }))
  }
  return Object.entries(fields).map(([field, counts]) => ({
    field,
    kind: counts.numeric >= counts.string ? 'quantitative' : 'nominal',
  }))
}

function findCategoricalField({ spec, rows, datasetSchema }) {
  const colorField = spec?.encoding?.color?.field
  if (typeof colorField === 'string') return colorField
  const xField = spec?.encoding?.x?.field
  const yField = spec?.encoding?.y?.field
  const fieldKinds = inferFieldKinds({ rows, datasetSchema })
  const categorical = fieldKinds.find((entry) => entry.kind === 'nominal' && entry.field !== xField && entry.field !== yField)
  return categorical?.field || null
}

function findSeriesField({ spec, rows, datasetSchema }) {
  const colorField = spec?.encoding?.color?.field
  if (typeof colorField === 'string') return colorField
  const detailField = spec?.encoding?.detail?.field
  if (typeof detailField === 'string') return detailField
  const fieldKinds = inferFieldKinds({ rows, datasetSchema })
  return fieldKinds.find((entry) => entry.kind === 'nominal')?.field || null
}

function findValueField(spec) {
  const yField = spec?.encoding?.y?.field
  if (typeof yField === 'string') return yField
  const colorField = spec?.encoding?.color?.field
  if (typeof colorField === 'string') return colorField
  return null
}

function hasCategoricalAxes(spec) {
  return !!spec?.encoding?.x?.field && !!spec?.encoding?.y?.field
}

function hasQuantitativeXY(spec) {
  return spec?.encoding?.x?.type === 'quantitative' && spec?.encoding?.y?.type === 'quantitative'
}

function createCategorySummarySpec(field) {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: 280,
    height: 220,
    mark: { type: 'bar', cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3, color: '#4d7ea8' },
    encoding: {
      x: {
        field,
        type: 'nominal',
        sort: '-y',
        axis: { title: field, labelAngle: -18 },
      },
      y: {
        field: 'recordCount',
        type: 'quantitative',
        axis: { title: 'Visible Records' },
      },
      tooltip: [
        { field, type: 'nominal' },
        { field: 'recordCount', type: 'quantitative' },
      ],
    },
    config: {
      view: { stroke: '#d6dbe6' },
      axis: { labelColor: '#2d3a4e', titleColor: '#2d3a4e' },
    },
  }
}

function createLineSeriesSummarySpec(field, valueField) {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: 280,
    height: 220,
    mark: { type: 'bar', cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3, color: '#4d7ea8' },
    encoding: {
      x: {
        field,
        type: 'nominal',
        sort: '-y',
        axis: { title: field, labelAngle: -18 },
      },
      y: {
        field: valueField ? `total_${valueField}` : 'recordCount',
        type: 'quantitative',
        axis: { title: valueField ? `${valueField} Total` : 'Visible Records' },
      },
      tooltip: [
        { field, type: 'nominal' },
        { field: valueField ? `total_${valueField}` : 'recordCount', type: 'quantitative' },
      ],
    },
    config: {
      view: { stroke: '#d6dbe6' },
      axis: { labelColor: '#2d3a4e', titleColor: '#2d3a4e' },
    },
  }
}

function createFocusedScatterSpec(spec) {
  const next = clone(spec)
  next.width = 280
  next.height = 220
  next.title = typeof spec?.title === 'string'
    ? `${spec.title} Detail`
    : {
        text: 'Focused Detail Scatter',
        anchor: 'start',
      }
  return next
}

function createDetailTableSource() {
  return {
    kind: 'tableView',
    title: 'Filtered Records',
  }
}

function buildMapDetailPlan({ sessionId, field, spec }) {
  const primaryWidgetId = sessionId ? `session_${sessionId}` : 'active_widget'
  return makeWorkspacePlanningResult({
    topology: 'T2',
    widgets: [
      {
        widgetId: primaryWidgetId,
        role: 'primary',
        source: { kind: 'baseSpec' },
        analyticRoles: ['geoPattern', 'compare', 'distribution'],
      },
      {
        widgetId: `${primaryWidgetId}_table`,
        role: 'detail',
        kind: 'table',
        title: 'Selected Region Records',
        description: 'Detail rows corresponding to the currently selected map regions.',
        source: createDetailTableSource(),
        analyticRoles: ['lookup', 'detail', 'compare'],
      },
    ],
    links: [
      {
        linkId: `${primaryWidgetId}_filter_table`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_table`,
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Selected map regions filter the detail table.',
        fieldMapping: field ? [{ sourceField: field, targetField: field }] : [],
      },
      {
        linkId: `${primaryWidgetId}_share_selection_table`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_table`,
        primitive: 'sharesSelection',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'The detail table mirrors the active map-region selection context.',
        fieldMapping: field ? [{ sourceField: field, targetField: field }] : [],
      },
    ],
    rationale: [
      'Map views benefit from a detail table so region-level selections can be inspected as exact records.',
      'This topology supports geographic overview plus row-level evidence.',
    ],
    planningMode: 'topology_driven',
    primaryWidgetId,
    title: typeof spec?.title === 'string' ? `${spec.title} Detail` : 'Map Detail Workspace',
  })
}

function buildParallelCoordinatesDetailPlan({ sessionId, spec }) {
  const primaryWidgetId = sessionId ? `session_${sessionId}` : 'active_widget'
  return makeWorkspacePlanningResult({
    topology: 'T2',
    widgets: [
      {
        widgetId: primaryWidgetId,
        role: 'primary',
        source: { kind: 'baseSpec' },
        analyticRoles: ['compare', 'outlier', 'distribution'],
      },
      {
        widgetId: `${primaryWidgetId}_table`,
        role: 'detail',
        kind: 'table',
        title: 'Brushed Records',
        description: 'Detail rows corresponding to the currently brushed multivariate range.',
        source: createDetailTableSource(),
        analyticRoles: ['lookup', 'detail', 'compare'],
      },
    ],
    links: [
      {
        linkId: `${primaryWidgetId}_filter_table`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_table`,
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Parallel coordinates brushing filters the detail table.',
        fieldMapping: [],
      },
      {
        linkId: `${primaryWidgetId}_share_selection_table`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_table`,
        primitive: 'sharesSelection',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'The detail table mirrors the active multivariate brush context.',
        fieldMapping: [],
      },
    ],
    rationale: [
      'Parallel coordinates often require row-level drill-down to interpret multivariate brushes.',
      'This topology supports multivariate filtering plus exact record inspection.',
    ],
    planningMode: 'topology_driven',
    primaryWidgetId,
    title: typeof spec?.title === 'string' ? `${spec.title} Detail` : 'Parallel Coordinates Detail Workspace',
  })
}

function buildSankeyDetailPlan({ sessionId, field, spec }) {
  const primaryWidgetId = sessionId ? `session_${sessionId}` : 'active_widget'
  return makeWorkspacePlanningResult({
    topology: 'T2',
    widgets: [
      {
        widgetId: primaryWidgetId,
        role: 'primary',
        source: { kind: 'baseSpec' },
        analyticRoles: ['flow', 'compare'],
      },
      {
        widgetId: `${primaryWidgetId}_table`,
        role: 'detail',
        kind: 'table',
        title: 'Focused Flow Records',
        description: 'Detail rows corresponding to the currently focused Sankey flow categories.',
        source: createDetailTableSource(),
        analyticRoles: ['lookup', 'detail', 'compare'],
      },
    ],
    links: [
      {
        linkId: `${primaryWidgetId}_filter_table`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_table`,
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Focused Sankey flows filter the detail table.',
        fieldMapping: field ? [{ sourceField: field, targetField: field }] : [],
      },
      {
        linkId: `${primaryWidgetId}_share_selection_table`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_table`,
        primitive: 'sharesSelection',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'The detail table mirrors the active Sankey flow selection context.',
        fieldMapping: field ? [{ sourceField: field, targetField: field }] : [],
      },
    ],
    rationale: [
      'Sankey views benefit from a detail table so focused flows can be verified against raw records.',
      'This topology supports flow overview plus exact downstream evidence.',
    ],
    planningMode: 'topology_driven',
    primaryWidgetId,
    title: typeof spec?.title === 'string' ? `${spec.title} Detail` : 'Sankey Detail Workspace',
  })
}

function buildLineCoordinationPlan({ sessionId, field, valueField, spec }) {
  const primaryWidgetId = sessionId ? `session_${sessionId}` : 'active_widget'
  return makeWorkspacePlanningResult({
    topology: 'T2',
    widgets: [
      {
        widgetId: primaryWidgetId,
        role: 'primary',
        source: { kind: 'baseSpec' },
        analyticRoles: ['trend', 'compare'],
      },
      {
        widgetId: `${primaryWidgetId}_summary`,
        role: 'context',
        title: `${field} Trend Summary`,
        description: `Aggregated summary for visible series grouped by ${field}.`,
        source: {
          kind: 'templateSpec',
          spec: createLineSeriesSummarySpec(field, valueField),
        },
        dataBinding: {
          sourceDataId: 'primary',
          transforms: [
            {
              kind: 'aggregate',
              groupBy: [field],
              metrics: valueField
                ? [{ op: 'sum', field: valueField, as: `total_${valueField}` }]
                : [{ op: 'count', as: 'recordCount' }],
              sortBy: { field: valueField ? `total_${valueField}` : 'recordCount', order: 'descending' },
            },
          ],
        },
        analyticRoles: ['compare', 'rank', 'trend'],
      },
      {
        widgetId: `${primaryWidgetId}_table`,
        role: 'detail',
        kind: 'table',
        title: 'Selected Series Rows',
        description: 'Detail rows corresponding to the currently selected line series.',
        source: createDetailTableSource(),
        analyticRoles: ['lookup', 'detail', 'compare'],
      },
    ],
    links: [
      {
        linkId: `${primaryWidgetId}_filter_summary`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_summary`,
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Selected line series filter the summary view.',
        fieldMapping: [],
      },
      {
        linkId: `${primaryWidgetId}_filter_table`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_table`,
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Selected line series filter the detail table.',
        fieldMapping: [],
      },
      {
        linkId: `${primaryWidgetId}_share_selection_table`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_table`,
        primitive: 'sharesSelection',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'The detail table mirrors the active line-series selection context.',
        fieldMapping: [{ sourceField: field, targetField: field }],
      },
    ],
    rationale: [
      'Line views benefit from a grouped summary plus row-level detail for the selected series.',
      'This topology supports trend comparison without losing record-level evidence.',
    ],
    planningMode: 'topology_driven',
    primaryWidgetId,
    title: typeof spec?.title === 'string' ? `${spec.title} Coordination` : 'Line Coordination Workspace',
  })
}

function buildHeatmapDetailPlan({ sessionId, spec }) {
  const primaryWidgetId = sessionId ? `session_${sessionId}` : 'active_widget'
  return makeWorkspacePlanningResult({
    topology: 'T2',
    widgets: [
      {
        widgetId: primaryWidgetId,
        role: 'primary',
        source: { kind: 'baseSpec' },
        analyticRoles: ['distribution', 'outlier', 'compare'],
      },
      {
        widgetId: `${primaryWidgetId}_table`,
        role: 'detail',
        kind: 'table',
        title: 'Selected Cell Records',
        description: 'Detail rows corresponding to the currently selected heatmap cell.',
        source: createDetailTableSource(),
        analyticRoles: ['lookup', 'detail', 'compare'],
      },
    ],
    links: [
      {
        linkId: `${primaryWidgetId}_filter_table`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_table`,
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Selected heatmap cell filters the detail table.',
        fieldMapping: [],
      },
      {
        linkId: `${primaryWidgetId}_share_selection_table`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_table`,
        primitive: 'sharesSelection',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'The detail table mirrors the active heatmap cell selection context.',
        fieldMapping: [],
      },
    ],
    rationale: [
      'Heatmaps benefit from row-level detail to inspect the records behind a selected cell.',
      'This topology supports matrix overview plus detailed evidence.',
    ],
    planningMode: 'topology_driven',
    primaryWidgetId,
    title: typeof spec?.title === 'string' ? `${spec.title} Detail` : 'Heatmap Detail Workspace',
  })
}

function buildSingleViewPlan({ sessionId, spec }) {
  const widgetId = sessionId ? `session_${sessionId}` : 'active_widget'
  return makeWorkspacePlanningResult({
    topology: 'T1',
    widgets: [
      {
        widgetId,
        role: 'primary',
        source: { kind: 'baseSpec' },
      },
    ],
    links: [],
    rationale: ['Single-view topology is sufficient for the current data and task context.'],
    planningMode: 'minimal_default',
    primaryWidgetId: widgetId,
    title: typeof spec?.title === 'string' ? spec.title : 'Active Widget',
  })
}

function buildCoordinatedPairPlan({ sessionId, field, spec }) {
  const primaryWidgetId = sessionId ? `session_${sessionId}` : 'active_widget'
  return makeWorkspacePlanningResult({
    topology: 'T2',
    widgets: [
      {
        widgetId: primaryWidgetId,
        role: 'primary',
        source: { kind: 'baseSpec' },
        analyticRoles: ['lookup', 'compare'],
      },
      {
        widgetId: `${primaryWidgetId}_summary`,
        role: 'context',
        title: `${field} Distribution`,
        description: `Category summary for ${field} over the current visible rows.`,
        source: {
          kind: 'templateSpec',
          spec: createCategorySummarySpec(field),
        },
        dataBinding: {
          sourceDataId: 'primary',
          transforms: [
            {
              kind: 'aggregate',
              groupBy: [field],
              metrics: [{ op: 'count', as: 'recordCount' }],
              sortBy: { field: 'recordCount', order: 'descending' },
            },
          ],
        },
        analyticRoles: ['compare', 'rank', 'distribution'],
      },
    ],
    links: [
      {
        linkId: `${primaryWidgetId}_filter_summary`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_summary`,
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Primary selection filters the summary view.',
        fieldMapping: [],
      },
    ],
    rationale: [
      'A categorical summary view adds context to the primary analysis view.',
      'Filter propagation supports coordinated overview and summary inspection.',
    ],
    planningMode: 'topology_driven',
    primaryWidgetId: primaryWidgetId,
    title: typeof spec?.title === 'string' ? spec.title : 'Coordinated Workspace',
  })
}

function buildScatterDetailPlan({ sessionId, field, spec }) {
  const primaryWidgetId = sessionId ? `session_${sessionId}` : 'active_widget'
  return makeWorkspacePlanningResult({
    topology: 'T3',
    widgets: [
      {
        widgetId: primaryWidgetId,
        role: 'primary',
        source: { kind: 'baseSpec' },
        analyticRoles: ['correlate', 'outlier', 'cluster'],
      },
      {
        widgetId: `${primaryWidgetId}_detail`,
        role: 'detail',
        kind: 'table',
        title: 'Filtered Records',
        description: 'Detail table showing the rows currently revealed by the active scatter selection.',
        source: createDetailTableSource(),
        analyticRoles: ['lookup', 'detail', 'compare'],
      },
    ],
    links: [
      {
        linkId: `${primaryWidgetId}_filter_detail`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_detail`,
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Primary scatter selection filters the detail table.',
        fieldMapping: field ? [{ sourceField: field, targetField: field }] : [],
      },
      {
        linkId: `${primaryWidgetId}_share_selection_detail`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_detail`,
        primitive: 'sharesSelection',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'The detail table mirrors the active scatter selection context.',
        fieldMapping: [{ sourceField: field, targetField: field }],
      },
    ],
    rationale: [
      'Scatter data with quantitative x/y benefits from a linked detail table for exact record inspection.',
      'The overview scatter directly controls a dedicated detail surface for drill-down evidence.',
      'This workspace topology keeps overview and detail tightly coordinated without adding a third dashboard role.',
    ],
    planningMode: 'topology_driven',
    primaryWidgetId: primaryWidgetId,
    title: typeof spec?.title === 'string' ? `${spec.title} Detail` : 'Scatter Detail Workspace',
  })
}

function buildTripleDashboardPlan({ sessionId, field, spec }) {
  const primaryWidgetId = sessionId ? `session_${sessionId}` : 'active_widget'
  return makeWorkspacePlanningResult({
    topology: 'T4',
    widgets: [
      {
        widgetId: primaryWidgetId,
        role: 'primary',
        source: { kind: 'baseSpec' },
        analyticRoles: ['correlate', 'outlier', 'cluster'],
      },
      {
        widgetId: `${primaryWidgetId}_summary`,
        role: 'context',
        title: `${field} Distribution`,
        description: `Category summary for ${field} under the current scatter selection.`,
        source: {
          kind: 'templateSpec',
          spec: createCategorySummarySpec(field),
        },
        dataBinding: {
          sourceDataId: 'primary',
          transforms: [
            {
              kind: 'aggregate',
              groupBy: [field],
              metrics: [{ op: 'count', as: 'recordCount' }],
              sortBy: { field: 'recordCount', order: 'descending' },
            },
          ],
        },
        analyticRoles: ['compare', 'rank', 'distribution'],
      },
      {
        widgetId: `${primaryWidgetId}_table`,
        role: 'detail',
        kind: 'table',
        title: 'Filtered Records',
        description: 'Detail table showing the records currently revealed by the active scatter selection.',
        source: createDetailTableSource(),
        analyticRoles: ['lookup', 'detail', 'compare'],
      },
    ],
    links: [
      {
        linkId: `${primaryWidgetId}_filter_summary`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_summary`,
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Primary scatter selection filters the summary view.',
        fieldMapping: [],
      },
      {
        linkId: `${primaryWidgetId}_filter_table`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_table`,
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Primary scatter selection filters the detail table.',
        fieldMapping: [],
      },
      {
        linkId: `${primaryWidgetId}_summary_highlight_table`,
        sourceWidgetId: `${primaryWidgetId}_summary`,
        targetWidgetId: `${primaryWidgetId}_table`,
        primitive: 'highlight',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Category selection in the summary view highlights matching records in the detail table.',
        fieldMapping: [{ sourceField: field, targetField: field }],
      },
    ],
    rationale: [
      'A triple dashboard supports overview, grouped comparison, and exact record inspection in parallel.',
      'Scatter brush drives both grouped summary and detail rows without hiding raw records.',
      'This topology is suitable when the task requires both aggregate comparison and table-level evidence.',
    ],
    planningMode: 'topology_driven',
    primaryWidgetId,
    title: typeof spec?.title === 'string' ? `${spec.title} Dashboard` : 'Triple Dashboard Workspace',
  })
}

function buildDrillDownChainPlan({ sessionId, field, spec }) {
  const primaryWidgetId = sessionId ? `session_${sessionId}` : 'active_widget'
  return makeWorkspacePlanningResult({
    topology: 'T5',
    widgets: [
      {
        widgetId: primaryWidgetId,
        role: 'primary',
        source: { kind: 'baseSpec' },
        analyticRoles: ['correlate', 'outlier', 'cluster'],
      },
      {
        widgetId: `${primaryWidgetId}_summary`,
        role: 'context',
        title: `${field} Distribution`,
        description: `Category summary for ${field} under the current scatter selection.`,
        source: {
          kind: 'templateSpec',
          spec: createCategorySummarySpec(field),
        },
        dataBinding: {
          sourceDataId: 'primary',
          transforms: [
            {
              kind: 'aggregate',
              groupBy: [field],
              metrics: [{ op: 'count', as: 'recordCount' }],
              sortBy: { field: 'recordCount', order: 'descending' },
            },
          ],
        },
        analyticRoles: ['compare', 'rank', 'distribution'],
      },
      {
        widgetId: `${primaryWidgetId}_detail`,
        role: 'detail',
        kind: 'table',
        title: 'Drill-down Records',
        description: 'Detail rows reached through the staged summary-to-detail drill-down path.',
        source: createDetailTableSource(),
        analyticRoles: ['lookup', 'detail', 'compare'],
      },
    ],
    links: [
      {
        linkId: `${primaryWidgetId}_filter_summary`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_summary`,
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Primary scatter selection filters the summary view.',
        fieldMapping: [],
      },
      {
        linkId: `${primaryWidgetId}_summary_filter_detail`,
        sourceWidgetId: `${primaryWidgetId}_summary`,
        targetWidgetId: `${primaryWidgetId}_detail`,
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Summary-category selections progressively narrow the detail table.',
        fieldMapping: [{ sourceField: field, targetField: field }],
      },
    ],
    rationale: [
      'A drill-down chain should narrow the analysis scope in stages rather than fan out from a single controller.',
      'The summary view sits between overview and detail so each interaction progressively refines the evidence surface.',
    ],
    planningMode: 'topology_driven',
    primaryWidgetId,
    title: typeof spec?.title === 'string' ? `${spec.title} Drill-down` : 'Drill-down Chain Workspace',
  })
}

function buildGlobalControlPlan({ sessionId, field, spec }) {
  const primaryWidgetId = sessionId ? `session_${sessionId}` : 'active_widget'
  return makeWorkspacePlanningResult({
    topology: 'T6',
    widgets: [
      {
        widgetId: primaryWidgetId,
        role: 'primary',
        source: { kind: 'baseSpec' },
        analyticRoles: ['correlate', 'outlier', 'cluster'],
      },
      {
        widgetId: `${primaryWidgetId}_summary`,
        role: 'context',
        title: `${field} Distribution`,
        description: `Category summary for ${field} under the current global control selection.`,
        source: {
          kind: 'templateSpec',
          spec: createCategorySummarySpec(field),
        },
        dataBinding: {
          sourceDataId: 'primary',
          transforms: [
            {
              kind: 'aggregate',
              groupBy: [field],
              metrics: [{ op: 'count', as: 'recordCount' }],
              sortBy: { field: 'recordCount', order: 'descending' },
            },
          ],
        },
        analyticRoles: ['compare', 'rank', 'distribution'],
      },
      {
        widgetId: `${primaryWidgetId}_detail`,
        role: 'detail',
        kind: 'table',
        title: 'Filtered Records',
        description: 'Detail rows directly controlled by the global selection surface.',
        source: createDetailTableSource(),
        analyticRoles: ['lookup', 'detail', 'compare'],
      },
    ],
    links: [
      {
        linkId: `${primaryWidgetId}_filter_summary`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_summary`,
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Primary selection filters the grouped summary view.',
        fieldMapping: [],
      },
      {
        linkId: `${primaryWidgetId}_filter_detail`,
        sourceWidgetId: primaryWidgetId,
        targetWidgetId: `${primaryWidgetId}_detail`,
        primitive: 'filter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        description: 'Primary selection simultaneously filters the detail table.',
        fieldMapping: field ? [{ sourceField: field, targetField: field }] : [],
      },
    ],
    rationale: [
      'A global-control topology fans one interaction surface out to multiple dependent targets.',
      'Grouped context and detail rows update in parallel from the same primary control widget.',
    ],
    planningMode: 'topology_driven',
    primaryWidgetId,
    title: typeof spec?.title === 'string' ? `${spec.title} Global Control` : 'Global Control Workspace',
  })
}

export function planWorkspace({
  sessionId,
  spec,
  task = null,
  datasetSchema = null,
  userIntent = null,
  runMode = 'goal_oriented',
  complexityBudget = 'standard',
  preferredTopology = null,
}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return null
  }

  const rows = Array.isArray(spec?.data?.values) ? spec.data.values : []
  const planningSignals = derivePlanningSignals({ task, userIntent, runMode, complexityBudget })
  const widgetKind = inferWidgetKind(spec)
  const categoryField = findCategoricalField({ spec, rows, datasetSchema })
  const seriesField = findSeriesField({ spec, rows, datasetSchema })
  const valueField = findValueField(spec)
  const requestedTopology = typeof preferredTopology === 'string' ? preferredTopology : null
  const canUseScatterWorkspace = widgetKind === 'scatter' && hasQuantitativeXY(spec) && categoryField
  const canUseCoordinatedPair = !!categoryField
  const canUseLineWorkspace = widgetKind === 'line' && !!seriesField
  const canUseHeatmapWorkspace = widgetKind === 'heatmap' && hasCategoricalAxes(spec)
  const canUseMapWorkspace = widgetKind === 'map' && !!categoryField
  const canUseParallelWorkspace = widgetKind === 'parallelCoordinates'
  const canUseSankeyWorkspace = widgetKind === 'sankey' && !!categoryField
  const expansiveMode = planningSignals.expansiveMode
  const canUseTripleDashboard = canUseScatterWorkspace
  const taskDrivenMultiWidget = planningSignals.wantsMultiWidget
  const taskDrivenDetail = planningSignals.wantsDetailEvidence
  const taskDrivenSummary = planningSignals.wantsSummaryContext

  if (requestedTopology === 'T2' && canUseLineWorkspace) {
    return appendPlanningSignals(buildLineCoordinationPlan({ sessionId, field: seriesField, valueField, spec }), planningSignals)
  }
  if (requestedTopology === 'T2' && canUseHeatmapWorkspace) {
    return appendPlanningSignals(buildHeatmapDetailPlan({ sessionId, spec }), planningSignals)
  }
  if (requestedTopology === 'T2' && canUseMapWorkspace) {
    return appendPlanningSignals(buildMapDetailPlan({ sessionId, field: categoryField, spec }), planningSignals)
  }
  if (requestedTopology === 'T2' && canUseParallelWorkspace) {
    return appendPlanningSignals(buildParallelCoordinatesDetailPlan({ sessionId, spec }), planningSignals)
  }
  if (requestedTopology === 'T2' && canUseSankeyWorkspace) {
    return appendPlanningSignals(buildSankeyDetailPlan({ sessionId, field: categoryField, spec }), planningSignals)
  }
  if (requestedTopology === 'T4' && canUseTripleDashboard) {
    return appendPlanningSignals(buildTripleDashboardPlan({ sessionId, field: categoryField, spec }), planningSignals)
  }
  if (requestedTopology === 'T3' && canUseScatterWorkspace) {
    return appendPlanningSignals(buildScatterDetailPlan({ sessionId, field: categoryField, spec }), planningSignals)
  }
  if (requestedTopology === 'T5' && canUseScatterWorkspace) {
    return appendPlanningSignals(buildDrillDownChainPlan({ sessionId, field: categoryField, spec }), planningSignals)
  }
  if (requestedTopology === 'T6' && canUseScatterWorkspace) {
    return appendPlanningSignals(buildGlobalControlPlan({ sessionId, field: categoryField, spec }), planningSignals)
  }
  if (requestedTopology === 'T2' && canUseCoordinatedPair) {
    return appendPlanningSignals(buildCoordinatedPairPlan({ sessionId, field: categoryField, spec }), planningSignals)
  }
  if (requestedTopology === 'T1') {
    return appendPlanningSignals(buildSingleViewPlan({ sessionId, spec }), planningSignals)
  }

  if (canUseTripleDashboard && (complexityBudget === 'extended' || (taskDrivenMultiWidget && taskDrivenSummary && taskDrivenDetail))) {
    return appendPlanningSignals(buildTripleDashboardPlan({ sessionId, field: categoryField, spec }), planningSignals, [
      'Planner selected a triple-dashboard topology because the task requires cross-widget evidence, grouped context, and record-level detail together.',
    ])
  }

  if (canUseScatterWorkspace && (expansiveMode || taskDrivenDetail || taskDrivenMultiWidget)) {
    return appendPlanningSignals(buildScatterDetailPlan({ sessionId, field: categoryField, spec }), planningSignals, [
      'Planner selected a scatter-detail topology because the current task requires interaction-driven evidence or coordinated follow-up views.',
    ])
  }

  if (canUseLineWorkspace && (expansiveMode || taskDrivenDetail || taskDrivenSummary || taskDrivenMultiWidget)) {
    return appendPlanningSignals(buildLineCoordinationPlan({ sessionId, field: seriesField, valueField, spec }), planningSignals)
  }

  if (canUseHeatmapWorkspace && (expansiveMode || taskDrivenDetail || taskDrivenMultiWidget)) {
    return appendPlanningSignals(buildHeatmapDetailPlan({ sessionId, spec }), planningSignals)
  }

  if (canUseMapWorkspace && (expansiveMode || taskDrivenDetail || taskDrivenMultiWidget)) {
    return appendPlanningSignals(buildMapDetailPlan({ sessionId, field: categoryField, spec }), planningSignals)
  }

  if (canUseParallelWorkspace && (expansiveMode || taskDrivenDetail || taskDrivenMultiWidget)) {
    return appendPlanningSignals(buildParallelCoordinatesDetailPlan({ sessionId, spec }), planningSignals)
  }

  if (canUseSankeyWorkspace && (expansiveMode || taskDrivenDetail || taskDrivenMultiWidget)) {
    return appendPlanningSignals(buildSankeyDetailPlan({ sessionId, field: categoryField, spec }), planningSignals)
  }

  if (canUseCoordinatedPair && (expansiveMode || taskDrivenSummary || taskDrivenMultiWidget)) {
    return appendPlanningSignals(buildCoordinatedPairPlan({ sessionId, field: categoryField, spec }), planningSignals, [
      'Planner selected a coordinated-pair topology to provide an overview view plus grouped context without adding full detail-table complexity.',
    ])
  }

  return appendPlanningSignals(buildSingleViewPlan({ sessionId, spec }), planningSignals, [
    'Planner kept a single-view topology because the current task signals do not require additional coordination surfaces.',
  ])
}
