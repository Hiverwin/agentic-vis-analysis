import {
  makeWorkspacePlanningRequest,
  makeWorkspacePlanningResult,
} from '../../../agent/planning/workspacePlanningShapes.js'
import { planWorkspace } from '../../../agent/planning/WorkspacePlanner.js'
import {
  WIDGET_LINK_ACTIVATION_POLICIES,
  WIDGET_LINK_ADVANCED_RESPONSE_KINDS,
  WIDGET_LINK_EFFECT_CONSTRAINTS,
  WIDGET_LINK_KINDS,
} from '../../../../schemas/widget-links.schema.js'

const WORKSPACE_TOPOLOGIES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function summarizeRequestedWorkspaceSpec(spec) {
  if (!isPlainObject(spec)) return null
  return {
    topology: typeof spec.topology === 'string' ? spec.topology : null,
    widgetCount: Array.isArray(spec.widgets) ? spec.widgets.length : 0,
    linkCount: Array.isArray(spec.links) ? spec.links.length : 0,
  }
}

function validateRequestedWorkspaceSpec(spec) {
  if (spec == null) {
    return {
      ok: true,
      issues: [],
    }
  }

  if (!isPlainObject(spec)) {
    return {
      ok: false,
      issues: ['workspaceSpec must be a plain object.'],
    }
  }

  const issues = []

  if (spec.topology != null && !WORKSPACE_TOPOLOGIES.includes(spec.topology)) {
    issues.push(`workspaceSpec.topology must be one of: ${WORKSPACE_TOPOLOGIES.join(', ')}.`)
  }

  if (spec.widgets != null && !Array.isArray(spec.widgets)) {
    issues.push('workspaceSpec.widgets must be an array when provided.')
  }

  if (spec.links != null && !Array.isArray(spec.links)) {
    issues.push('workspaceSpec.links must be an array when provided.')
  }

  const widgetIds = new Set()
  if (Array.isArray(spec.widgets)) {
    spec.widgets.forEach((widget, index) => {
      if (!isPlainObject(widget)) {
        issues.push(`workspaceSpec.widgets[${index}] must be a plain object.`)
        return
      }
      if (!widget.widgetId || typeof widget.widgetId !== 'string') {
        issues.push(`workspaceSpec.widgets[${index}].widgetId must be a non-empty string.`)
        return
      }
      if (widgetIds.has(widget.widgetId)) {
        issues.push(`workspaceSpec.widgets[${index}].widgetId must be unique.`)
        return
      }
      widgetIds.add(widget.widgetId)
    })
  }

  if (Array.isArray(spec.links)) {
    spec.links.forEach((link, index) => {
      if (!isPlainObject(link)) {
        issues.push(`workspaceSpec.links[${index}] must be a plain object.`)
        return
      }
      const isStateRelation = typeof link.sourceStateRef === 'string' && typeof link.targetStateRef === 'string'
      if (isStateRelation) {
        const linkRef = link.ref || link.linkId || link.id
        if (!linkRef || typeof linkRef !== 'string') {
          issues.push(`workspaceSpec.links[${index}].ref or linkId must be a non-empty string for state-to-state coordination relations.`)
        }
        if (!link.sourceStateRef || typeof link.sourceStateRef !== 'string') {
          issues.push(`workspaceSpec.links[${index}].sourceStateRef must be a non-empty string.`)
        }
        if (!link.targetStateRef || typeof link.targetStateRef !== 'string') {
          issues.push(`workspaceSpec.links[${index}].targetStateRef must be a non-empty string.`)
        }
        if (link.relation != null && link.relation !== 'controls' && link.relation !== 'derives') {
          issues.push(`workspaceSpec.links[${index}].relation must be "controls" or "derives" when provided.`)
        }
        if (link.transform != null) {
          if (!isPlainObject(link.transform)) {
            issues.push(`workspaceSpec.links[${index}].transform must be a plain object when provided.`)
          } else if (!link.transform.kind || typeof link.transform.kind !== 'string') {
            issues.push(`workspaceSpec.links[${index}].transform.kind must be a non-empty string when transform is provided.`)
          }
        }
        return
      }
      if (!link.linkId || typeof link.linkId !== 'string') {
        issues.push(`workspaceSpec.links[${index}].linkId must be a non-empty string.`)
      }
      if (!link.sourceWidgetId || typeof link.sourceWidgetId !== 'string') {
        issues.push(`workspaceSpec.links[${index}].sourceWidgetId must be a non-empty string.`)
      } else if (widgetIds.size > 0 && !widgetIds.has(link.sourceWidgetId)) {
        issues.push(`workspaceSpec.links[${index}].sourceWidgetId must reference an existing widgetId.`)
      }
      if (!link.targetWidgetId || typeof link.targetWidgetId !== 'string') {
        issues.push(`workspaceSpec.links[${index}].targetWidgetId must be a non-empty string.`)
      } else if (widgetIds.size > 0 && !widgetIds.has(link.targetWidgetId)) {
        issues.push(`workspaceSpec.links[${index}].targetWidgetId must reference an existing widgetId.`)
      }
      if (!link.kind || typeof link.kind !== 'string') {
        issues.push(`workspaceSpec.links[${index}].kind must be a non-empty string.`)
      } else if (!WIDGET_LINK_KINDS.includes(link.kind)) {
        issues.push(`workspaceSpec.links[${index}].kind must be one of: ${WIDGET_LINK_KINDS.join(', ')}.`)
      }
      if (link.activationPolicy != null && !WIDGET_LINK_ACTIVATION_POLICIES.includes(link.activationPolicy)) {
        issues.push(`workspaceSpec.links[${index}].activationPolicy must be one of: ${WIDGET_LINK_ACTIVATION_POLICIES.join(', ')}.`)
      }
      if (link.effectConstraint != null && !WIDGET_LINK_EFFECT_CONSTRAINTS.includes(link.effectConstraint)) {
        issues.push(`workspaceSpec.links[${index}].effectConstraint must be one of: ${WIDGET_LINK_EFFECT_CONSTRAINTS.join(', ')}.`)
      }
      if (link.responseSpec != null) {
        if (!isPlainObject(link.responseSpec)) {
          issues.push(`workspaceSpec.links[${index}].responseSpec must be a plain object when provided.`)
        } else {
          if (!link.responseSpec.kind || typeof link.responseSpec.kind !== 'string') {
            issues.push(`workspaceSpec.links[${index}].responseSpec.kind must be a non-empty string when responseSpec is provided.`)
          } else if (!WIDGET_LINK_ADVANCED_RESPONSE_KINDS.includes(link.responseSpec.kind)) {
            issues.push(`workspaceSpec.links[${index}].responseSpec.kind must be one of: ${WIDGET_LINK_ADVANCED_RESPONSE_KINDS.join(', ')}.`)
          }
          if (link.responseSpec.params != null && !isPlainObject(link.responseSpec.params)) {
            issues.push(`workspaceSpec.links[${index}].responseSpec.params must be a plain object when provided.`)
          }
        }
      }
    })
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

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
  const validation = validateRequestedWorkspaceSpec(workspaceSpec)
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
      summary: summarizeRequestedWorkspaceSpec(workspaceSpec),
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
    summary: summarizeRequestedWorkspaceSpec(workspaceSpec),
    planningSummary: null,
    materializedFromSpec: true,
    materializedFromPlanner: false,
  }
}
