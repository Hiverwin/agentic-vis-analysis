import {
  makeCurrentSelectionDataRef,
  makeCurrentViewDataRef,
  makeDataRef,
  makeLinkRef,
  makeSelectionRef,
  makeSelectionScopedDataRef,
  makeWidgetRef,
  makeWidgetSelectionDataRef,
} from '../../../../contracts/refs-contracts.js'
import { makeWidgetDescription, makeWorkspaceDescription } from '../../../../workspace/store/workspaceStoreReaders.js'
import { makeSelectionState, makeWorkspaceState } from '../../../../contracts/state-contracts.js'
import { makeWidgetLink } from '../../../../contracts/widget-links-contracts.js'
import { normalizeViewportState } from '../../../../workspace/state/viewportStateModel.js'
import { withFocusSubmodel } from '../../../../workspace/state/focusStateModel.js'
import { deriveHighlightState, withHighlightSubmodel } from '../../../../workspace/state/highlightStateModel.js'
import { withSelectionSubmodel } from '../../../../workspace/state/selectionStateModel.js'
import { createVegaLiteWidgetAdapter } from '../../../../adapters/vegaLite/VegaLiteWidgetAdapter.js'
import { createDataQueryEngine } from '../../../data/index.js'
import {
  buildActionDescriptors,
  buildDataHandle,
  buildDerivedDataHandle,
  buildPerceptionDescriptors,
} from './workspaceDescriptorBuilders.js'
import { normalizeWorkspacePlan } from './workspacePlanBuilder.js'
import {
  applySelectionToSpec,
  applyHighlightToSpec,
  applyLinkedViewStateToSpec,
  buildWidgetState,
} from '../state/widgetStateBuilders.js'
import {
  countSelectedRowsForSelections,
  mapSelectionToTargetSelection,
  rowMatchesSelection,
  rowMatchesAnySelection,
} from '../state/selectionHelpers.js'
import { buildSelectionStateInput } from '../state/selectionStateShape.js'
import {
  applySupportedSpecTransforms,
} from '../state/transformHelpers.js'
import { deriveGlobalFiltersFromState } from '../../../../workspace/state/sharedStateDerivation.js'
import { deriveWorkspaceTopology } from '../../../../workspace/coordination/deriveWorkspaceTopology.js'
import { summarizeWidgetAdapter } from '../../summaries/summarizeWidgetAdapter.js'
import {
  WORKSPACE_PLAN_MODES,
  WORKSPACE_PLAN_SOURCES,
  WORKSPACE_PLANNING_BUDGETS,
  WORKSPACE_PLANNING_RUN_MODES,
  WORKSPACE_PLANNING_TOPOLOGIES,
} from '../../../../schemas/planning-constants.schema.js'
import { getWidgetFamilyHumanInteractionConfig } from '../../../../widgets/families/index.js'

const dataQueryEngine = createDataQueryEngine({ kind: 'js_array' })

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function getInlineRows(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return []
  }
  const rows = spec?.data?.values
  if (Array.isArray(rows)) {
    return rows
  }
  if (Array.isArray(spec?.data)) {
    const namedValues = spec.data
      .map((entry) => (Array.isArray(entry?.values) ? entry.values : null))
      .find((entry) => Array.isArray(entry) && entry.length > 0)
    if (Array.isArray(namedValues)) {
      return namedValues
    }
  }
  if (spec.spec && typeof spec.spec === 'object' && !Array.isArray(spec.spec)) {
    const nestedRows = getInlineRows(spec.spec)
    if (nestedRows.length > 0) {
      return nestedRows
    }
  }
  const compositeChildren = [
    ...(Array.isArray(spec?.vconcat) ? spec.vconcat : []),
    ...(Array.isArray(spec?.hconcat) ? spec.hconcat : []),
    ...(Array.isArray(spec?.concat) ? spec.concat : []),
    ...(Array.isArray(spec?.layer) ? spec.layer : []),
  ]
  for (const child of compositeChildren) {
    const childRows = getInlineRows(child)
    if (childRows.length > 0) {
      return childRows
    }
  }
  return []
}

function getTitleText(title) {
  if (typeof title === 'string') return title
  if (title && typeof title === 'object' && typeof title.text === 'string') return title.text
  return null
}

function isSelectionPayload(selection) {
  return selection != null && typeof selection === 'object' && !Array.isArray(selection)
}

function normalizeSelectionPayloadEntries({ selections, fallbackSelection }) {
  const entries = []
  const pushSelection = (selection, fallbackKey = null) => {
    if (!isSelectionPayload(selection)) return
    const sourceWidgetId = selection.source_widget_id || null
    const selectionId = selection.selection_id || selection.id || null
    if (!sourceWidgetId || !selectionId) return
    entries.push([fallbackKey || `${sourceWidgetId}::${selectionId}`, selection, { sourceWidgetId, selectionId }])
  }

  if (selections && typeof selections === 'object' && !Array.isArray(selections)) {
    for (const [key, value] of Object.entries(selections)) {
      pushSelection(value, key || null)
    }
  }

  if (entries.length === 0 && isSelectionPayload(fallbackSelection)) {
    pushSelection(fallbackSelection)
  }

  return entries
}

function buildActiveSelectionMap({ appId, workspaceId, selections, fallbackSelection }) {
  return Object.fromEntries(
    normalizeSelectionPayloadEntries({ selections, fallbackSelection })
      .map(([, selection, selectionMeta]) => [
        makeSelectionRef({
          appId,
          workspaceId,
          widgetId: selectionMeta.sourceWidgetId,
          selectionId: selectionMeta.selectionId,
        }),
        makeSelectionState(buildSelectionStateInput(selection)),
      ]),
  )
}

function buildActiveSelectionEntries({ appId, workspaceId, selections, fallbackSelection }) {
  return normalizeSelectionPayloadEntries({ selections, fallbackSelection })
    .map(([, selection, selectionMeta]) => ({
      ref: makeSelectionRef({
        appId,
        workspaceId,
        widgetId: selectionMeta.sourceWidgetId,
        selectionId: selectionMeta.selectionId,
      }),
      widgetId: selectionMeta.sourceWidgetId,
      selectionId: selectionMeta.selectionId,
      selection,
    }))
}

function resolvePrimarySelection({ selection, selections, preferredWidgetId = null }) {
  if (isSelectionPayload(selection)) return selection
  const entries = normalizeSelectionPayloadEntries({ selections, fallbackSelection: null })
  if (entries.length === 0) return null
  if (preferredWidgetId) {
    const preferredEntry = entries.find(([, , selectionMeta]) => selectionMeta?.sourceWidgetId === preferredWidgetId)
    if (preferredEntry?.[1]) return preferredEntry[1]
  }
  if (entries.length === 1) return entries[0]?.[1] || null
  return entries[entries.length - 1]?.[1] || null
}

function buildPlanningTaskContext({ planningRequest, coordinationScope, targetWidgetRefs }) {
  const task = planningRequest?.task || null
  const runMode = planningRequest?.runMode || null
  const complexityBudget = planningRequest?.complexityBudget || null
  const userIntent = planningRequest?.userIntent || null
  const userQuery = task?.userQuery || userIntent || null
  const expectedAnswerType = task?.answerType || task?.expectedAnswerType || null
  const taskMode = task?.taskMode || runMode || 'goal_oriented'

  return {
    taskId: task?.taskId || null,
    userQuery,
    taskMode,
    runMode,
    coordinationScope: task?.coordinationScope || coordinationScope,
    expectedAnswerType,
    interactionHorizon: task?.interactionHorizon || null,
    evidenceType: task?.evidenceType || null,
    complexityBudget,
    targetWidgetRefs,
  }
}

function inferWidgetKind(spec) {
  if (spec?.kind === 'parallelCoordinates') return 'parallelCoordinates'
  if (spec?.kind === 'sankey') return 'sankey'
  if (spec?.kind === 'map') return 'map'
  const mark = typeof spec?.mark === 'string' ? spec.mark : spec?.mark?.type
  if (mark === 'bar') return 'bar'
  if (mark === 'line') return 'line'
  if (mark === 'point' || mark === 'circle') return 'scatter'
  if (mark === 'rect') return 'heatmap'
  return 'custom'
}

function inferAnalyticRoles(kind) {
  switch (kind) {
    case 'scatter':
      return ['correlate', 'cluster', 'outlier', 'distribution']
    case 'bar':
      return ['compare', 'rank', 'distribution']
    case 'line':
      return ['trend', 'compare']
    case 'heatmap':
      return ['distribution', 'outlier', 'compare']
    case 'parallelCoordinates':
      return ['compare', 'outlier', 'distribution']
    case 'sankey':
      return ['flow', 'compare']
    case 'map':
      return ['geoPattern', 'compare', 'distribution']
    default:
      return ['lookup']
  }
}

function buildEncodings(spec) {
  const enc = spec?.encoding || {}
  const normalized = {}
  for (const [channel, value] of Object.entries(enc)) {
    if (!value || typeof value !== 'object') continue
    normalized[channel] = {
      field: value.field,
      type: value.type,
      aggregate: value.aggregate,
      bin: value.bin,
      scale: value.scale,
    }
  }
  return normalized
}

function aggregateRows(rows, transform) {
  const result = dataQueryEngine.aggregate(rows, {
    groupBy: Array.isArray(transform?.groupBy) ? transform.groupBy.filter(Boolean) : [],
    measures: Array.isArray(transform?.metrics) ? transform.metrics : [],
    sortBy: transform?.sortBy,
    limit: transform?.limit,
  })
  return result.rows
}

function buildLinkRef({ appId, workspaceId, linkId }) {
  return `wl://${appId}/workspace/${workspaceId}/link/${linkId}`
}

function uniqueRecognizedKinds(kinds = []) {
  return [...new Set((Array.isArray(kinds) ? kinds : []).filter((kind) => typeof kind === 'string' && kind.length > 0))]
}

function shouldInlineRowsIntoSpec({ source, spec, rows }) {
  return Array.isArray(rows)
    && rows.length > 0
    && !Array.isArray(spec?.data)
    && source?.provider !== 'vega'
    && source?.providerSpec?.provider !== 'vega'
}

function withInlineRows(spec, rows) {
  const currentData = spec?.data
  const baseData = currentData && typeof currentData === 'object' && !Array.isArray(currentData)
    ? currentData
    : {}
  return {
    ...baseData,
    values: rows,
  }
}

function buildSpecFromSource({ source, baseSpec, rows }) {
  if (source?.kind === 'baseSpec') {
    const nextSpec = JSON.parse(JSON.stringify(baseSpec))
    if (shouldInlineRowsIntoSpec({ source, spec: nextSpec, rows })) {
      nextSpec.data = withInlineRows(nextSpec, rows)
    }
    return nextSpec
  }
  if (source?.kind === 'nativeArtifact' && source?.providerSpec?.spec) {
    const nextSpec = JSON.parse(JSON.stringify(source.providerSpec.spec))
    if (shouldInlineRowsIntoSpec({ source, spec: nextSpec, rows })) {
      nextSpec.data = withInlineRows(nextSpec, rows)
    }
    return nextSpec
  }
  if (source?.kind === 'templateSpec' && source.spec) {
    const nextSpec = JSON.parse(JSON.stringify(source.spec))
    // Preserve the author-provided data binding for imported specs that rely on
    // external URLs or named datasets. Overwriting them with an empty inline
    // array causes bound workspaces to render blank immediately after bind.
    if (shouldInlineRowsIntoSpec({ source, spec: nextSpec, rows })) {
      nextSpec.data = withInlineRows(nextSpec, rows)
    }
    return nextSpec
  }
  return null
}

function getSourceTransforms({ widgetDef, baseSpec }) {
  if (widgetDef?.source?.kind === 'baseSpec') {
    return Array.isArray(baseSpec?.transform) ? baseSpec.transform : []
  }
  if (widgetDef?.source?.kind === 'templateSpec') {
    return Array.isArray(widgetDef?.source?.spec?.transform) ? widgetDef.source.spec.transform : []
  }
  if (widgetDef?.source?.kind === 'nativeArtifact') {
    return Array.isArray(widgetDef?.source?.providerSpec?.spec?.transform)
      ? widgetDef.source.providerSpec.spec.transform
      : []
  }
  return []
}

function readSpecFromWidgetSource(source = null) {
  if (source?.kind === 'nativeArtifact' && source?.providerSpec?.spec) {
    return source.providerSpec.spec
  }
  if (source?.kind === 'templateSpec' && source?.spec) {
    return source.spec
  }
  return null
}

function readMaterializationRootSpec({ spec, workspaceSpec }) {
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) return spec
  const sourceSpec = (Array.isArray(workspaceSpec?.widgets) ? workspaceSpec.widgets : [])
    .map((widgetDef) => readSpecFromWidgetSource(widgetDef?.source))
    .find((candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate))
  return sourceSpec || null
}

function materializeRows({ baseRows, widgetDef, inboundLinks, activeSelections, sourceTransforms = [] }) {
  let rows = applySupportedSpecTransforms({
    rows: baseRows,
    transforms: sourceTransforms,
    dataQueryEngine,
  })
  const filteringLinks = inboundLinks.filter((link) => link.kind === 'filter')
  if (filteringLinks.length > 0 && Array.isArray(activeSelections) && activeSelections.length > 0) {
    for (const link of filteringLinks) {
      const relevantSelections = activeSelections.filter((entry) => entry?.widgetId === link.sourceWidgetId)
      for (const selectionEntry of relevantSelections) {
        const mappedSelection = mapSelectionToTargetSelection(selectionEntry.selection, link.fieldMapping)
        rows = dataQueryEngine.filter(rows, mappedSelection?.predicates || [])
      }
    }
  }

  const transforms = Array.isArray(widgetDef?.dataBinding?.transforms) ? widgetDef.dataBinding.transforms : []
  for (const transform of transforms) {
    if (transform?.kind === 'aggregate') {
      rows = aggregateRows(rows, transform)
    }
  }
  return rows
}

export function materializeWorkspace({
  appId = 'widgetva-app',
  workspaceId = 'main',
  sessionId,
  spec,
  workspaceSpec = null,
  planningRequest = null,
  replayContext = null,
  selection,
  selections = null,
  focusedWidgetRef = null,
  focusState = null,
  highlightState = null,
  viewportState = null,
  previousState = null,
  currentBranchId = 'main',
  stateManager = null,
}) {
  const materializationSpec = readMaterializationRootSpec({ spec, workspaceSpec })
  const {
    plan,
    validation: workspaceSpecValidation,
    summary: workspaceSpecSummary,
    planningSummary,
    materializedFromSpec,
    materializedFromPlanner,
  } = normalizeWorkspacePlan({ sessionId, spec: materializationSpec, workspaceSpec, planningRequest })
  const workspaceSpecStatus = !workspaceSpecSummary
    ? (materializedFromPlanner ? 'planned' : 'idle')
    : workspaceSpecValidation.ok
      ? (materializedFromSpec ? 'materialized' : 'deferred')
      : 'invalid'

  if (!materializationSpec || typeof materializationSpec !== 'object' || Array.isArray(materializationSpec)) {
    return {
      description: {
        appId,
        workspaceId,
        generatedAt: new Date().toISOString(),
        workspaceCapabilities: ['singleWidgetAnalysis'],
        taskContext: null,
        planning: {
          requestedWorkspaceSpec: workspaceSpecSummary,
          planningRequest: planningRequest || null,
          workspaceSpecStatus,
          workspaceSpecIssues: workspaceSpecValidation.issues,
          materializedFromSpec,
          materializedFromPlanner,
          planner: planningSummary,
        },
        widgets: [],
        dataHandles: [],
        links: [],
        actions: [],
        perceptionQueries: [],
      },
        state: {
          stateId: `${workspaceId}:empty`,
          createdAt: new Date().toISOString(),
          widgets: {},
          shared: {
            selections: {
              registry: {},
              views: {
                primary: null,
                byWidget: {},
              },
            },
            globalFilters: {},
          },
        },
      replayContext,
    }
  }

  const dataHandle = buildDataHandle({ appId, workspaceId, spec: materializationSpec })
  const baseRows = getInlineRows(materializationSpec)
  const runtimeData = {
    [dataHandle.ref]: {
      ref: dataHandle.ref,
      rows: baseRows,
      handle: dataHandle,
    },
  }
  const primarySelection = resolvePrimarySelection({
    selection,
    selections,
    preferredWidgetId: plan.primaryWidgetId || null,
  })
  const activeSelections = buildActiveSelectionMap({
    appId,
    workspaceId,
    selections,
    fallbackSelection: primarySelection,
  })
  const activeSelectionEntries = buildActiveSelectionEntries({
    appId,
    workspaceId,
    selections,
    fallbackSelection: primarySelection,
  })
  const normalizedViewportState = normalizeViewportState(viewportState)
  const selectionSourceWidgetId = primarySelection?.source_widget_id || plan.primaryWidgetId
  const selectionRef = primarySelection?.selection_id && selectionSourceWidgetId
    ? makeSelectionRef({
        appId,
        workspaceId,
        widgetId: selectionSourceWidgetId,
        selectionId: primarySelection.selection_id,
      })
    : null
  const widgets = {}
  const widgetDescriptions = []
  const widgetAdapters = []
  const actionDescriptors = []
  const perceptionDescriptors = []
  const dataHandles = [dataHandle]
  const structuralLinks = []
  const widgetRefsById = new Map()

  for (const widgetDef of plan.widgets) {
    const widgetRef = makeWidgetRef({ appId, workspaceId, widgetId: widgetDef.widgetId })
    widgetRefsById.set(widgetDef.widgetId, widgetRef)
  }

  for (const widgetDef of plan.widgets) {
    const widgetRef = widgetRefsById.get(widgetDef.widgetId)
    const inboundLinks = (plan.links || []).filter((link) => link.targetWidgetId === widgetDef.widgetId)
    const localSelectionEntries = activeSelectionEntries.filter((entry) => entry.widgetId === widgetDef.widgetId)
    const inboundSharedSelectionLinks = inboundLinks.filter((link) => link.kind === 'sharesSelection')
    const mirroredSelectionEntries = inboundSharedSelectionLinks.flatMap((link) =>
      activeSelectionEntries
        .filter((entry) => entry.widgetId === link.sourceWidgetId)
        .map((entry) => ({
          ref: makeSelectionRef({
            appId,
            workspaceId,
            widgetId: widgetDef.widgetId,
            selectionId: `shared_from_${link.sourceWidgetId}_${entry.selectionId}`,
          }),
          selection: mapSelectionToTargetSelection(entry.selection, link.fieldMapping),
          sourceWidgetId: link.sourceWidgetId,
        }))
        .filter((entry) => entry.selection),
    )
    const widgetSelectionEntries = localSelectionEntries.map((entry) => ({
      ref: entry.ref,
      selection: entry.selection,
    }))
    const widgetRuntimeSelections = [
      ...widgetSelectionEntries.map((entry) => entry.selection),
      ...mirroredSelectionEntries.map((entry) => entry.selection),
    ]
    const widgetSourceSpec = readSpecFromWidgetSource(widgetDef?.source)
    const widgetSourceRows = getInlineRows(widgetSourceSpec)
    const widgetBaseRows = widgetSourceRows.length > 0 ? widgetSourceRows : baseRows
    const sourceTransforms = getSourceTransforms({ widgetDef, baseSpec: widgetSourceSpec || materializationSpec })
    const materializedRows = materializeRows({
      baseRows: widgetBaseRows,
      widgetDef,
      inboundLinks,
      activeSelections: activeSelectionEntries,
      sourceTransforms,
    })
    const visibleDataRef = makeDataRef({
      appId,
      workspaceId,
      dataId: `${widgetDef.widgetId}_visible`,
    })
    const widgetSpec = buildSpecFromSource({
      source: widgetDef.source,
      baseSpec: materializationSpec,
      rows: materializedRows,
    })
    if (!widgetSpec) continue
    const runtimeSpec = applyLinkedViewStateToSpec({
      widgetSpec,
      inboundLinks,
      activeSelections: activeSelectionEntries
        .filter((entry) => inboundLinks.some((link) => link.kind === 'syncDomain' && link.sourceWidgetId === entry.widgetId))
        .map((entry) => entry.selection),
    })
    const selectionVisibleOnWidget =
      widgetRuntimeSelections.length > 0
    const materializedSelectedCount = selectionVisibleOnWidget
      ? countSelectedRowsForSelections(materializedRows, widgetRuntimeSelections)
      : 0
    const selectedRows = selectionVisibleOnWidget
      ? materializedRows.filter((row) => rowMatchesAnySelection(row, widgetRuntimeSelections))
      : []
    const selectedSpec = applySelectionToSpec({
      widgetSpec: runtimeSpec,
      activeSelections: widgetRuntimeSelections,
      selectionEnabled: selectionVisibleOnWidget,
    })
    const highlightedSpec = applyHighlightToSpec({
      widgetSpec: selectedSpec,
      inboundLinks,
      activeSelections: activeSelectionEntries
        .filter((entry) => inboundLinks.some((link) => link.kind === 'highlight' && link.sourceWidgetId === entry.widgetId))
        .map((entry) => mapSelectionToTargetSelection(
          entry.selection,
          inboundLinks.find((link) => link.kind === 'highlight' && link.sourceWidgetId === entry.widgetId)?.fieldMapping,
        )),
    })
    const visibleDataHandle = buildDerivedDataHandle({
      ref: visibleDataRef,
      title: `${widgetDef.title || widgetDef.widgetId} Visible Data`,
      description: `Current visible rows for widget ${widgetDef.widgetId}.`,
      rows: materializedRows,
      selectedCount: materializedSelectedCount,
      kind: 'dataView',
      scope: 'visible',
      widgetRef,
    })
    runtimeData[visibleDataRef] = {
      ref: visibleDataRef,
      rows: materializedRows,
      baseRows: materializedRows,
      handle: visibleDataHandle,
      widgetRef,
    }
    dataHandles.push(visibleDataHandle)
    structuralLinks.push(makeWidgetLink({
      ref: makeLinkRef({
        appId,
        workspaceId,
        linkId: `${widgetDef.widgetId}_uses_visible_data`,
      }),
      kind: 'usesData',
      from: widgetRef,
      to: visibleDataRef,
      sourceRef: widgetRef,
      targetRef: visibleDataRef,
      sourceDataRef: dataHandle.ref,
      targetDataRef: visibleDataRef,
      description: `${widgetDef.widgetId} reads from its current visible data view.`,
      activationPolicy: 'manual',
    }))
    structuralLinks.push(makeWidgetLink({
      ref: makeLinkRef({
        appId,
        workspaceId,
        linkId: `${widgetDef.widgetId}_visible_derives_from_source`,
      }),
      kind: 'derivesFrom',
      from: visibleDataRef,
      to: dataHandle.ref,
      sourceRef: visibleDataRef,
      targetRef: dataHandle.ref,
      sourceDataRef: visibleDataRef,
      targetDataRef: dataHandle.ref,
      description: `${widgetDef.widgetId} visible data is derived from the primary workspace data handle.`,
      activationPolicy: 'manual',
    }))

    if (selectionVisibleOnWidget) {
      const selectionDataRef = makeWidgetSelectionDataRef({
        appId,
        workspaceId,
        widgetId: widgetDef.widgetId,
      })
      const selectionDataHandle = buildDerivedDataHandle({
        ref: selectionDataRef,
        title: `${widgetDef.title || widgetDef.widgetId} Selection Data`,
        description: `Current rows selected on widget ${widgetDef.widgetId}.`,
        rows: selectedRows,
        selectedCount: selectedRows.length,
        kind: 'selectionData',
        scope: 'combined',
        widgetRef,
      })
      runtimeData[selectionDataRef] = {
        ref: selectionDataRef,
        rows: selectedRows,
        baseRows: materializedRows,
        handle: selectionDataHandle,
        widgetRef,
        kind: 'selectionData',
        scope: 'combined',
      }
      dataHandles.push(selectionDataHandle)
      structuralLinks.push(makeWidgetLink({
        ref: makeLinkRef({
          appId,
          workspaceId,
          linkId: `${widgetDef.widgetId}_selection_data_derives_from_visible`,
        }),
        kind: 'derivesFrom',
        from: selectionDataRef,
        to: visibleDataRef,
        sourceRef: selectionDataRef,
        targetRef: visibleDataRef,
        sourceDataRef: selectionDataRef,
        targetDataRef: visibleDataRef,
        description: `${widgetDef.widgetId} combined selection data is derived from the widget visible data view.`,
        activationPolicy: 'manual',
      }))

      for (const entry of widgetSelectionEntries) {
        const selectionId = entry?.ref?.split('/').pop() || null
        if (!selectionId || !entry?.selection) continue
        const selectionRows = materializedRows.filter((row) => rowMatchesSelection(row, entry.selection))
        const selectionScopedDataRef = makeSelectionScopedDataRef({
          appId,
          workspaceId,
          widgetId: widgetDef.widgetId,
          selectionId,
        })
        const selectionScopedDataHandle = buildDerivedDataHandle({
          ref: selectionScopedDataRef,
          title: `${widgetDef.title || widgetDef.widgetId} Selection ${selectionId} Data`,
          description: `Current rows for selection ${selectionId} on widget ${widgetDef.widgetId}.`,
          rows: selectionRows,
          selectedCount: selectionRows.length,
          kind: 'selectionData',
          scope: 'selection',
          widgetRef,
          sourceSelectionRef: entry.ref,
        })
        runtimeData[selectionScopedDataRef] = {
          ref: selectionScopedDataRef,
          rows: selectionRows,
          baseRows: materializedRows,
          handle: selectionScopedDataHandle,
          widgetRef,
          sourceSelectionRef: entry.ref,
          kind: 'selectionData',
          scope: 'selection',
        }
        dataHandles.push(selectionScopedDataHandle)
        structuralLinks.push(makeWidgetLink({
          ref: makeLinkRef({
            appId,
            workspaceId,
            linkId: `${widgetDef.widgetId}_${selectionId}_contains_selection`,
          }),
          kind: 'contains',
          from: widgetRef,
          to: entry.ref,
          sourceRef: widgetRef,
          targetRef: entry.ref,
          description: `${widgetDef.widgetId} contains the local selection ${selectionId}.`,
          activationPolicy: 'manual',
        }))
        structuralLinks.push(makeWidgetLink({
          ref: makeLinkRef({
            appId,
            workspaceId,
            linkId: `${widgetDef.widgetId}_${selectionId}_selection_data_derives_from_selection`,
          }),
          kind: 'derivesFrom',
          from: selectionScopedDataRef,
          to: entry.ref,
          sourceRef: selectionScopedDataRef,
          targetRef: entry.ref,
          sourceDataRef: visibleDataRef,
          description: `${widgetDef.widgetId} selection-scoped data is derived from selection ${selectionId}.`,
          activationPolicy: 'manual',
        }))
      }
    }

    const widgetKind = widgetDef.kind || inferWidgetKind(highlightedSpec)
    const linkedRefs = inboundLinks
      .map((link) => widgetRefsById.get(link.sourceWidgetId))
      .filter(Boolean)
    const outboundRefs = (plan.links || [])
      .filter((link) => link.sourceWidgetId === widgetDef.widgetId)
      .map((link) => widgetRefsById.get(link.targetWidgetId))
      .filter(Boolean)
    const affectedRefs = [widgetRef, ...new Set(outboundRefs)]
    const widgetSelectionRef = widgetSelectionEntries[0]?.ref || null

    const widgetActions = buildActionDescriptors({
      widgetRef,
      selectionRef: widgetSelectionRef,
      widgetKind,
      widgetSourceKind: widgetDef.source?.kind,
      widgetSpec: highlightedSpec,
      widgetDef,
      scope: outboundRefs.length > 0 ? 'workspace' : 'local',
      affectedRefs,
    })
    const widgetPerceptions = buildPerceptionDescriptors({
      appId,
      workspaceId,
      widgetRef,
      dataRef: visibleDataRef,
      widgetKind,
      widgetDef,
      widgetSpec: highlightedSpec,
    })
    const humanInteraction = getWidgetFamilyHumanInteractionConfig(widgetKind, {
      widgetRef,
      widgetDef,
      widgetSpec: highlightedSpec,
    })

    const widgetDescription = makeWidgetDescription({
      ref: widgetRef,
      widgetId: widgetDef.widgetId,
      role: widgetDef.role,
      kind: widgetKind,
      recognizedKinds: uniqueRecognizedKinds(
        highlightedSpec?.__widgetvaRecognizedKinds
        || highlightedSpec?.recognizedKinds
        || highlightedSpec?.__widgetvaCandidateKinds
        || highlightedSpec?.candidateKinds
        || widgetDef?.recognizedKinds
        || widgetDef?.candidateKinds,
      ),
      sourceKind: widgetDef.source?.kind || null,
      supportsSpecMutation: widgetDef.source?.kind === 'baseSpec',
      title: widgetDef.title || getTitleText(highlightedSpec?.title) || widgetDef.widgetId,
      description: widgetDef.description || 'Workspace visualization widget.',
      analyticRoles: Array.isArray(widgetDef.analyticRoles) && widgetDef.analyticRoles.length > 0
        ? widgetDef.analyticRoles
        : inferAnalyticRoles(widgetKind),
      primaryDataRef: dataHandle.ref,
      actionNames: widgetActions.map((d) => d.name),
      perceptionQueryNames: widgetPerceptions.map((d) => d.name),
      usageNotes: widgetDef.usageNotes || [],
      humanInteraction,
    })
    widgetDescriptions.push(widgetDescription)

    const widgetState = buildWidgetState({
      widgetRef,
      widgetId: widgetDef.widgetId,
      role: widgetDef.role,
      kind: widgetKind,
      updatedAt: new Date().toISOString(),
      sourceDataRef: dataHandle.ref,
      currentDataRef: visibleDataRef,
      rowCount: dataHandle.stats?.rowCount || 0,
      visibleCount: materializedRows.length,
      selectedCount: materializedSelectedCount,
      widgetSpec: highlightedSpec,
      inboundLinks,
      activeSelections: widgetRuntimeSelections,
      widgetSelectionRefs: widgetSelectionEntries,
      mirroredSelectionEntries,
      humanInteraction,
      linkedRefs,
      existingFeedback: previousState?.widgets?.[widgetRef]?.feedback,
    })
    widgets[widgetRef] = widgetState

    widgetAdapters.push({
      ...createVegaLiteWidgetAdapter({ kind: widgetKind }),
      provider: widgetDef.provider || 'vega-lite',
      widgetRef,
      dataRef: visibleDataRef,
      kind: widgetKind,
      title: widgetDescription.title,
      description: widgetDescription.description,
      analyticRoles: widgetDescription.analyticRoles,
      primaryDataRef: dataHandle.ref,
      role: widgetDef.role,
      sourceKind: widgetDef.source?.kind || null,
      supportsSpecMutation: widgetDef.source?.kind === 'baseSpec',
      actionNames: widgetActions.map((d) => d.name),
      perceptionQueryNames: widgetPerceptions.map((d) => d.name),
      usageNotes: widgetDef.usageNotes || [],
      humanInteraction,
      metadata: {
        widgetId: widgetDef.widgetId,
        role: widgetDef.role,
        primaryDataRef: dataHandle.ref,
        currentDataRef: visibleDataRef,
      },
    })

    actionDescriptors.push(...widgetActions)
    perceptionDescriptors.push(...widgetPerceptions)
  }

  const coordinationLinks = (plan.links || []).map((link) => {
    if (typeof link?.sourceStateRef === 'string' && typeof link?.targetStateRef === 'string') {
      return {
        ...cloneValue(link),
        ref: link.ref || link.linkId || link.id,
        linkId: link.linkId || link.id || link.ref,
        relation: link.relation || 'controls',
        activation: link.activation || link.activationPolicy || 'automatic',
      }
    }
    return makeWidgetLink({
      ref: buildLinkRef({ appId, workspaceId, linkId: link.linkId }),
      kind: link.kind,
      from: widgetRefsById.get(link.sourceWidgetId) || null,
      to: widgetRefsById.get(link.targetWidgetId) || null,
      description: link.description || `${link.sourceWidgetId} -> ${link.targetWidgetId}`,
      effect: link.effect
        || (link.kind === 'filter'
          ? 'applyFilter'
          : link.kind === 'highlight'
            ? 'applyHighlight'
            : link.kind === 'syncDomain'
              ? 'syncDomain'
              : link.kind === 'sharesSelection'
                ? 'shareSelection'
              : null),
      activationPolicy: link.activationPolicy,
      effectConstraint: link.effectConstraint,
      fieldMapping: Array.isArray(link.fieldMapping) ? link.fieldMapping : [],
    })
  })
  const links = [...coordinationLinks, ...structuralLinks]

  const defaultFocusedWidgetRef = widgetRefsById.get(plan.primaryWidgetId) || widgetDescriptions[0]?.ref || null
  const runtimeTopology = deriveWorkspaceTopology({
    widgets: widgetDescriptions,
    links,
  })
  const resolvedFocusedWidgetRef = focusedWidgetRef && widgets[focusedWidgetRef]
    ? focusedWidgetRef
    : defaultFocusedWidgetRef
  const targetWidgetRefs = widgetDescriptions.map((widget) => widget.ref)
  const coordinationScope = targetWidgetRefs.length > 1 ? 'multi_widget' : 'single_widget'
  const taskContext = buildPlanningTaskContext({
    planningRequest,
    coordinationScope,
    targetWidgetRefs,
  })
  const capabilities = new Set(['singleWidgetAnalysis', 'traceReplay'])
  if (targetWidgetRefs.length > 1) capabilities.add('multiWidgetCoordination')
  if (links.some((link) => link.kind === 'filter')) capabilities.add('crossFilter')
  if (links.some((link) => link.kind === 'sharesSelection')) capabilities.add('sharedSelection')
  if (links.some((link) => link.kind === 'syncDomain')) capabilities.add('domainSync')

  const globalFilters = deriveGlobalFiltersFromState({
    widgets,
    shared: {
      activeSelections,
    },
  })

  const sharedStateBase = {
    activeSelections,
    viewport: normalizedViewportState,
    globalFilters,
    focusedWidget: resolvedFocusedWidgetRef,
  }
  const sharedStateWithSelections = withSelectionSubmodel(sharedStateBase, {
    registry: activeSelections,
    primary: selectionRef
      ? {
        selectionRef,
      }
      : null,
  })
  const sharedStateWithFocus = withFocusSubmodel(
    sharedStateWithSelections,
    focusState == null ? undefined : focusState,
    widgets,
  )
  const sharedState = withHighlightSubmodel(
    sharedStateWithFocus,
    highlightState ?? deriveHighlightState({ widgets, shared: sharedStateWithFocus }),
  )

  const stateMeta = stateManager?.createStateMeta({
    workspaceId,
    previousState,
    nextWidgets: widgets,
    nextShared: sharedState,
    nextTaskContext: taskContext,
    nextReplayContext: replayContext,
    branchId: currentBranchId,
  }) || {
    stateId: `${workspaceId}:${Date.now()}`,
    createdAt: new Date().toISOString(),
  }

  const currentSelectionDataRef = makeCurrentSelectionDataRef({ appId, workspaceId })
  const currentViewDataRef = makeCurrentViewDataRef({ appId, workspaceId })
  const focusedWidgetSelectionRef = resolvedFocusedWidgetRef
    ? Object.keys(widgets[resolvedFocusedWidgetRef]?.selections || {})[0] || null
    : null
  const focusedWidgetVisibleDataRef = resolvedFocusedWidgetRef
    ? widgets[resolvedFocusedWidgetRef]?.data?.currentDataRef || null
    : null
  const focusedWidgetVisibleDataEntry = focusedWidgetVisibleDataRef ? runtimeData[focusedWidgetVisibleDataRef] : null
  const focusedWidgetSelectionDataRef = resolvedFocusedWidgetRef
    ? runtimeData[makeWidgetSelectionDataRef({
        appId,
        workspaceId,
        widgetId: widgets[resolvedFocusedWidgetRef]?.widgetId,
      })]
    : null
  if (focusedWidgetSelectionDataRef?.widgetRef && Array.isArray(focusedWidgetSelectionDataRef?.rows)) {
    const currentSelectionHandle = buildDerivedDataHandle({
      ref: currentSelectionDataRef,
      title: 'Current Selection Data',
      description: 'Current rows for the focused widget selection.',
      rows: focusedWidgetSelectionDataRef.rows,
      selectedCount: focusedWidgetSelectionDataRef.rows.length,
      kind: 'selectionData',
      scope: 'workspaceCurrent',
      widgetRef: focusedWidgetSelectionDataRef.widgetRef,
      sourceSelectionRef: focusedWidgetSelectionRef,
    })
    runtimeData[currentSelectionDataRef] = {
      ref: currentSelectionDataRef,
      rows: focusedWidgetSelectionDataRef.rows,
      baseRows: focusedWidgetSelectionDataRef.baseRows,
      handle: currentSelectionHandle,
      widgetRef: focusedWidgetSelectionDataRef.widgetRef,
      sourceSelectionRef: focusedWidgetSelectionRef,
      kind: 'selectionData',
      scope: 'workspaceCurrent',
    }
    dataHandles.push(currentSelectionHandle)
  }
  if (focusedWidgetVisibleDataEntry?.widgetRef && Array.isArray(focusedWidgetVisibleDataEntry?.rows)) {
    const currentViewHandle = buildDerivedDataHandle({
      ref: currentViewDataRef,
      title: 'Current View Data',
      description: 'Current visible rows for the focused widget.',
      rows: focusedWidgetVisibleDataEntry.rows,
      selectedCount: focusedWidgetVisibleDataEntry.handle?.stats?.selectedCount || 0,
      kind: 'dataView',
      scope: 'workspaceCurrentView',
      widgetRef: focusedWidgetVisibleDataEntry.widgetRef,
    })
    runtimeData[currentViewDataRef] = {
      ref: currentViewDataRef,
      rows: focusedWidgetVisibleDataEntry.rows,
      baseRows: focusedWidgetVisibleDataEntry.baseRows,
      handle: currentViewHandle,
      widgetRef: focusedWidgetVisibleDataEntry.widgetRef,
      kind: 'dataView',
      scope: 'workspaceCurrentView',
    }
    dataHandles.push(currentViewHandle)
  }

  const widgetAdapterSummaries = widgetAdapters.map((adapter) => summarizeWidgetAdapter(adapter)).filter(Boolean)

  return {
    description: makeWorkspaceDescription({
      appId,
      workspaceId,
      generatedAt: new Date().toISOString(),
      workspaceCapabilities: Array.from(capabilities),
      transportHints: {
        recommendedTools: ['workspace_describe', 'view_read', 'action_run', 'perception_query', 'interaction_trace_read'],
        note: 'External transports should prefer the stable workspace/view/action/perception/trace surface.',
      },
      runtimeTopology,
      taskContext,
      planning: {
        supportedTopologies: [...WORKSPACE_PLANNING_TOPOLOGIES],
        supportedRunModes: [...WORKSPACE_PLANNING_RUN_MODES],
        supportedComplexityBudgets: [...WORKSPACE_PLANNING_BUDGETS],
        supportedPlanSources: [...WORKSPACE_PLAN_SOURCES],
        supportedPlanningModes: [...WORKSPACE_PLAN_MODES],
        requestedWorkspaceSpec: workspaceSpecSummary,
        planningRequest: planningRequest || null,
        workspaceSpecStatus,
        workspaceSpecIssues: workspaceSpecValidation.issues,
        materializedFromSpec,
        materializedFromPlanner,
        planner: planningSummary,
      },
      widgets: widgetDescriptions,
      widgetAdapters: widgetAdapterSummaries,
      dataHandles,
      links,
      actions: actionDescriptors,
      perceptionQueries: perceptionDescriptors,
    }),
    state: makeWorkspaceState({
      stateId: stateMeta.stateId,
      createdAt: stateMeta.createdAt,
      widgets,
      shared: sharedState,
      taskContext,
    }),
    runtimeData,
    widgetAdapters,
    replayContext,
  }
}
