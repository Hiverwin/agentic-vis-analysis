import { decorateImportedWidget } from './importedWidgetContracts.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function makeDefaultLinkId(sourceWidgetId, targetWidgetId, primitive = 'selection_filter') {
  return `${sourceWidgetId}__${primitive}__${targetWidgetId}`
}

function buildDefaultLinkDefinitions(widgets) {
  if (!Array.isArray(widgets) || widgets.length < 2) return []
  return widgets.flatMap((sourceWidget) => (
    widgets
      .filter((targetWidget) => targetWidget.id !== sourceWidget.id)
      .map((targetWidget) => ({
        id: makeDefaultLinkId(sourceWidget.id, targetWidget.id),
        from: sourceWidget.id,
        to: targetWidget.id,
        primitive: 'filter',
        effect: 'applyFilter',
        activationPolicy: 'automatic',
        effectConstraint: null,
        scope: 'workspaceShared.selections',
        mode: 'linked-filter',
      }))
  ))
}

function buildAdvancedLinkDefinitions(widgets) {
  if (!Array.isArray(widgets) || widgets.length === 0) return []
  const links = []
  const widgetIds = new Set(widgets.map((widget) => widget?.id).filter(Boolean))
  if (widgetIds.has('w_line_year') && widgetIds.has('w_heatmap_origin_cyl')) {
    links.push({
      id: makeDefaultLinkId('w_line_year', 'w_heatmap_origin_cyl', 'selection_reencode'),
      from: 'w_line_year',
      to: 'w_heatmap_origin_cyl',
      primitive: 'reencode',
      effect: 'transformView',
      activationPolicy: 'automatic',
      effectConstraint: null,
      scope: 'workspaceShared.selections',
      mode: 'linked-reencode',
      responseSpec: {
        kind: 'reencode',
        params: {
          variant: 'transpose',
          transposed: true,
        },
        verificationHints: {
          preferredReadMethod: 'readVerificationState',
          checks: [
            'encodings.fieldsByChannel.x',
            'encodings.fieldsByChannel.y',
            'checks.encodingReadable',
          ],
        },
      },
    })
  }
  if (widgetIds.has('w_heatmap_origin_cyl') && widgetIds.has('w_sankey_cars')) {
    links.push({
      id: makeDefaultLinkId('w_heatmap_origin_cyl', 'w_sankey_cars', 'selection_reorder'),
      from: 'w_heatmap_origin_cyl',
      to: 'w_sankey_cars',
      primitive: 'reencode',
      effect: 'transformView',
      activationPolicy: 'automatic',
      effectConstraint: null,
      scope: 'workspaceShared.selections',
      mode: 'linked-reorder',
      responseSpec: {
        kind: 'reencode',
        params: {
          variant: 'reorderLayer',
          depth: 0,
          mode: 'selected-first',
          field: 'origin',
        },
        verificationHints: {
          preferredReadMethod: 'readVerificationState',
          checks: [
            'checks.encodingReadable',
            'feedback.linkedSourceRefCount',
          ],
        },
      },
    })
  }
  if (widgetIds.has('w_bar_origin') && widgetIds.has('w_line_year')) {
    links.push({
      id: makeDefaultLinkId('w_bar_origin', 'w_line_year', 'selection_drilldown'),
      from: 'w_bar_origin',
      to: 'w_line_year',
      primitive: 'drillDown',
      effect: 'transformView',
      activationPolicy: 'automatic',
      effectConstraint: null,
      scope: 'workspaceShared.selections',
      mode: 'linked-drilldown',
      responseSpec: {
        kind: 'drillDown',
        params: {
          variant: 'recordsByModel',
          xField: 'name',
          yField: 'mpg',
        },
        verificationHints: {
          preferredReadMethod: 'readVerificationState',
          checks: [
            'encodings.fieldsByChannel.x',
            'encodings.fieldsByChannel.y',
            'checks.encodingReadable',
          ],
        },
      },
    })
  }
  if (widgetIds.has('w_scatter_cars') && widgetIds.has('w_line_year')) {
    links.push({
      id: makeDefaultLinkId('w_scatter_cars', 'w_line_year', 'selection_sync_domain'),
      from: 'w_scatter_cars',
      to: 'w_line_year',
      primitive: 'syncDomain',
      effect: 'syncDomain',
      activationPolicy: 'automatic',
      effectConstraint: null,
      scope: 'workspaceShared.selections',
      mode: 'linked-domain',
    })
  }
  if (widgetIds.has('w_line_year') && widgetIds.has('w_sankey_cars')) {
    links.push({
      id: makeDefaultLinkId('w_line_year', 'w_sankey_cars', 'selection_collapse'),
      from: 'w_line_year',
      to: 'w_sankey_cars',
      primitive: 'structure',
      effect: 'transformStructure',
      activationPolicy: 'automatic',
      effectConstraint: null,
      scope: 'workspaceShared.selections',
      mode: 'linked-collapse',
      responseSpec: {
        kind: 'collapse',
        params: {
          variant: 'collapseNodes',
          nodes: ['origin:Japan', 'origin:Europe'],
          aggregateName: 'origin:other',
        },
        verificationHints: {
          preferredReadMethod: 'readVerificationState',
          checks: [
            'checks.encodingReadable',
            'feedback.linkedSourceRefCount',
          ],
        },
      },
    })
  }
  if (widgetIds.has('w_scatter_cars') && widgetIds.has('w_sankey_cars')) {
    links.push({
      id: makeDefaultLinkId('w_scatter_cars', 'w_sankey_cars', 'selection_expand'),
      from: 'w_scatter_cars',
      to: 'w_sankey_cars',
      primitive: 'structure',
      effect: 'transformStructure',
      activationPolicy: 'automatic',
      effectConstraint: null,
      scope: 'workspaceShared.selections',
      mode: 'linked-expand',
      responseSpec: {
        kind: 'expand',
        params: {
          variant: 'expandNode',
          aggregateName: 'collapsed:0:other',
          topN: 2,
        },
        verificationHints: {
          preferredReadMethod: 'readVerificationState',
          checks: [
            'checks.encodingReadable',
            'feedback.linkedSourceRefCount',
          ],
        },
      },
    })
  }
  if (widgetIds.has('w_bar_origin') && widgetIds.has('w_sankey_cars')) {
    links.push({
      id: makeDefaultLinkId('w_bar_origin', 'w_sankey_cars', 'selection_aggregate'),
      from: 'w_bar_origin',
      to: 'w_sankey_cars',
      primitive: 'aggregate',
      effect: 'transformDataView',
      activationPolicy: 'automatic',
      effectConstraint: null,
      scope: 'workspaceShared.selections',
      mode: 'linked-aggregate',
      responseSpec: {
        kind: 'aggregate',
        params: {
          variant: 'autoCollapseByRank',
          topN: 2,
        },
        verificationHints: {
          preferredReadMethod: 'readVerificationState',
          checks: [
            'checks.encodingReadable',
            'feedback.linkedSourceRefCount',
          ],
        },
      },
    })
  }
  return links
}

export function buildWorkspaceComposition(caseDefinition) {
  const widgets = (caseDefinition?.widgets || []).map((widget) => decorateImportedWidget(widget))
  const links = [
    ...buildDefaultLinkDefinitions(widgets),
    ...buildAdvancedLinkDefinitions(widgets),
  ]
  const selectedWidgetId = widgets[0]?.id || null

  return {
    caseId: caseDefinition?.id || null,
    topology: caseDefinition?.topology || 'grid-overview',
    widgets,
    links,
    selectedWidgetId,
  }
}

export function cloneWorkspaceComposition(composition) {
  return clone(composition)
}
