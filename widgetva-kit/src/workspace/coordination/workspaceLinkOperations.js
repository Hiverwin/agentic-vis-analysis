import { makeLinkRef, parseRef } from '../../contracts/refs-contracts.js'
import {
  makeWidgetLink,
  stripWidgetLinkCompatibilityFields,
} from '../../contracts/widget-links-contracts.js'
import { withLinkSubmodel } from '../state/linkStateModel.js'
import { deriveWorkspaceTopology } from './deriveWorkspaceTopology.js'

function resolveWorkspaceIdentity(runtime) {
  const description = runtime?.store?.readDescription?.() || {}
  return {
    appId: description?.appId || parseRef(description?.widgets?.[0]?.ref)?.appId || 'widgetva-app',
    workspaceId: description?.workspaceId || parseRef(description?.widgets?.[0]?.ref)?.workspaceId || 'main',
  }
}

function resolveLinkEndpointWidgetId(value, widgets = []) {
  if (typeof value !== 'string' || value.length === 0) return null
  const parsedWidgetId = parseRef(value)?.widgetId
  if (parsedWidgetId) return parsedWidgetId
  const byWidgetRef = widgets.find((widget) => widget?.resolveWidgetRef?.() === value)?.resolveWidgetId?.()
  if (byWidgetRef) return byWidgetRef
  const byWidgetId = widgets.find((widget) => widget?.resolveWidgetId?.() === value)?.resolveWidgetId?.()
  if (byWidgetId) return byWidgetId
  return value
}

function inferLinkId(link = {}, widgets = []) {
  const explicitId = parseRef(link?.ref)?.linkId || link?.linkId || null
  if (explicitId) return explicitId
  const sourceRef = link?.from || link?.sourceRef || null
  const targetRef = link?.to || link?.targetRef || null
  const sourceWidgetId = link?.sourceWidgetId
    || resolveLinkEndpointWidgetId(sourceRef, widgets)
    || 'source'
  const targetWidgetId = link?.targetWidgetId
    || resolveLinkEndpointWidgetId(targetRef, widgets)
    || 'target'
  const linkKind = link?.kind || 'link'
  return `${sourceWidgetId}_${linkKind}_${targetWidgetId}`
}

export function normalizeWorkspaceLink(link, widgets = [], runtime = null) {
  const { appId, workspaceId } = resolveWorkspaceIdentity(runtime)
  const linkId = inferLinkId(link, widgets)
  const sourceWidgetId = link?.sourceWidgetId
    || resolveLinkEndpointWidgetId(link?.from || link?.sourceRef || null, widgets)
    || null
  const targetWidgetId = link?.targetWidgetId
    || resolveLinkEndpointWidgetId(link?.to || link?.targetRef || null, widgets)
    || null
  return makeWidgetLink({
    ...link,
    ...(sourceWidgetId ? { sourceWidgetId } : {}),
    ...(targetWidgetId ? { targetWidgetId } : {}),
    ref: link?.ref || makeLinkRef({ appId, workspaceId, linkId }),
  })
}

export function listWorkspaceLinks(workspace) {
  const registeredLinks = workspace.runtime?.store?.listLinks?.() || []
  if (registeredLinks.length > 0) {
    return registeredLinks.map((link) => stripWidgetLinkCompatibilityFields(link))
  }
  return workspace.links.map((link) => stripWidgetLinkCompatibilityFields(link))
}

export function getWorkspaceLink(workspace, refOrId) {
  const links = listWorkspaceLinks(workspace)
  return links.find((link) => (
    link?.ref === refOrId
    || parseRef(link?.ref)?.linkId === refOrId
    || link?.linkId === refOrId
  )) || null
}

export function readWorkspaceLinkTopology(workspace) {
  const widgets = workspace.describe()?.widgets
    || workspace.listWidgets().map((widget) => widget?.describe?.()).filter(Boolean)
  return deriveWorkspaceTopology({
    widgets,
    links: listWorkspaceLinks(workspace),
  })
}

function writeSharedLinkState(workspace) {
  workspace.updateSharedCoordinationState((shared) => withLinkSubmodel(shared, {
    definitions: workspace.links,
    topology: readWorkspaceLinkTopology(workspace),
  }))
}

export function registerWorkspaceLink(workspace, link) {
  if (!link || typeof link !== 'object') {
    throw new Error('WidgetWorkspace.registerLink requires a link object.')
  }
  const normalizedLink = normalizeWorkspaceLink(link, workspace.widgets, workspace.runtime)
  if (typeof workspace.runtime?.store?.registerLink === 'function') {
    workspace.runtime.store.registerLink(normalizedLink)
  }
  const existingIndex = workspace.links.findIndex((entry) => entry?.ref === normalizedLink.ref)
  if (existingIndex >= 0) {
    workspace.links.splice(existingIndex, 1, normalizedLink)
  } else {
    workspace.links.push(normalizedLink)
  }
  writeSharedLinkState(workspace)
  return normalizedLink
}

export function removeWorkspaceLink(workspace, refOrId) {
  const existing = getWorkspaceLink(workspace, refOrId)
  if (!existing) return null
  if (typeof workspace.runtime?.store?.removeLinkDefinition === 'function') {
    workspace.runtime.store.removeLinkDefinition(existing.ref)
  } else if (workspace.runtime?.store?.links && existing.ref in workspace.runtime.store.links) {
    delete workspace.runtime.store.links[existing.ref]
  }
  workspace.links = workspace.links.filter((entry) => entry?.ref !== existing.ref)
  writeSharedLinkState(workspace)
  return existing
}

export function describeWorkspaceComposition(workspace) {
  return {
    widgetRefs: workspace.listWidgets().map((widget) => widget?.resolveWidgetRef?.()).filter(Boolean),
    widgetIds: workspace.listWidgets().map((widget) => widget?.resolveWidgetId?.()).filter(Boolean),
    links: listWorkspaceLinks(workspace),
    topology: readWorkspaceLinkTopology(workspace),
  }
}
