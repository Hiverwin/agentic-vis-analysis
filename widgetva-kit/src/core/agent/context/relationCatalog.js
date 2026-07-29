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

/**
 * Prompt-facing relation guidance. Runtime links remain in workspace.links;
 * this catalog is only the optional semantic explanation shown to a planner.
 */
export const relationGuidance = Object.freeze(
  Object.entries(actionLinks).flatMap(([family, familyLinks]) =>
    Object.entries(familyLinks || {}).map(([actionName, effects]) => Object.freeze({
      id: buildRelationId(family, actionName),
      scope: 'multi_widget',
      family,
      action: actionName,
      sourceStates: [...new Set((effects || []).map((effect) => effect?.sourceState).filter(Boolean))],
      effects: clone(effects || []),
    })),
  ),
)

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
