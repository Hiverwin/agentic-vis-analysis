import { summarizeWorkspaceSpec, validateWorkspaceSpec } from '../../protocol/workspaceSpec.js'
import {
  makeWorkspacePlanningRequest,
  makeWorkspacePlanningResult,
} from '../../protocol/planning.js'
import { planWorkspace } from '../planning/WorkspacePlanner.js'

function getTitleText(title) {
  if (typeof title === 'string') return title
  if (title && typeof title === 'object' && typeof title.text === 'string') return title.text
  return null
}

export function buildBaseWidgetPlan({ sessionId, spec }) {
  const widgetId = sessionId ? `session_${sessionId}` : 'active_widget'
  return makeWorkspacePlanningResult({
    topology: 'T1',
    widgets: [
      {
        widgetId,
        role: 'primary',
        source: { kind: 'baseSpec' },
      },
    ],
    links: [],
    source: 'runtime_default',
    planningMode: 'minimal_default',
    primaryWidgetId: widgetId,
    title: getTitleText(spec?.title) || 'Active Widget',
  })
}

export function normalizeWorkspacePlan({ sessionId, spec, workspaceSpec, planningRequest = null }) {
  const validation = validateWorkspaceSpec(workspaceSpec)
  if (!workspaceSpec || !validation.ok || !Array.isArray(workspaceSpec.widgets) || workspaceSpec.widgets.length === 0) {
    const normalizedPlanningRequest = makeWorkspacePlanningRequest(planningRequest || {})
    const planned = planWorkspace({
      sessionId,
      spec,
      ...normalizedPlanningRequest,
    })
    return {
      plan: planned || buildBaseWidgetPlan({ sessionId, spec }),
      validation,
      summary: summarizeWorkspaceSpec(workspaceSpec),
      planningSummary: planned || null,
      materializedFromSpec: false,
      materializedFromPlanner: !!planned,
    }
  }

  const primaryWidgetId = workspaceSpec.widgets[0]?.widgetId
  return {
    plan: makeWorkspacePlanningResult({
      topology: workspaceSpec.topology || 'T1',
      widgets: workspaceSpec.widgets,
      links: Array.isArray(workspaceSpec.links) ? workspaceSpec.links : [],
      source: 'workspace_spec',
      planningMode: 'explicit_spec',
      primaryWidgetId,
      title: getTitleText(spec?.title) || 'Workspace',
    }),
    validation,
    summary: summarizeWorkspaceSpec(workspaceSpec),
    planningSummary: null,
    materializedFromSpec: true,
    materializedFromPlanner: false,
  }
}
