#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const instancesRoot = path.join(repoRoot, 'visagentbench_kit', 'instances')
const writeChanges = process.argv.includes('--write')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function listJsonFiles(root) {
  if (!fs.existsSync(root)) return []
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) return listJsonFiles(entryPath)
    return entry.isFile() && entry.name.endsWith('.json') ? [entryPath] : []
  })
}

function widgetIdFromRef(ref) {
  return typeof ref === 'string' ? ref.match(/\/widget\/([^/]+)/)?.[1] || null : null
}

function shortLinkId(ref) {
  return typeof ref === 'string' ? ref.match(/\/link\/([^/]+)$/)?.[1] || ref : 'link'
}

function safeKey(value) {
  return String(value || 'filter')
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'filter'
}

function sourceSelectionId({ sourceKind, mappings, operations }) {
  const fields = mappings.map((mapping) => mapping.source_field)
  if (sourceKind === 'bar') return fields[0]
  if (sourceKind === 'scatter') return 'brush'
  if (sourceKind === 'sankey') return 'flow'
  if (sourceKind === 'parallelCoordinates') return fields.join('-')
  if (sourceKind === 'line') {
    if (operations.has('line.selectXValue')) return `${fields[0]}-value`
    if (operations.has('line.selectSeries')) return `${fields[0]}-series`
  }
  throw new Error(`Cannot infer canonical selection id for ${sourceKind}: ${fields.join(', ')}`)
}

function canonicalFieldMapping(mappings) {
  return mappings.map((mapping) => ({
    sourceField: mapping.source_field,
    targetField: mapping.target_field,
  }))
}

function canonicalChannelMapping(mappings) {
  return mappings.map((mapping, index) => ({
    sourceChannel: index === 0 ? 'x' : index === 1 ? 'y' : `channel${index + 1}`,
    targetField: mapping.target_field,
  }))
}

function convertLink(link, instance) {
  if (link.sourceStateRef && link.targetStateRef) return link

  const sourceRef = link.source_state?.widget_ref
  const targetRef = link.target_state?.widget_ref
  const sourceWidgetId = widgetIdFromRef(sourceRef)
  const targetWidgetId = widgetIdFromRef(targetRef)
  const sourceKind = instance.workspace?.widgets?.[sourceWidgetId]?.kind
  const mappings = Array.isArray(link.field_mapping) ? link.field_mapping : []
  const operations = new Set(
    (instance.evaluation?.tool?.steps || []).map((step) => step.operation),
  )
  if (!sourceRef || !targetRef || !sourceKind || mappings.length === 0) {
    throw new Error(`Incomplete legacy link ${link.ref || '<unknown>'}`)
  }

  const linkId = shortLinkId(link.ref)
  const isDomain = link.source_state?.component === 'view'
  const isHighlight = link.kind === 'highlight'
  const transformKind = isDomain
    ? 'domainToFilter'
    : isHighlight
      ? 'selectionToHighlight'
      : sourceKind === 'scatter'
        ? 'intervalToFilter'
        : 'selectionToFilter'
  const mappingKey = mappings.map((mapping) => safeKey(mapping.target_field)).join('-')
  const sourceStateRef = isDomain
    ? `${sourceRef}/view/zoom`
    : `${sourceRef}/selection/${sourceSelectionId({ sourceKind, mappings, operations })}`
  const targetStateRef = isHighlight
    ? `${targetRef}/view/highlight`
    : `${targetRef}/transform/${mappingKey}-${isDomain ? 'domain-' : ''}filter`
  const transform = {
    kind: transformKind,
    ...(isDomain || sourceKind === 'scatter'
      ? { channelMapping: canonicalChannelMapping(mappings) }
      : { fieldMapping: canonicalFieldMapping(mappings) }),
  }

  return {
    ref: link.ref,
    id: linkId,
    linkId,
    sourceStateRef,
    targetStateRef,
    relation: 'controls',
    transform,
    activation: link.activation_policy === 'manual' ? 'manual' : 'automatic',
  }
}

function updateHighdimContract(value) {
  if (Array.isArray(value)) return value.map(updateHighdimContract)
  if (typeof value === 'string') {
    return value.replaceAll(
      'parallelCoordinates.brushAxes',
      'parallelCoordinates.selectCohort',
    )
  }
  if (!value || typeof value !== 'object') return value

  const output = {}
  for (const [key, child] of Object.entries(value)) {
    output[key] = updateHighdimContract(child)
  }
  if (output.operation === 'parallelCoordinates.brushAxes') {
    output.operation = 'parallelCoordinates.selectCohort'
  }
  if (
    (output.operation === 'parallelCoordinates.selectCohort'
      || output.action === 'parallelCoordinates.selectCohort')
    && Array.isArray(output.params?.rules)
  ) {
    output.params.rules = output.params.rules.map((rule) => ({
      dimension: rule.dimension || rule.field,
      range: rule.range,
    }))
  }
  return output
}

function convertInstance(instance) {
  const isHighdimLegacy = jsonText(instance).includes('parallelCoordinates.brushAxes')
  let output = isHighdimLegacy
    ? updateHighdimContract(instance)
    : JSON.parse(JSON.stringify(instance))
  if (isHighdimLegacy) {
    output.query = output.query
      ?.replaceAll('parallelCoordinates.brushAxes', 'parallelCoordinates.selectCohort')
      ?.replaceAll('brush the parallel-coordinates axes', 'select the parallel-coordinates cohort')
      ?.replaceAll('axis brush', 'cohort selection')
  }

  output.workspace.links = (output.workspace?.links || []).map((link) => convertLink(link, output))

  const materializationGroups = Object.values(output.materializations || {})
  const allMaterializedWidgets = Object.assign(
    {},
    ...materializationGroups.map((group) => group?.widgets || {}),
  )
  if (Object.keys(allMaterializedWidgets).length > 0) {
    output.materializations = {
      vega: {
        renderer: materializationGroups.length > 1 ? 'mixed-vega' : materializationGroups[0]?.renderer,
        status: 'contract_ready',
        widgets: allMaterializedWidgets,
      },
    }
  }
  return output
}

function propertyAt(root, property) {
  if (!property) return root
  return property.split('.').reduce((value, key) => value?.[key], root)
}

function loadExternalRows(specFile, data) {
  const sourceFile = path.resolve(path.dirname(specFile), data.url)
  const source = readJson(sourceFile)
  const rows = propertyAt(source, data.format?.property)
  if (Array.isArray(rows)) return rows
  if (Array.isArray(source?.data?.values)) return source.data.values
  if (Array.isArray(source)) return source
  throw new Error(`External data did not resolve to an array: ${sourceFile}`)
}

function inlineDataUrls(value, specFile) {
  if (Array.isArray(value)) return value.map((child) => inlineDataUrls(child, specFile))
  if (!value || typeof value !== 'object') return value

  if (typeof value.url === 'string') {
    return { values: loadExternalRows(specFile, value) }
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, inlineDataUrls(child, specFile)]),
  )
}

function buildSankeySpec(rows) {
  const rawLinks = rows.map((row) => ({ ...row, value: 1 }))
  const edgeRows = rows.flatMap((row) => [
    {
      ...row,
      source: row.source,
      target: row.middle,
      value: 1,
      stage: 1,
    },
    {
      ...row,
      source: row.middle,
      target: row.target,
      value: 1,
      stage: 2,
    },
  ])
  const nodeConfig = [
    { name: 'Web', depth: 0, order: 0, x: 30, y: 55, color: '#4C78A8' },
    { name: 'Organic', depth: 0, order: 1, x: 30, y: 175, color: '#59A14F' },
    { name: 'Partner', depth: 0, order: 2, x: 30, y: 295, color: '#F28E2B' },
    { name: 'Trial', depth: 1, order: 0, x: 310, y: 105, color: '#76B7B2' },
    { name: 'Demo', depth: 1, order: 1, x: 310, y: 285, color: '#EDC948' },
    { name: 'Paid', depth: 2, order: 0, x: 590, y: 125, color: '#54A24B' },
    { name: 'Churn', depth: 2, order: 1, x: 590, y: 285, color: '#E45756' },
  ]

  return {
    $schema: 'https://vega.github.io/schema/vega/v5.json',
    kind: 'sankey',
    widget_kind: 'sankey',
    title: 'Acquisition flow paths',
    width: 680,
    height: 380,
    padding: 20,
    data: [
      { name: 'rawLinks', values: rawLinks },
      { name: 'edgeRows', values: edgeRows },
      { name: 'nodeConfig', values: nodeConfig },
      {
        name: 'links',
        source: 'edgeRows',
        transform: [
          {
            type: 'aggregate',
            groupby: ['source', 'target'],
            fields: ['value'],
            ops: ['sum'],
            as: ['value'],
          },
          {
            type: 'lookup',
            from: 'nodeConfig',
            key: 'name',
            fields: ['source'],
            values: ['x', 'y'],
            as: ['sourceX', 'sourceY'],
          },
          {
            type: 'lookup',
            from: 'nodeConfig',
            key: 'name',
            fields: ['target'],
            values: ['x', 'y'],
            as: ['targetX', 'targetY'],
          },
          { type: 'formula', expr: 'datum.sourceX + 24', as: 'sourceX2' },
          { type: 'formula', expr: 'datum.targetX', as: 'targetX2' },
          {
            type: 'linkpath',
            orient: 'horizontal',
            shape: 'diagonal',
            sourceX: 'sourceX2',
            sourceY: 'sourceY',
            targetX: 'targetX2',
            targetY: 'targetY',
          },
        ],
      },
    ],
    scales: [
      {
        name: 'linkWidth',
        type: 'sqrt',
        domain: { data: 'links', field: 'value' },
        range: [4, 24],
      },
    ],
    marks: [
      {
        name: 'edgeMark',
        type: 'path',
        from: { data: 'links' },
        encode: {
          update: {
            path: { field: 'path' },
            stroke: { value: '#8DA0B6' },
            strokeOpacity: { value: 0.48 },
            strokeWidth: { scale: 'linkWidth', field: 'value' },
            fill: { value: null },
          },
          hover: { strokeOpacity: { value: 0.85 } },
        },
      },
      {
        name: 'nodeMark',
        type: 'rect',
        from: { data: 'nodeConfig' },
        encode: {
          enter: {
            x: { field: 'x' },
            x2: { signal: 'datum.x + 24' },
            y: { signal: 'datum.y - 22' },
            y2: { signal: 'datum.y + 22' },
            cornerRadius: { value: 3 },
            fill: { field: 'color' },
            stroke: { value: 'white' },
            strokeWidth: { value: 1.5 },
          },
        },
      },
      {
        type: 'text',
        from: { data: 'nodeConfig' },
        encode: {
          enter: {
            x: { signal: 'datum.x + 12' },
            y: { signal: 'datum.y - 30' },
            text: { field: 'name' },
            align: { value: 'center' },
            fontSize: { value: 13 },
            fontWeight: { value: 'bold' },
            fill: { value: '#25313C' },
          },
        },
      },
    ],
  }
}

function referencedSpecFiles(instanceFiles) {
  const files = new Set()
  for (const instanceFile of instanceFiles) {
    const instance = readJson(instanceFile)
    for (const materialization of Object.values(instance.materializations || {})) {
      for (const widget of Object.values(materialization?.widgets || {})) {
        if (typeof widget?.spec_path === 'string') {
          files.add(path.resolve(repoRoot, widget.spec_path))
        }
      }
    }
  }
  return [...files]
}

function failOnInvalidInstance(instance, filePath) {
  for (const [index, link] of (instance.workspace?.links || []).entries()) {
    const legacyKeys = ['source_state', 'target_state', 'field_mapping', 'activation_policy', 'kind']
      .filter((key) => key in link)
    if (legacyKeys.length > 0) {
      throw new Error(`${filePath}: link ${index} still has legacy keys: ${legacyKeys.join(', ')}`)
    }
    if (!link.sourceStateRef || !link.targetStateRef || !link.transform?.kind) {
      throw new Error(`${filePath}: link ${index} is not a canonical Kit relation`)
    }
  }
  if (jsonText(instance).includes('parallelCoordinates.brushAxes')) {
    throw new Error(`${filePath}: deleted parallelCoordinates.brushAxes action remains`)
  }
}

function stageChange(filePath, original, converted, staged) {
  const before = jsonText(original)
  const after = jsonText(converted)
  if (before === after) return
  staged.push({ filePath, text: after })
}

const instanceFiles = listJsonFiles(instancesRoot)
  .filter((filePath) => /_asl[0-3]\.json$/.test(filePath))
if (instanceFiles.length !== 40) {
  throw new Error(`Expected exactly 40 ASL files for 10 workflows; found ${instanceFiles.length}`)
}

const staged = []
for (const filePath of instanceFiles) {
  const original = readJson(filePath)
  const converted = convertInstance(original)
  failOnInvalidInstance(converted, filePath)
  stageChange(filePath, original, converted, staged)
}

const specFiles = referencedSpecFiles(instanceFiles)
for (const filePath of specFiles) {
  const original = readJson(filePath)
  const converted = filePath.endsWith('/w_flow_sankey.json')
    ? buildSankeySpec(readJson(path.join(
      repoRoot,
      'visagentbench_v2/datasets/generated_multiview/flow_sankey_contributor_context_001.json',
    )))
    : inlineDataUrls(original, filePath)
  stageChange(filePath, original, converted, staged)
}

if (writeChanges) {
  for (const change of staged) fs.writeFileSync(change.filePath, change.text)
  process.stdout.write(`Converted ${staged.length} files (${instanceFiles.length} instances, ${specFiles.length} specs).\n`)
} else {
  process.stdout.write(`Check only: ${staged.length} files require conversion.\n`)
  process.stdout.write('Run again with --write to apply the deterministic conversion.\n')
}
