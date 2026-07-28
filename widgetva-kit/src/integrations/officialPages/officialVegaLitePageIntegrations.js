import { createVegaLiteWidgetAdapter } from '../../adapters/vegaLite/VegaLiteWidgetAdapter.js'
import { installBrowserExtensionBridge } from '../../transports/browserExtensionBridge.js'
import {
  readControllerRecoverableState,
  restoreControllerRecoverableState,
} from './officialPageController.js'
import { createOfficialPageHostBridge } from '../../host/hostBridge.js'
import {
  createOfficialPageMaterializer,
} from '../../core/runtime/materializers/providers/vegaLite/vegaLiteOfficialPageMaterializer.js'
import { buildVegaLiteRenderSpecFromRuntimeState } from '../../adapters/vegaLite/renderSpecFromRuntimeState.js'
import { runAgentLoopOnTarget } from '../../core/agent/adapters/agentTargetPort.js'
import { createWidgetInstance } from '../../core/rendering/widgetRuntimeSurface.js'
import { createWidgetWorkspace } from '../../workspace/widgetWorkspace.js'
import {
  makeActionDescriptor,
  makeDomainEffect,
  makeSelectionEffect,
} from '../../contracts/action-contracts.js'
import { buildBarActionDescriptors } from '../../widgets/families/bar/actionDescriptors.js'
import { buildHeatmapActionDescriptors } from '../../widgets/families/heatmap/actionDescriptors.js'
import { buildLineActionDescriptors } from '../../widgets/families/line/actionDescriptors.js'
import { buildScatterActionDescriptors } from '../../widgets/families/scatter/actionDescriptors.js'
import {
  createOfficialPageActionDispatchProxy,
  createOfficialPageParamActionDispatcher,
} from './officialVegaLitePageAgentActions.js'
import {
  clearLatestVegaEmbedCapture,
  installVegaEmbedCapture,
  readLatestVegaEmbedCapture,
} from './vegaEmbedCapture.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function readOfficialPageSelectionState({
  widgetState = {},
  workspaceState = {},
  hostSelections = {},
} = {}) {
  const runtimeSelections = workspaceState?.shared?.selections?.registry
    || workspaceState?.shared?.activeSelections
    || {}
  const normalizedHostSelections = hostSelections && typeof hostSelections === 'object' && !Array.isArray(hostSelections)
    ? hostSelections
    : {}
  return {
    ...(widgetState || {}),
    selections: {
      ...(runtimeSelections || {}),
      ...normalizedHostSelections,
    },
  }
}

function uniqueByName(entries = []) {
  const seen = new Set()
  const results = []
  for (const entry of Array.isArray(entries) ? entries : []) {
    const name = typeof entry?.name === 'string' ? entry.name : null
    if (!name || seen.has(name)) continue
    seen.add(name)
    results.push(entry)
  }
  return results
}

const OFFICIAL_PAGE_NATIVE_ACTION_NAMES = new Set([
  'vegaLite.setIntervalParam',
  'vegaLite.setPointParam',
  'vegaLite.clearParam',
])

const OFFICIAL_PAGE_FALLBACK_ACTION_DESCRIPTORS = [
  ...buildBarActionDescriptors(),
  ...buildHeatmapActionDescriptors(),
  ...buildLineActionDescriptors(),
  ...buildScatterActionDescriptors(),
  makeActionDescriptor({
    name: 'widget.clearSelection',
    title: 'Clear selection',
    description: 'Clear the active page-backed selection state and rematerialize the official page view.',
    primitive: 'reset',
    category: 'selection',
    paramsSchema: {
      type: 'object',
      properties: {},
    },
    effects: [
      makeSelectionEffect(null, 'Clears the current page-backed selection.'),
    ],
  }),
  makeActionDescriptor({
    name: 'widget.resetView',
    title: 'Reset view',
    description: 'Reset the official page view by clearing page-backed selection and domain parameters.',
    primitive: 'reset',
    category: 'viewTransform',
    paramsSchema: {
      type: 'object',
      properties: {},
    },
    effects: [
      makeSelectionEffect(null, 'Clears the current page-backed selections.'),
      makeDomainEffect(null, 'Clears page-backed domain selections.'),
    ],
  }),
  makeActionDescriptor({
    name: 'widget.filterByValues',
    title: 'Filter by values',
    description: 'Filter the official page view to rows matching one or more categorical values when the underlying Vega-Lite spec exposes a point selection parameter.',
    primitive: 'filter',
    category: 'dataTransform',
    paramsSchema: {
      type: 'object',
      required: ['field', 'values'],
      properties: {
        field: { type: 'string' },
        values: { type: 'array', items: {}, minItems: 1 },
      },
    },
    effects: [
      makeSelectionEffect(null, 'Updates the page-backed point selection used for filtering.'),
    ],
  }),
]

function readDescriptorName(descriptor = null) {
  return typeof descriptor?.name === 'string' && descriptor.name.length > 0
    ? descriptor.name
    : null
}

function readActionDescriptorsByName(description = null) {
  const descriptors = new Map()
  for (const descriptor of [
    ...(Array.isArray(description?.actions) ? description.actions : []),
    ...OFFICIAL_PAGE_FALLBACK_ACTION_DESCRIPTORS,
  ]) {
    const name = readDescriptorName(descriptor)
    if (!name || descriptors.has(name)) continue
    descriptors.set(name, descriptor)
  }
  return descriptors
}

function readParamProducerKinds(param = {}, recognizedKinds = []) {
  return uniqueKinds([
    inferWidgetKindFromMark(param?.producerMark),
    ...(Array.isArray(recognizedKinds) ? recognizedKinds : []),
  ])
}

function paramHasConsumer(param = {}, consumerTypes = []) {
  const consumers = Array.isArray(param?.consumerTypes) ? param.consumerTypes : []
  return consumerTypes.some((consumerType) => consumers.includes(consumerType))
}

function addPointSelectionActions(actionNames, param = {}, recognizedKinds = []) {
  const producerKinds = readParamProducerKinds(param, recognizedKinds)
  const hasFilterConsumer = paramHasConsumer(param, ['filter'])

  if (producerKinds.includes('bar')) {
    actionNames.add('bar.selectCategory')
    actionNames.add('bar.clickCategory')
    if (hasFilterConsumer) actionNames.add('bar.filterCategories')
  }

  if (producerKinds.includes('line')) {
    actionNames.add('line.selectSeries')
    actionNames.add('line.focusLines')
    actionNames.add('line.selectXValue')
  }

  if (producerKinds.includes('heatmap')) {
    actionNames.add('heatmap.selectCell')
    actionNames.add('heatmap.filterCells')
    actionNames.add('heatmap.selectSubmatrix')
  }

  if (hasFilterConsumer) {
    actionNames.add('widget.filterByValues')
  }
}

function addIntervalSelectionActions(actionNames, param = {}, recognizedKinds = []) {
  const producerKinds = readParamProducerKinds(param, recognizedKinds)
  const hasDomainConsumer = param?.isScaleBound || paramHasConsumer(param, ['scaleDomain'])

  if (producerKinds.includes('scatter')) {
    actionNames.add('scatter.brushRegion')
    if (hasDomainConsumer) actionNames.add('scatter.zoomDomain')
  }

  if (producerKinds.includes('line')) {
    actionNames.add('line.zoomXRegion')
  }
}

export function buildOfficialPageExecutableActionNames({
  interactionModel,
  recognizedKinds = [],
} = {}) {
  const params = Array.isArray(interactionModel?.params) ? interactionModel.params : []
  const actionNames = new Set()

  for (const param of params) {
    if (param?.selectionType === 'point') {
      addPointSelectionActions(actionNames, param, recognizedKinds)
    }
    if (param?.selectionType === 'interval') {
      addIntervalSelectionActions(actionNames, param, recognizedKinds)
    }
  }

  if (params.length > 0) {
    actionNames.add('widget.clearSelection')
    actionNames.add('widget.resetView')
  }

  return [...actionNames]
}

export function buildOfficialPageExecutableActionDescriptors(description, {
  interactionModel,
  recognizedKinds = [],
} = {}) {
  const descriptorsByName = readActionDescriptorsByName(description)
  return buildOfficialPageExecutableActionNames({
    interactionModel,
    recognizedKinds,
  })
    .map((name) => descriptorsByName.get(name) || null)
    .filter(Boolean)
}

function appendOfficialPageMultiViewActionsToWorkspaceDescription(description, {
  interactionModel,
  recognizedKinds = [],
} = {}) {
  if (!description || typeof description !== 'object') return description
  const nextDescription = clone(description)
  const executableActions = buildOfficialPageExecutableActionDescriptors(nextDescription, {
    interactionModel,
    recognizedKinds,
  })
  const executableActionNames = executableActions.map((entry) => entry.name)
  const executableActionNameSet = new Set(executableActionNames)

  nextDescription.actions = uniqueByName([
    ...executableActions,
    ...(Array.isArray(nextDescription.actions) ? nextDescription.actions : [])
      .filter((entry) => executableActionNameSet.has(entry?.name)),
  ])

  if (Array.isArray(nextDescription.widgets)) {
    nextDescription.widgets = nextDescription.widgets.map((widget) => {
      return {
        ...widget,
        actionNames: executableActionNames,
      }
    })
  }

  return nextDescription
}

function createOfficialPagePortMetadataProxy(target, {
  widgetRef,
  interactionModel,
  recognizedKinds = [],
} = {}) {
  if (!target || typeof target !== 'object') return target
  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop === 'describeWorkspace') {
        const original = Reflect.get(obj, prop, receiver)
        if (typeof original !== 'function') return original
        return async (...args) => {
          const description = await original.apply(obj, args)
          return appendOfficialPageMultiViewActionsToWorkspaceDescription(description, {
            widgetRef,
            interactionModel,
            recognizedKinds,
          })
        }
      }
      const value = Reflect.get(obj, prop, receiver)
      return typeof value === 'function' ? value.bind(obj) : value
    },
  })
}

function createOfficialPageWorkspaceContractProxy(target, {
  widgetRef,
  interactionModel,
  recognizedKinds = [],
  executeParamAction,
  executeVerifiedParamAction,
  syncAfterAction,
} = {}) {
  if (!target || typeof target !== 'object') return target

  const filterWorkspaceDescription = (description) => appendOfficialPageMultiViewActionsToWorkspaceDescription(description, {
    widgetRef,
    interactionModel,
    recognizedKinds,
  })
  const readExecutableActionNames = () => new Set(buildOfficialPageExecutableActionNames({
    interactionModel,
    recognizedKinds,
  }))

  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop === 'describe' || prop === 'describeWorkspace') {
        const original = Reflect.get(obj, prop, receiver)
        if (typeof original !== 'function') return original
        return (...args) => filterWorkspaceDescription(original.apply(obj, args))
      }
      if (prop === 'readObservation') {
        const original = Reflect.get(obj, prop, receiver)
        if (typeof original !== 'function') return original
        return (...args) => original.apply(receiver, args)
      }
      if (prop === 'executeAction' || prop === 'executeVerifiedAction') {
        const original = Reflect.get(obj, prop, receiver)
        const executeOfficialAction = prop === 'executeVerifiedAction'
          ? executeVerifiedParamAction
          : executeParamAction
        return async (call = {}, options = {}) => {
          const actionName = typeof call?.name === 'string' ? call.name : null
          if (actionName && readExecutableActionNames().has(actionName) && typeof executeOfficialAction === 'function') {
            const result = await executeOfficialAction(call, options)
            if (result?.ok && typeof syncAfterAction === 'function') {
              await syncAfterAction()
            }
            if (result) return result
          }
          if (typeof original !== 'function') {
            throw new Error(`WidgetVA official page workspace does not expose ${String(prop)}().`)
          }
          return original.call(obj, call, options)
        }
      }
      const value = Reflect.get(obj, prop, receiver)
      return typeof value === 'function' ? value.bind(obj) : value
    },
  })
}

function readRecoverableSelectionRegistry(state = null) {
  const candidates = [
    state?.shared?.activeSelections,
    state?.shared?.selections,
    state?.selections,
    state?.sharedAnalyticalState?.selections,
    state?.sharedAnalyticalState?.activeSelections,
  ]
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return clone(candidate)
    }
  }
  return null
}

function tryParseUrl(value) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function decodeHtmlEntities(text) {
  if (typeof text !== 'string' || text.length === 0) return ''
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function resolveSpecNodeByViewId(spec, viewId) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec) || typeof viewId !== 'string' || viewId.length === 0) {
    return null
  }
  const segments = viewId.split('.')
  let current = spec
  for (const segment of segments) {
    if (!current || typeof current !== 'object') return null
    if (/^\d+$/.test(segment)) {
      const index = Number(segment)
      if (!Array.isArray(current) || !Number.isInteger(index)) return null
      current = current[index]
      continue
    }
    current = current[segment]
  }
  return current && typeof current === 'object' ? current : null
}

function stripHtmlTags(text) {
  if (typeof text !== 'string' || text.length === 0) return ''
  return decodeHtmlEntities(text.replace(/<[^>]+>/g, ' '))
}

function coerceDelimitedValue(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (trimmed.length === 0) return ''
  if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed)
    if (Number.isFinite(numeric)) return numeric
  }
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  return trimmed
}

function parseDelimitedRow(line, delimiter) {
  const cells = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }
    current += char
  }
  cells.push(current)
  return cells
}

function parseDelimitedText(text, delimiter = ',') {
  const normalized = typeof text === 'string'
    ? text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    : ''
  const lines = normalized
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
  if (lines.length === 0) return []

  const headers = parseDelimitedRow(lines[0], delimiter).map((value) => String(value).trim())
  return lines.slice(1).map((line) => {
    const values = parseDelimitedRow(line, delimiter)
    return Object.fromEntries(
      headers.map((header, index) => [header, coerceDelimitedValue(values[index] ?? '')]),
    )
  })
}

async function loadOfficialPageDataValues({ root, spec }) {
  const dataUrl = typeof spec?.data?.url === 'string' ? spec.data.url : null
  if (!dataUrl || Array.isArray(spec?.data?.values)) {
    return spec
  }

  const fetchImpl =
    root?.fetch?.bind(root)
    || globalThis.fetch?.bind(globalThis)
    || null
  if (typeof fetchImpl !== 'function') {
    return spec
  }

  try {
    const response = await fetchImpl(dataUrl)
    if (!response?.ok) {
      return spec
    }

    const url = tryParseUrl(dataUrl)
    const pathname = url?.pathname?.toLowerCase?.() || dataUrl.toLowerCase()
    if (pathname.endsWith('.json')) {
      const payload = await response.json()
      if (!Array.isArray(payload)) {
        return spec
      }
      return {
        ...spec,
        data: {
          ...(spec.data || {}),
          values: clone(payload),
        },
      }
    }

    const rawText = await response.text()
    const delimiter = pathname.endsWith('.tsv') ? '\t' : ','
    const rows = parseDelimitedText(rawText, delimiter)
    if (!Array.isArray(rows) || rows.length === 0) {
      return spec
    }
    return {
      ...spec,
      data: {
        ...(spec.data || {}),
        values: rows,
      },
    }
  } catch {
    return spec
  }
}

function collectCodeLikeBlocks(html) {
  if (typeof html !== 'string' || html.length === 0) return []
  const matches = []
  const patterns = [
    /<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi,
  ]

  for (const pattern of patterns) {
    let match = pattern.exec(html)
    while (match) {
      matches.push(decodeHtmlEntities(match[1] || ''))
      match = pattern.exec(html)
    }
  }

  return matches
}

function extractBalancedJsonObject(source, startIndex) {
  if (typeof source !== 'string' || startIndex < 0 || startIndex >= source.length || source[startIndex] !== '{') {
    return null
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

function findSchemaAnchoredJson(text) {
  if (typeof text !== 'string' || text.length === 0) return null
  const schemaNeedles = ['"$schema"', '\'${schema}\'', 'https://vega.github.io/schema/vega-lite']

  for (const needle of schemaNeedles) {
    let fromIndex = 0
    while (fromIndex < text.length) {
      const hitIndex = text.indexOf(needle, fromIndex)
      if (hitIndex === -1) break

      for (let cursor = hitIndex; cursor >= 0; cursor -= 1) {
        if (text[cursor] !== '{') continue
        const candidate = extractBalancedJsonObject(text, cursor)
        if (!candidate) continue
        try {
          const parsed = JSON.parse(candidate)
          if (typeof parsed?.$schema === 'string' && parsed.$schema.includes('vega-lite')) {
            return parsed
          }
        } catch {}
      }

      fromIndex = hitIndex + needle.length
    }
  }

  return null
}

function absolutizeDataUrls(node, pageUrl, inDataScope = false) {
  if (Array.isArray(node)) {
    return node.map((entry) => absolutizeDataUrls(entry, pageUrl, inDataScope))
  }
  if (!node || typeof node !== 'object') {
    return node
  }

  const next = {}
  for (const [key, value] of Object.entries(node)) {
    if (inDataScope && key === 'url' && typeof value === 'string') {
      try {
        next[key] = new URL(value, pageUrl).href
      } catch {
        next[key] = value
      }
      continue
    }
    next[key] = absolutizeDataUrls(value, pageUrl, key === 'data')
  }
  return next
}

function addHeatmapAxisAliasesToRows(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return spec
  }

  const mark = typeof spec?.mark === 'string' ? spec.mark : spec?.mark?.type
  const rows = spec?.data?.values
  if (mark !== 'rect' || !Array.isArray(rows) || rows.length === 0) {
    return spec
  }

  const xField = typeof spec?.encoding?.x?.field === 'string' ? spec.encoding.x.field : null
  const yField = typeof spec?.encoding?.y?.field === 'string' ? spec.encoding.y.field : null
  if (!xField && !yField) {
    return spec
  }

  const aliasedRows = rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return row
    }

    const nextRow = { ...row }
    if (xField && !Object.prototype.hasOwnProperty.call(nextRow, 'x') && Object.prototype.hasOwnProperty.call(nextRow, xField)) {
      nextRow.x = nextRow[xField]
    }
    if (yField && !Object.prototype.hasOwnProperty.call(nextRow, 'y') && Object.prototype.hasOwnProperty.call(nextRow, yField)) {
      nextRow.y = nextRow[yField]
    }
    return nextRow
  })

  return {
    ...spec,
    data: {
      ...(spec.data || {}),
      values: aliasedRows,
    },
  }
}

function createOfficialPageAgentLoopRunner(agentTarget) {
  return async function runOfficialPageAgentLoop(options = {}) {
    if (!agentTarget || typeof agentTarget.describeWorkspace !== 'function') {
      throw new Error('WidgetVA page port is not ready for captured Vega-Lite page agent-loop execution.')
    }
    return runAgentLoopOnTarget(agentTarget, options)
  }
}

export function isOfficialVegaLiteGalleryPage(pageUrl) {
  const parsedUrl = tryParseUrl(pageUrl)
  if (!parsedUrl) return false
  return (
    parsedUrl.hostname === 'vega.github.io'
    && parsedUrl.pathname.startsWith('/vega-lite/examples/')
    && parsedUrl.pathname.endsWith('.html')
  )
}

function inferWidgetKindFromMark(mark) {
  const normalizedMark = typeof mark === 'string' ? mark : mark?.type
  if (normalizedMark === 'bar') return 'bar'
  if (normalizedMark === 'line') return 'line'
  if (normalizedMark === 'area') return 'line'
  if (normalizedMark === 'point' || normalizedMark === 'circle') return 'scatter'
  if (normalizedMark === 'rect') return 'heatmap'
  return null
}

function pushUniqueKind(target, kind) {
  if (typeof kind !== 'string' || kind.length === 0) return
  if (!target.includes(kind)) {
    target.push(kind)
  }
}

function uniqueKinds(kinds = []) {
  return [...new Set(
    (Array.isArray(kinds) ? kinds : [])
      .filter((kind) => typeof kind === 'string' && kind.length > 0),
  )]
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readMarkType(mark) {
  return typeof mark === 'string' ? mark : mark?.type || null
}

function makeSpecPathId(path = []) {
  if (!Array.isArray(path) || path.length === 0) {
    return 'root'
  }
  return path.join('.')
}

function pushUniqueRecord(target, nextRecord, keyBuilder) {
  if (!Array.isArray(target) || !isRecord(nextRecord) || typeof keyBuilder !== 'function') return
  const nextKey = keyBuilder(nextRecord)
  if (!nextKey) return
  const hasMatch = target.some((entry) => keyBuilder(entry) === nextKey)
  if (!hasMatch) {
    target.push(nextRecord)
  }
}

function collectParamNamesFromNode(node, target) {
  if (Array.isArray(node)) {
    for (const entry of node) {
      collectParamNamesFromNode(entry, target)
    }
    return
  }
  if (!isRecord(node)) return

  if (typeof node.param === 'string' && node.param.length > 0) {
    target.add(node.param)
  }

  for (const value of Object.values(node)) {
    collectParamNamesFromNode(value, target)
  }
}

function collectVegaLiteViewNodes(spec, path = [], inherited = {}) {
  if (!isRecord(spec)) return []

  const repeat = inherited.repeat || null
  const node = {
    path,
    pathId: makeSpecPathId(path),
    mark: readMarkType(spec.mark),
    repeat,
    hasLayerChildren: Array.isArray(spec.layer) && spec.layer.length > 0,
    spec,
  }

  const nodes = [node]
  const childCollections = [
    ['layer', spec.layer],
    ['vconcat', spec.vconcat],
    ['hconcat', spec.hconcat],
    ['concat', spec.concat],
  ]

  for (const [key, entries] of childCollections) {
    if (!Array.isArray(entries)) continue
    entries.forEach((entry, index) => {
      nodes.push(...collectVegaLiteViewNodes(entry, [...path, key, index], { repeat }))
    })
  }

  if (isRecord(spec.spec)) {
    const nextRepeat = isRecord(spec.repeat) ? clone(spec.repeat) : repeat
    nodes.push(...collectVegaLiteViewNodes(spec.spec, [...path, 'spec'], { repeat: nextRepeat }))
  }

  return nodes
}

function normalizeSelectionType(select = {}) {
  const normalizedType = typeof select?.type === 'string' ? select.type.trim().toLowerCase() : ''
  if (normalizedType === 'interval') return 'interval'
  if (normalizedType === 'point' || normalizedType === 'single' || normalizedType === 'multi') return 'point'
  return normalizedType || null
}

function collectEncodingParamConsumers(encoding = {}, path = [], paramConsumers = []) {
  if (!isRecord(encoding)) return

  for (const [channel, channelSpec] of Object.entries(encoding)) {
    if (!isRecord(channelSpec)) continue

    if (typeof channelSpec?.scale?.domain?.param === 'string') {
      pushUniqueRecord(paramConsumers, {
        paramName: channelSpec.scale.domain.param,
        consumerType: 'scaleDomain',
        channel,
        pathId: makeSpecPathId(path),
      }, (entry) => `${entry.paramName}:${entry.consumerType}:${entry.channel}:${entry.pathId}`)
    }

    const directCondition = channelSpec.condition
    const conditionEntries = Array.isArray(directCondition) ? directCondition : [directCondition]
    for (const condition of conditionEntries) {
      if (typeof condition?.param === 'string') {
        pushUniqueRecord(paramConsumers, {
          paramName: condition.param,
          consumerType: 'condition',
          channel,
          pathId: makeSpecPathId(path),
        }, (entry) => `${entry.paramName}:${entry.consumerType}:${entry.channel}:${entry.pathId}`)
      }
      const nestedTestParams = new Set()
      collectParamNamesFromNode(condition?.test, nestedTestParams)
      for (const paramName of nestedTestParams) {
        pushUniqueRecord(paramConsumers, {
          paramName,
          consumerType: 'conditionTest',
          channel,
          pathId: makeSpecPathId(path),
        }, (entry) => `${entry.paramName}:${entry.consumerType}:${entry.channel}:${entry.pathId}`)
      }
    }
  }
}

function collectTransformParamConsumers(transforms = [], path = [], paramConsumers = []) {
  if (!Array.isArray(transforms)) return

  for (const transform of transforms) {
    if (!isRecord(transform)) continue
    const filterParams = new Set()
    collectParamNamesFromNode(transform.filter, filterParams)
    for (const paramName of filterParams) {
      pushUniqueRecord(paramConsumers, {
        paramName,
        consumerType: 'filter',
        channel: null,
        pathId: makeSpecPathId(path),
      }, (entry) => `${entry.paramName}:${entry.consumerType}:${entry.pathId}`)
    }
  }
}

function summarizeCompositeKinds(spec) {
  const compositionKinds = []
  if (Array.isArray(spec?.vconcat)) compositionKinds.push('vconcat')
  if (Array.isArray(spec?.hconcat)) compositionKinds.push('hconcat')
  if (Array.isArray(spec?.concat)) compositionKinds.push('concat')
  if (Array.isArray(spec?.layer)) compositionKinds.push('layer')
  if (isRecord(spec?.repeat)) compositionKinds.push('repeat')
  if (isRecord(spec?.facet)) compositionKinds.push('facet')
  return compositionKinds
}

function buildParamInteractionModel({
  paramDefinitions = [],
  paramConsumers = [],
  views = [],
} = {}) {
  return paramDefinitions.map((definition) => {
    const consumers = paramConsumers.filter((entry) => entry.paramName === definition.name)
    const producerViews = [definition.pathId]
    const consumerViews = Array.from(new Set(consumers.map((entry) => entry.pathId)))
    const consumerTypes = Array.from(new Set(consumers.map((entry) => entry.consumerType)))
    const channels = Array.from(new Set(consumers.map((entry) => entry.channel).filter(Boolean)))
    const producerView = views.find((entry) => entry.viewId === definition.pathId) || null

    return {
      name: definition.name,
      selectionType: definition.selectionType,
      producerViewId: definition.pathId,
      producerMark: producerView?.mark || null,
      producerViews,
      consumerViews,
      consumerTypes,
      channels,
      resolve: definition.resolve || null,
      encodings: Array.isArray(definition.encodings) ? [...definition.encodings] : [],
      fields: Array.isArray(definition.fields) ? [...definition.fields] : [],
      isScaleBound: definition.isScaleBound,
      isBoundInput: definition.isBoundInput,
      eventHandlers: {
        on: definition.on || null,
        translate: definition.translate || null,
        zoom: definition.zoom || null,
      },
    }
  })
}

function deriveInteractionPatternIds({
  compositeKinds = [],
  paramInteractions = [],
} = {}) {
  const patternIds = []
  const hasRepeat = compositeKinds.includes('repeat')
  const hasLayer = compositeKinds.includes('layer')
  const hasConcat = compositeKinds.includes('vconcat')
    || compositeKinds.includes('hconcat')
    || compositeKinds.includes('concat')

  const intervalParams = paramInteractions.filter((entry) => entry.selectionType === 'interval')
  const pointParams = paramInteractions.filter((entry) => entry.selectionType === 'point')
  const anyScaleDomainDriver = paramInteractions.some((entry) => entry.consumerTypes.includes('scaleDomain'))
  const anyFilterDriver = paramInteractions.some((entry) => entry.consumerTypes.includes('filter'))
  const anyConditionDriver = paramInteractions.some((entry) => (
    entry.consumerTypes.includes('condition')
    || entry.consumerTypes.includes('conditionTest')
  ))
  const anyScaleBound = paramInteractions.some((entry) => entry.isScaleBound)
  const anyUnionResolve = paramInteractions.some((entry) => entry.resolve === 'union')
  const anyHoverProducer = paramInteractions.some((entry) => typeof entry.eventHandlers?.on === 'string' && entry.eventHandlers.on.includes('pointerover'))
  const anyBoundRange = paramInteractions.some((entry) => entry.selectionType === 'point' && entry.isBoundInput)

  if (hasConcat && intervalParams.length === 1 && anyScaleDomainDriver) {
    patternIds.push('overview_detail_scale_domain')
  }
  if (hasRepeat && intervalParams.length >= 1 && anyFilterDriver && !anyConditionDriver) {
    patternIds.push('repeat_brush_filter')
  }
  if (hasRepeat && intervalParams.length >= 1 && anyFilterDriver && hasLayer) {
    patternIds.push('repeat_brush_overlay')
  }
  if (hasRepeat && anyUnionResolve && anyScaleBound) {
    patternIds.push('repeat_scatter_matrix_brush_panzoom')
  }
  if (hasConcat && pointParams.length === 1 && anyFilterDriver && anyConditionDriver) {
    patternIds.push('cross_highlight_dashboard')
  }
  if (paramInteractions.length >= 2 && hasConcat && intervalParams.length >= 1 && pointParams.length >= 1 && anyFilterDriver && anyConditionDriver) {
    patternIds.push('bidirectional_crossfilter')
  }
  if (hasLayer && pointParams.length >= 1 && anyHoverProducer && anyFilterDriver) {
    patternIds.push('hover_driven_detail')
  }
  if (hasLayer && paramInteractions.length >= 2 && anyConditionDriver && anyBoundRange) {
    patternIds.push('bound_scrubber_focus')
  }

  return patternIds
}

function deriveStableInteractionModes({
  patternIds = [],
  paramInteractions = [],
} = {}) {
  const modes = []
  const hasPattern = (patternId) => patternIds.includes(patternId)
  const hasConsumerType = (consumerType) => paramInteractions.some((entry) => entry.consumerTypes.includes(consumerType))
  const hasScaleBinding = paramInteractions.some((entry) => entry.isScaleBound)
  const hasHoverDrivenPoint = paramInteractions.some((entry) => (
    entry.selectionType === 'point'
    && typeof entry.eventHandlers?.on === 'string'
    && entry.eventHandlers.on.includes('pointerover')
  ))
  const hasBoundInput = paramInteractions.some((entry) => entry.selectionType === 'point' && entry.isBoundInput)

  if (hasPattern('overview_detail_scale_domain') || hasScaleBinding || hasConsumerType('scaleDomain')) {
    modes.push('sharedDomain')
  }
  if (
    hasPattern('repeat_brush_filter')
    || hasPattern('bidirectional_crossfilter')
    || hasPattern('hover_driven_detail')
    || hasConsumerType('filter')
  ) {
    modes.push('sharedFilter')
  }
  if (
    hasPattern('repeat_brush_overlay')
    || hasPattern('cross_highlight_dashboard')
    || hasPattern('bidirectional_crossfilter')
    || hasConsumerType('condition')
    || hasConsumerType('conditionTest')
  ) {
    modes.push('sharedHighlight')
  }
  if (hasPattern('hover_driven_detail') || hasHoverDrivenPoint) {
    modes.push('focusDetail')
  }
  if (hasPattern('bound_scrubber_focus') || hasBoundInput) {
    modes.push('boundParameter')
  }

  return modes
}

function buildMultiViewActionSurface(paramInteractions = []) {
  const actions = []
  for (const param of paramInteractions) {
    if (param.selectionType === 'interval') {
      actions.push({
        name: 'vegaLite.setIntervalParam',
        paramName: param.name,
      })
      actions.push({
        name: 'vegaLite.clearParam',
        paramName: param.name,
      })
      continue
    }
    if (param.selectionType === 'point') {
      actions.push({
        name: 'vegaLite.setPointParam',
        paramName: param.name,
      })
      actions.push({
        name: 'vegaLite.clearParam',
        paramName: param.name,
      })
    }
  }
  return actions
}

function normalizeScopeKinds(compositeKinds = []) {
  return compositeKinds.map((kind) => {
    if (kind === 'vconcat' || kind === 'hconcat' || kind === 'concat') return 'across_concat_views'
    if (kind === 'repeat') return 'across_repeated_views'
    if (kind === 'layer') return 'within_layered_view'
    if (kind === 'facet') return 'within_faceted_view'
    return kind
  })
}

function normalizeConsumerEffectKind(consumerType) {
  if (consumerType === 'filter') return 'filter'
  if (consumerType === 'condition' || consumerType === 'conditionTest') return 'highlight'
  if (consumerType === 'scaleDomain') return 'syncDomain'
  return consumerType || null
}

function buildInteractionClassification({
  compositeKinds = [],
  paramInteractions = [],
  patternIds = [],
} = {}) {
  const sourceStateKinds = Array.from(new Set(
    paramInteractions
      .map((entry) => entry.selectionType)
      .filter(Boolean),
  ))
  const consumerEffectKinds = Array.from(new Set(
    paramInteractions
      .flatMap((entry) => entry.consumerTypes)
      .map((entry) => normalizeConsumerEffectKind(entry))
      .filter(Boolean),
  ))
  const scopeKinds = Array.from(new Set(normalizeScopeKinds(compositeKinds)))
  const interactionModes = Array.from(new Set(deriveStableInteractionModes({
    patternIds,
    paramInteractions,
  })))
  return {
    sourceStateKinds,
    consumerEffectKinds,
    scopeKinds,
    interactionModes,
  }
}

function buildProjectedWidgetLinks(paramInteractions = []) {
  const projectedLinks = []
  for (const param of paramInteractions) {
    for (const consumerViewId of param.consumerViews) {
      for (const consumerType of param.consumerTypes) {
        const effectKind = normalizeConsumerEffectKind(consumerType)
        if (!effectKind) continue
        pushUniqueRecord(projectedLinks, {
          ref: `wl://widgetva-app/vega-lite/link/${param.name}/${param.producerViewId}/${consumerViewId}/${effectKind}`,
          sourceViewId: param.producerViewId,
          targetViewId: consumerViewId,
          sourceParamName: param.name,
          sourceSelectionType: param.selectionType,
          kind: effectKind,
          primitive: effectKind,
          effect:
            effectKind === 'filter'
              ? 'applyFilter'
              : effectKind === 'highlight'
                ? 'applyHighlight'
                : effectKind === 'syncDomain'
                  ? 'syncDomain'
                  : null,
          activationPolicy: 'automatic',
          channels: [...param.channels],
          description: `${param.name} propagates ${effectKind} semantics from ${param.producerViewId} to ${consumerViewId}.`,
        }, (entry) => entry.ref)
      }
    }
  }
  return projectedLinks
}

function buildSharedStateCandidates(paramInteractions = []) {
  return paramInteractions.map((param) => {
    const surfaces = []
    if (param.selectionType === 'interval' || param.selectionType === 'point') {
      surfaces.push('selection')
    }
    if (param.consumerTypes.includes('filter')) {
      surfaces.push('globalFilters')
    }
    if (param.consumerTypes.includes('condition') || param.consumerTypes.includes('conditionTest')) {
      surfaces.push('highlight')
    }
    if (param.consumerTypes.includes('scaleDomain') || param.isScaleBound) {
      surfaces.push('viewport')
    }
    if (typeof param.eventHandlers?.on === 'string' && param.eventHandlers.on.includes('pointerover')) {
      surfaces.push('focus')
    }
    if (param.isBoundInput) {
      surfaces.push('view')
    }
    return {
      paramName: param.name,
      sourceSelectionType: param.selectionType,
      sharedSurfaces: Array.from(new Set(surfaces)),
    }
  })
}

export function projectVegaLiteMultiViewToWidgetSemantics(interactionModel = {}) {
  const paramInteractions = Array.isArray(interactionModel?.params) ? interactionModel.params : []
  const classification = buildInteractionClassification({
    compositeKinds: Array.isArray(interactionModel?.compositeKinds) ? interactionModel.compositeKinds : [],
    paramInteractions,
    patternIds: Array.isArray(interactionModel?.patternIds) ? interactionModel.patternIds : [],
  })
  return {
    classification,
    projectedLinks: buildProjectedWidgetLinks(paramInteractions),
    sharedStateCandidates: buildSharedStateCandidates(paramInteractions),
  }
}

export function describeVegaLiteMultiViewInteractions(spec) {
  if (!isRecord(spec)) {
    throw new Error('describeVegaLiteMultiViewInteractions requires a Vega-Lite spec object.')
  }

  const normalizedSpec = clone(spec)
  const collectedNodes = collectVegaLiteViewNodes(normalizedSpec)
  const views = collectedNodes
    .filter((entry) => entry.mark || Array.isArray(entry.spec?.layer) || isRecord(entry.spec?.repeat))
    .map((entry) => ({
      viewId: entry.pathId,
      path: entry.path,
      mark: entry.mark,
      repeat: entry.repeat || null,
      compositionKinds: summarizeCompositeKinds(entry.spec),
    }))

  const paramDefinitions = []
  const paramConsumers = []

  for (const node of collectedNodes) {
    const params = Array.isArray(node.spec?.params) ? node.spec.params : []
    for (const param of params) {
      if (!isRecord(param) || !isRecord(param.select) || typeof param.name !== 'string' || param.name.length === 0) continue
      pushUniqueRecord(paramDefinitions, {
        name: param.name,
        selectionType: normalizeSelectionType(param.select),
        pathId: node.pathId,
        resolve: typeof param.select?.resolve === 'string' ? param.select.resolve : null,
        encodings: Array.isArray(param.select?.encodings) ? [...param.select.encodings] : [],
        fields: Array.isArray(param.select?.fields) ? [...param.select.fields] : [],
        isScaleBound: param.bind === 'scales',
        isBoundInput: param.bind != null && param.bind !== 'scales',
        on: typeof param.select?.on === 'string' ? param.select.on : null,
        translate: typeof param.select?.translate === 'string' ? param.select.translate : null,
        zoom: typeof param.select?.zoom === 'string' ? param.select.zoom : null,
      }, (entry) => `${entry.name}:${entry.pathId}`)
    }

    collectTransformParamConsumers(node.spec?.transform, node.path, paramConsumers)
    collectEncodingParamConsumers(node.spec?.encoding, node.path, paramConsumers)
  }

  const compositeKinds = Array.from(new Set([
    ...summarizeCompositeKinds(normalizedSpec),
    ...collectedNodes.flatMap((entry) => summarizeCompositeKinds(entry.spec)),
  ]))
  const paramInteractions = buildParamInteractionModel({
    paramDefinitions,
    paramConsumers,
    views,
  })
  const patternIds = deriveInteractionPatternIds({
    compositeKinds,
    paramInteractions,
  })
  const widgetSemantics = projectVegaLiteMultiViewToWidgetSemantics({
    compositeKinds,
    params: paramInteractions,
  })

  return {
    topology: compositeKinds.length > 0 ? 'composite_spec_multiview' : 'single_view',
    compositeKinds,
    viewCount: views.length,
    views,
    params: paramInteractions,
    patternIds,
    actionSurface: buildMultiViewActionSurface(paramInteractions),
    widgetSemantics,
  }
}

function collectNestedVegaLiteSpecs(spec) {
  const nested = []
  const childArrays = [
    spec?.layer,
    spec?.vconcat,
    spec?.hconcat,
    spec?.concat,
  ]

  for (const entries of childArrays) {
    if (Array.isArray(entries)) {
      nested.push(...entries.filter((entry) => entry && typeof entry === 'object'))
    }
  }

  if (spec?.spec && typeof spec.spec === 'object' && !Array.isArray(spec.spec)) {
    nested.push(spec.spec)
  }

  return nested
}

function inferExplicitWidgetKindHint(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return null
  }

  const explicitKind = normalizeExplicitWidgetKindHint(spec?.widgetKind)
    || normalizeExplicitWidgetKindHint(spec?.kind)
    || normalizeExplicitWidgetKindHint(spec?.usermeta?.widgetva?.widgetKind)
    || normalizeExplicitWidgetKindHint(spec?.usermeta?.widgetva?.kind)
    || inferExplicitWidgetKindHintFromTitle(spec?.title)
  if (explicitKind) return explicitKind
  return null
}

function normalizeExplicitWidgetKindHint(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return null
  if (normalized === 'parallelCoordinates') return 'parallelCoordinates'
  const lower = normalized.toLowerCase()
  if (lower === 'parallelcoordinates' || lower === 'parallel-coordinates' || lower === 'parallel_coordinates') return 'parallelCoordinates'
  if (lower === 'sankey') return 'sankey'
  if (lower === 'map') return 'map'
  return null
}

function readVegaLiteTitleText(title) {
  if (typeof title === 'string') return title
  if (title && typeof title === 'object' && !Array.isArray(title) && typeof title.text === 'string') return title.text
  return ''
}

function inferExplicitWidgetKindHintFromTitle(title) {
  const normalizedTitle = readVegaLiteTitleText(title).toLowerCase()
  if (!normalizedTitle) return null
  if (normalizedTitle.includes('parallel coordinates') || normalizedTitle.includes('parallel coordinate') || normalizedTitle.includes('平行坐标')) {
    return 'parallelCoordinates'
  }
  if (normalizedTitle.includes('sankey') || normalizedTitle.includes('桑基')) {
    return 'sankey'
  }
  return null
}

function inferSemanticWidgetKindFromVegaLiteSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return null
  }

  const explicitKind = inferExplicitWidgetKindHint(spec)
  if (explicitKind) return explicitKind

  const directKind = inferWidgetKindFromMark(spec?.mark)
  if (directKind) return directKind

  const layeredEntries = Array.isArray(spec?.layer) ? spec.layer : []
  for (const entry of layeredEntries) {
    const layeredKind = inferSemanticWidgetKindFromVegaLiteSpec(entry)
    if (layeredKind) return layeredKind
  }

  const compositeKeys = ['vconcat', 'hconcat', 'concat']
  for (const key of compositeKeys) {
    const entries = Array.isArray(spec?.[key]) ? spec[key] : []
    for (const entry of entries) {
      const nestedKind = inferSemanticWidgetKindFromVegaLiteSpec(entry)
      if (nestedKind) return nestedKind
    }
  }

  if (spec?.spec && typeof spec.spec === 'object' && !Array.isArray(spec.spec)) {
    return inferSemanticWidgetKindFromVegaLiteSpec(spec.spec)
  }

  return null
}

function collectRecognizedWidgetKindsFromSemanticViews(spec, target = []) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return target
  }

  const concatKeys = ['vconcat', 'hconcat', 'concat']
  for (const key of concatKeys) {
    const entries = Array.isArray(spec?.[key]) ? spec[key] : null
    if (!entries) continue
    for (const entry of entries) {
      collectRecognizedWidgetKindsFromSemanticViews(entry, target)
    }
    return target
  }

  if (isRecord(spec?.repeat) && isRecord(spec?.spec)) {
    collectRecognizedWidgetKindsFromSemanticViews(spec.spec, target)
    return target
  }

  if (isRecord(spec?.facet) && isRecord(spec?.spec)) {
    collectRecognizedWidgetKindsFromSemanticViews(spec.spec, target)
    return target
  }

  const semanticKind = inferSemanticWidgetKindFromVegaLiteSpec(spec)
  if (semanticKind) {
    pushUniqueKind(target, semanticKind)
  }
  return target
}

function inferRecognizedWidgetKindsFromParamProducers(interactionModel = null) {
  const interactionModes = Array.isArray(interactionModel?.widgetSemantics?.classification?.interactionModes)
    ? interactionModel.widgetSemantics.classification.interactionModes
    : []
  const compositeKinds = Array.isArray(interactionModel?.compositeKinds) ? interactionModel.compositeKinds : []
  const hasStructuredMultiView = compositeKinds.some((kind) => ['vconcat', 'hconcat', 'concat', 'repeat', 'facet'].includes(kind))
  const pointParams = Array.isArray(interactionModel?.params)
    ? interactionModel.params.filter((entry) => entry?.selectionType === 'point')
    : []
  const isLayeredPointFocusDetail = compositeKinds.includes('layer')
    && !hasStructuredMultiView
    && pointParams.length > 0
    && pointParams.every((entry) => {
      const producerKind = inferWidgetKindFromMark(entry?.producerMark)
      return producerKind === 'scatter'
        && Array.isArray(entry?.consumerTypes)
        && entry.consumerTypes.length > 0
        && entry.consumerTypes.every((consumerType) => consumerType === 'condition' || consumerType === 'conditionTest')
    })
  const shouldPreferProducerKinds = isLayeredPointFocusDetail
    || (interactionModes.includes('focusDetail') && !hasStructuredMultiView)
    || (interactionModes.includes('boundParameter') && !hasStructuredMultiView)
  if (!shouldPreferProducerKinds) {
    return []
  }

  const producerKinds = Array.isArray(interactionModel?.params)
    ? interactionModel.params
      .map((entry) => inferWidgetKindFromMark(entry?.producerMark))
      .filter(Boolean)
    : []
  return uniqueKinds(producerKinds)
}

function inferRecognizedWidgetKindsFromInteractionModel(spec, interactionModel = null) {
  const interactionModes = Array.isArray(interactionModel?.widgetSemantics?.classification?.interactionModes)
    ? interactionModel.widgetSemantics.classification.interactionModes
    : []
  const compositeKinds = Array.isArray(interactionModel?.compositeKinds) ? interactionModel.compositeKinds : []
  const hasStructuredMultiView = compositeKinds.some((kind) => ['vconcat', 'hconcat', 'concat', 'repeat', 'facet'].includes(kind))
  const pointParams = Array.isArray(interactionModel?.params)
    ? interactionModel.params.filter((entry) => entry?.selectionType === 'point')
    : []
  const semanticKinds = collectRecognizedWidgetKindsFromSemanticViews(spec, [])
  const isLayeredLineHoverProxy = (
    interactionModes.includes('focusDetail')
    && compositeKinds.includes('layer')
    && !hasStructuredMultiView
    && semanticKinds.includes('line')
    && pointParams.length > 0
    && pointParams.every((entry) => {
      const producerKind = inferWidgetKindFromMark(entry?.producerMark)
      const producerSpec = resolveSpecNodeByViewId(spec, entry?.producerViewId)
      const usesEncodingProxy = Array.isArray(entry?.encodings)
        && entry.encodings.length > 0
        && (!Array.isArray(entry?.fields) || entry.fields.length === 0)
      const usesInheritedPointProxy = (
        producerSpec
        && producerKind === 'scatter'
        && (
          !producerSpec?.encoding
          || (
            typeof producerSpec?.encoding?.x?.field !== 'string'
            && typeof producerSpec?.encoding?.y?.field !== 'string'
          )
        )
      )
      return producerKind === 'scatter'
        && (usesEncodingProxy || usesInheritedPointProxy)
    })
  )
  if (isLayeredLineHoverProxy) {
    return ['line']
  }

  const producerKinds = inferRecognizedWidgetKindsFromParamProducers(interactionModel)
  if (producerKinds.length > 0) {
    return producerKinds
  }
  if (semanticKinds.length > 0) {
    return uniqueKinds(semanticKinds)
  }
  const interactionKinds = Array.isArray(interactionModel?.views)
    ? interactionModel.views
      .map((view) => inferSemanticWidgetKindFromVegaLiteSpec(view?.spec))
      .filter(Boolean)
    : []
  if (interactionKinds.length > 0) {
    return uniqueKinds(interactionKinds)
  }
  return uniqueKinds(inferWidgetKindsFromVegaLiteSpec(spec))
}

export function inferWidgetKindsFromVegaLiteSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return []
  }

  const inferredKinds = []

  const explicitKind = inferExplicitWidgetKindHint(spec)
  if (explicitKind) return [explicitKind]

  pushUniqueKind(inferredKinds, inferWidgetKindFromMark(spec?.mark))

  for (const child of collectNestedVegaLiteSpecs(spec)) {
    for (const kind of inferWidgetKindsFromVegaLiteSpec(child)) {
      pushUniqueKind(inferredKinds, kind)
    }
  }

  return inferredKinds
}

export function inferWidgetKindFromVegaLiteSpec(spec) {
  const candidateKinds = inferWidgetKindsFromVegaLiteSpec(spec)
  if (candidateKinds.length === 1) {
    return candidateKinds[0]
  }
  return 'custom'
}

export function extractOfficialVegaLitePageSpecFromText(text) {
  return findSchemaAnchoredJson(text)
}

export function extractOfficialVegaLitePageSpecFromHtml(html) {
  const codeBlocks = collectCodeLikeBlocks(html)
  for (const block of codeBlocks) {
    const spec = extractOfficialVegaLitePageSpecFromText(block)
    if (spec) return spec
  }
  return extractOfficialVegaLitePageSpecFromText(stripHtmlTags(html))
}

export function normalizeOfficialVegaLitePageSpec(spec, pageUrl) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('normalizeOfficialVegaLitePageSpec requires a Vega-Lite spec object.')
  }
  const effectivePageUrl = typeof pageUrl === 'string' && pageUrl.length > 0 ? pageUrl : null
  return effectivePageUrl ? absolutizeDataUrls(clone(spec), effectivePageUrl) : clone(spec)
}

export function readGenericVegaLiteIntegrationInput({
  spec,
  pageUrl = '',
} = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('readGenericVegaLiteIntegrationInput requires a Vega-Lite spec object.')
  }

  const normalizedSpec = normalizeOfficialVegaLitePageSpec(spec, pageUrl)
  const candidateKinds = inferWidgetKindsFromVegaLiteSpec(normalizedSpec)
  const interactionModel = describeVegaLiteMultiViewInteractions(normalizedSpec)
  const recognizedKinds = inferRecognizedWidgetKindsFromInteractionModel(normalizedSpec, interactionModel)
  return {
    provider: 'vega-lite',
    kind: recognizedKinds.length === 1 ? recognizedKinds[0] : 'custom',
    candidateKinds,
    recognizedKinds,
    interactionModel,
    spec: normalizedSpec,
    pageUrl: typeof pageUrl === 'string' ? pageUrl : '',
  }
}

export function readOfficialVegaLitePageIntegrationInput({
  html = '',
  text = '',
  pageUrl = '',
} = {}) {
  if (!isOfficialVegaLiteGalleryPage(pageUrl)) {
    throw new Error(`Unsupported Vega-Lite examples URL: ${pageUrl}`)
  }

  const parsedSpec = extractOfficialVegaLitePageSpecFromHtml(html) || extractOfficialVegaLitePageSpecFromText(text)
  if (!parsedSpec) {
    throw new Error('Unable to extract a Vega-Lite example spec from the provided page content.')
  }

  const spec = normalizeOfficialVegaLitePageSpec(parsedSpec, pageUrl)
  return readGenericVegaLiteIntegrationInput({ spec, pageUrl })
}

async function createAttachedVegaLiteController({
  root = globalThis.window,
  integrationInput,
  view = null,
  capture = null,
  sessionId = null,
  userIntent = 'Analyze and manipulate the current Vega-Lite view through WidgetVA structured actions.',
} = {}) {
  if (!view) {
    throw new Error('createAttachedVegaLiteController requires a Vega/Vega-Lite view instance.')
  }

  const hydratedSpec = await loadOfficialPageDataValues({
    root,
    spec: integrationInput.spec,
  })
  const hydratedAugmentedSpec = addHeatmapAxisAliasesToRows(hydratedSpec)
  if (Array.isArray(integrationInput.candidateKinds) && integrationInput.candidateKinds.length > 0) {
    hydratedAugmentedSpec.__widgetvaCandidateKinds = [...integrationInput.candidateKinds]
  }
  if (Array.isArray(integrationInput.recognizedKinds) && integrationInput.recognizedKinds.length > 0) {
    hydratedAugmentedSpec.__widgetvaRecognizedKinds = [...integrationInput.recognizedKinds]
  }
  const normalizedInput = {
    ...integrationInput,
    spec: hydratedAugmentedSpec,
  }
  const widgetAdapter = createVegaLiteWidgetAdapter({ kind: normalizedInput.kind })
  const baselineSpec = clone(normalizedInput.spec)
  const currentSpecRef = { current: clone(normalizedInput.spec) }
  const renderedSpecRef = { current: clone(normalizedInput.spec) }
  const viewRef = { current: view }
  const originalPagePort = root?.__widgetVA || null
  const hostBridge = createOfficialPageHostBridge({
    sessionId: sessionId || `vega-lite-${normalizedInput.kind}`,
    baselineSpec,
    currentSpecRef,
    userIntent,
    emitOnWrite: true,
  })
  const widget = createWidgetInstance({
    widgetAdapter,
    spec: baselineSpec,
    runtimeOptions: {
      hostBridge,
    },
  })

  await widget.mount({
    view,
    spec: baselineSpec,
    bindHumanInteractions: false,
  })

  const rematerialize = createOfficialPageMaterializer({
    root,
    capture,
    currentSpecRef,
    renderedSpecRef,
    viewRef,
  })
  const readOfficialPageSelectionStateForWidget = () => readOfficialPageSelectionState({
    widgetState: clone(widget.readState?.() || {}) || {},
    workspaceState: clone(widget.readWorkspaceState?.() || {}) || {},
    hostSelections: clone(hostBridge.readCurrentSelections?.() || {}) || {},
  })
  const sourceWidgetId = widget.resolveWidgetId() || widget.resolveWidgetRef() || sessionId || `vega-lite-${normalizedInput.kind}`
  const sourceWidgetRef = widget.resolveWidgetRef() || null

  let pendingSharedStateMaterialization = Promise.resolve()
  const materializeFromSharedState = async () => {
    const renderSpec = buildVegaLiteRenderSpecFromRuntimeState({
      semanticSpec: currentSpecRef.current,
      state: readOfficialPageSelectionStateForWidget(),
      runtime: widget.runtime,
    })
    const renderMatchesCurrent = JSON.stringify(renderedSpecRef.current) === JSON.stringify(renderSpec)
    if (renderMatchesCurrent) return
    await rematerialize(renderSpec)
  }
  const unsubscribeSharedStateMaterialization = hostBridge.subscribe(() => {
    pendingSharedStateMaterialization = pendingSharedStateMaterialization
      .catch(() => {})
      .then(() => materializeFromSharedState())
      .catch(() => {})
  })

  const syncOfficialPageAfterAction = async () => {
    await Promise.resolve()
    await Promise.resolve(pendingSharedStateMaterialization).catch(() => {})
  }

  const {
    executeParamAction,
    executeVerifiedParamAction,
  } = createOfficialPageParamActionDispatcher({
    widget,
    spec: () => currentSpecRef.current,
    interactionModel: normalizedInput.interactionModel,
    sourceWidgetId,
    sourceWidgetRef,
    hostBridge,
  })

  const proxiedWidget = createOfficialPageActionDispatchProxy(widget, {
    executeParamAction,
    executeVerifiedParamAction,
    syncAfterAction: syncOfficialPageAfterAction,
  })
  const mountedPagePort = root?.__widgetVA || null
  const proxiedPagePort = createOfficialPageActionDispatchProxy(mountedPagePort, {
    executeParamAction,
    executeVerifiedParamAction,
    syncAfterAction: syncOfficialPageAfterAction,
  })
  const metadataAwarePagePort = createOfficialPagePortMetadataProxy(proxiedPagePort, {
    widgetRef: widget.resolveWidgetRef(),
    interactionModel: normalizedInput.interactionModel,
    recognizedKinds: normalizedInput.recognizedKinds || normalizedInput.candidateKinds,
  })
  if (mountedPagePort && metadataAwarePagePort && root) {
    root.__widgetVA = metadataAwarePagePort
  }
  const baseWorkspace = createWidgetWorkspace({
    runtime: widget.runtime,
    widgets: [proxiedWidget],
  })
  const workspace = createOfficialPageWorkspaceContractProxy(baseWorkspace, {
    widgetRef: widget.resolveWidgetRef(),
    interactionModel: normalizedInput.interactionModel,
    recognizedKinds: normalizedInput.recognizedKinds || normalizedInput.candidateKinds,
    executeParamAction,
    executeVerifiedParamAction,
    syncAfterAction: syncOfficialPageAfterAction,
  })

  return {
    ...normalizedInput,
    widget: proxiedWidget,
    workspace,
    widgetAdapter,
    pagePort: root?.__widgetVA || null,
    runAgentLoop: createOfficialPageAgentLoopRunner(workspace),
    readRecoverableState() {
      return readControllerRecoverableState(widget)
    },
    async restoreRecoverableState(state) {
      const recoverableSelections = readRecoverableSelectionRegistry(state)
      if (recoverableSelections && typeof hostBridge?.writeCurrentSelections === 'function') {
        hostBridge.writeCurrentSelections(recoverableSelections, {
          primarySelectionRef: Object.keys(recoverableSelections)[0] || null,
        })
        await syncOfficialPageAfterAction()
        return {
          ok: true,
          stateId: state?.stateId || null,
          method: 'sharedSelections',
        }
      }
      return restoreControllerRecoverableState(widget, state, 'Vega-Lite page controller')
    },
    getCurrentSpec() {
      return clone(currentSpecRef.current)
    },
    getRenderedSpec() {
      return clone(renderedSpecRef.current)
    },
    dispose() {
      unsubscribeSharedStateMaterialization?.()
      if (root?.__widgetVA === metadataAwarePagePort || root?.__widgetVA === proxiedPagePort) {
        if (originalPagePort) root.__widgetVA = originalPagePort
        else delete root.__widgetVA
      }
      baseWorkspace.dispose()
      widget.dispose()
    },
  }
}

export async function attachWidgetVAToVegaLiteView({
  root = globalThis.window,
  spec = null,
  pageUrl = '',
  view = null,
  capture = null,
  sessionId = null,
  userIntent = 'Analyze and manipulate the current Vega-Lite view through WidgetVA structured actions.',
} = {}) {
  const integrationInput = readGenericVegaLiteIntegrationInput({ spec, pageUrl })
  return createAttachedVegaLiteController({
    root,
    integrationInput,
    view,
    capture,
    sessionId,
    userIntent,
  })
}

export async function attachWidgetVAToOfficialVegaLitePage({
  root = globalThis.window,
  html = '',
  text = '',
  pageUrl = '',
  view = null,
  capture = null,
  sessionId = null,
  userIntent = 'Analyze and manipulate the current official Vega-Lite example through WidgetVA structured actions.',
} = {}) {
  if (!view) {
    throw new Error('attachWidgetVAToOfficialVegaLitePage requires a Vega/Vega-Lite view instance.')
  }

  const integrationInput = readOfficialVegaLitePageIntegrationInput({ html, text, pageUrl })
  return createAttachedVegaLiteController({
    root,
    integrationInput,
    view,
    capture,
    sessionId: sessionId || `official-vega-lite-${integrationInput.kind}`,
    userIntent,
  })
}

export async function attachWidgetVAToCapturedVegaLiteView({
  root = globalThis.window,
  spec = null,
  pageUrl = '',
  sessionId = null,
  userIntent,
} = {}) {
  const latestCapture = readLatestVegaEmbedCapture(root)
  const view = latestCapture?.view || latestCapture?.result?.view || null
  if (!view) {
    throw new Error('No captured Vega embed view is available on the current page.')
  }

  const effectiveSpec = spec || latestCapture?.spec || null
  if (!effectiveSpec) {
    throw new Error('attachWidgetVAToCapturedVegaLiteView requires a Vega-Lite spec or a captured vegaEmbed spec.')
  }

  return attachWidgetVAToVegaLiteView({
    root,
    spec: effectiveSpec,
    pageUrl: pageUrl || root?.location?.href || '',
    view,
    capture: latestCapture,
    sessionId,
    userIntent,
  })
}

export async function attachWidgetVAToCapturedOfficialVegaLitePage({
  root = globalThis.window,
  html = '',
  text = '',
  pageUrl = '',
  sessionId = null,
  userIntent,
} = {}) {
  const latestCapture = readLatestVegaEmbedCapture(root)
  const view = latestCapture?.view || latestCapture?.result?.view || null
  if (!view) {
    throw new Error('No captured Vega embed view is available on the current page.')
  }

  const fallbackHtml = html || root?.document?.documentElement?.outerHTML || ''
  const fallbackText = text || root?.document?.body?.innerText || ''
  const fallbackPageUrl = pageUrl || root?.location?.href || ''

  if (!isOfficialVegaLiteGalleryPage(fallbackPageUrl)) {
    const fallbackSpec = latestCapture?.spec
      || extractOfficialVegaLitePageSpecFromHtml(fallbackHtml)
      || extractOfficialVegaLitePageSpecFromText(fallbackText)
      || null
    if (!fallbackSpec) {
      throw new Error('attachWidgetVAToCapturedOfficialVegaLitePage could not resolve a Vega-Lite spec for a non-official captured page.')
    }
    return attachWidgetVAToVegaLiteView({
      root,
      spec: fallbackSpec,
      pageUrl: fallbackPageUrl,
      view,
      capture: latestCapture,
      sessionId,
      userIntent,
    })
  }

  return attachWidgetVAToOfficialVegaLitePage({
    root,
    html: fallbackHtml,
    text: fallbackText,
    pageUrl: fallbackPageUrl,
    view,
    capture: latestCapture,
    sessionId,
    userIntent,
  })
}

export async function waitForCapturedVegaLiteView({
  root = globalThis.window,
  timeoutMs = 5000,
  pollMs = 25,
} = {}) {
  const start = Date.now()

  while ((Date.now() - start) <= timeoutMs) {
    const latestCapture = readLatestVegaEmbedCapture(root)
    if (latestCapture?.view || latestCapture?.result?.view) {
      return latestCapture
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  throw new Error(`Timed out waiting for a captured Vega embed view after ${timeoutMs}ms.`)
}

export async function attachWidgetVAToCurrentCapturedVegaLitePage({
  root = globalThis.window,
  html = '',
  text = '',
  pageUrl = '',
  sessionId = null,
  userIntent,
  timeoutMs = 5000,
  pollMs = 25,
  forceReattach = false,
} = {}) {
  installVegaEmbedCapture(root)
  if (forceReattach) {
    clearLatestVegaEmbedCapture(root)
  }
  await waitForCapturedVegaLiteView({
    root,
    timeoutMs,
    pollMs,
  })

  return attachWidgetVAToCapturedOfficialVegaLitePage({
    root,
    html,
    text,
    pageUrl,
    sessionId,
    userIntent,
  })
}

export async function bootstrapCurrentCapturedVegaLitePage({
  root = globalThis.window,
  html = '',
  text = '',
  pageUrl = '',
  sessionId = null,
  userIntent,
  timeoutMs = 5000,
  pollMs = 25,
  enableExtensionBridge = true,
  forceReattach = false,
} = {}) {
  const controller = await attachWidgetVAToCurrentCapturedVegaLitePage({
    root,
    html,
    text,
    pageUrl,
    sessionId,
    userIntent,
    timeoutMs,
    pollMs,
    forceReattach,
  })

  const disposeBridge = enableExtensionBridge
    ? installBrowserExtensionBridge({ root })
    : () => {}

  return {
    ...controller,
    pagePort: root?.__widgetVA || null,
    runAgentLoop: createOfficialPageAgentLoopRunner(controller.workspace),
    dispose() {
      try {
        disposeBridge?.()
      } finally {
        controller.dispose()
      }
    },
  }
}
