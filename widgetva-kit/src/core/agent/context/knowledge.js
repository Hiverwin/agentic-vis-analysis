import { cloneJsonValue as clone } from '../../../shared/clone.js'
import {
  barFamily,
  heatmapFamily,
  lineFamily,
  parallelCoordinatesFamily,
  sankeyFamily,
  scatterFamily,
} from '../../../widgets/families/index.js'
import { actionLinks } from '../relations/actionLinks/index.js'
import { analysisToAction, listSingleWidgetWorkflows, listWorkflows } from '../workflows/index.js'

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

function mergeDescriptors(...descriptorLists) {
  const seen = new Set()
  return descriptorLists.flatMap((descriptors) => (Array.isArray(descriptors) ? descriptors : []))
    .filter((descriptor) => {
      const name = descriptor?.name
      if (typeof name !== 'string' || name.length === 0 || seen.has(name)) return false
      seen.add(name)
      return true
    })
}

function buildFamilyKnowledge(family) {
  const actionDescriptors = typeof family.actions?.buildDescriptors === 'function'
    ? family.actions.buildDescriptors()
    : []
  const perceptionDescriptors = typeof family.perception?.buildDescriptors === 'function'
    ? family.perception.buildDescriptors({ dataRef: null })
    : []

  return {
    kind: family.kind,
    actions: clone(actionDescriptors),
    perceptions: clone(mergeDescriptors(perceptionDescriptors, COMMON_AGENT_TOOLS.perceptions)),
  }
}

function buildActionLinkKnowledge(families) {
  const selectedKinds = new Set(families.map((family) => family.kind))
  const result = {}

  for (const [sourceKind, sourceActions] of Object.entries(actionLinks)) {
    if (!selectedKinds.has(sourceKind)) continue
    const actionNames = new Set(
      (families.find((family) => family.kind === sourceKind)?.actions?.buildDescriptors?.() || [])
        .map((descriptor) => descriptor?.name),
    )
    const availableActions = {}

    for (const [actionName, effects] of Object.entries(sourceActions || {})) {
      if (!actionNames.has(actionName)) continue
      const visibleEffects = (Array.isArray(effects) ? effects : []).filter((effect) => {
        const targetKind = typeof effect?.targetState === 'string'
          ? effect.targetState.split('.')[0]
          : null
        return targetKind && selectedKinds.has(targetKind)
      })
      if (visibleEffects.length > 0) availableActions[actionName] = clone(visibleEffects)
    }

    if (Object.keys(availableActions).length > 0) result[sourceKind] = availableActions
  }

  return result
}

function buildWorkflowKnowledge(families) {
  const availableOperations = new Set(
    families.flatMap((family) => [
      ...(family.actions?.buildDescriptors?.() || []),
      ...(family.perception?.buildDescriptors?.({ dataRef: null }) || []),
      ...COMMON_AGENT_TOOLS.perceptions,
    ]).map((descriptor) => descriptor?.name),
  )

  return listWorkflows()
    .map((workflow) => ({
      ...workflow,
      examples: clone(workflow.scenarioExamples || []),
      steps: workflow.steps.filter((step) => availableOperations.has(step.operation)),
    }))
    .filter((workflow) => workflow.steps.length > 0)
    .map(clone)
}

function buildAnalysisToActionGuidance(families) {
  return Object.fromEntries(
    families
      .map((family) => [family.kind, {
        analysisToAction: clone(analysisToAction[family.kind] || []),
        workflows: clone(listSingleWidgetWorkflows(family.kind)),
      }]),
  )
}

export function buildAgentKnowledge({
  widgetKinds = null,
} = {}) {
  const selectedKinds = Array.isArray(widgetKinds) && widgetKinds.length > 0
    ? uniqueStrings(widgetKinds)
    : []
  const selectedKindSet = new Set(selectedKinds)
  const families = selectedKinds.length > 0
    ? FIRST_CLASS_WIDGET_FAMILIES.filter((family) => selectedKindSet.has(family.kind))
    : FIRST_CLASS_WIDGET_FAMILIES

  return {
    widgetFamilies: families.map((family) => buildFamilyKnowledge(family)),
    agentGuidance: {
      analysisToActionByFamily: buildAnalysisToActionGuidance(families),
      relations: buildActionLinkKnowledge(families),
      workflows: buildWorkflowKnowledge(families),
    },
  }
}

/**
 * Project the full Kit capability knowledge into a benchmark planner surface.
 * This does not change runtime capabilities; it only controls what the model
 * receives for the Level 1/2/3 ablation.
 */
export function projectPlannerKnowledge(knowledge = {}, { level = 2, observation = null } = {}) {
  if (![1, 2, 3].includes(level)) return clone(knowledge)
  const families = Array.isArray(knowledge?.widgetFamilies) ? clone(knowledge.widgetFamilies) : []
  if (level === 1) {
    const widgets = Array.isArray(observation?.state?.widgets) ? observation.state.widgets : []
    const tools = []
    for (const widget of widgets) {
      const family = families.find((entry) => entry.kind === widget?.kind)
      if (!family || !widget?.ref) continue
      for (const descriptor of [...(family.actions || []), ...(family.perceptions || [])]) {
        tools.push({
          ...clone(descriptor),
          kind: descriptor.name.startsWith('perception.') ? 'perception' : 'action',
          target: { widgetRef: widget.ref },
        })
      }
    }
    return { tools }
  }

  // Level 2 and Level 3 share the widget abstraction. Selected guidance is
  // injected separately as plannerContext, never through the global catalog.
  return { widgetFamilies: families }
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
