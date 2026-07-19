import {
  barFamily,
  heatmapFamily,
  lineFamily,
  parallelCoordinatesFamily,
  sankeyFamily,
  scatterFamily,
} from '../../../widgets/families/index.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

const FIRST_CLASS_WIDGET_FAMILIES = Object.freeze([
  barFamily,
  heatmapFamily,
  lineFamily,
  parallelCoordinatesFamily,
  sankeyFamily,
  scatterFamily,
])

const COMMON_AGENT_TOOLS = Object.freeze({
  actions: Object.freeze([]),
  perceptions: Object.freeze([
    Object.freeze({
      name: 'perception.inspectViewConfig',
      description: 'Read the current widget encodings, transforms, domains, selections, and feedback state.',
      paramsSchema: Object.freeze({
        type: 'object',
        properties: Object.freeze({}),
      }),
    }),
    Object.freeze({
      name: 'perception.inspectVisibleRows',
      description: 'Read a bounded sample of rows currently visible in the target widget.',
      paramsSchema: Object.freeze({
        type: 'object',
        properties: Object.freeze({
          limit: Object.freeze({ type: 'number' }),
        }),
      }),
    }),
    Object.freeze({
      name: 'perception.summarizeVisible',
      description: 'Read a grouped or aggregate summary over rows currently visible in the target widget.',
      paramsSchema: Object.freeze({
        type: 'object',
        properties: Object.freeze({
          groupBy: Object.freeze({ type: 'array', items: Object.freeze({ type: 'string' }) }),
          fields: Object.freeze({ type: 'array', items: Object.freeze({ type: 'string' }) }),
          metrics: Object.freeze({ type: 'array', items: Object.freeze({ type: 'string' }) }),
          limit: Object.freeze({ type: 'integer' }),
        }),
      }),
    }),
  ]),
})

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.length > 0))]
}

function filterDescriptorsByName(descriptors = [], allowedNames = null) {
  if (!(allowedNames instanceof Set)) return clone(descriptors)
  return (Array.isArray(descriptors) ? descriptors : [])
    .filter((descriptor) => allowedNames.has(descriptor?.name))
    .map(clone)
}

function buildFamilyKnowledge(family, {
  actionNamesByKind = null,
  perceptionNamesByKind = null,
} = {}) {
  const allowedActionNames = actionNamesByKind instanceof Map ? actionNamesByKind.get(family.kind) || null : null
  const allowedPerceptionNames = perceptionNamesByKind instanceof Map ? perceptionNamesByKind.get(family.kind) || null : null
  const actionDescriptors = typeof family.actions?.buildDescriptors === 'function'
    ? family.actions.buildDescriptors()
    : []
  const perceptionDescriptors = typeof family.perception?.buildDescriptors === 'function'
    ? family.perception.buildDescriptors({ dataRef: null })
    : []

  return {
    kind: family.kind,
    actions: filterDescriptorsByName(actionDescriptors, allowedActionNames),
    perceptions: filterDescriptorsByName(perceptionDescriptors, allowedPerceptionNames),
    playbook: clone(family.playbook || null),
  }
}

export function buildAgentKnowledge({
  task = null,
  widgetKinds = null,
  widgetActionNamesByKind = null,
  widgetPerceptionNamesByKind = null,
} = {}) {
  const selectedKinds = Array.isArray(widgetKinds) && widgetKinds.length > 0
    ? uniqueStrings(widgetKinds)
    : []
  const selectedKindSet = new Set(selectedKinds)
  const families = selectedKinds.length > 0
    ? FIRST_CLASS_WIDGET_FAMILIES.filter((family) => selectedKindSet.has(family.kind))
    : FIRST_CLASS_WIDGET_FAMILIES

  return {
    ...(task ? { task: clone(task) } : {}),
    commonTools: clone(COMMON_AGENT_TOOLS),
    widgetFamilies: families.map((family) => buildFamilyKnowledge(family, {
      actionNamesByKind: widgetActionNamesByKind,
      perceptionNamesByKind: widgetPerceptionNamesByKind,
    })),
  }
}

export function findWidgetFamilyKnowledge(knowledge = null, widgetKind = null) {
  if (!widgetKind) return null
  const families = Array.isArray(knowledge?.widgetFamilies) ? knowledge.widgetFamilies : []
  return families.find((family) => family?.kind === widgetKind) || null
}

export function listWidgetFamilyActionNames(knowledge = null, widgetKind = null) {
  const family = findWidgetFamilyKnowledge(knowledge, widgetKind)
  return uniqueStrings((Array.isArray(family?.actions) ? family.actions : []).map((descriptor) => descriptor?.name))
}

export function listWidgetFamilyPerceptionNames(knowledge = null, widgetKind = null) {
  const family = findWidgetFamilyKnowledge(knowledge, widgetKind)
  return uniqueStrings((Array.isArray(family?.perceptions) ? family.perceptions : []).map((descriptor) => descriptor?.name))
}

export function listCommonAgentActionNames(knowledge = null) {
  return uniqueStrings((Array.isArray(knowledge?.commonTools?.actions) ? knowledge.commonTools.actions : []).map((descriptor) => descriptor?.name))
}

export function listCommonAgentPerceptionNames(knowledge = null) {
  return uniqueStrings((Array.isArray(knowledge?.commonTools?.perceptions) ? knowledge.commonTools.perceptions : []).map((descriptor) => descriptor?.name))
}
