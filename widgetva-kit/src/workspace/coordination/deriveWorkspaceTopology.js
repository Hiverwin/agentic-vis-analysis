import { parseRef } from '../../contracts/refs-contracts.js'
import { makeWidgetLink } from '../../contracts/widget-links-contracts.js'

const TOPOLOGY_LABELS = {
  T1: 'Single View',
  T2: 'Coordinated Pair',
  T3: 'Overview + Detail',
  T4: 'Triple Dashboard',
  T5: 'Drill-down Chain',
  T6: 'Global Control + Multiple Targets',
}

const TOPOLOGY_LINK_KINDS = new Set([
  'filter',
  'filters',
  'highlight',
  'highlights',
  'syncDomain',
  'syncsDomain',
  'sharesSelection',
  'comparesWith',
])

const COORDINATION_TRANSFORM_TO_LINK_KIND = Object.freeze({
  selectionToFilter: 'filter',
  intervalToFilter: 'filter',
  domainToFilter: 'filter',
  selectionToHighlight: 'highlight',
  intervalToDomain: 'syncDomain',
  domainToDomain: 'syncDomain',
  selectionToSelection: 'sharesSelection',
  identity: 'sharesSelection',
})

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))]
}

function resolveWidgetId(ref) {
  return parseRef(ref)?.widgetId || null
}

function normalizeTopologyLink(link) {
  const transformKind = link?.transform?.kind
  const canonicalKind = COORDINATION_TRANSFORM_TO_LINK_KIND[transformKind] || null
  return makeWidgetLink({
    ...link,
    kind: COORDINATION_TRANSFORM_TO_LINK_KIND[link?.kind] || link?.kind || canonicalKind,
    from: link?.from || link?.sourceStateRef || null,
    to: link?.to || link?.targetStateRef || null,
    sourceWidgetId:
      link?.sourceWidgetId
      || resolveWidgetId(link?.from)
      || resolveWidgetId(link?.sourceStateRef),
    targetWidgetId:
      link?.targetWidgetId
      || resolveWidgetId(link?.to)
      || resolveWidgetId(link?.targetStateRef),
  })
}

function buildDegreeMaps(widgetIds, links) {
  const outDegree = new Map(widgetIds.map((widgetId) => [widgetId, 0]))
  const inDegree = new Map(widgetIds.map((widgetId) => [widgetId, 0]))
  const adjacency = new Map(widgetIds.map((widgetId) => [widgetId, new Set()]))

  for (const link of links) {
    const sourceWidgetId = link?.sourceWidgetId || resolveWidgetId(link?.from)
    const targetWidgetId = link?.targetWidgetId || resolveWidgetId(link?.to)
    if (!sourceWidgetId || !targetWidgetId || sourceWidgetId === targetWidgetId) continue
    if (!adjacency.has(sourceWidgetId)) adjacency.set(sourceWidgetId, new Set())
    if (!outDegree.has(sourceWidgetId)) outDegree.set(sourceWidgetId, 0)
    if (!inDegree.has(targetWidgetId)) inDegree.set(targetWidgetId, 0)
    const targets = adjacency.get(sourceWidgetId)
    if (targets.has(targetWidgetId)) continue
    targets.add(targetWidgetId)
    outDegree.set(sourceWidgetId, (outDegree.get(sourceWidgetId) || 0) + 1)
    inDegree.set(targetWidgetId, (inDegree.get(targetWidgetId) || 0) + 1)
  }

  return { outDegree, inDegree, adjacency }
}

function isLinearChain(widgetIds, edgeCount, outDegree, inDegree) {
  if (widgetIds.length < 3) return false
  if (edgeCount !== widgetIds.length - 1) return false
  const starts = widgetIds.filter((widgetId) => (inDegree.get(widgetId) || 0) === 0 && (outDegree.get(widgetId) || 0) === 1)
  const ends = widgetIds.filter((widgetId) => (inDegree.get(widgetId) || 0) === 1 && (outDegree.get(widgetId) || 0) === 0)
  const middles = widgetIds.filter((widgetId) => (inDegree.get(widgetId) || 0) === 1 && (outDegree.get(widgetId) || 0) === 1)
  return starts.length === 1 && ends.length === 1 && middles.length === widgetIds.length - 2
}

function hasDetailRole(widgets) {
  return (Array.isArray(widgets) ? widgets : []).some((widget) => widget?.role === 'detail')
}

function hasContextRole(widgets) {
  return (Array.isArray(widgets) ? widgets : []).some((widget) => widget?.role === 'context')
}

function makeWorkspaceTopologySummary(summary = {}) {
  return {
    topology: summary?.topology || '',
    topologyLabel: summary?.topologyLabel || '',
    widgetCount: summary?.widgetCount || 0,
    edgeCount: summary?.edgeCount || 0,
    linkDensity: summary?.linkDensity || 0,
    sourceWidgetCount: summary?.sourceWidgetCount || 0,
    targetWidgetCount: summary?.targetWidgetCount || 0,
    maxOutDegree: summary?.maxOutDegree || 0,
    maxInDegree: summary?.maxInDegree || 0,
    rationale: Array.isArray(summary?.rationale) ? [...summary.rationale] : [],
  }
}

export function isTopologyLink(link) {
  const normalizedLink = normalizeTopologyLink(link)
  return TOPOLOGY_LINK_KINDS.has(normalizedLink?.kind)
}

export function deriveWorkspaceTopology({ widgets = [], links = [] } = {}) {
  const widgetIds = unique(
    (Array.isArray(widgets) ? widgets : [])
      .map((widget) => widget?.widgetId || resolveWidgetId(widget?.ref))
      .filter(Boolean),
  )
  const linkEntries = (Array.isArray(links) ? links : [])
    .map((link) => normalizeTopologyLink(link))
    .filter(isTopologyLink)
  const { outDegree, inDegree } = buildDegreeMaps(widgetIds, linkEntries)
  const edgeCount = Array.from(outDegree.values()).reduce((sum, value) => sum + value, 0)
  const maxOutDegree = Math.max(0, ...Array.from(outDegree.values()))
  const maxInDegree = Math.max(0, ...Array.from(inDegree.values()))
  const sourceWidgetCount = Array.from(outDegree.values()).filter((value) => value > 0).length
  const targetWidgetCount = Array.from(inDegree.values()).filter((value) => value > 0).length
  const possibleDirectedEdges = widgetIds.length > 1 ? widgetIds.length * (widgetIds.length - 1) : 1
  const linkDensity = Number((edgeCount / possibleDirectedEdges).toFixed(3))

  let topology = 'T1'
  const rationale = []

  if (widgetIds.length <= 1) {
    topology = 'T1'
    rationale.push('A single widget is active in the current workspace.')
  } else if (isLinearChain(widgetIds, edgeCount, outDegree, inDegree)) {
    topology = 'T5'
    rationale.push('The link graph forms a linear multi-step chain.')
  } else if (widgetIds.length >= 3 && hasDetailRole(widgets) && hasContextRole(widgets) && sourceWidgetCount > 1) {
    topology = 'T4'
    rationale.push('The workspace includes coordinated overview, context, and detail roles across multiple propagation stages.')
  } else if (maxOutDegree >= 2) {
    topology = 'T6'
    rationale.push('One widget currently propagates to multiple targets.')
  } else if (hasDetailRole(widgets)) {
    topology = 'T3'
    rationale.push('A detail-role widget is present in the current workspace plan.')
  } else if (widgetIds.length === 2) {
    topology = 'T2'
    rationale.push('Two widgets are active, forming a coordinated pair.')
  } else {
    topology = 'T4'
    rationale.push('Three or more widgets are active without a single fan-out controller.')
  }

  return makeWorkspaceTopologySummary({
    topology,
    topologyLabel: TOPOLOGY_LABELS[topology] || topology,
    widgetCount: widgetIds.length,
    edgeCount,
    linkDensity,
    sourceWidgetCount,
    targetWidgetCount,
    maxOutDegree,
    maxInDegree,
    rationale,
  })
}
