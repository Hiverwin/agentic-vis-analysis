import {
  buildDerivedCoordinationRelations,
  buildProviderCoordinationFieldModels,
  makeCoordinationRelation,
} from 'widgetva-kit'
import { cloneJsonValue as clone } from '../../shared/clone.js'

function makeDefaultLinkId(sourceWidgetId, targetWidgetId, linkKind = 'selection_filter') {
  return `${sourceWidgetId}__${linkKind}__${targetWidgetId}`
}

function buildDeclaredLinkDefinitions(caseDefinition, widgets) {
  const declaredLinks = Array.isArray(caseDefinition?.links)
    ? caseDefinition.links
    : Array.isArray(caseDefinition?.coordinationLinks)
      ? caseDefinition.coordinationLinks
      : []
  if (declaredLinks.length === 0) return []

  const widgetIds = new Set((Array.isArray(widgets) ? widgets : []).map((widget) => widget?.id).filter(Boolean))
  return declaredLinks
    .filter((link) => link && typeof link === 'object' && !Array.isArray(link))
    .map((link) => {
      if (typeof link.sourceStateRef === 'string' && typeof link.targetStateRef === 'string') {
        const linkId = link.id || link.linkId || link.ref || `${link.sourceStateRef}__controls__${link.targetStateRef}`
        const relation = makeCoordinationRelation({
          ...link,
          ref: link.ref || linkId,
          activation: link.activation || link.activationPolicy || 'automatic',
        })
        return {
          ...link,
          id: linkId,
          linkId,
          ...relation,
          transform: relation.transform || { kind: 'selectionToFilter' },
        }
      }

      const sourceWidgetId = link.sourceWidgetId || link.from || null
      const targetWidgetId = link.targetWidgetId || link.to || null
      const sourceExists = widgetIds.has(sourceWidgetId)
      const targetExists = widgetIds.has(targetWidgetId)
      const linkKind = link.kind || 'filter'
      const linkId = link.id || link.linkId || makeDefaultLinkId(sourceWidgetId || 'source', targetWidgetId || 'target', linkKind)
      return {
        ...link,
        id: linkId,
        linkId,
        from: sourceExists ? undefined : link.from,
        to: targetExists ? undefined : link.to,
        sourceWidgetId: sourceWidgetId || link.sourceWidgetId || null,
        targetWidgetId: targetWidgetId || link.targetWidgetId || null,
        kind: linkKind,
        effect: link.effect || (linkKind === 'highlight' ? 'applyHighlight' : 'applyFilter'),
        activationPolicy: link.activationPolicy || 'manual',
        effectConstraint: link.effectConstraint || null,
        scope: link.scope || 'workspaceShared.selections',
        mode: link.mode || 'agent-invoked-link',
      }
    })
}

export function buildWorkspaceComposition(caseDefinition) {
  const widgets = clone(caseDefinition?.widgets || [])
  const declaredLinks = buildDeclaredLinkDefinitions(caseDefinition, widgets)
  const declaredLinkRefs = new Set(declaredLinks.map((link) => link?.ref || link?.linkId || link?.id).filter(Boolean))
  const coordinationFieldModels = buildProviderCoordinationFieldModels(widgets, {
    caseId: caseDefinition?.id || 'workspace',
  })
  const derivedLinks = declaredLinks.length > 0
    ? []
    : buildDerivedCoordinationRelations(caseDefinition, coordinationFieldModels)
      .filter((link) => !declaredLinkRefs.has(link?.ref || link?.linkId || link?.id))
  const links = [...declaredLinks, ...derivedLinks]
  const selectedWidgetId = widgets[0]?.id || null

  return {
    caseId: caseDefinition?.id || null,
    topology: caseDefinition?.topology || 'grid-overview',
    widgets,
    links,
    selectedWidgetId,
  }
}

export function cloneWorkspaceComposition(composition) {
  return clone(composition)
}
