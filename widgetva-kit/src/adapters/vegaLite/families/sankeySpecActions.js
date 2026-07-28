import { ensureObjectSpec } from '../specModel.js'

function findNamedDataSource(spec, name) {
  const data = Array.isArray(spec?.data) ? spec.data : []
  const index = data.findIndex((entry) => entry && typeof entry === 'object' && entry.name === name)
  if (index < 0) return { index: -1, values: null }
  return { index, values: Array.isArray(data[index]?.values) ? data[index].values : null }
}

function findNamedMark(spec, name) {
  const marks = Array.isArray(spec?.marks) ? spec.marks : []
  for (const mark of marks) {
    if (mark?.name === name) return mark
    if (mark?.type === 'group' && Array.isArray(mark.marks)) {
      const nested = mark.marks.find((entry) => entry?.name === name)
      if (nested) return nested
    }
  }
  return null
}

function setSignalValue(spec, name, value) {
  const signals = Array.isArray(spec?.signals) ? [...spec.signals] : []
  const index = signals.findIndex((entry) => entry && typeof entry === 'object' && entry.name === name)
  if (index >= 0) {
    signals[index] = { ...signals[index], value }
    return { ...spec, signals }
  }
  return { ...spec, signals: [...signals, { name, value }] }
}

function computeNodeFlows(links) {
  const flows = new Map()
  const ensure = (name) => {
    if (!flows.has(name)) flows.set(name, { inflow: 0, outflow: 0, total: 0 })
    return flows.get(name)
  }
  for (const link of Array.isArray(links) ? links : []) {
    if (!link || typeof link !== 'object') continue
    const value = Number(link.value || 0)
    ensure(link.source).outflow += value
    ensure(link.target).inflow += value
  }
  for (const entry of flows.values()) entry.total = Math.max(entry.inflow, entry.outflow)
  return flows
}

function cloneFirstAvailableDataWithValues(spec, sourceNames, updateValues) {
  for (const sourceName of sourceNames) {
    const { index, values } = findNamedDataSource(spec, sourceName)
    if (index >= 0 && Array.isArray(values)) {
      const nextData = [...spec.data]
      nextData[index] = {
        ...nextData[index],
        values: updateValues(values),
      }
      return { ...spec, data: nextData }
    }
  }
  throw new Error(`Sankey source data "${sourceNames.join('" or "')}" is not available.`)
}

function readLinks(spec) {
  return findNamedDataSource(spec, 'rawLinks').values
    || findNamedDataSource(spec, 'links').values
    || findNamedDataSource(spec, 'link-data').values
    || findNamedDataSource(spec, 'filteredLinks').values
    || findNamedDataSource(spec, 'edges').values
    || []
}

function readNodes(spec) {
  return findNamedDataSource(spec, 'nodeConfig').values
    || findNamedDataSource(spec, 'nodes').values
    || findNamedDataSource(spec, 'node-data').values
    || []
}

function updateNodeConfig(spec, updateValues) {
  return cloneFirstAvailableDataWithValues(spec, ['nodeConfig', 'nodes', 'node-data'], updateValues)
}

function nodeName(row) {
  return row?.name || row?.id || row?.label || null
}

function nodeDepth(row) {
  const depth = Number(row?.depth)
  return Number.isFinite(depth) ? depth : null
}

function readMarkDataName(mark = {}) {
  if (typeof mark?.from?.data === 'string') return mark.from.data
  if (typeof mark?.from?.facet?.data === 'string') return mark.from.facet.data
  return null
}

function isSankeyLinkMark(mark = {}) {
  const name = typeof mark?.name === 'string' ? mark.name.toLowerCase() : ''
  const dataName = readMarkDataName(mark)?.toLowerCase() || ''
  return mark?.type === 'path'
    || name.includes('edge')
    || name.includes('link')
    || dataName.includes('edge')
    || dataName.includes('link')
}

function isSankeyNodeMark(mark = {}) {
  const name = typeof mark?.name === 'string' ? mark.name.toLowerCase() : ''
  const dataName = readMarkDataName(mark)?.toLowerCase() || ''
  return name.includes('node')
    || dataName.includes('node')
    || dataName.includes('config')
}

function mapMarks(marks, updateMark) {
  if (!Array.isArray(marks)) return marks
  return marks.map((mark) => {
    if (!mark || typeof mark !== 'object') return mark
    const nextMark = updateMark({ ...mark })
    if (Array.isArray(nextMark.marks)) {
      return {
        ...nextMark,
        marks: mapMarks(nextMark.marks, updateMark),
      }
    }
    return nextMark
  })
}

function mergeUpdateEncode(mark, update) {
  return {
    ...mark,
    encode: {
      ...(mark.encode || {}),
      update: {
        ...(mark.encode?.update || {}),
        ...update,
      },
    },
  }
}

function quoteStringList(values) {
  return JSON.stringify(Array.from(new Set(values.filter((value) => typeof value === 'string' && value.length > 0))))
}

function buildNodeMembershipExpr(nodes) {
  const nodeList = quoteStringList(nodes)
  return [
    `indexof(${nodeList}, datum.name) >= 0`,
    `indexof(${nodeList}, datum.id) >= 0`,
    `indexof(${nodeList}, datum.label) >= 0`,
    `indexof(${nodeList}, datum.datum && datum.datum.name) >= 0`,
    `indexof(${nodeList}, datum.datum && datum.datum.id) >= 0`,
    `indexof(${nodeList}, datum.datum && datum.datum.label) >= 0`,
  ].join(' || ')
}

function buildSankeyEndpointExpr(field) {
  return [
    `datum.${field}`,
    `datum.${field} && datum.${field}.name`,
    `datum.${field} && datum.${field}.id`,
    `datum.${field} && datum.${field}.label`,
    `datum.${field} && datum.${field}.data && datum.${field}.data.name`,
    `datum.${field} && datum.${field}.data && datum.${field}.data.id`,
    `datum.datum && datum.datum.${field}`,
    `datum.datum && datum.datum.${field} && datum.datum.${field}.name`,
    `datum.datum && datum.datum.${field} && datum.datum.${field}.id`,
    `datum.datum && datum.datum.${field} && datum.datum.${field}.label`,
    `datum.datum && datum.datum.${field} && datum.datum.${field}.data && datum.datum.${field}.data.name`,
  ]
}

function buildLinkMembershipExpr({ nodes = [], links = [] } = {}) {
  const nodeList = quoteStringList(nodes)
  const sourceExprs = buildSankeyEndpointExpr('source')
  const targetExprs = buildSankeyEndpointExpr('target')
  const linkExprs = [
    ...sourceExprs.map((expr) => `indexof(${nodeList}, ${expr}) >= 0`),
    ...targetExprs.map((expr) => `indexof(${nodeList}, ${expr}) >= 0`),
  ]
  for (const link of Array.isArray(links) ? links : []) {
    if (!link || typeof link !== 'object') continue
    if (link.source == null || link.target == null) continue
    const source = JSON.stringify(link.source)
    const target = JSON.stringify(link.target)
    linkExprs.push(`(${sourceExprs.map((expr) => `${expr} === ${source}`).join(' || ')}) && (${targetExprs.map((expr) => `${expr} === ${target}`).join(' || ')})`)
  }
  return linkExprs.join(' || ')
}

function applySankeyEmphasisToMarks(spec, { nodes = [], links = [] } = {}) {
  if (!Array.isArray(spec?.marks)) return spec
  const nodeExpr = buildNodeMembershipExpr(nodes)
  const linkExpr = buildLinkMembershipExpr({ nodes, links })
  return {
    ...spec,
    marks: mapMarks(spec.marks, (mark) => {
      if (isSankeyLinkMark(mark)) {
        return mergeUpdateEncode(mark, {
          opacity: { signal: `(${linkExpr}) ? 0.92 : 0.14` },
          fillOpacity: { signal: `(${linkExpr}) ? 0.68 : 0.06` },
          strokeOpacity: { signal: `(${linkExpr}) ? 0.95 : 0.14` },
        })
      }
      if (isSankeyNodeMark(mark)) {
        return mergeUpdateEncode(mark, {
          opacity: { signal: `(${nodeExpr}) ? 1 : 0.28` },
          fillOpacity: { signal: `(${nodeExpr}) ? 1 : 0.28` },
        })
      }
      return mark
    }),
  }
}

function withCollapsedNodeConfig(spec, nodes, collapsedName) {
  const collapsedSet = new Set(nodes)
  return updateNodeConfig(spec, (rows) => {
    const collapsedRows = rows.filter((row) => collapsedSet.has(nodeName(row)))
    if (collapsedRows.length === 0) return rows
    const depth = nodeDepth(collapsedRows[0]) ?? 0
    const order = Math.min(...collapsedRows.map((row) => Number(row?.order)).filter(Number.isFinite), 0)
    const remaining = rows.filter((row) => !collapsedSet.has(nodeName(row)) && nodeName(row) !== collapsedName)
    return [
      ...remaining,
      { ...collapsedRows[0], name: collapsedName, id: collapsedName, label: collapsedName, depth, order, collapsed: nodes },
    ]
  })
}

export function executeVegaSankeyFilterFlow(spec, params = {}) {
  ensureObjectSpec(spec, 'No active Vega spec is available for sankey flow filtering.')
  const source = params.source ?? params.sourceNode ?? null
  const target = params.target ?? params.targetNode ?? null
  const minValue = Number.isFinite(params.minValue) ? params.minValue : null
  return cloneFirstAvailableDataWithValues(spec, ['links', 'rawLinks', 'filteredLinks'], (links) => links.filter((link) => {
    if (source != null && link.source !== source) return false
    if (target != null && link.target !== target) return false
    if (minValue != null && Number(link.value || 0) < minValue) return false
    return true
  }))
}

export function executeVegaSankeyCollapseNodes(spec, params = {}) {
  ensureObjectSpec(spec, 'No active Vega spec is available for sankey node collapse.')
  const nodes = Array.isArray(params.nodes) ? params.nodes.filter((node) => node != null) : []
  if (nodes.length === 0) throw new Error('sankey.collapseNodes requires nodes.')
  const collapsedName = params.collapsedName || params.aggregateName || params.groupName || nodes.join('+')
  const collapsedSet = new Set(nodes)
  let nextSpec = cloneFirstAvailableDataWithValues(spec, ['rawLinks', 'links', 'filteredLinks'], (links) => links.map((link) => ({
    ...link,
    source: collapsedSet.has(link.source) ? collapsedName : link.source,
    target: collapsedSet.has(link.target) ? collapsedName : link.target,
  })).filter((link) => link.source !== link.target))
  try {
    nextSpec = withCollapsedNodeConfig(nextSpec, nodes, collapsedName)
    return setSignalValue(nextSpec, 'selectedNode', collapsedName)
  } catch {
    return { ...nextSpec, _sankey_collapse_state: { nodes, collapsedName } }
  }
}

export function executeVegaSankeyExpandNode(spec, params = {}) {
  ensureObjectSpec(spec, 'No active Vega spec is available for sankey node expansion.')
  const node = params.node || params.collapsedName || null
  if (!node) throw new Error('sankey.expandNode requires a node.')
  return {
    ...spec,
    _sankey_expand_state: { node },
    _sankey_collapse_state: null,
  }
}

export function executeVegaSankeyHighlightPath(spec, params = {}) {
  ensureObjectSpec(spec, 'No active Vega spec is available for sankey path highlighting.')
  const pathNodes = Array.isArray(params.path) ? params.path : []
  const nodes = Array.isArray(params.nodes)
    ? params.nodes.filter((node) => node != null)
    : pathNodes.filter((node) => node != null)
  const links = Array.isArray(params.links) ? params.links : []
  if (nodes.length === 0 && links.length === 0) throw new Error('sankey.highlightPath requires nodes or links.')
  return applySankeyEmphasisToMarks({
    ...spec,
    _sankey_highlight_state: { nodes, links },
  }, { nodes, links })
}

export function executeVegaSankeyTraceNode(spec, params = {}) {
  ensureObjectSpec(spec, 'No active Vega spec is available for sankey node tracing.')
  const node = params.node || params.nodeName || params.nodeId || null
  if (!node) throw new Error('sankey.traceNode requires a node.')
  const links = readLinks(spec)
  const reachableLinks = links.filter((link) => link.source === node || link.target === node)
  const reachableNodes = [
    node,
    ...reachableLinks.flatMap((link) => [link.source, link.target]),
  ].filter((value) => value != null)
  return setSignalValue(applySankeyEmphasisToMarks({
    ...spec,
    _sankey_trace_state: { node, links: reachableLinks },
  }, { nodes: reachableNodes, links: reachableLinks }), 'selectedNode', node)
}

export function executeVegaSankeyColorFlows(spec, params = {}) {
  ensureObjectSpec(spec, 'No active Vega spec is available for sankey flow coloring.')
  const nodes = Array.isArray(params.nodes) ? params.nodes.filter((node) => node != null) : []
  const color = params.color || '#e74c3c'
  const field = params.field || 'source'
  const scheme = params.scheme || 'category10'
  const linkMark = findNamedMark(spec, 'edgeMark') || findNamedMark(spec, 'links') || findNamedMark(spec, 'link') || null
  const nextSpec = {
    ...spec,
    marks: Array.isArray(spec.marks) ? spec.marks.map((mark) => ({ ...mark })) : spec.marks,
  }
  const nextLinkMark = findNamedMark(nextSpec, 'edgeMark') || findNamedMark(nextSpec, 'links') || findNamedMark(nextSpec, 'link') || null
  const highlightExpr = nodes.length > 0
    ? `indexof(${JSON.stringify(nodes)}, datum.source) >= 0 || indexof(${JSON.stringify(nodes)}, datum.target) >= 0`
    : 'false'
  const fallbackFill = linkMark?.encode?.update?.fill || { scale: 'color', field }
  if (linkMark) {
    nextLinkMark.encode = {
      ...(nextLinkMark.encode || {}),
      update: {
        ...(nextLinkMark.encode?.update || {}),
        fill: { signal: `${highlightExpr} ? ${JSON.stringify(color)} : (${fallbackFill.signal || `scale('color', datum.${field})`})` },
        stroke: { signal: `${highlightExpr} ? ${JSON.stringify(color)} : (${fallbackFill.signal || `scale('color', datum.${field})`})` },
      },
    }
  }
  return {
    ...nextSpec,
    scales: [
      ...(Array.isArray(spec.scales) ? spec.scales : []),
    ],
    _sankey_color_state: { field, scheme, nodes, color },
  }
}

export function executeVegaSankeyReorderNodesInLayer(spec, params = {}) {
  ensureObjectSpec(spec, 'No active Vega spec is available for sankey node reordering.')
  const layer = params.layer ?? params.rank ?? params.depth ?? null
  const order = Array.isArray(params.order) ? params.order.filter((node) => node != null) : []
  if (layer == null || order.length === 0) throw new Error('sankey.reorderNodesInLayer requires layer and order.')
  return updateNodeConfig(spec, (rows) => rows.map((row) => {
    if (nodeDepth(row) !== Number(layer)) return row
    const index = order.indexOf(nodeName(row))
    return index >= 0 ? { ...row, order: index } : row
  }))
}

export function executeVegaSankeyAutoCollapseByRank(spec, params = {}) {
  ensureObjectSpec(spec, 'No active Vega spec is available for sankey auto-collapse.')
  const requestedMaxNodes = Number.isFinite(params.maxNodes) ? params.maxNodes : params.topN
  const topN = Number.isFinite(requestedMaxNodes) ? Math.max(1, Math.floor(requestedMaxNodes)) : 8
  const links = readLinks(spec)
  const flows = computeNodeFlows(links)
  const configRows = readNodes(spec)
  const keepSet = new Set()
  const collapseByNode = new Map()
  const rowsByDepth = new Map()
  for (const row of configRows) {
    const depth = nodeDepth(row)
    if (depth == null) continue
    const bucket = rowsByDepth.get(depth) || []
    bucket.push(row)
    rowsByDepth.set(depth, bucket)
  }
  for (const [depth, rows] of rowsByDepth.entries()) {
    const sorted = [...rows].sort((left, right) => (flows.get(nodeName(right))?.total || 0) - (flows.get(nodeName(left))?.total || 0))
    for (const row of sorted.slice(0, topN)) keepSet.add(nodeName(row))
    for (const row of sorted.slice(topN)) collapseByNode.set(nodeName(row), `Other ${depth}`)
  }
  let nextSpec = cloneFirstAvailableDataWithValues(spec, ['rawLinks', 'links', 'filteredLinks'], (sourceLinks) => sourceLinks.map((link) => ({
    ...link,
    source: collapseByNode.get(link.source) || link.source,
    target: collapseByNode.get(link.target) || link.target,
  })).filter((link) => link.source !== link.target))
  nextSpec = updateNodeConfig(nextSpec, (rows) => {
    const keptRows = rows.filter((row) => keepSet.has(nodeName(row)))
    const otherRows = [...new Set([...collapseByNode.values()])].map((name) => {
      const depth = Number(String(name).replace(/^Other\s+/, ''))
      const sample = rows.find((row) => nodeDepth(row) === depth) || {}
      return { ...sample, name, id: name, label: name, depth, order: topN }
    })
    return [...keptRows, ...otherRows]
  })
  return {
    ...nextSpec,
    _sankey_auto_collapse_state: {
      topN,
      keepNodes: [...keepSet],
      collapsedNodes: [...collapseByNode.keys()],
    },
  }
}
