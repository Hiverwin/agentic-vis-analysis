import { cloneJsonValue as clone } from '../../../shared/clone.js'
import { getAnalysisToAction } from '../workflows/analysisToAction.js'
import { getWorkflow } from '../workflows/index.js'
import { resolveRelationGuidance } from './relationCatalog.js'

/** Resolve only instance-selected prompt guidance; never expose a catalog. */
export function buildPlannerContext({
  analysisToActionIds = [],
  relationIds = [],
  workflowId = null,
  level = 3,
} = {}) {
  return {
    analysisToAction: (Array.isArray(analysisToActionIds) ? analysisToActionIds : [])
      .map((id) => getAnalysisToAction(id))
      .filter(Boolean)
      .map(clone),
    relations: level >= 2 ? resolveRelationGuidance(relationIds) : [],
    workflow: level >= 3 && workflowId ? clone(getWorkflow(workflowId)) : null,
  }
}

export function buildPlannerContextFromInstance(instance = {}, { level = 3 } = {}) {
  const context = instance?.planner_context || instance?.plannerContext || {}
  return buildPlannerContext({
    analysisToActionIds: context.analysis_to_action_ids || context.analysisToActionIds,
    relationIds: context.relation_ids || context.relationIds,
    workflowId: context.workflow_id || context.workflowId || null,
    level,
  })
}
