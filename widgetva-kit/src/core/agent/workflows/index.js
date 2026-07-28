import { listMultiWidgetWorkflows, multiWidgetWorkflows } from './multi.js'
import {
  barWorkflows,
  heatmapWorkflows,
  lineWorkflows,
  parallelCoordinatesWorkflows,
  sankeyWorkflows,
  scatterWorkflows,
  listSingleWidgetWorkflows,
  singleWidgetWorkflowList,
  singleWidgetWorkflows,
} from './single.js'
import {
  analysisToAction,
  getAnalysisToAction,
  listAnalysisToAction,
} from './analysisToAction.js'

export {
  analysisToAction,
  getAnalysisToAction,
  listAnalysisToAction,
  listMultiWidgetWorkflows,
  multiWidgetWorkflows,
  singleWidgetWorkflowList,
  singleWidgetWorkflows,
  listSingleWidgetWorkflows,
}

export {
  barWorkflows,
  heatmapWorkflows,
  lineWorkflows,
  parallelCoordinatesWorkflows,
  sankeyWorkflows,
  scatterWorkflows,
}

export function listWorkflows({ scope = null, family = null } = {}) {
  const workflows = [
    ...listSingleWidgetWorkflows(family),
    ...(family
      ? listMultiWidgetWorkflows().filter((workflow) => workflow.families.includes(family))
      : listMultiWidgetWorkflows()),
  ]
  return scope ? workflows.filter((workflow) => workflow.scope === scope) : workflows
}

export function getWorkflow(workflowId) {
  if (typeof workflowId !== 'string' || !workflowId) return null
  return listWorkflows().find((workflow) => {
    const familySlug = workflow.scope === 'single_widget'
      ? `${workflow.families[0]}.${workflow.name}`
      : `multi.${workflow.name}`
    return workflow.id === workflowId || workflow.slug === workflowId || familySlug === workflowId || workflow.name === workflowId
  }) || null
}

export const getSingleWidgetWorkflow = getWorkflow

export default singleWidgetWorkflows
