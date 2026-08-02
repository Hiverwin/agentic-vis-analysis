import { cloneJsonValue as clone } from '../../shared/clone.js'
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
  inferWidgetKindFromMark,
  uniqueKinds,
} from './officialVegaLiteWidgetKinds.js'

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

export function appendOfficialPageMultiViewActionsToWorkspaceDescription(description, {
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
