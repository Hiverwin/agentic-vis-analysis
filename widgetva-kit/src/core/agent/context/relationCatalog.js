import { cloneJsonValue as clone } from '../../../shared/clone.js'
import { actionLinks } from '../relations/actionLinks/index.js'

function slugify(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
}

function buildRelationId(family, actionName) {
  const action = String(actionName || '').split('.').pop()
  return `REL-2V-${slugify(family)}-${slugify(action)}-01`
}

function buildRelationDefinition({
  id,
  scope = 'multi_widget',
  family = null,
  kind,
  sourceStates = [],
  targetStates = [],
  effects = [],
  description,
}) {
  return Object.freeze({
    id,
    scope,
    family,
    kind,
    sourceStates: [...new Set(sourceStates)],
    targetStates: [...new Set(targetStates)],
    effects: clone(effects),
    ...(description ? { description } : {}),
  })
}

/**
 * Prompt-facing relation guidance. Runtime links remain in workspace.links;
 * this catalog is only the optional semantic explanation shown to a planner.
 */
const actionRelationGuidance = Object.entries(actionLinks).flatMap(([family, familyLinks]) =>
    Object.entries(familyLinks || {}).map(([actionName, effects]) => Object.freeze({
      id: buildRelationId(family, actionName),
      scope: 'multi_widget',
      family,
      action: actionName,
      sourceStates: [...new Set((effects || []).map((effect) => effect?.sourceState).filter(Boolean))],
      effects: clone(effects || []),
    })),
)

// Benchmark relation IDs are canonical semantic identities. They are defined
// independently from action-derived IDs; action links only provide reusable
// state-transition descriptions where the semantics overlap.
const relationDefinitions = [
  buildRelationDefinition({
    id: 'REL-3V-CORE-001',
    scope: '3V',
    kind: 'core_coordination',
    description: 'Core three-widget coordination relation. Its concrete source and targets are resolved from the selected workflow and workspace topology.',
  }),
  buildRelationDefinition({
    id: 'REL-3V-BAR-CATEGORY-01',
    scope: '3V',
    family: 'bar',
    kind: 'category_selection_propagation',
    sourceStates: ['bar.selection.category'],
    targetStates: ['scatter.transform', 'line.transform', 'heatmap.transform'],
    effects: actionLinks.bar['bar.selectCategory'],
    description: 'A category selection in the bar view propagates as a linked category constraint across the three-view composition.',
  }),
  buildRelationDefinition({
    id: 'REL-2V-PARALLEL-SELECTCOHORT-01',
    scope: '2V',
    family: 'parallelCoordinates',
    kind: 'cohort_selection_propagation',
    sourceStates: ['parallelCoordinates.selection.cohort'],
    targetStates: ['scatter.transform', 'bar.view.highlight'],
    effects: actionLinks.parallelCoordinates['parallelCoordinates.selectCohort'],
    description: 'A multidimensional cohort selected in the parallel-coordinates view constrains and highlights linked views.',
  }),
  buildRelationDefinition({
    id: 'REL-3V-SCATTER-COHORT-01',
    scope: '3V',
    family: 'scatter',
    kind: 'cohort_selection_propagation',
    sourceStates: ['scatter.selection.brush'],
    targetStates: ['bar.transform', 'line.transform', 'heatmap.transform'],
    effects: actionLinks.scatter['scatter.brushRegion'],
    description: 'A directly brushed scatter cohort propagates to linked composition and detail views.',
  }),
  buildRelationDefinition({
    id: 'REL-3V-SCATTER-DERIVEDCOHORT-01',
    scope: '3V',
    family: 'scatter',
    kind: 'derived_cohort_propagation',
    sourceStates: ['scatter.selection.derivedCohort'],
    targetStates: ['bar.transform', 'line.transform', 'heatmap.transform'],
    effects: actionLinks.scatter['scatter.brushRegion'],
    description: 'A derived cohort originating from scatter analysis propagates as cohort context to linked views.',
  }),
]

export const relationGuidance = Object.freeze([
  ...actionRelationGuidance,
  ...relationDefinitions,
])

export function listRelationGuidance() {
  return relationGuidance.map(clone)
}

export function getRelationGuidance(id) {
  if (typeof id !== 'string' || !id) return null
  const relation = relationGuidance.find((entry) => entry.id === id)
  return relation ? clone(relation) : null
}

export function resolveRelationGuidance(ids = []) {
  return (Array.isArray(ids) ? ids : [])
    .map((id) => getRelationGuidance(id))
    .filter(Boolean)
}

export default relationGuidance
