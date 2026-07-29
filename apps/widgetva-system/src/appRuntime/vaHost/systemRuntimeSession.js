import { createWidgetVAHost, makeCoordinationRelation } from 'widgetva-kit'
import { buildWorkspaceComposition } from '../workspace/workspaceComposition.js'
import { buildFirstPartyWorkspaceControlStateAdapter } from '../workspace/workspaceControlStateAdapter.js'
import { cloneJsonValue as clone } from '../../shared/clone.js'

function mapTopologyToWorkspaceSpec(topology) {
  if (topology === 'two-up-comparison') return 'T3'
  if (topology === 'grid-overview') return 'T2'
  return 'T2'
}

export function buildSystemRuntimeWorkspaceSpec(caseDef) {
  return {
    topology: mapTopologyToWorkspaceSpec(caseDef?.topology),
    widgets: (caseDef?.widgets || []).map((widget) => ({
      widgetId: widget.id,
      provider: widget.provider || 'custom',
      role: widget.role || 'support',
      kind: widget.widgetKind || widget.kind || null,
      title: widget.title,
      description: widget.insight || widget.subtitle || '',
      dataBinding: {
        dataset: caseDef?.dataset?.name || null,
      },
      source: widget.source || {
        kind: 'nativeArtifact',
        provider: widget.provider || 'custom',
        providerSpec: widget.providerSpec || null,
      },
      analyticRoles: Array.isArray(widget.metrics) ? widget.metrics : [],
      recognizedKinds: Array.isArray(widget.recognizedKinds) ? [...widget.recognizedKinds] : [],
    })),
    links: (buildWorkspaceComposition(caseDef).links || []).map((link) => {
      if (typeof link.sourceStateRef === 'string' && typeof link.targetStateRef === 'string') {
        const relation = makeCoordinationRelation({
          ...link,
          ref: link.ref || link.linkId || link.id,
          activation: link.activation || link.activationPolicy || 'automatic',
        })
        return {
          ...clone(link),
          linkId: link.linkId || link.id || link.ref,
          ...relation,
          transform: relation.transform || { kind: 'selectionToFilter' },
        }
      }
      const sourceWidgetId = link.sourceWidgetId || link.from || null
      const targetWidgetId = link.targetWidgetId || link.to || null
      return {
        ...clone(link),
        linkId: link.linkId || link.id,
        sourceWidgetId,
        targetWidgetId,
        kind: link.kind || null,
        effect: link.effect || null,
        activationPolicy: link.activationPolicy || null,
        effectConstraint: link.effectConstraint || null,
        description: `${sourceWidgetId || 'source'} -> ${targetWidgetId || 'target'}`,
      }
    }),
  }
}

export function createSystemRuntimeSession(caseDef) {
  const workspaceSpec = clone(buildSystemRuntimeWorkspaceSpec(caseDef))
  const composition = buildWorkspaceComposition(caseDef)
  return createWidgetVAHost().createRuntimeSession({
    sessionId: caseDef?.id || 'widgetva-system-session',
    workspaceId: caseDef?.id || 'main',
    workspaceSpec,
    links: composition.links || [],
    controlStateAdapter: buildFirstPartyWorkspaceControlStateAdapter(),
    initialFocusedWidgetId: composition.selectedWidgetId || null,
    userIntent: caseDef?.summary || '',
  })
}
