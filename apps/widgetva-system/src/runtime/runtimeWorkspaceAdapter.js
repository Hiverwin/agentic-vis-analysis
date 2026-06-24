import {
  createBarWidget,
  createHeatmapWidget,
  createLineWidget,
  createParallelCoordinatesWidget,
  createSankeyWidget,
  createScatterWidget,
} from '../../../../widgetva-kit/src/index.js'
import { makeWidgetRef } from '../../../../widgetva-kit/src/core/protocol/refs.js'
import {
  readDeclaredLinkEffect,
  readLinkActivationPolicy,
  readLinkEffectConstraint,
} from '../../../../widgetva-kit/src/core/runtime/linkSemantics.js'
import { normalizeWidgetLink } from '../../../../widgetva-kit/src/core/protocol/widgetLinks.js'
import { buildWorkspaceComposition } from './workspaceComposition.js'
import { createWidgetRuntimeSource, createWidgetRuntimeSpec } from './carsWidgetDerivation.js'
import { createProviderWidgetAdapter } from './providerWidgetAdapters.js'

const WIDGET_CONSTRUCTORS = {
  scatter: createScatterWidget,
  bar: createBarWidget,
  line: createLineWidget,
  heatmap: createHeatmapWidget,
  parallelCoordinates: createParallelCoordinatesWidget,
  sankey: createSankeyWidget,
}

function mapTopologyToWorkspaceSpec(topology) {
  if (topology === 'two-up-comparison') return 'T3'
  if (topology === 'grid-overview') return 'T2'
  return 'T2'
}

export function buildRuntimeWorkspaceSpec(caseDef) {
  const rows = caseDef?.dataset?.rowsData || []
  return {
    topology: mapTopologyToWorkspaceSpec(caseDef?.topology),
    widgets: (caseDef?.widgets || []).map((widget) => ({
      widgetId: widget.id,
      provider: widget.provider || 'custom',
      role: widget.role || 'support',
      kind: widget.widgetKind || null,
      title: widget.title,
      description: widget.insight || widget.subtitle || '',
      dataBinding: {
        dataset: caseDef?.dataset?.name || null,
      },
      source: createWidgetRuntimeSource(widget, rows),
      analyticRoles: Array.isArray(widget.metrics) ? widget.metrics : [],
    })),
    links: (buildWorkspaceComposition(caseDef).links || []).map((link) => {
      const normalizedLink = normalizeWidgetLink(link) || {}
      return {
        ...normalizedLink,
        linkId: link.id,
        sourceWidgetId: link.from,
        targetWidgetId: link.to,
        primitive: normalizedLink.primitive || null,
        effect: readDeclaredLinkEffect(link),
        activationPolicy: readLinkActivationPolicy(link),
        effectConstraint: readLinkEffectConstraint(link),
        description: `${link.from} -> ${link.to}`,
      }
    }),
  }
}

export function createWidgetInstances(runtime, caseDef) {
  const rows = caseDef?.dataset?.rowsData || []
  const compositionWidgets = buildWorkspaceComposition(caseDef).widgets || []
  return compositionWidgets.map((widget) => {
    const kind = widget?.widgetKind || null
    const createWidget = kind ? WIDGET_CONSTRUCTORS[kind] : null
    if (typeof createWidget !== 'function') return null
    const spec = createWidgetRuntimeSpec(widget, rows)
    const widgetRef = makeWidgetRef({
      workspaceId: caseDef?.id || 'main',
      widgetId: widget.id,
    })
    const widgetAdapter = createProviderWidgetAdapter(kind, widget?.provider || 'vega-lite')
    return createWidget({
      runtime,
      widgetAdapter,
      widgetRef,
      widgetId: widget.id,
      spec,
    })
  }).filter(Boolean)
}
