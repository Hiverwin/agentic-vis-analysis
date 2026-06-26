import {
  WIDGET_LINK_ACTIVATION_POLICIES,
  WIDGET_LINK_ADVANCED_RESPONSE_KINDS,
  WIDGET_LINK_EFFECT_CONSTRAINTS,
  WIDGET_LINK_KINDS,
} from './widgetLinks.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export const WORKSPACE_TOPOLOGIES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']
export const WIDGET_SOURCE_KINDS = ['baseSpec', 'templateSpec', 'tableView']
export const WIDGET_LINK_PRIMITIVES = [...WIDGET_LINK_KINDS]
export const TRANSFORM_KINDS = ['aggregate']
const LEGACY_WIDGET_LINK_PROPAGATION_POLICIES = ['automatic', 'manual', 'highlightOnly', 'focusOnly']

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function makeWorkspaceSpecSummary(summary = {}) {
  return {
    topology: typeof summary?.topology === 'string' ? summary.topology : null,
    widgetCount: Number.isInteger(summary?.widgetCount) ? summary.widgetCount : 0,
    linkCount: Number.isInteger(summary?.linkCount) ? summary.linkCount : 0,
  }
}

export function validateWorkspaceSpec(spec) {
  if (spec == null) {
    return {
      ok: true,
      issues: [],
    }
  }

  const issues = []

  if (!isPlainObject(spec)) {
    return {
      ok: false,
      issues: ['workspaceSpec must be a plain object.'],
    }
  }

  if (spec.topology != null && !WORKSPACE_TOPOLOGIES.includes(spec.topology)) {
    issues.push(`workspaceSpec.topology must be one of: ${WORKSPACE_TOPOLOGIES.join(', ')}.`)
  }

  if (spec.widgets != null && !Array.isArray(spec.widgets)) {
    issues.push('workspaceSpec.widgets must be an array when provided.')
  }

  if (spec.links != null && !Array.isArray(spec.links)) {
    issues.push('workspaceSpec.links must be an array when provided.')
  }

  if (Array.isArray(spec.widgets)) {
    const widgetIds = new Set()
    spec.widgets.forEach((widget, index) => {
      if (!isPlainObject(widget)) {
        issues.push(`workspaceSpec.widgets[${index}] must be a plain object.`)
        return
      }
      if (!widget.widgetId || typeof widget.widgetId !== 'string') {
        issues.push(`workspaceSpec.widgets[${index}].widgetId must be a non-empty string.`)
      } else {
        if (widgetIds.has(widget.widgetId)) {
          issues.push(`workspaceSpec.widgets[${index}].widgetId must be unique.`)
        }
        widgetIds.add(widget.widgetId)
      }
      if (!widget.role || typeof widget.role !== 'string') {
        issues.push(`workspaceSpec.widgets[${index}].role must be a non-empty string.`)
      }
      if (!isPlainObject(widget.source)) {
        issues.push(`workspaceSpec.widgets[${index}].source must be a plain object.`)
      } else if (!WIDGET_SOURCE_KINDS.includes(widget.source.kind)) {
        issues.push(`workspaceSpec.widgets[${index}].source.kind must be one of: ${WIDGET_SOURCE_KINDS.join(', ')}.`)
      }
      if (widget.source?.kind === 'templateSpec' && !isPlainObject(widget.source.spec)) {
        issues.push(`workspaceSpec.widgets[${index}].source.spec must be provided for templateSpec widgets.`)
      }
      if (widget.dataBinding != null && !isPlainObject(widget.dataBinding)) {
        issues.push(`workspaceSpec.widgets[${index}].dataBinding must be a plain object when provided.`)
      }
      if (Array.isArray(widget.dataBinding?.transforms)) {
        widget.dataBinding.transforms.forEach((transform, transformIndex) => {
          if (!isPlainObject(transform)) {
            issues.push(`workspaceSpec.widgets[${index}].dataBinding.transforms[${transformIndex}] must be a plain object.`)
            return
          }
          if (!TRANSFORM_KINDS.includes(transform.kind)) {
            issues.push(`workspaceSpec.widgets[${index}].dataBinding.transforms[${transformIndex}].kind must be one of: ${TRANSFORM_KINDS.join(', ')}.`)
          }
        })
      }
    })
  }

  if (Array.isArray(spec.links)) {
    const widgetIds = new Set(
      Array.isArray(spec.widgets)
        ? spec.widgets.map((widget) => widget?.widgetId).filter((id) => typeof id === 'string' && id.length > 0)
        : [],
    )
    spec.links.forEach((link, index) => {
      if (!isPlainObject(link)) {
        issues.push(`workspaceSpec.links[${index}] must be a plain object.`)
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
      if (!link.primitive || typeof link.primitive !== 'string') {
        issues.push(`workspaceSpec.links[${index}].primitive must be a non-empty string.`)
      } else if (!WIDGET_LINK_PRIMITIVES.includes(link.primitive)) {
        issues.push(`workspaceSpec.links[${index}].primitive must be one of: ${WIDGET_LINK_PRIMITIVES.join(', ')}.`)
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
          if (link.responseSpec.verificationHints != null && !isPlainObject(link.responseSpec.verificationHints)) {
            issues.push(`workspaceSpec.links[${index}].responseSpec.verificationHints must be a plain object when provided.`)
          }
        }
      }
      if (link.propagationPolicy != null && !LEGACY_WIDGET_LINK_PROPAGATION_POLICIES.includes(link.propagationPolicy)) {
        issues.push(`workspaceSpec.links[${index}].propagationPolicy is a legacy compatibility field and, when provided, must be one of: ${LEGACY_WIDGET_LINK_PROPAGATION_POLICIES.join(', ')}.`)
      }
    })
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

export function summarizeWorkspaceSpec(spec) {
  if (!isPlainObject(spec)) return null
  return makeWorkspaceSpecSummary({
    topology: typeof spec.topology === 'string' ? spec.topology : null,
    widgetCount: Array.isArray(spec.widgets) ? spec.widgets.length : 0,
    linkCount: Array.isArray(spec.links) ? spec.links.length : 0,
  })
}

export function describeWorkspaceSpecSummarySchema() {
  return cloneValue({
    type: 'object',
    properties: {
      topology: { type: ['string', 'null'], enum: [...WORKSPACE_TOPOLOGIES, null] },
      widgetCount: { type: 'integer' },
      linkCount: { type: 'integer' },
    },
  })
}

export function describeWorkspaceSpecSchema() {
  return cloneValue({
    type: 'object',
    properties: {
      topology: { type: 'string', enum: WORKSPACE_TOPOLOGIES },
      widgets: {
        type: 'array',
        items: {
          type: 'object',
          required: ['widgetId', 'role', 'source'],
          properties: {
            widgetId: { type: 'string' },
            role: { type: 'string' },
            kind: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            source: {
              type: 'object',
              required: ['kind'],
              properties: {
                kind: { type: 'string', enum: WIDGET_SOURCE_KINDS },
                spec: { type: 'object' },
                title: { type: 'string' },
              },
            },
            dataBinding: {
              type: 'object',
              properties: {
                sourceDataId: { type: 'string' },
                transforms: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['kind'],
                    properties: {
                      kind: { type: 'string', enum: TRANSFORM_KINDS },
                      groupBy: { type: 'array', items: { type: 'string' } },
                      metrics: { type: 'array', items: { type: 'object' } },
                      sortBy: { type: 'object' },
                      limit: { type: 'integer' },
                    },
                  },
                },
              },
            },
            analyticRoles: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      links: {
        type: 'array',
        items: {
          type: 'object',
          required: ['linkId', 'sourceWidgetId', 'targetWidgetId', 'primitive'],
          properties: {
            linkId: { type: 'string' },
            sourceWidgetId: { type: 'string' },
            targetWidgetId: { type: 'string' },
            primitive: { type: 'string', enum: WIDGET_LINK_PRIMITIVES },
            activationPolicy: { type: 'string', enum: WIDGET_LINK_ACTIVATION_POLICIES },
            effectConstraint: { type: ['string', 'null'], enum: [...WIDGET_LINK_EFFECT_CONSTRAINTS, null] },
            responseSpec: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: WIDGET_LINK_ADVANCED_RESPONSE_KINDS },
                params: { type: 'object' },
                verificationHints: { type: 'object' },
              },
            },
            description: { type: 'string' },
            fieldMapping: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  })
}
