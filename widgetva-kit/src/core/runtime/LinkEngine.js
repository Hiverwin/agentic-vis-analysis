import {
  countSelectedRowsForSelections,
  countSelectedRows,
  mapSelectionToTargetSelection,
  rowMatchesSelection,
} from './materializers/selectionHelpers.js'
import { readSelectionRegistry } from '../../workspace/state/selectionStateModel.js'
import { deriveHighlightState, withHighlightSubmodel } from '../../workspace/state/highlightStateModel.js'
import { withFocusSubmodel } from '../../workspace/state/focusStateModel.js'
import { buildSelectionStateInput } from './materializers/selectionStateShape.js'
import { buildViewZoomState } from './materializers/viewStateMetadata.js'
import { makeSelectionState } from '../protocol/state.js'
import {
  makeLinkEngineCapabilities,
  makeLinkEnginePrimitiveEntry,
  makeLinkEngineSummary,
  normalizeWidgetLink,
} from '../protocol/widgetLinks.js'
import { deriveWorkspaceTopology, isTopologyLink } from './deriveWorkspaceTopology.js'
import { updateSharedStateInStore } from '../../workspace/state/workspaceSharedStateMutators.js'
import {
  readAppliedLinkEffect,
  readDeclaredLinkEffect,
  readLinkActivationPolicy,
  readLinkEffectConstraint,
  readLinkResponseSpec,
} from './linkSemantics.js'
import { normalizePropagationSkipReason } from './propagationReasons.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function arraysEqual(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function uniqueValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => value != null))]
}

function stableKey(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function omitKey(record, key) {
  if (!record || typeof record !== 'object' || !key || !Object.prototype.hasOwnProperty.call(record, key)) {
    return record || {}
  }
  const nextRecord = { ...record }
  delete nextRecord[key]
  return nextRecord
}

function updateEncodingDomain(encoding, channel, domain) {
  const channelSpec = encoding?.[channel]
  if (!channelSpec || typeof channelSpec !== 'object') return channelSpec
  const nextScale = { ...(channelSpec.scale || {}) }
  if (Array.isArray(domain)) {
    nextScale.domain = domain
  } else {
    delete nextScale.domain
  }
  return {
    ...channelSpec,
    scale: nextScale,
  }
}

function categoricalValuesFromSelection(selection) {
  const predicates = Array.isArray(selection?.predicates) ? selection.predicates : []
  return uniqueValues(
    predicates
      .filter((predicate) => predicate?.op === 'equals' || predicate?.op === 'in')
      .flatMap((predicate) => (Array.isArray(predicate?.value) ? predicate.value : [predicate?.value])),
  )
}

function markRows(rows, marker, predicate) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    [marker]: Boolean(predicate?.(row)),
  }))
}

function countRowsMatching(rows, predicate) {
  if (!Array.isArray(rows) || typeof predicate !== 'function') return 0
  return rows.filter((row) => predicate(row)).length
}

function findNamedDataSource(spec, name) {
  const data = Array.isArray(spec?.data) ? spec.data : []
  const index = data.findIndex((entry) => entry && typeof entry === 'object' && entry.name === name)
  if (index < 0) return { index: -1, values: null }
  return {
    index,
    values: Array.isArray(data[index]?.values) ? data[index].values : null,
  }
}

function computeNodeFlows(links) {
  const flows = new Map()
  const ensure = (name) => {
    if (!flows.has(name)) {
      flows.set(name, { inflow: 0, outflow: 0, total: 0 })
    }
    return flows.get(name)
  }
  for (const link of Array.isArray(links) ? links : []) {
    if (!link || typeof link !== 'object') continue
    const source = link.source
    const target = link.target
    const value = Number(link.value || 0)
    const sourceEntry = ensure(source)
    const targetEntry = ensure(target)
    sourceEntry.outflow += value
    targetEntry.inflow += value
  }
  for (const entry of flows.values()) {
    entry.total = Math.max(entry.inflow, entry.outflow)
  }
  return flows
}

function normalizeFieldName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null
}

function readScalarPredicateValue(selection, candidateFields = []) {
  const predicates = Array.isArray(selection?.predicates) ? selection.predicates : []
  const normalizedCandidates = candidateFields
    .map((field) => normalizeFieldName(field))
    .filter(Boolean)
  if (normalizedCandidates.length === 0) return null
  const predicate = predicates.find((entry) => normalizedCandidates.includes(normalizeFieldName(entry?.field)))
  if (!predicate) return null
  if (predicate.op === 'equals') return predicate.value
  if (predicate.op === 'in' && Array.isArray(predicate.value) && predicate.value.length === 1) {
    return predicate.value[0]
  }
  return null
}

function buildLineDrillDownSpec(spec, params = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('Line drill-down requires an object spec.')
  }
  const level = typeof params.level === 'string' ? params.level.toLowerCase().trim() : null
  const numericValue = Number.isFinite(params.value) ? Number(params.value) : null
  const parent = params.parent && typeof params.parent === 'object' && !Array.isArray(params.parent)
    ? params.parent
    : {}
  if (!level || numericValue === null) {
    throw new Error('Line drill-down requires level and numeric value.')
  }

  const drillState = spec._line_drilldown_state && typeof spec._line_drilldown_state === 'object'
    ? { ...spec._line_drilldown_state }
    : {}
  if (!drillState.original_transform) {
    drillState.original_transform = Array.isArray(spec.transform) ? clone(spec.transform) : []
    drillState.original_encoding = clone(spec.encoding || {})
    drillState.original_title = spec.title || ''
    drillState.raw_time_field = drillState.raw_time_field || spec?.encoding?.x?.field || null
    drillState.raw_value_field = drillState.raw_value_field || spec?.encoding?.y?.field || null
    drillState.group_field = drillState.group_field || spec?.encoding?.color?.field || null
  }

  const rawDateField = drillState.raw_time_field
  const rawValueField = drillState.raw_value_field
  const groupField = drillState.group_field
  if (!rawDateField || !rawValueField) {
    throw new Error('Line drill-down requires x/y fields on the active spec.')
  }

  const nextTransforms = []
  let nextEncoding
  let nextParent = {}
  let titleSuffix = ''

  if (level === 'year') {
    nextTransforms.push({
      filter: `year(datum.${rawDateField}) == ${numericValue}`,
      _widgetvaTag: 'line.drillDownXAxis',
    })
    nextTransforms.push({
      timeUnit: 'yearmonth',
      field: rawDateField,
      as: 'month_date',
      _widgetvaTag: 'line.drillDownXAxis',
    })
    nextTransforms.push({
      aggregate: [{ op: 'sum', field: rawValueField, as: 'total_value' }],
      groupby: groupField ? ['month_date', groupField] : ['month_date'],
      _widgetvaTag: 'line.drillDownXAxis',
    })
    nextParent = { year: numericValue }
    titleSuffix = `${numericValue} monthly trend`
    nextEncoding = {
      x: {
        field: 'month_date',
        type: 'temporal',
        title: 'Month',
        axis: { format: '%Y-%m' },
      },
      y: {
        field: 'total_value',
        type: 'quantitative',
        title: `Monthly total ${rawValueField}`,
      },
      ...(groupField ? { color: drillState.original_encoding?.color || { field: groupField, type: 'nominal' } } : {}),
    }
  } else if (level === 'month') {
    const yearValue = Number.isFinite(parent.year) ? Number(parent.year) : null
    if (yearValue === null) {
      throw new Error('Line month drill-down requires parent.year.')
    }
    if (numericValue < 1 || numericValue > 12) {
      throw new Error('Line month drill-down requires a month value between 1 and 12.')
    }
    nextTransforms.push({
      filter: `year(datum.${rawDateField}) == ${yearValue} && month(datum.${rawDateField}) == ${numericValue - 1}`,
      _widgetvaTag: 'line.drillDownXAxis',
    })
    nextTransforms.push({
      timeUnit: 'yearmonthdate',
      field: rawDateField,
      as: 'day_date',
      _widgetvaTag: 'line.drillDownXAxis',
    })
    nextTransforms.push({
      aggregate: [{ op: 'sum', field: rawValueField, as: 'total_value' }],
      groupby: groupField ? ['day_date', groupField] : ['day_date'],
      _widgetvaTag: 'line.drillDownXAxis',
    })
    nextParent = { year: yearValue, month: numericValue }
    titleSuffix = `${yearValue}-${String(numericValue).padStart(2, '0')} daily trend`
    nextEncoding = {
      x: {
        field: 'day_date',
        type: 'temporal',
        title: 'Date',
        axis: { format: '%m-%d' },
      },
      y: {
        field: 'total_value',
        type: 'quantitative',
        title: `Daily total ${rawValueField}`,
      },
      ...(groupField ? { color: drillState.original_encoding?.color || { field: groupField, type: 'nominal' } } : {}),
    }
  } else {
    throw new Error(`Line drill-down does not support level "${level}".`)
  }

  drillState.parent = nextParent

  return {
    ...spec,
    transform: nextTransforms,
    encoding: nextEncoding,
    title: titleSuffix,
    _line_drilldown_state: drillState,
  }
}

function buildHeatmapDrillDownSpec(spec, params = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('Heatmap drill-down requires an object spec.')
  }
  const level = typeof params.level === 'string' ? params.level.toLowerCase().trim() : null
  const value = params.value
  const parent = params.parent && typeof params.parent === 'object' && !Array.isArray(params.parent)
    ? params.parent
    : {}
  if (!level || value == null || value === '') {
    throw new Error('Heatmap drill-down requires level and value.')
  }

  const xEncoding = spec?.encoding?.x
  const timeField = xEncoding?.field || null
  const xType = xEncoding?.type || null
  if (!timeField) {
    throw new Error('Heatmap drill-down requires a temporal x field on the active spec.')
  }
  if (xType && xType !== 'temporal') {
    throw new Error(`Heatmap drill-down requires encoding.x.type=temporal, received ${xType}.`)
  }

  const heatmapState = spec._heatmap_state && typeof spec._heatmap_state === 'object'
    ? { ...spec._heatmap_state }
    : {}
  if (!heatmapState.original_x_encoding) {
    heatmapState.original_x_encoding = clone(xEncoding)
  }

  const nextTransforms = Array.isArray(spec.transform)
    ? spec.transform.filter((transform) => transform?._widgetvaTag !== 'heatmap.drilldownAxis')
    : []
  const mergedParent = {
    ...(heatmapState.parent && typeof heatmapState.parent === 'object' ? heatmapState.parent : {}),
    ...parent,
  }

  let nextTimeUnit = null
  const filters = []
  let nextParent

  if (level === 'year') {
    const yearValue = Number.parseInt(value, 10)
    if (!Number.isFinite(yearValue)) {
      throw new Error(`Heatmap drill-down requires an integer year value; received ${value}.`)
    }
    nextParent = { year: yearValue }
    nextTimeUnit = 'month'
    filters.push(`year(datum.${timeField}) == ${yearValue}`)
  } else if (level === 'month') {
    const yearValue = Number.parseInt(mergedParent.year, 10)
    const monthValue = Number.parseInt(value, 10)
    if (!Number.isFinite(yearValue)) {
      throw new Error('Heatmap month drill-down requires parent.year.')
    }
    if (!Number.isFinite(monthValue)) {
      throw new Error(`Heatmap drill-down requires an integer month value; received ${value}.`)
    }
    nextParent = { year: yearValue, month: monthValue }
    nextTimeUnit = 'date'
    filters.push(`year(datum.${timeField}) == ${yearValue}`)
    filters.push(`month(datum.${timeField}) == ${monthValue - 1}`)
  } else if (level === 'date') {
    const yearValue = Number.parseInt(mergedParent.year, 10)
    const monthValue = Number.parseInt(mergedParent.month, 10)
    const dateValue = Number.parseInt(value, 10)
    if (!Number.isFinite(yearValue) || !Number.isFinite(monthValue)) {
      throw new Error('Heatmap date drill-down requires parent.year and parent.month.')
    }
    if (!Number.isFinite(dateValue)) {
      throw new Error(`Heatmap drill-down requires an integer date value; received ${value}.`)
    }
    nextParent = { year: yearValue, month: monthValue, date: dateValue }
    nextTimeUnit = 'date'
    filters.push(`year(datum.${timeField}) == ${yearValue}`)
    filters.push(`month(datum.${timeField}) == ${monthValue - 1}`)
    filters.push(`date(datum.${timeField}) == ${dateValue}`)
  } else {
    throw new Error(`Heatmap drill-down does not support level "${level}".`)
  }

  heatmapState.parent = nextParent

  return {
    ...spec,
    encoding: {
      ...(spec.encoding || {}),
      x: {
        ...(spec.encoding?.x || {}),
        field: timeField,
        type: 'temporal',
        ...(nextTimeUnit ? { timeUnit: nextTimeUnit } : {}),
      },
    },
    transform: [
      ...nextTransforms,
      {
        filter: filters.join(' && '),
        _widgetvaTag: 'heatmap.drilldownAxis',
      },
    ],
    _heatmap_state: heatmapState,
  }
}

function buildHeatmapTransposeSpec(spec, params = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('Heatmap re-encode transpose requires an object spec.')
  }
  const xEncoding = spec?.encoding?.x
  const yEncoding = spec?.encoding?.y
  if (!xEncoding || !yEncoding) {
    throw new Error('Heatmap transpose requires both x and y encodings on the active spec.')
  }

  const desiredTransposed = params?.transposed !== false
  const currentTransposed = spec?._transpose_state?.transposed === true
  if (desiredTransposed === currentTransposed) {
    return clone(spec)
  }

  return {
    ...spec,
    encoding: {
      ...(spec.encoding || {}),
      x: clone(yEncoding),
      y: clone(xEncoding),
    },
    ...(spec.width != null && spec.height != null ? { width: spec.height, height: spec.width } : {}),
    _transpose_state: {
      ...(spec._transpose_state || { transposed: false }),
      transposed: desiredTransposed,
    },
  }
}

function buildSankeyAutoCollapseSpec(spec, params = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('Sankey aggregate auto-collapse requires an object spec.')
  }
  const topN = Number.isFinite(params.topN) ? Number(params.topN) : null
  if (topN == null || topN < 0) {
    throw new Error('Sankey aggregate auto-collapse requires a non-negative topN.')
  }

  const nextSpec = clone(spec)
  const rawLinksSource = findNamedDataSource(nextSpec, 'rawLinks')
  const nodeConfigSource = findNamedDataSource(nextSpec, 'nodeConfig')
  if (rawLinksSource.index < 0 || nodeConfigSource.index < 0 || !rawLinksSource.values || !nodeConfigSource.values) {
    throw new Error('Sankey aggregate auto-collapse requires rawLinks and nodeConfig data sources.')
  }

  if (!nextSpec._sankey_state || typeof nextSpec._sankey_state !== 'object') {
    nextSpec._sankey_state = {
      original_nodes: clone(nodeConfigSource.values),
      original_links: clone(rawLinksSource.values),
      collapsed_groups: {},
    }
  }
  if (!nextSpec._sankey_state.collapsed_groups || typeof nextSpec._sankey_state.collapsed_groups !== 'object') {
    nextSpec._sankey_state.collapsed_groups = {}
  }

  const nodeFlows = computeNodeFlows(rawLinksSource.values)
  const depthGroups = new Map()
  for (const node of nodeConfigSource.values) {
    const depth = Number(node?.depth ?? 0)
    if (!depthGroups.has(depth)) depthGroups.set(depth, [])
    depthGroups.get(depth).push(node)
  }

  const nodesToKeep = new Set()
  const collapsedByLayer = new Map()
  const nodeToAggregate = new Map()

  for (const [depth, group] of depthGroups.entries()) {
    const sortedGroup = [...group].sort((left, right) => {
      const leftTotal = nodeFlows.get(left?.name)?.total || 0
      const rightTotal = nodeFlows.get(right?.name)?.total || 0
      return rightTotal - leftTotal
    })
    for (const node of sortedGroup.slice(0, topN)) {
      nodesToKeep.add(node?.name)
    }
    const collapsedNames = sortedGroup.slice(topN).map((node) => node?.name).filter((name) => typeof name === 'string')
    if (collapsedNames.length > 0) {
      const aggregateName = `Others (Layer ${depth})`
      collapsedByLayer.set(depth, { aggregateName, collapsedNodes: collapsedNames })
      nextSpec._sankey_state.collapsed_groups[aggregateName] = collapsedNames
      for (const name of collapsedNames) {
        nodeToAggregate.set(name, aggregateName)
      }
    }
  }

  if (collapsedByLayer.size === 0) {
    return nextSpec
  }

  const newNodes = nodeConfigSource.values.filter((node) => nodesToKeep.has(node?.name))
  for (const [depth, info] of collapsedByLayer.entries()) {
    const group = depthGroups.get(depth) || []
    const maxOrder = group.reduce((max, node) => Math.max(max, Number(node?.order ?? 0)), 0)
    newNodes.push({
      name: info.aggregateName,
      depth,
      order: maxOrder + 1,
      _is_aggregate: true,
      _collapsed_nodes: info.collapsedNodes,
    })
  }

  const linkAgg = new Map()
  for (const link of rawLinksSource.values) {
    if (!link || typeof link !== 'object') continue
    const source = nodeToAggregate.get(link.source) || link.source
    const target = nodeToAggregate.get(link.target) || link.target
    const key = `${source}-->${target}`
    linkAgg.set(key, {
      source,
      target,
      value: (linkAgg.get(key)?.value || 0) + Number(link.value || 0),
    })
  }

  nextSpec.data[nodeConfigSource.index].values = newNodes
  nextSpec.data[rawLinksSource.index].values = [...linkAgg.values()]
  return nextSpec
}

function buildSankeyCollapseNodesSpec(spec, params = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('Sankey structure collapse requires an object spec.')
  }
  const nodes = Array.isArray(params.nodes)
    ? params.nodes.filter((value) => typeof value === 'string' && value.trim().length > 0)
    : []
  const aggregateName = typeof params.aggregateName === 'string' && params.aggregateName.trim().length > 0
    ? params.aggregateName
    : 'Other'
  if (nodes.length === 0) {
    throw new Error('Sankey structure collapse requires one or more node names.')
  }

  const nextSpec = clone(spec)
  const rawLinksSource = findNamedDataSource(nextSpec, 'rawLinks')
  const nodeConfigSource = findNamedDataSource(nextSpec, 'nodeConfig')
  if (rawLinksSource.index < 0 || nodeConfigSource.index < 0 || !rawLinksSource.values || !nodeConfigSource.values) {
    throw new Error('Sankey structure collapse requires rawLinks and nodeConfig data sources.')
  }

  const collapseSet = new Set(nodes)
  const existingNames = new Set(nodeConfigSource.values.map((node) => node?.name).filter((name) => typeof name === 'string'))
  const missing = nodes.filter((name) => !existingNames.has(name))
  if (missing.length > 0) {
    throw new Error(`Sankey structure collapse cannot find node(s): ${missing.join(', ')}`)
  }

  if (!nextSpec._sankey_state || typeof nextSpec._sankey_state !== 'object') {
    nextSpec._sankey_state = {
      original_nodes: clone(nodeConfigSource.values),
      original_links: clone(rawLinksSource.values),
      collapsed_groups: {},
    }
  }
  if (!nextSpec._sankey_state.collapsed_groups || typeof nextSpec._sankey_state.collapsed_groups !== 'object') {
    nextSpec._sankey_state.collapsed_groups = {}
  }
  nextSpec._sankey_state.collapsed_groups[aggregateName] = [...nodes]

  let collapseDepth = 0
  let maxOrder = 0
  for (const node of nodeConfigSource.values) {
    if (!node || typeof node !== 'object') continue
    if (collapseSet.has(node.name)) {
      collapseDepth = typeof node.depth === 'number' ? node.depth : collapseDepth
    }
    if ((typeof node.depth === 'number' ? node.depth : 0) === collapseDepth) {
      maxOrder = Math.max(maxOrder, typeof node.order === 'number' ? node.order : 0)
    }
  }

  const newNodes = nodeConfigSource.values.filter((node) => !collapseSet.has(node?.name))
  newNodes.push({
    name: aggregateName,
    depth: collapseDepth,
    order: maxOrder + 1,
    _is_aggregate: true,
    _collapsed_nodes: [...nodes],
  })

  const linkAgg = new Map()
  for (const link of rawLinksSource.values) {
    if (!link || typeof link !== 'object') continue
    const src = link.source
    const tgt = link.target
    const value = Number(link.value || 0)
    const newSrc = collapseSet.has(src) ? aggregateName : src
    const newTgt = collapseSet.has(tgt) ? aggregateName : tgt
    if (newSrc === aggregateName && newTgt === aggregateName) continue
    const key = `${newSrc}-->${newTgt}`
    linkAgg.set(key, {
      source: newSrc,
      target: newTgt,
      value: (linkAgg.get(key)?.value || 0) + value,
    })
  }

  nextSpec.data[nodeConfigSource.index].values = newNodes
  nextSpec.data[rawLinksSource.index].values = [...linkAgg.values()]
  return nextSpec
}

function buildSankeyExpandNodeSpec(spec, params = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('Sankey structure expand requires an object spec.')
  }
  const aggregateName = typeof params.aggregateName === 'string' && params.aggregateName.trim().length > 0
    ? params.aggregateName
    : null
  if (!aggregateName) {
    throw new Error('Sankey structure expand requires an aggregateName.')
  }

  const nextSpec = clone(spec)
  const rawLinksSource = findNamedDataSource(nextSpec, 'rawLinks')
  const nodeConfigSource = findNamedDataSource(nextSpec, 'nodeConfig')
  if (rawLinksSource.index < 0 || nodeConfigSource.index < 0 || !rawLinksSource.values || !nodeConfigSource.values) {
    throw new Error('Sankey structure expand requires rawLinks and nodeConfig data sources.')
  }

  const sankeyState = nextSpec?._sankey_state && typeof nextSpec._sankey_state === 'object'
    ? nextSpec._sankey_state
    : null
  const collapsedGroups = sankeyState?.collapsed_groups && typeof sankeyState.collapsed_groups === 'object'
    ? sankeyState.collapsed_groups
    : null
  const originalNodes = Array.isArray(sankeyState?.original_nodes) ? sankeyState.original_nodes : null
  const originalLinks = Array.isArray(sankeyState?.original_links) ? sankeyState.original_links : null
  if (!collapsedGroups || !originalNodes || !originalLinks) {
    throw new Error('Sankey structure expand requires saved _sankey_state with original nodes, links, and collapsed groups.')
  }
  if (!Array.isArray(collapsedGroups[aggregateName])) {
    throw new Error(`Sankey structure expand cannot find collapsed group "${aggregateName}".`)
  }

  const collapsedNodeNames = new Set(collapsedGroups[aggregateName])
  const newNodes = nodeConfigSource.values.filter((node) => node?.name !== aggregateName)
  for (const originalNode of originalNodes) {
    if (collapsedNodeNames.has(originalNode?.name)) {
      newNodes.push(clone(originalNode))
    }
  }

  const restoredLinks = []
  for (const originalLink of originalLinks) {
    if (!originalLink || typeof originalLink !== 'object') continue
    const src = originalLink.source
    const tgt = originalLink.target
    if (collapsedNodeNames.has(src) || collapsedNodeNames.has(tgt)) {
      restoredLinks.push(clone(originalLink))
    }
  }
  for (const link of rawLinksSource.values) {
    if (!link || typeof link !== 'object') continue
    const src = link.source
    const tgt = link.target
    if (src === aggregateName || tgt === aggregateName) continue
    if (collapsedNodeNames.has(src) || collapsedNodeNames.has(tgt)) continue
    restoredLinks.push(clone(link))
  }

  nextSpec.data[nodeConfigSource.index].values = newNodes
  nextSpec.data[rawLinksSource.index].values = restoredLinks
  delete nextSpec._sankey_state.collapsed_groups[aggregateName]
  return nextSpec
}

function resolveAdvancedResponsePlan(entry, targetState) {
  const responseSpec = entry?.responseSpec && typeof entry.responseSpec === 'object' ? entry.responseSpec : null
  const params = responseSpec?.params && typeof responseSpec.params === 'object' ? responseSpec.params : {}
  if (!responseSpec?.kind) {
    return { ok: false, reason: normalizePropagationSkipReason('unsupported_advanced_response') }
  }

  if (responseSpec.kind === 'aggregate' && entry?.appliedEffect === 'transformDataView') {
    const variant = typeof params.variant === 'string' ? params.variant : null
    const baseSpec = clone(targetState?.currentSpec || targetState?.rawSpec || null)
    try {
      if (targetState?.kind === 'sankey' && variant === 'autoCollapseByRank') {
        return {
          ok: true,
          nextSpec: buildSankeyAutoCollapseSpec(baseSpec, params),
          actionName: 'sankey.autoCollapseByRank',
        }
      }
    } catch {
      return { ok: false, reason: normalizePropagationSkipReason('effect_not_applied') }
    }
    return { ok: false, reason: normalizePropagationSkipReason('unsupported_advanced_response') }
  }

  if ((responseSpec.kind === 'collapse' || responseSpec.kind === 'expand') && entry?.appliedEffect === 'transformStructure') {
    const variant = typeof params.variant === 'string' ? params.variant : null
    const baseSpec = clone(targetState?.currentSpec || targetState?.rawSpec || null)
    try {
      if (targetState?.kind === 'sankey' && responseSpec.kind === 'collapse' && variant === 'collapseNodes') {
        return {
          ok: true,
          nextSpec: buildSankeyCollapseNodesSpec(baseSpec, params),
          actionName: 'sankey.collapseNodes',
        }
      }
      if (targetState?.kind === 'sankey' && responseSpec.kind === 'expand' && variant === 'expandNode') {
        return {
          ok: true,
          nextSpec: buildSankeyExpandNodeSpec(baseSpec, params),
          actionName: 'sankey.expandNode',
        }
      }
    } catch (error) {
      const message = typeof error?.message === 'string' ? error.message : ''
      if (message.length > 0) {
        return { ok: false, reason: normalizePropagationSkipReason('advanced_response_params_invalid') }
      }
      return { ok: false, reason: normalizePropagationSkipReason('effect_not_applied') }
    }
    return { ok: false, reason: normalizePropagationSkipReason('unsupported_advanced_response') }
  }

  if (entry?.appliedEffect !== 'transformView') {
    return { ok: false, reason: normalizePropagationSkipReason('unsupported_advanced_response') }
  }

  const baseSpec = clone(targetState?.currentSpec || targetState?.rawSpec || null)
  if (responseSpec.kind === 'reencode') {
    const variant = typeof params.variant === 'string' ? params.variant : null
    try {
      if (targetState?.kind === 'heatmap' && variant === 'transpose') {
        return {
          ok: true,
          nextSpec: buildHeatmapTransposeSpec(baseSpec, params),
          actionName: 'heatmap.transpose',
        }
      }
    } catch {
      return { ok: false, reason: normalizePropagationSkipReason('effect_not_applied') }
    }
    return { ok: false, reason: normalizePropagationSkipReason('unsupported_advanced_response') }
  }

  if (responseSpec.kind !== 'drillDown') {
    return { ok: false, reason: normalizePropagationSkipReason('unsupported_advanced_response') }
  }

  const level = typeof params.level === 'string'
    ? params.level
    : typeof params.fromLevel === 'string'
      ? params.fromLevel
      : null
  const selectionField = params.selectionField || level
  const parent = params.parent && typeof params.parent === 'object' && !Array.isArray(params.parent)
    ? clone(params.parent)
    : {}
  const value = params.value != null
    ? params.value
    : readScalarPredicateValue(entry?.mappedSelection || null, [selectionField])

  if (!level || value == null || value === '') {
    return { ok: false, reason: normalizePropagationSkipReason('mapping_unresolved') }
  }
  if (level === 'month' && parent.year == null) {
    parent.year = readScalarPredicateValue(entry?.mappedSelection || null, ['year'])
  }
  if (level === 'date') {
    if (parent.year == null) parent.year = readScalarPredicateValue(entry?.mappedSelection || null, ['year'])
    if (parent.month == null) parent.month = readScalarPredicateValue(entry?.mappedSelection || null, ['month'])
  }

  const drillParams = {
    level,
    value,
    parent,
  }
  try {
    if (targetState?.kind === 'line') {
      return {
        ok: true,
        nextSpec: buildLineDrillDownSpec(baseSpec, drillParams),
        actionName: 'line.drillDownXAxis',
      }
    }
    if (targetState?.kind === 'heatmap') {
      return {
        ok: true,
        nextSpec: buildHeatmapDrillDownSpec(baseSpec, drillParams),
        actionName: 'heatmap.drilldownAxis',
      }
    }
  } catch {
    return { ok: false, reason: normalizePropagationSkipReason('effect_not_applied') }
  }
  return { ok: false, reason: normalizePropagationSkipReason('unsupported_advanced_response') }
}

function describeLinkEffect(link) {
  const appliedEffect = readAppliedLinkEffect(link)
  if (appliedEffect === 'applyFilter') {
    return {
      kind: 'filtersWidget',
      targetRef: link.to,
      description: link.description || 'Filter propagation',
    }
  }
  if (appliedEffect === 'applyHighlight') {
    return {
      kind: 'highlightsItems',
      targetRef: link.to,
      description: link.description || 'Highlight propagation',
    }
  }
  if (appliedEffect === 'focusTarget') {
    return {
      kind: 'focusesWidget',
      targetRef: link.to,
      description: link.description || 'Focus propagation',
    }
  }
  if (appliedEffect === 'syncDomain') {
    return {
      kind: 'updatesViewDomain',
      targetRef: link.to,
      description: link.description || 'Domain synchronization',
    }
  }
  if (appliedEffect === 'shareSelection') {
    return {
      kind: 'sharesSelectionState',
      targetRef: link.to,
      description: link.description || 'Selection sharing',
    }
  }
  if (appliedEffect === 'transformView') {
    return {
      kind: 'transformsView',
      targetRef: link.to,
      description: link.description || 'View transformation',
    }
  }
  if (appliedEffect === 'transformDataView') {
    return {
      kind: 'transformsDataView',
      targetRef: link.to,
      description: link.description || 'Data-view transformation',
    }
  }
  if (appliedEffect === 'transformStructure') {
    return {
      kind: 'transformsStructure',
      targetRef: link.to,
      description: link.description || 'Structure transformation',
    }
  }
  return null
}

function describeAppliedStatePathsForEffect(effect) {
  if (effect === 'applyFilter') return ['transforms', 'data.currentDataRef', 'feedback.inboundLinkIds']
  if (effect === 'applyHighlight') return ['feedback.highlightedKeys', 'feedback.inboundLinkIds']
  if (effect === 'focusTarget') return ['shared.focusedWidget', 'shared.focus']
  if (effect === 'syncDomain') return ['view.xDomain', 'view.yDomain', 'feedback.inboundLinkIds']
  if (effect === 'shareSelection') return ['selections', 'data.selectedCount', 'feedback.linkedSourceRefs']
  if (effect === 'transformView') return ['currentSpec', 'rawSpec', 'transforms', 'encoding', 'feedback.inboundLinkIds']
  if (effect === 'transformDataView') return ['currentSpec', 'rawSpec', 'transforms', 'data', 'feedback.inboundLinkIds']
  if (effect === 'transformStructure') return ['currentSpec', 'rawSpec', 'feedback.inboundLinkIds']
  return []
}

export class LinkEngine {
  constructor(args = {}) {
    const store = args?.store || args
    this.store = store
    this.primitiveHandlers = new Map([
      ['filter', (link) => describeLinkEffect(link)],
      ['highlight', (link) => describeLinkEffect(link)],
      ['syncDomain', (link) => describeLinkEffect(link)],
      ['sharesSelection', (link) => describeLinkEffect(link)],
      ['drillDown', (link) => describeLinkEffect(link)],
      ['reencode', (link) => describeLinkEffect(link)],
      ['aggregate', (link) => describeLinkEffect(link)],
      ['structure', (link) => describeLinkEffect(link)],
    ])
  }

  resolveWidgetRefById(widgetId) {
    if (typeof widgetId !== 'string' || widgetId.length === 0) return null
    const descriptionWidgets = this.store.readDescription?.()?.widgets || []
    const describedWidget = descriptionWidgets.find((widget) => widget?.widgetId === widgetId)
    if (typeof describedWidget?.ref === 'string' && describedWidget.ref.length > 0) {
      return describedWidget.ref
    }
    const listedWidget = this.store.listWidgetDescriptions?.()?.find((widget) => widget?.widgetId === widgetId)
    return typeof listedWidget?.ref === 'string' && listedWidget.ref.length > 0 ? listedWidget.ref : null
  }

  listLinks() {
    const deduped = new Map()
    for (const rawLink of this.store.listLinks?.() || []) {
      const normalizedLink = normalizeWidgetLink(rawLink)
      const hydratedLink = {
        ...normalizedLink,
        from: normalizedLink?.from || this.resolveWidgetRefById(normalizedLink?.sourceWidgetId),
        to: normalizedLink?.to || this.resolveWidgetRefById(normalizedLink?.targetWidgetId),
      }
      const dedupeKey = [
        hydratedLink?.from || null,
        hydratedLink?.to || null,
        hydratedLink?.sourceWidgetId || null,
        hydratedLink?.targetWidgetId || null,
        hydratedLink?.kind || null,
        hydratedLink?.effect || null,
        hydratedLink?.activationPolicy || null,
        hydratedLink?.effectConstraint || null,
        stableKey(hydratedLink?.fieldMapping || []),
      ].join('::')
      if (!deduped.has(dedupeKey)) {
        deduped.set(dedupeKey, hydratedLink)
      }
    }
    return Array.from(deduped.values())
  }

  listPrimitives() {
    return Array.from(this.primitiveHandlers.keys())
  }

  describeEngine() {
    const links = this.listLinks()
    const coordinationLinks = links.filter(isTopologyLink)
    const description = this.store.readDescription?.() || {}
    const topology = deriveWorkspaceTopology({
      widgets: description.widgets || [],
      links,
    })
    return makeLinkEngineSummary({
      primitiveCount: this.primitiveHandlers.size,
      primitives: this.listPrimitives().map((name) => makeLinkEnginePrimitiveEntry({
        name,
        appliedStatePaths: this.describeAppliedStatePaths(name),
      })),
      linkCount: links.length,
      coordinationLinkCount: coordinationLinks.length,
      structuralLinkCount: links.length - coordinationLinks.length,
      automaticLinkCount: links.filter((link) => readLinkActivationPolicy(link) !== 'manual').length,
      manualLinkCount: links.filter((link) => readLinkActivationPolicy(link) === 'manual').length,
      topology,
      capabilities: makeLinkEngineCapabilities({
        propagationExecution: true,
        propagationPlan: true,
        effectCollection: true,
        consistencyEvaluation: true,
      }),
    })
  }

  findOutgoing({ sourceRef, state = this.store.readState() }) {
    if (!sourceRef) return []
    const activeSelection = this.resolveActiveSelection({ sourceRef, state })
    return this.listLinks().filter((link) => {
      if (link.from === sourceRef) return true
      if (!activeSelection) return false
      if (link.sourceWidgetId && link.sourceWidgetId === activeSelection.sourceWidgetId) return true
      if (link.from && activeSelection.sourceWidgetRef && link.from === activeSelection.sourceWidgetRef) return true
      return false
    })
  }

  findAffectedRefs({ sourceRef, state = this.store.readState() }) {
    const affected = new Set()
    for (const link of this.findOutgoing({ sourceRef, state })) {
      if (link.to) affected.add(link.to)
    }
    return Array.from(affected)
  }

  describePropagation({ sourceRef }) {
    const state = this.store.readState?.() || {}
    const activeSelection = this.resolveActiveSelection({ sourceRef, state })
    return this.findOutgoing({ sourceRef, state }).map((link) => {
      const mappedSelection = activeSelection
        ? clone(mapSelectionToTargetSelection(activeSelection, link.fieldMapping))
        : null
      const planEntry = {
        linkRef: link.ref,
        primitive: link.kind,
        declaredEffect: readDeclaredLinkEffect(link),
        appliedEffect: readAppliedLinkEffect(link),
        responseSpec: readLinkResponseSpec(link),
        targetRef: link.to,
        activationPolicy: readLinkActivationPolicy(link),
        effectConstraint: readLinkEffectConstraint(link),
        sourceSelectionRef: link.from || null,
        sourceWidgetId: link.sourceWidgetId || null,
        hasActiveSelection: Boolean(activeSelection),
        mappedSelection,
        effect: this.primitiveHandlers.get(link.kind)?.(link) || null,
      }
      const applicability = this.assessPropagationEntry({
        entry: planEntry,
        state,
        activeSelection,
      })
      return {
        ...planEntry,
        canApply: applicability.canApply,
        skippedReason: applicability.reason,
      }
    })
  }

  collectEffects({ sourceRef }) {
    return this.findOutgoing({ sourceRef })
      .map((link) => describeLinkEffect(link))
      .filter(Boolean)
  }

  describeAppliedStatePaths(primitive) {
    if (primitive === 'filter') return ['transforms', 'data.currentDataRef', 'feedback.inboundLinkIds']
    if (primitive === 'highlight') return ['feedback.highlightedKeys', 'feedback.inboundLinkIds']
    if (primitive === 'syncDomain') return ['view.xDomain', 'view.yDomain', 'feedback.inboundLinkIds']
    if (primitive === 'sharesSelection') return ['selections', 'data.selectedCount', 'feedback.linkedSourceRefs']
    return []
  }

  resolveActiveSelection({ sourceRef, state = this.store.readState() }) {
    return sourceRef ? readSelectionRegistry(state?.shared || {})?.[sourceRef] || null : null
  }

  buildMirroredSelectionRef(targetRef, sourceSelectionRef) {
    return `${targetRef}/selection/shared_${String(sourceSelectionRef || 'selection').split('/').pop()}`
  }

  buildLinkedFeedback(targetState, entry) {
    const feedback = targetState?.feedback || {}
    return {
      feedback,
      inboundLinkIds: uniqueValues([...(feedback.inboundLinkIds || []), this.resolveLinkId(entry.linkRef)]),
      linkedSourceRefs: uniqueValues([...(feedback.linkedSourceRefs || []), entry.sourceSelectionRef]),
    }
  }

  buildPropagationPlan({ sourceRef, state = this.store.readState() }) {
    const activeSelection = this.resolveActiveSelection({ sourceRef, state })
    return this.findOutgoing({ sourceRef, state }).map((link) => ({
      linkRef: link.ref,
      primitive: link.kind,
      declaredEffect: readDeclaredLinkEffect(link),
      appliedEffect: readAppliedLinkEffect(link),
      responseSpec: readLinkResponseSpec(link),
      targetRef: link.to,
      activationPolicy: readLinkActivationPolicy(link),
      effectConstraint: readLinkEffectConstraint(link),
      sourceSelectionRef: sourceRef,
      sourceWidgetId: link.sourceWidgetId || null,
      hasActiveSelection: Boolean(activeSelection),
      mappedSelection: activeSelection
        ? clone(mapSelectionToTargetSelection(activeSelection, link.fieldMapping))
        : null,
      effect: this.primitiveHandlers.get(link.kind)?.(link) || null,
    }))
  }

  buildTargetPrimitiveEntries({ targetRef, primitive, state = this.store.readState() }) {
    if (!targetRef || !primitive) return []
    return this.listLinks()
      .filter((link) => link.to === targetRef && link.kind === primitive && readLinkActivationPolicy(link) !== 'manual')
      .map((link) => {
        const sourceSelectionRef = link.from || null
        const activeSelection = this.resolveActiveSelection({ sourceRef: sourceSelectionRef, state })
        return {
          linkRef: link.ref,
          primitive: link.kind,
          declaredEffect: readDeclaredLinkEffect(link),
          appliedEffect: readAppliedLinkEffect(link),
          responseSpec: readLinkResponseSpec(link),
          targetRef,
          activationPolicy: readLinkActivationPolicy(link),
          effectConstraint: readLinkEffectConstraint(link),
          sourceSelectionRef,
          sourceWidgetId: link.sourceWidgetId || null,
          hasActiveSelection: Boolean(activeSelection),
          mappedSelection: activeSelection
            ? clone(mapSelectionToTargetSelection(activeSelection, link.fieldMapping))
            : null,
          effect: this.primitiveHandlers.get(link.kind)?.(link) || null,
        }
      })
  }

  buildTargetEffectEntries({ targetRef, effect, state = this.store.readState() }) {
    if (!targetRef || !effect) return []
    return this.listLinks()
      .filter((link) => link.to === targetRef && readAppliedLinkEffect(link) === effect && readLinkActivationPolicy(link) !== 'manual')
      .map((link) => {
        const sourceSelectionRef = link.from || null
        const activeSelection = this.resolveActiveSelection({ sourceRef: sourceSelectionRef, state })
        return {
          linkRef: link.ref,
          primitive: link.kind,
          declaredEffect: readDeclaredLinkEffect(link),
          appliedEffect: readAppliedLinkEffect(link),
          responseSpec: readLinkResponseSpec(link),
          targetRef,
          activationPolicy: readLinkActivationPolicy(link),
          effectConstraint: readLinkEffectConstraint(link),
          sourceSelectionRef,
          sourceWidgetId: link.sourceWidgetId || null,
          hasActiveSelection: Boolean(activeSelection),
          mappedSelection: activeSelection
            ? clone(mapSelectionToTargetSelection(activeSelection, link.fieldMapping))
            : null,
          effect: this.primitiveHandlers.get(link.kind)?.(link) || null,
        }
      })
  }

  assessPropagationEntry({ entry, state = this.store.readState(), activeSelection = null }) {
    if (!entry?.targetRef) {
      return { canApply: false, reason: normalizePropagationSkipReason('missing_target_ref') }
    }
    if (entry.activationPolicy === 'manual') {
      return { canApply: false, reason: normalizePropagationSkipReason('manual_activation_policy') }
    }
    const targetState = this.store.getWidgetState?.(entry.targetRef) || state?.widgets?.[entry.targetRef] || null
    if (!targetState) {
      return { canApply: false, reason: normalizePropagationSkipReason('missing_target_widget') }
    }
    if (!entry.appliedEffect) {
      return { canApply: false, reason: normalizePropagationSkipReason('unsupported_effect') }
    }
    if (!activeSelection) {
      return { canApply: false, reason: normalizePropagationSkipReason('no_active_selection') }
    }
    if (entry.appliedEffect === 'transformView' || entry.appliedEffect === 'transformDataView' || entry.appliedEffect === 'transformStructure') {
      const advancedPlan = resolveAdvancedResponsePlan(entry, targetState)
      return {
        canApply: advancedPlan.ok === true,
        reason: advancedPlan.ok === true ? null : normalizePropagationSkipReason(advancedPlan.reason),
      }
    }
    if (entry.appliedEffect === 'focusTarget') {
      return { canApply: true, reason: null }
    }
    if (entry.appliedEffect === 'syncDomain') {
      const hasDomain = Array.isArray(entry.mappedSelection?.domain?.xDomain) || Array.isArray(entry.mappedSelection?.domain?.yDomain)
      return {
        canApply: hasDomain,
        reason: hasDomain ? null : normalizePropagationSkipReason('mapping_unresolved'),
      }
    }
    if (!entry.mappedSelection) {
      return { canApply: false, reason: normalizePropagationSkipReason('mapping_unresolved') }
    }
    return { canApply: true, reason: null }
  }

  propagate(input) {
    const directSourceRef = typeof input === 'string' ? input : null
    const sourceRef = directSourceRef || input?.sourceRef || null
    const state = directSourceRef ? this.store.readState() : (input?.state || this.store.readState())
    const activeSelection = this.resolveActiveSelection({ sourceRef, state })
    const plan = this.buildPropagationPlan({ sourceRef, state })

    const candidateRefs = [...new Set(plan.map((entry) => entry.targetRef).filter(Boolean))]
    this.store.clearWidgetPatches?.(candidateRefs)

    let currentState = this.store.readState()
    const appliedLinks = []
    const skippedTargets = []
    for (const entry of plan) {
      const applicability = this.assessPropagationEntry({
        entry,
        state: currentState,
        activeSelection,
      })
      if (!applicability.canApply) {
        skippedTargets.push({
          linkRef: entry.linkRef,
          primitive: entry.primitive,
          declaredEffect: entry.declaredEffect,
          appliedEffect: entry.appliedEffect,
          responseSpec: clone(entry.responseSpec),
          targetRef: entry.targetRef,
          activationPolicy: entry.activationPolicy,
          effectConstraint: entry.effectConstraint,
          reason: normalizePropagationSkipReason(applicability.reason),
        })
        continue
      }
      const patchResult = this.applyPropagationEntry({ entry, state: currentState, activeSelection })
      if (patchResult?.applied) {
        currentState = patchResult.nextState || this.store.readState()
      } else {
        skippedTargets.push({
          linkRef: entry.linkRef,
          primitive: entry.primitive,
          declaredEffect: entry.declaredEffect,
          appliedEffect: entry.appliedEffect,
          responseSpec: clone(entry.responseSpec),
          targetRef: entry.targetRef,
          activationPolicy: entry.activationPolicy,
          effectConstraint: entry.effectConstraint,
          reason: normalizePropagationSkipReason(patchResult?.reason),
        })
        continue
      }
      appliedLinks.push({
        linkRef: entry.linkRef,
        primitive: entry.primitive,
        declaredEffect: entry.declaredEffect,
        appliedEffect: entry.appliedEffect,
        responseSpec: clone(entry.responseSpec),
        targetRef: entry.targetRef,
        activationPolicy: entry.activationPolicy,
        effectConstraint: entry.effectConstraint,
        hasActiveSelection: entry.hasActiveSelection,
        appliedStatePaths: describeAppliedStatePathsForEffect(entry.appliedEffect),
        effect: clone(entry.effect),
      })
    }

    const affectedRefs = [...new Set(appliedLinks.map((entry) => entry.targetRef).filter(Boolean))]

    const propagation = {
      sourceRef,
      activeSelection: clone(activeSelection),
      affectedRefs,
      linkCount: plan.length,
      appliedLinkCount: appliedLinks.length,
      skippedLinkCount: skippedTargets.length,
      nextState: currentState,
      links: appliedLinks,
      skippedTargets,
      effects: plan.map((entry) => clone(entry.effect)).filter(Boolean),
    }

    return directSourceRef ? propagation.affectedRefs : propagation
  }

  applyPropagationEntry({ entry, state, activeSelection }) {
    const targetRef = entry?.targetRef
    if (!targetRef) return { applied: false, nextState: state, reason: normalizePropagationSkipReason('missing_target_ref') }

    const targetState = this.store.getWidgetState?.(targetRef) || state?.widgets?.[targetRef] || null
    if (!targetState) return { applied: false, nextState: state, reason: normalizePropagationSkipReason('missing_target_widget') }

    const { feedback, inboundLinkIds, linkedSourceRefs } = this.buildLinkedFeedback(targetState, entry)
    const mappedSelection = entry.mappedSelection || null

    if (entry.appliedEffect === 'applyFilter') {
      const filterEntries = this.buildTargetEffectEntries({
        targetRef,
        effect: 'applyFilter',
        state,
      })
      const activeFilterEntries = filterEntries.filter((item) => item.mappedSelection)
      const filterLinkRefs = new Set(filterEntries.map((item) => item.linkRef))
      const nextTransforms = (Array.isArray(targetState.transforms) ? targetState.transforms : [])
        .filter((transform) => !filterLinkRefs.has(transform?.spec?.linkRef))
      const visibleDataRef = targetState.data?.currentDataRef || null
      const runtimeData = visibleDataRef ? this.store.readRuntimeData(visibleDataRef) : null
      const baselineRows = Array.isArray(runtimeData?.baseRows)
        ? runtimeData.baseRows
        : Array.isArray(runtimeData?.rows)
          ? runtimeData.rows
          : []
      const nextVisibleRows = activeFilterEntries.reduce(
        (rows, filterEntry) => rows.filter((row) => rowMatchesSelection(row, filterEntry.mappedSelection)),
        baselineRows,
      )
      const activeSelectionStates = Object.values(targetState.selections || {}).filter(Boolean)
      const selectedCount = countSelectedRowsForSelections(nextVisibleRows, activeSelectionStates)
      for (const filterEntry of activeFilterEntries) {
        nextTransforms.push({
          kind: 'filter',
          source: filterEntry.sourceSelectionRef,
          sourceWidgetId: filterEntry.sourceWidgetId || null,
          sourceSelectionRef: filterEntry.sourceSelectionRef,
          linkId: this.resolveLinkId(filterEntry.linkRef),
          spec: {
            linkRef: filterEntry.linkRef,
            sourceSelectionRef: filterEntry.sourceSelectionRef,
          },
        })
      }
      if (visibleDataRef) {
        this.store.updateRuntimeData?.(visibleDataRef, (currentEntry) => ({
          ...currentEntry,
          rows: nextVisibleRows,
          baseRows: Array.isArray(currentEntry?.baseRows) ? currentEntry.baseRows : baselineRows,
          handle: {
            ...(currentEntry?.handle || {}),
            stats: {
              ...(currentEntry?.handle?.stats || {}),
              rowCount: Array.isArray(baselineRows) ? baselineRows.length : 0,
              visibleCount: nextVisibleRows.length,
              selectedCount,
            },
          },
        }))
      }
      const nextState = this.store.patchWidget(targetRef, {
        transforms: nextTransforms,
        data: {
          ...(targetState.data || {}),
          visibleCount: nextVisibleRows.length,
          selectedCount,
        },
        rawSpec: targetState.rawSpec?.data
          ? {
              ...clone(targetState.rawSpec),
              data: {
                ...(targetState.rawSpec.data || {}),
                values: nextVisibleRows,
              },
            }
          : targetState.rawSpec,
        feedback: {
          ...feedback,
          inboundLinkIds,
          linkedSourceRefs,
        },
      })
      this.store.syncSelectionRuntimeData?.(targetRef)
      return {
        applied: true,
        nextState,
      }
    }

    if (entry.appliedEffect === 'applyHighlight') {
      const highlightEntries = this.buildTargetEffectEntries({
        targetRef,
        effect: 'applyHighlight',
        state,
      })
      const activeHighlightEntries = highlightEntries.filter((item) => item.mappedSelection)
      const highlightedKeys = uniqueValues(
        activeHighlightEntries.flatMap((item) => categoricalValuesFromSelection(item.mappedSelection)),
      )
      const isHighlightedRow = (row) => activeHighlightEntries.some((item) => rowMatchesSelection(row, item.mappedSelection))
      if (targetState.data?.currentDataRef) {
        this.store.updateRuntimeData?.(targetState.data.currentDataRef, (currentEntry) => {
          const currentRows = Array.isArray(currentEntry?.rows) ? currentEntry.rows : []
          return {
            ...currentEntry,
            rows: markRows(currentRows, '__widgetva_highlight', isHighlightedRow),
          }
        })
      }
      const nextState = this.store.patchWidget(targetRef, {
        rawSpec: targetState.rawSpec?.data
          ? {
              ...clone(targetState.rawSpec),
              data: {
                ...(targetState.rawSpec.data || {}),
                values: markRows(targetState.rawSpec.data.values, '__widgetva_highlight', isHighlightedRow),
              },
            }
          : targetState.rawSpec,
        feedback: {
          ...feedback,
          inboundLinkIds,
          linkedSourceRefs,
          highlightedKeys,
        },
      })
      const nextStateWithSharedHighlight = updateSharedStateInStore(this.store, (shared) =>
        withHighlightSubmodel(shared, deriveHighlightState(nextState)),
      )
      return {
        applied: true,
        nextState: nextStateWithSharedHighlight,
      }
    }

    if (entry.appliedEffect === 'focusTarget') {
      const nextState = this.store.patchWidget(targetRef, {
        feedback: {
          ...feedback,
          inboundLinkIds,
          linkedSourceRefs,
          focusLinkIds: uniqueValues([...(feedback.focusLinkIds || []), this.resolveLinkId(entry.linkRef)]),
          focusedBySelectionRef: entry.sourceSelectionRef || null,
        },
      })
      const nextStateWithSharedFocus = updateSharedStateInStore(this.store, (shared) =>
        withFocusSubmodel(shared, {
          widgetRef: targetRef,
          widgetId: targetState.widgetId || null,
          source: 'link',
        }, nextState?.widgets || state?.widgets || {}),
      )
      return {
        applied: true,
        nextState: nextStateWithSharedFocus,
      }
    }

    if (entry.appliedEffect === 'syncDomain') {
      const syncEntries = this.buildTargetEffectEntries({
        targetRef,
        effect: 'syncDomain',
        state,
      })
      const activeSyncEntries = syncEntries.filter((item) => item.mappedSelection?.domain)
      const resolvedXDomain = [...activeSyncEntries]
        .reverse()
        .find((item) => Array.isArray(item.mappedSelection?.domain?.xDomain))
        ?.mappedSelection?.domain?.xDomain || null
      const resolvedYDomain = [...activeSyncEntries]
        .reverse()
        .find((item) => Array.isArray(item.mappedSelection?.domain?.yDomain))
        ?.mappedSelection?.domain?.yDomain || null
      return {
        applied: true,
        nextState: this.store.patchWidget(targetRef, {
          view: {
            ...(targetState.view || {}),
            xDomain: resolvedXDomain,
            yDomain: resolvedYDomain,
            zoom: buildViewZoomState({
              widgetSpec: targetState.rawSpec,
              xDomain: resolvedXDomain,
              yDomain: resolvedYDomain,
            }),
          },
          rawSpec: targetState.rawSpec?.encoding
            ? {
                ...clone(targetState.rawSpec),
                encoding: {
                  ...(targetState.rawSpec.encoding || {}),
                  ...(targetState.rawSpec.encoding?.x ? { x: updateEncodingDomain(targetState.rawSpec.encoding, 'x', resolvedXDomain) } : {}),
                  ...(targetState.rawSpec.encoding?.y ? { y: updateEncodingDomain(targetState.rawSpec.encoding, 'y', resolvedYDomain) } : {}),
                },
              }
            : targetState.rawSpec,
          feedback: {
            ...feedback,
            inboundLinkIds,
            linkedSourceRefs,
          },
        }),
      }
    }

    if (entry.appliedEffect === 'shareSelection') {
      const shareEntries = this.buildTargetEffectEntries({
        targetRef,
        effect: 'shareSelection',
        state,
      })
      const activeShareEntries = shareEntries.filter((item) => item.mappedSelection)
      const runtimeData = this.store.readRuntimeData(targetState.data?.currentDataRef)
      const targetRows = Array.isArray(runtimeData?.rows) ? runtimeData.rows : []
      const shareSelectionRefs = new Set(
        shareEntries.map((item) => this.buildMirroredSelectionRef(targetRef, item.sourceSelectionRef)),
      )
      const isSelectedRow = (row) => activeShareEntries.some((item) => rowMatchesSelection(row, item.mappedSelection))
      const selectedCount = countRowsMatching(targetRows, isSelectedRow)
      if (targetState.data?.currentDataRef) {
        this.store.updateRuntimeData?.(targetState.data.currentDataRef, (currentEntry) => ({
          ...currentEntry,
          rows: markRows(currentEntry?.rows, '__widgetva_selected', isSelectedRow),
          handle: {
            ...(currentEntry?.handle || {}),
            stats: {
              ...(currentEntry?.handle?.stats || {}),
              selectedCount,
            },
          },
        }))
      }
      const nextState = this.store.patchWidget(targetRef, {
        selections: activeShareEntries.reduce((acc, shareEntry) => ({
          ...acc,
          [this.buildMirroredSelectionRef(targetRef, shareEntry.sourceSelectionRef)]: makeSelectionState(
            buildSelectionStateInput(shareEntry.mappedSelection),
          ),
        }), Object.fromEntries(
          Object.entries(targetState.selections || {}).filter(([selectionRef]) => !shareSelectionRefs.has(selectionRef)),
        )),
        data: {
          ...(targetState.data || {}),
          selectedCount,
        },
        rawSpec: targetState.rawSpec?.data
          ? {
              ...clone(targetState.rawSpec),
              data: {
                ...(targetState.rawSpec.data || {}),
                values: markRows(targetState.rawSpec.data.values, '__widgetva_selected', isSelectedRow),
              },
            }
          : targetState.rawSpec,
        feedback: {
          ...feedback,
          inboundLinkIds,
          linkedSourceRefs,
          sharedSelectionSourceWidgetId: activeShareEntries[0]?.sourceWidgetId || null,
        },
      })
      this.store.syncSelectionRuntimeData?.(targetRef)
      return {
        applied: true,
        nextState,
      }
    }

    if (entry.appliedEffect === 'transformView' || entry.appliedEffect === 'transformDataView' || entry.appliedEffect === 'transformStructure') {
      const advancedPlan = resolveAdvancedResponsePlan(entry, targetState)
      if (advancedPlan.ok !== true || !advancedPlan.nextSpec) {
        return {
          applied: false,
          nextState: state,
          reason: normalizePropagationSkipReason(advancedPlan.reason),
        }
      }
      return {
        applied: true,
        nextState: this.store.patchWidget(targetRef, {
          currentSpec: clone(advancedPlan.nextSpec),
          rawSpec: clone(advancedPlan.nextSpec),
          encodings: advancedPlan.nextSpec?.encoding && typeof advancedPlan.nextSpec.encoding === 'object'
            ? clone(advancedPlan.nextSpec.encoding)
            : targetState.encodings || {},
          transforms: Array.isArray(advancedPlan.nextSpec.transform)
            ? clone(advancedPlan.nextSpec.transform)
            : targetState.transforms || [],
          feedback: {
            ...feedback,
            inboundLinkIds,
            linkedSourceRefs,
            advancedResponseKinds: uniqueValues([
              ...(Array.isArray(feedback.advancedResponseKinds) ? feedback.advancedResponseKinds : []),
              entry?.responseSpec?.kind || null,
            ]),
            advancedActionName: advancedPlan.actionName || null,
          },
        }),
      }
    }

    return { applied: false, nextState: state, reason: normalizePropagationSkipReason('unsupported_effect') }
  }

  resolveLinkId(linkRef) {
    const link = this.store.getLink?.(linkRef) || this.listLinks().find((item) => item.ref === linkRef) || null
    if (link?.linkId) return link.linkId
    if (typeof linkRef === 'string' && linkRef.includes('/link/')) {
      return linkRef.split('/').pop() || null
    }
    return null
  }

  evaluatePropagation({ sourceRef, state = this.store.readState() }) {
    const activeSelection = this.resolveActiveSelection({ sourceRef, state })
    const plan = this.buildPropagationPlan({ sourceRef, state })
    const results = plan.map((entry) => this.evaluatePlanEntry({ entry, state, activeSelection }))
    const passedCount = results.filter((item) => item.passed).length
    return {
      ok: results.every((item) => item.passed),
      sourceRef,
      activeSelection: clone(activeSelection),
      linkCount: results.length,
      passedCount,
      consistencyScore: results.length === 0 ? 1 : passedCount / results.length,
      results,
    }
  }

  evaluatePlanEntry({ entry, state, activeSelection }) {
    const resolvedLinkId = this.resolveLinkId(entry.linkRef)
    const targetState = entry.targetRef ? state?.widgets?.[entry.targetRef] || null : null
    const mappedSelection = entry.mappedSelection
    const checks = []
    const applicability = this.assessPropagationEntry({ entry, state, activeSelection })

    checks.push({
      name: 'targetExists',
      passed: Boolean(targetState),
      actual: Boolean(targetState),
      expected: true,
    })

    if (targetState && applicability.canApply && entry.appliedEffect !== 'focusTarget') {
      checks.push({
        name: 'inboundLinkRegistered',
        passed: Array.isArray(targetState.feedback?.inboundLinkIds) && targetState.feedback.inboundLinkIds.includes(resolvedLinkId),
        actual: targetState.feedback?.inboundLinkIds || [],
        expected: resolvedLinkId,
      })
    }

    if (targetState && applicability.canApply) {
      if (entry.appliedEffect === 'applyFilter' && mappedSelection) {
        const runtimeData = this.store.readRuntimeData?.(targetState.data?.currentDataRef)
        const targetRows = Array.isArray(runtimeData?.rows) ? runtimeData.rows : []
        const everyVisibleRowMatches = targetRows.every((row) => countSelectedRows([row], mappedSelection) === 1)
        checks.push({
          name: 'visibleRowsMatchFilter',
          passed: everyVisibleRowMatches,
          actual: targetRows.length,
          expected: 'all visible rows satisfy mapped selection predicates',
        })
      }

      if (entry.appliedEffect === 'shareSelection' && mappedSelection) {
        const runtimeData = this.store.readRuntimeData?.(targetState.data?.currentDataRef)
        const targetRows = Array.isArray(runtimeData?.rows) ? runtimeData.rows : []
        const mirroredSelection = Object.values(targetState.selections || {}).find((selection) => selection?.summary === mappedSelection.summary)
        const expectedSelectedCount = countSelectedRows(targetRows, mappedSelection)
        checks.push({
          name: 'mirroredSelectionExists',
          passed: Boolean(mirroredSelection),
          actual: Boolean(mirroredSelection),
          expected: true,
        })
        checks.push({
          name: 'mirroredSelectionCountMatches',
          passed: targetState.data?.selectedCount === expectedSelectedCount,
          actual: targetState.data?.selectedCount ?? 0,
          expected: expectedSelectedCount,
        })
      }

      if (entry.appliedEffect === 'syncDomain') {
        checks.push({
          name: 'xDomainSynced',
          passed: arraysEqual(targetState.view?.xDomain, activeSelection?.domain?.xDomain),
          actual: targetState.view?.xDomain || null,
          expected: activeSelection?.domain?.xDomain || null,
        })
        checks.push({
          name: 'yDomainSynced',
          passed: arraysEqual(targetState.view?.yDomain, activeSelection?.domain?.yDomain),
          actual: targetState.view?.yDomain || null,
          expected: activeSelection?.domain?.yDomain || null,
        })
      }

      if (entry.appliedEffect === 'applyHighlight') {
        const highlightedKeys = targetState.feedback?.highlightedKeys || []
        const highlightedRows = Array.isArray(targetState.rawSpec?.data?.values)
          ? targetState.rawSpec.data.values.filter((row) => row?.__widgetva_highlight === true).length
          : 0
        checks.push({
          name: 'highlightFeedbackPresent',
          passed: highlightedKeys.length > 0 || highlightedRows > 0,
          actual: {
            highlightedKeys: highlightedKeys.length,
            highlightedRows,
          },
          expected: 'at least one highlight feedback channel should be populated',
        })
      }

      if (entry.appliedEffect === 'focusTarget') {
        const focusState = state?.shared?.focus || null
        checks.push({
          name: 'focusedWidgetMatchesTarget',
          passed: state?.shared?.focusedWidget === entry.targetRef,
          actual: state?.shared?.focusedWidget || null,
          expected: entry.targetRef,
        })
        checks.push({
          name: 'focusStateMatchesTarget',
          passed: focusState?.widgetRef === entry.targetRef,
          actual: focusState?.widgetRef || null,
          expected: entry.targetRef,
        })
      }
    }

    checks.push({
      name: 'linkCanApply',
      passed: applicability.canApply,
      actual: applicability.reason || 'applicable',
      expected: 'applicable',
    })

    return {
      linkRef: entry.linkRef,
      primitive: entry.primitive,
      declaredEffect: entry.declaredEffect,
      appliedEffect: entry.appliedEffect,
      responseSpec: clone(entry.responseSpec),
      targetRef: entry.targetRef,
      activationPolicy: entry.activationPolicy,
      effectConstraint: entry.effectConstraint,
      reason: applicability.reason,
      passed: checks.every((check) => check.passed),
      checks,
    }
  }
}
