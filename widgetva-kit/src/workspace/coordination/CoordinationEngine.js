import {
  countSelectedRows,
  countSelectedRowsForSelections,
  mapSelectionToTargetSelection,
  rowMatchesSelection,
} from '../../core/runtime/materializers/state/selectionHelpers.js'
import {
  readSelectionByWidgetView,
  readSelectionRegistry,
  withSelectionSubmodel,
} from '../state/selectionStateModel.js'
import { deriveHighlightState, withHighlightSubmodel } from '../state/highlightStateModel.js'
import { withFocusSubmodel } from '../state/focusStateModel.js'
import { buildSelectionStateInput } from '../../core/runtime/materializers/state/selectionStateShape.js'
import { buildViewZoomState } from '../../core/runtime/materializers/state/viewStateMetadata.js'
import { makeSelectionState } from '../../contracts/state-contracts.js'
import { makeCoordinationRelation, makeCoordinationRelationMap } from '../../contracts/coordination-contracts.js'
import {
  makeWidgetLink,
} from '../../contracts/widget-links-contracts.js'
import { deriveWorkspaceTopology, isTopologyLink } from './deriveWorkspaceTopology.js'
import { updateSharedStateInStore } from '../state/workspaceSharedStateMutators.js'
import {
  readAppliedLinkEffect,
  readDeclaredLinkEffect,
  readLinkActivationPolicy,
  readLinkEffectConstraint,
  readLinkResponseSpec,
} from './linkSemantics.js'
import { normalizePropagationSkipReason } from './propagationReasons.js'
import { readStateByRef, readWidgetRefFromStateRef } from '../store/workspaceStoreReaders.js'
import { patchStateByRef } from '../store/workspaceStoreMutators.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function valuesEqual(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function buildLinkStatePatch({ beforeState, afterState, affectedRefs = [] } = {}) {
  const patch = {}
  const refs = [...new Set((Array.isArray(affectedRefs) ? affectedRefs : []).filter(Boolean))]
  for (const ref of refs) {
    if (afterState?.widgets?.[ref]) {
      patch[ref] = clone(afterState.widgets[ref])
    }
  }
  if (!valuesEqual(beforeState?.shared, afterState?.shared)) {
    patch.shared = clone(afterState?.shared || {})
  }
  return patch
}

function arraysEqual(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function uniqueValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => value != null))]
}

function makeCoordinationEngineLinkKindEntry(entry = {}) {
  return {
    name: entry?.name || '',
    appliedStatePaths: Array.isArray(entry?.appliedStatePaths) ? [...entry.appliedStatePaths] : [],
  }
}

function makeCoordinationEngineCapabilities(capabilities = {}) {
  return {
    propagationExecution: false,
    propagationPlan: false,
    effectCollection: false,
    consistencyEvaluation: false,
    ...capabilities,
  }
}

function makeCoordinationEngineSummary(summary = {}) {
  return {
    linkKindCount: summary?.linkKindCount || 0,
    linkKinds: Array.isArray(summary?.linkKinds)
      ? summary.linkKinds.map((entry) => makeCoordinationEngineLinkKindEntry(entry))
      : [],
    linkCount: summary?.linkCount || 0,
    coordinationLinkCount: summary?.coordinationLinkCount || 0,
    structuralLinkCount: summary?.structuralLinkCount || 0,
    automaticLinkCount: summary?.automaticLinkCount || 0,
    manualLinkCount: summary?.manualLinkCount || 0,
    topology: summary?.topology || null,
    capabilities: makeCoordinationEngineCapabilities(summary?.capabilities),
  }
}

function readWidgetIdFromRef(ref) {
  if (typeof ref !== 'string' || ref.length === 0) return null
  const marker = '/widget/'
  const index = ref.lastIndexOf(marker)
  if (index < 0) return null
  const rest = ref.slice(index + marker.length)
  const widgetId = rest.split('/')[0]
  return widgetId || null
}

function isCoordinationRelation(link) {
  return Boolean(
    link
    && typeof link === 'object'
    && typeof link.sourceStateRef === 'string'
    && typeof link.targetStateRef === 'string',
  )
}

function readRelationActivationPolicy(relation) {
  const activation = relation?.activation || relation?.activationPolicy
  return activation === 'manual' ? 'manual' : 'automatic'
}

function readEffectFromCoordinationTransform(transform = {}) {
  switch (transform?.kind) {
    case 'selectionToFilter':
    case 'intervalToFilter':
    case 'domainToFilter':
      return 'applyFilter'
    case 'selectionToHighlight':
      return 'applyHighlight'
    case 'selectionToReencode':
    case 'domainToReencode':
    case 'reencodeToReencode':
      return 'reencodeView'
    case 'selectionToSelection':
    case 'identity':
      return 'shareSelection'
    case 'intervalToDomain':
    case 'domainToDomain':
      return 'syncDomain'
    default:
      return null
  }
}

function makeCoordinationRelationLink(relation) {
  const normalizedRelation = makeCoordinationRelation(relation)
  const sourceWidgetId = readWidgetIdFromRef(normalizedRelation.sourceStateRef)
  const targetWidgetRef = readWidgetRefFromStateRef(normalizedRelation.targetStateRef)
  const targetWidgetId = readWidgetIdFromRef(targetWidgetRef)
  const transform = normalizedRelation.transform && typeof normalizedRelation.transform === 'object'
    ? clone(normalizedRelation.transform)
    : {}
  return {
    ...clone(normalizedRelation),
    kind: transform.kind || normalizedRelation.relation || 'coordination',
    effect: readEffectFromCoordinationTransform(transform),
    from: normalizedRelation.sourceStateRef,
    to: targetWidgetRef,
    sourceStateRef: normalizedRelation.sourceStateRef,
    targetStateRef: normalizedRelation.targetStateRef,
    sourceWidgetId,
    targetWidgetId,
    relation: normalizedRelation.relation || 'controls',
    transform,
    fieldMapping: Array.isArray(transform.fieldMapping) ? clone(transform.fieldMapping) : [],
    activationPolicy: readRelationActivationPolicy(normalizedRelation),
    effectConstraint: null,
    responseSpec: null,
    isCoordinationRelation: true,
  }
}

function stableKey(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function categoricalValuesFromSelection(selection) {
  const predicates = Array.isArray(selection?.predicates) ? selection.predicates : []
  return uniqueValues(
    predicates
      .filter((predicate) => predicate?.op === 'equals' || predicate?.op === 'eq' || predicate?.op === 'in')
      .flatMap((predicate) => (Array.isArray(predicate?.value) ? predicate.value : [predicate?.value])),
  )
}

function readChannelDomain(selection = {}, sourceChannel = null) {
  if (!sourceChannel) return null
  const channelState = selection?.channels?.[sourceChannel]
  if (Array.isArray(channelState?.domain)) return channelState.domain
  const domainKey = `${sourceChannel}Domain`
  if (Array.isArray(selection?.domain?.[domainKey])) return selection.domain[domainKey]
  if (Array.isArray(selection?.domain?.[sourceChannel])) return selection.domain[sourceChannel]
  if (Array.isArray(selection?.value?.[sourceChannel])) return selection.value[sourceChannel]
  return null
}

function readChannelField(selection = {}, sourceChannel = null) {
  if (!sourceChannel) return null
  const channelState = selection?.channels?.[sourceChannel]
  if (typeof channelState?.field === 'string' && channelState.field.length > 0) return channelState.field
  const fields = Array.isArray(selection?.fields) ? selection.fields : []
  if (sourceChannel === 'x') return fields[0] || selection?.field || null
  if (sourceChannel === 'y') return fields[1] || null
  return null
}

function mapIntervalSelectionToFilter(selection = {}, channelMapping = []) {
  const predicates = []
  for (const mapping of Array.isArray(channelMapping) ? channelMapping : []) {
    const sourceChannel = mapping?.sourceChannel
    const targetField = mapping?.targetField
    const domain = readChannelDomain(selection, sourceChannel)
    if (typeof targetField === 'string' && targetField.length > 0 && Array.isArray(domain) && domain.length >= 2) {
      predicates.push({ field: targetField, op: 'between', value: domain })
    }
  }
  if (predicates.length === 0) return null
  return {
    ...selection,
    predicates,
    domain: selection?.domain || null,
  }
}

function mapIntervalSelectionToDomain(selection = {}, channelMapping = []) {
  const domain = {}
  for (const mapping of Array.isArray(channelMapping) ? channelMapping : []) {
    const sourceChannel = mapping?.sourceChannel
    const targetChannel = mapping?.targetChannel || sourceChannel
    const sourceDomain = readChannelDomain(selection, sourceChannel)
    if (Array.isArray(sourceDomain) && sourceDomain.length >= 2) {
      domain[`${targetChannel}Domain`] = sourceDomain
    }
  }
  if (Object.keys(domain).length === 0) return null
  return {
    ...selection,
    domain,
  }
}

function normalizeDomainValue(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object' && Array.isArray(value.domain)) return value.domain
  return null
}

function buildPredicateFromDomain(targetField, domain) {
  if (typeof targetField !== 'string' || targetField.length === 0) return null
  if (!Array.isArray(domain) || domain.length < 2) return null
  const lower = domain[0]
  const upper = domain[1]
  const hasLower = lower != null
  const hasUpper = upper != null
  if (hasLower && hasUpper) return { field: targetField, op: 'between', value: [lower, upper] }
  if (hasLower) return { field: targetField, op: 'gte', value: lower }
  if (hasUpper) return { field: targetField, op: 'lte', value: upper }
  return null
}

function mapDomainStateToFilter(sourceValue = {}, channelMapping = []) {
  const predicates = []
  const zoom = sourceValue?.zoom && typeof sourceValue.zoom === 'object' ? sourceValue.zoom : sourceValue
  for (const mapping of Array.isArray(channelMapping) ? channelMapping : []) {
    const sourceChannel = mapping?.sourceChannel
    const targetField = mapping?.targetField
    const domain = normalizeDomainValue(
      sourceChannel === 'x'
        ? sourceValue?.xDomain || zoom?.xDomain || zoom?.domain?.xDomain
        : sourceChannel === 'y'
          ? sourceValue?.yDomain || zoom?.yDomain || zoom?.domain?.yDomain
          : sourceValue?.[`${sourceChannel}Domain`] || zoom?.[`${sourceChannel}Domain`],
    )
    const predicate = buildPredicateFromDomain(targetField, domain)
    if (predicate) predicates.push(predicate)
  }
  if (predicates.length === 0) return null
  return {
    kind: 'predicate',
    predicates,
    domain: {
      ...(sourceValue?.xDomain ? { xDomain: sourceValue.xDomain } : {}),
      ...(sourceValue?.yDomain ? { yDomain: sourceValue.yDomain } : {}),
    },
  }
}

function mapDomainStateToDomain(sourceValue = {}, channelMapping = []) {
  const domain = {}
  const zoom = sourceValue?.zoom && typeof sourceValue.zoom === 'object' ? sourceValue.zoom : sourceValue
  for (const mapping of Array.isArray(channelMapping) ? channelMapping : []) {
    const sourceChannel = mapping?.sourceChannel
    const targetChannel = mapping?.targetChannel || sourceChannel
    const sourceDomain = normalizeDomainValue(
      sourceChannel === 'x'
        ? sourceValue?.xDomain || zoom?.xDomain || zoom?.domain?.xDomain
        : sourceChannel === 'y'
          ? sourceValue?.yDomain || zoom?.yDomain || zoom?.domain?.yDomain
          : sourceValue?.[`${sourceChannel}Domain`] || zoom?.[`${sourceChannel}Domain`],
    )
    if (Array.isArray(sourceDomain) && sourceDomain.length >= 2) {
      domain[`${targetChannel}Domain`] = sourceDomain
    }
  }
  if (Object.keys(domain).length === 0) return null
  return { domain }
}

function mapSelectionToReencode(activeSelection = null, link = {}) {
  const transform = link?.transform || {}
  const mappedSelection = activeSelection
    ? mapSelectionToTargetSelection(activeSelection, transform.fieldMapping)
    : null
  if (!mappedSelection) return null
  return {
    reencode: {
      ...(transform.reencode || {}),
      sourceAction: 'coordination.selectionToReencode',
      relationRef: link?.ref || null,
      sourceStateRef: link?.sourceStateRef || null,
      targetStateRef: link?.targetStateRef || null,
      sourceSelection: mappedSelection,
    },
  }
}

function mapDomainStateToReencode(sourceValue = {}, link = {}) {
  const transform = link?.transform || {}
  const mappedFilter = mapDomainStateToFilter(sourceValue, transform.channelMapping)
  const predicates = Array.isArray(mappedFilter?.predicates) ? mappedFilter.predicates : []
  if (predicates.length === 0) return null
  return {
    reencode: {
      ...(transform.reencode || {}),
      sourceAction: 'coordination.domainToReencode',
      relationRef: link?.ref || null,
      sourceStateRef: link?.sourceStateRef || null,
      targetStateRef: link?.targetStateRef || null,
      sourcePredicate: predicates.length === 1 ? predicates[0] : predicates,
    },
  }
}

function mapReencodeStateToReencode(sourceValue = {}, link = {}) {
  const transform = link?.transform || {}
  if (!sourceValue || typeof sourceValue !== 'object' || Array.isArray(sourceValue)) return null
  const firstFieldMapping = Array.isArray(transform.fieldMapping) ? transform.fieldMapping[0] : null
  const targetField = firstFieldMapping?.targetField || sourceValue.categoryField || sourceValue.field || null
  const sortField = sourceValue.sortField || sourceValue.measureField || (
    targetField && sourceValue.field !== targetField ? sourceValue.field : null
  )
  return {
    reencode: {
      ...clone(sourceValue),
      ...(transform.reencode || {}),
      sourceAction: 'coordination.reencodeToReencode',
      relationRef: link?.ref || null,
      sourceStateRef: link?.sourceStateRef || null,
      targetStateRef: link?.targetStateRef || null,
      ...(targetField ? { field: targetField } : {}),
      ...(sortField ? { sortField } : {}),
      mapping: Array.isArray(transform.reencodeMapping) ? clone(transform.reencodeMapping) : sourceValue.mapping,
    },
  }
}

function mapCoordinationSourceToTarget({ activeSelection, sourceValue, link }) {
  const transform = link?.transform || {}
  switch (transform.kind) {
    case 'intervalToFilter':
      return mapIntervalSelectionToFilter(activeSelection, transform.channelMapping)
    case 'intervalToDomain':
      return mapIntervalSelectionToDomain(activeSelection, transform.channelMapping)
    case 'domainToFilter':
      return mapDomainStateToFilter(sourceValue, transform.channelMapping)
    case 'domainToDomain':
      return mapDomainStateToDomain(sourceValue, transform.channelMapping)
    case 'selectionToReencode':
      return mapSelectionToReencode(activeSelection, link)
    case 'domainToReencode':
      return mapDomainStateToReencode(sourceValue, link)
    case 'reencodeToReencode':
      return mapReencodeStateToReencode(sourceValue, link)
    case 'selectionToFilter':
    case 'selectionToHighlight':
    case 'selectionToSelection':
    case 'identity':
    default:
      return activeSelection ? mapSelectionToTargetSelection(activeSelection, link?.fieldMapping) : null
  }
}

const EFFECT_METADATA = {
  applyFilter: {
    effectKind: 'filtersWidget',
    defaultDescription: 'Filter propagation',
    appliedStatePaths: ['transforms', 'data.currentDataRef', 'feedback.inboundLinkIds'],
  },
  applyHighlight: {
    effectKind: 'highlightsItems',
    defaultDescription: 'Highlight propagation',
    appliedStatePaths: ['feedback.highlightedKeys', 'feedback.inboundLinkIds'],
  },
  focusTarget: {
    effectKind: 'focusesWidget',
    defaultDescription: 'Focus propagation',
    appliedStatePaths: ['shared.focusedWidget', 'shared.focus'],
  },
  syncDomain: {
    effectKind: 'updatesViewDomain',
    defaultDescription: 'Domain synchronization',
    appliedStatePaths: ['view.xDomain', 'view.yDomain', 'feedback.inboundLinkIds'],
  },
  reencodeView: {
    effectKind: 'reencodesView',
    defaultDescription: 'Reencode propagation',
    appliedStatePaths: ['view.reencode', 'feedback.inboundLinkIds'],
  },
  shareSelection: {
    effectKind: 'sharesSelectionState',
    defaultDescription: 'Selection sharing',
    appliedStatePaths: ['selections', 'data.selectedCount', 'feedback.linkedSourceRefs'],
  },
  transformView: {
    effectKind: 'transformsView',
    defaultDescription: 'View transformation',
    appliedStatePaths: ['transforms', 'feedback.inboundLinkIds', 'feedback.linkedSourceRefs'],
  },
  transformDataView: {
    effectKind: 'transformsDataView',
    defaultDescription: 'Data-view transformation',
    appliedStatePaths: ['transforms', 'feedback.inboundLinkIds', 'feedback.linkedSourceRefs'],
  },
  transformStructure: {
    effectKind: 'transformsStructure',
    defaultDescription: 'Structure transformation',
    appliedStatePaths: ['transforms', 'feedback.inboundLinkIds', 'feedback.linkedSourceRefs'],
  },
}

function markRows(rows, marker, predicate) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    [marker]: Boolean(predicate?.(row)),
  }))
}

function countRowsMatching(rows, predicate) {
  if (!Array.isArray(rows) || typeof predicate !== 'function') return 0
  return rows.filter((row) => predicate(row)).length
}

function readRuntimeRows(runtimeEntry = null) {
  const baseRows = Array.isArray(runtimeEntry?.baseRows)
    ? runtimeEntry.baseRows
    : Array.isArray(runtimeEntry?.rows)
      ? runtimeEntry.rows
      : []
  return {
    baseRows,
    visibleRows: Array.isArray(runtimeEntry?.rows) ? runtimeEntry.rows : baseRows,
  }
}

function readEffectMetadata(effect) {
  return EFFECT_METADATA[effect] || null
}

function describeLinkEffect(link) {
  const appliedEffect = readAppliedLinkEffect(link)
  const metadata = readEffectMetadata(appliedEffect)
  if (!metadata) return null
  return {
    kind: metadata.effectKind,
    targetRef: link.to,
    description: link.description || metadata.defaultDescription,
  }
}

function describeAppliedStatePathsForEffect(effect) {
  return [...(readEffectMetadata(effect)?.appliedStatePaths || [])]
}

export class CoordinationEngine {
  constructor(args = {}) {
    const store = args?.store || args
    this.store = store
  }

  resolveWidgetRefById(widgetId) {
    if (typeof widgetId !== 'string' || widgetId.length === 0) return null
    const descriptionWidgets = this.store.readDescription?.()?.widgets || []
    const describedWidget = descriptionWidgets.find((widget) => widget?.widgetId === widgetId)
    if (typeof describedWidget?.ref === 'string' && describedWidget.ref.length > 0) {
      return describedWidget.ref
    }
    const listedWidget = this.store.listWidgetDescriptions?.()?.find((widget) => widget?.widgetId === widgetId)
    return typeof listedWidget?.ref === 'string' && listedWidget.ref.length > 0 ? listedWidget.ref : null
  }

  resolveWidgetEndpointRef(refOrWidgetId) {
    if (typeof refOrWidgetId !== 'string' || refOrWidgetId.length === 0) return null
    if (refOrWidgetId.includes('/widget/')) return refOrWidgetId
    return this.resolveWidgetRefById(refOrWidgetId) || refOrWidgetId
  }

  listLinks() {
    const deduped = new Map()
    const stateRelations = makeCoordinationRelationMap(this.store.readState?.()?.coordination?.relations || {})
    // Canonical coordination relations are state-owned. The registry fallback
    // only serves workspaces that have not been migrated to that state shape.
    const rawLinks = Object.keys(stateRelations).length > 0
      ? Object.values(stateRelations)
      : (this.store.listLinks?.() || [])
    for (const rawLink of rawLinks) {
      const normalizedLink = isCoordinationRelation(rawLink)
        ? makeCoordinationRelationLink(rawLink)
        : makeWidgetLink(rawLink)
      const hydratedLink = {
        ...normalizedLink,
        from: normalizedLink?.isCoordinationRelation
          ? normalizedLink.sourceStateRef
          : this.resolveWidgetEndpointRef(normalizedLink?.from)
            || this.resolveWidgetRefById(normalizedLink?.sourceWidgetId),
        to: normalizedLink?.isCoordinationRelation
          ? normalizedLink.to
          : this.resolveWidgetEndpointRef(normalizedLink?.to)
            || this.resolveWidgetRefById(normalizedLink?.targetWidgetId),
      }
      const dedupeKey = [
        hydratedLink?.from || null,
        hydratedLink?.to || null,
        hydratedLink?.kind || null,
        hydratedLink?.effect || null,
        hydratedLink?.activationPolicy || null,
        hydratedLink?.effectConstraint || null,
        stableKey(hydratedLink?.fieldMapping || []),
        hydratedLink?.sourceStateRef || null,
        hydratedLink?.targetStateRef || null,
      ].join('::')
      if (!deduped.has(dedupeKey)) {
        deduped.set(dedupeKey, hydratedLink)
      }
    }
    return Array.from(deduped.values())
  }

  listLinkKinds() {
    return [
      'filter',
      'highlight',
      'syncDomain',
      'sharesSelection',
      'drillDown',
      'reencode',
      'aggregate',
      'structure',
    ]
  }

  describeLinks(options = {}) {
    const includeInternal = options?.includeInternal === true
    const descriptionWidgets = this.store.readDescription?.()?.widgets || []
    const widgetsByRef = new Map(descriptionWidgets.map((widget) => [widget?.ref, widget]).filter(([ref]) => typeof ref === 'string'))
    const widgetsById = new Map(descriptionWidgets.map((widget) => [widget?.widgetId, widget]).filter(([widgetId]) => typeof widgetId === 'string'))
    return this.listLinks()
      .filter(isTopologyLink)
      .map((link) => {
        const sourceWidget = widgetsByRef.get(link.from) || widgetsById.get(link.sourceWidgetId) || null
        const targetWidget = widgetsByRef.get(link.to) || widgetsById.get(link.targetWidgetId) || null
        const targetEffect = readAppliedLinkEffect(link)
        const sourceWidgetId = link.sourceWidgetId || sourceWidget?.widgetId || null
        const targetWidgetId = link.targetWidgetId || targetWidget?.widgetId || null
        const summary = {
          linkId: link.linkId || this.resolveLinkId(link.ref),
          linkRef: link.ref || null,
          sourceRef: link.from || null,
          targetRef: link.to || null,
          sourceWidgetId,
          sourceWidgetKind: link.sourceWidgetKind || sourceWidget?.kind || null,
          targetWidgetId,
          targetWidgetKind: link.targetWidgetKind || targetWidget?.kind || null,
          linkKind: link.kind || null,
          targetEffect,
          activationPolicy: readLinkActivationPolicy(link),
          triggerSummary: `${sourceWidgetId || 'source'} selection drives ${targetWidgetId || 'target'} ${targetEffect || 'effect'}`,
          description: link.description || null,
        }
        if (!includeInternal) return summary
        return {
          ...summary,
          effectConstraint: readLinkEffectConstraint(link),
          fieldMapping: clone(link.fieldMapping || []),
          responseSpec: clone(readLinkResponseSpec(link)),
        }
      })
  }

  describeEngine() {
    const links = this.listLinks()
    const coordinationLinks = links.filter(isTopologyLink)
    const description = this.store.readDescription?.() || {}
    const topology = deriveWorkspaceTopology({
      widgets: description.widgets || [],
      links,
    })
    return makeCoordinationEngineSummary({
      linkKindCount: this.listLinkKinds().length,
      linkKinds: this.listLinkKinds().map((name) => makeCoordinationEngineLinkKindEntry({
        name,
        appliedStatePaths: this.describeAppliedStatePaths(name),
      })),
      linkCount: links.length,
      coordinationLinkCount: coordinationLinks.length,
      structuralLinkCount: links.length - coordinationLinks.length,
      automaticLinkCount: links.filter((link) => readLinkActivationPolicy(link) !== 'manual').length,
      manualLinkCount: links.filter((link) => readLinkActivationPolicy(link) === 'manual').length,
      topology,
      capabilities: makeCoordinationEngineCapabilities({
        propagationExecution: true,
        propagationPlan: true,
        effectCollection: true,
        consistencyEvaluation: true,
      }),
    })
  }

  buildPlanEntry({ link, state = this.store.readState(), sourceRef = null }) {
    const sourceSelectionRef = sourceRef || link?.from || null
    const activeSelection = this.resolveActiveSelection({ sourceRef: sourceSelectionRef, state })
    const sourceValue = link?.sourceStateRef ? readStateByRef(state, link.sourceStateRef) : null
    const mappedSelection = mapCoordinationSourceToTarget({
      activeSelection,
      sourceValue,
      link,
    })
    return {
      linkRef: link?.ref || null,
      linkKind: link?.kind || null,
      declaredEffect: readDeclaredLinkEffect(link),
      appliedEffect: readAppliedLinkEffect(link),
      responseSpec: readLinkResponseSpec(link),
      targetRef: link?.to || null,
      activationPolicy: readLinkActivationPolicy(link),
      effectConstraint: readLinkEffectConstraint(link),
      sourceSelectionRef,
      sourceStateRef: link?.sourceStateRef || sourceSelectionRef,
      targetStateRef: link?.targetStateRef || null,
      sourceWidgetId: link?.sourceWidgetId || null,
      targetWidgetId: link?.targetWidgetId || null,
      relation: link?.relation || null,
      transform: clone(link?.transform || null),
      isCoordinationRelation: Boolean(link?.isCoordinationRelation),
      hasActiveSelection: Boolean(activeSelection),
      hasSourceValue: Boolean(sourceValue),
      mappedSelection: mappedSelection ? clone(mappedSelection) : null,
      effect: describeLinkEffect(link),
    }
  }

  listPlanEntriesForTargetEffect({ targetRef, effect, state = this.store.readState(), includeManual = false }) {
    if (!targetRef || !effect) return []
    return this.listLinks()
      .filter((link) => link.to === targetRef && readAppliedLinkEffect(link) === effect && (includeManual || readLinkActivationPolicy(link) !== 'manual'))
      .map((link) => this.buildPlanEntry({ link, state, sourceRef: link.from || null }))
  }

  findOutgoing({ sourceRef, state = this.store.readState() }) {
    if (!sourceRef) return []
    const activeSelection = this.resolveActiveSelection({ sourceRef, state })
    return this.listLinks().filter((link) => {
      if (link.sourceStateRef === sourceRef) return true
      if (link.from === sourceRef) return true
      if (link.isCoordinationRelation) return false
      if (!activeSelection) return false
      if (link.sourceWidgetId && link.sourceWidgetId === activeSelection.sourceWidgetId) return true
      if (link.from && activeSelection.sourceWidgetRef && link.from === activeSelection.sourceWidgetRef) return true
      return false
    })
  }

  findAffectedRefs({ sourceRef, state = this.store.readState() }) {
    const affected = new Set()
    for (const link of this.findOutgoing({ sourceRef, state })) {
      if (link.to) affected.add(link.to)
    }
    return Array.from(affected)
  }

  describePropagation({ sourceRef }) {
    const state = this.store.readState?.() || {}
    return this.findOutgoing({ sourceRef, state }).map((link) => {
      const planEntry = this.buildPlanEntry({ link, state, sourceRef })
      const applicability = this.assessPropagationEntry({
        entry: planEntry,
        state,
        activeSelection: this.resolveActiveSelection({ sourceRef, state }),
      })
      return {
        ...planEntry,
        canApply: applicability.canApply,
        skippedReason: applicability.reason,
      }
    })
  }

  collectEffects({ sourceRef }) {
    return this.findOutgoing({ sourceRef })
      .map((link) => describeLinkEffect(link))
      .filter(Boolean)
  }

  describeAppliedStatePaths(linkKind) {
    return uniqueValues(
      this.listLinks()
        .filter((link) => link?.kind === linkKind)
        .flatMap((link) => describeAppliedStatePathsForEffect(readAppliedLinkEffect(link))),
    )
  }

  resolveActiveSelection({ sourceRef, state = this.store.readState() }) {
    if (!sourceRef) return null
    const shared = state?.shared || {}
    const registry = readSelectionRegistry(shared)
    if (registry?.[sourceRef]) return registry[sourceRef]

    const byWidget = readSelectionByWidgetView(shared)
    if (byWidget?.[sourceRef]) return byWidget[sourceRef]

    const sourceWidgetId = readWidgetIdFromRef(sourceRef)
    if (sourceWidgetId && byWidget?.[sourceWidgetId]) return byWidget[sourceWidgetId]

    return Object.values(registry || {}).find((selection) => (
      selection?.sourceWidgetRef === sourceRef
      || (sourceWidgetId && selection?.sourceWidgetId === sourceWidgetId)
    )) || null
  }

  buildMirroredSelectionRef(targetRef, sourceSelectionRef) {
    return `${targetRef}/selection/shared_${String(sourceSelectionRef || 'selection').split('/').pop()}`
  }

  buildLinkedFeedback(targetState, entry) {
    const feedback = targetState?.feedback || {}
    return {
      feedback,
      inboundLinkIds: uniqueValues([...(feedback.inboundLinkIds || []), this.resolveLinkId(entry.linkRef)]),
      linkedSourceRefs: uniqueValues([...(feedback.linkedSourceRefs || []), entry.sourceSelectionRef]),
    }
  }

  buildPropagationPlan({ sourceRef, state = this.store.readState() }) {
    return this.findOutgoing({ sourceRef, state }).map((link) => this.buildPlanEntry({ link, state, sourceRef }))
  }

  assessPropagationEntry({ entry, state = this.store.readState(), activeSelection = null, allowManual = false }) {
    if (!entry?.targetRef) {
      return { canApply: false, reason: normalizePropagationSkipReason('missing_target_ref') }
    }
    if (entry.activationPolicy === 'manual' && !allowManual) {
      return { canApply: false, reason: normalizePropagationSkipReason('manual_activation_policy') }
    }
    const targetState = this.store.getWidgetState?.(entry.targetRef) || state?.widgets?.[entry.targetRef] || null
    if (!targetState) {
      return { canApply: false, reason: normalizePropagationSkipReason('missing_target_widget') }
    }
    if (!entry.appliedEffect) {
      return { canApply: false, reason: normalizePropagationSkipReason('unsupported_effect') }
    }
    const sourceValueTransformKinds = new Set([
      'selectionToFilter',
      'domainToFilter',
      'domainToDomain',
      'domainToReencode',
      'reencodeToReencode',
    ])
    if (!activeSelection && entry.appliedEffect !== 'applyFilter' && !sourceValueTransformKinds.has(entry.transform?.kind)) {
      return { canApply: false, reason: normalizePropagationSkipReason('no_active_selection') }
    }
    if (entry.appliedEffect === 'transformView' || entry.appliedEffect === 'transformDataView' || entry.appliedEffect === 'transformStructure') {
      return {
        canApply: false,
        reason: normalizePropagationSkipReason('unsupported_advanced_response'),
      }
    }
    if (entry.appliedEffect === 'focusTarget') {
      return { canApply: true, reason: null }
    }
    if (entry.appliedEffect === 'syncDomain') {
      const hasDomain = Array.isArray(entry.mappedSelection?.domain?.xDomain) || Array.isArray(entry.mappedSelection?.domain?.yDomain)
      return {
        canApply: hasDomain,
        reason: hasDomain ? null : normalizePropagationSkipReason('mapping_unresolved'),
      }
    }
    if (entry.appliedEffect === 'applyFilter') {
      return { canApply: true, reason: null }
    }
    if (entry.appliedEffect === 'reencodeView') {
      const hasReencode = entry.mappedSelection?.reencode && typeof entry.mappedSelection.reencode === 'object'
      return {
        canApply: Boolean(hasReencode),
        reason: hasReencode ? null : normalizePropagationSkipReason('mapping_unresolved'),
      }
    }
    if (!entry.mappedSelection) {
      return { canApply: false, reason: normalizePropagationSkipReason('mapping_unresolved') }
    }
    return { canApply: true, reason: null }
  }

  propagate(input) {
    const directSourceRef = typeof input === 'string' ? input : null
    const sourceRef = directSourceRef || input?.sourceRef || null
    const state = directSourceRef ? this.store.readState() : (input?.state || this.store.readState())
    const beforeState = clone(state)
    const activeSelection = this.resolveActiveSelection({ sourceRef, state })
    const plan = this.buildPropagationPlan({ sourceRef, state })

    const candidateRefs = [...new Set(plan.map((entry) => entry.targetRef).filter(Boolean))]
    this.store.clearWidgetPatches?.(candidateRefs)

    let currentState = this.store.readState()
    const appliedLinks = []
    const skippedTargets = []
    for (const entry of plan) {
      const applicability = this.assessPropagationEntry({
        entry,
        state: currentState,
        activeSelection,
      })
      if (!applicability.canApply) {
        skippedTargets.push({
          linkRef: entry.linkRef,
          linkKind: entry.linkKind,
          declaredEffect: entry.declaredEffect,
          appliedEffect: entry.appliedEffect,
          responseSpec: clone(entry.responseSpec),
          targetRef: entry.targetRef,
          activationPolicy: entry.activationPolicy,
          effectConstraint: entry.effectConstraint,
          reason: normalizePropagationSkipReason(applicability.reason),
        })
        continue
      }
      const patchResult = this.applyPropagationEntry({ entry, state: currentState, activeSelection })
      if (patchResult?.applied) {
        currentState = patchResult.nextState || this.store.readState()
      } else {
        skippedTargets.push({
          linkRef: entry.linkRef,
          linkKind: entry.linkKind,
          declaredEffect: entry.declaredEffect,
          appliedEffect: entry.appliedEffect,
          responseSpec: clone(entry.responseSpec),
          targetRef: entry.targetRef,
          activationPolicy: entry.activationPolicy,
          effectConstraint: entry.effectConstraint,
          reason: normalizePropagationSkipReason(patchResult?.reason),
        })
        continue
      }
      appliedLinks.push({
        linkRef: entry.linkRef,
        linkKind: entry.linkKind,
        declaredEffect: entry.declaredEffect,
        appliedEffect: entry.appliedEffect,
        responseSpec: clone(entry.responseSpec),
        targetRef: entry.targetRef,
        activationPolicy: entry.activationPolicy,
        effectConstraint: entry.effectConstraint,
        hasActiveSelection: entry.hasActiveSelection,
        appliedStatePaths: describeAppliedStatePathsForEffect(entry.appliedEffect),
        effect: clone(entry.effect),
      })
    }

    const affectedRefs = [...new Set(appliedLinks.map((entry) => entry.targetRef).filter(Boolean))]

    const propagation = {
      sourceRef,
      activeSelection: clone(activeSelection),
      affectedRefs,
      patch: buildLinkStatePatch({
        beforeState,
        afterState: currentState,
        affectedRefs,
      }),
      linkCount: plan.length,
      appliedLinkCount: appliedLinks.length,
      skippedLinkCount: skippedTargets.length,
      nextState: currentState,
      links: appliedLinks,
      skippedTargets,
      effects: plan.map((entry) => clone(entry.effect)).filter(Boolean),
    }

    return directSourceRef ? propagation.affectedRefs : propagation
  }

  applyLink({ linkRef, sourceRef = null, state = this.store.readState() } = {}) {
    const beforeState = clone(state)
    const link = this.listLinks().find((entry) => (
      entry?.ref === linkRef || entry?.linkId === linkRef || this.resolveLinkId(entry?.ref) === linkRef
    ))
    if (!link) {
      return {
        ok: false,
        reason: normalizePropagationSkipReason('missing_link'),
        linkRef: linkRef || null,
        affectedRefs: [],
        appliedLinkCount: 0,
        skippedLinkCount: 1,
      }
    }
    const resolvedSourceRef = sourceRef || link.from || null
    const activeSelection = this.resolveActiveSelection({ sourceRef: resolvedSourceRef, state })
    const entry = this.buildPlanEntry({ link, state, sourceRef: resolvedSourceRef })
    const applicability = this.assessPropagationEntry({
      entry,
      state,
      activeSelection,
      allowManual: true,
    })
    if (!applicability.canApply) {
      return {
        ok: false,
        reason: normalizePropagationSkipReason(applicability.reason),
        sourceRef: resolvedSourceRef,
        activeSelection: clone(activeSelection),
        affectedRefs: [],
        linkCount: 1,
        appliedLinkCount: 0,
        skippedLinkCount: 1,
        links: [],
        skippedTargets: [{
          linkRef: entry.linkRef,
          linkKind: entry.linkKind,
          declaredEffect: entry.declaredEffect,
          appliedEffect: entry.appliedEffect,
          responseSpec: clone(entry.responseSpec),
          targetRef: entry.targetRef,
          activationPolicy: entry.activationPolicy,
          effectConstraint: entry.effectConstraint,
          reason: normalizePropagationSkipReason(applicability.reason),
        }],
        effects: entry.effect ? [clone(entry.effect)] : [],
      }
    }

    this.store.clearWidgetPatches?.([entry.targetRef].filter(Boolean))
    const patchResult = this.applyPropagationEntry({
      entry,
      state,
      activeSelection,
      allowManual: true,
    })
    if (!patchResult?.applied) {
      return {
        ok: false,
        reason: normalizePropagationSkipReason(patchResult?.reason),
        sourceRef: resolvedSourceRef,
        activeSelection: clone(activeSelection),
        affectedRefs: [],
        linkCount: 1,
        appliedLinkCount: 0,
        skippedLinkCount: 1,
        links: [],
        skippedTargets: [{
          linkRef: entry.linkRef,
          linkKind: entry.linkKind,
          declaredEffect: entry.declaredEffect,
          appliedEffect: entry.appliedEffect,
          responseSpec: clone(entry.responseSpec),
          targetRef: entry.targetRef,
          activationPolicy: entry.activationPolicy,
          effectConstraint: entry.effectConstraint,
          reason: normalizePropagationSkipReason(patchResult?.reason),
        }],
        effects: entry.effect ? [clone(entry.effect)] : [],
      }
    }

    return {
      ok: true,
      sourceRef: resolvedSourceRef,
      activeSelection: clone(activeSelection),
      affectedRefs: entry.targetRef ? [entry.targetRef] : [],
      patch: buildLinkStatePatch({
        beforeState,
        afterState: patchResult.nextState || this.store.readState(),
        affectedRefs: entry.targetRef ? [entry.targetRef] : [],
      }),
      linkCount: 1,
      appliedLinkCount: 1,
      skippedLinkCount: 0,
      nextState: patchResult.nextState || this.store.readState(),
      links: [{
        linkRef: entry.linkRef,
        linkKind: entry.linkKind,
        declaredEffect: entry.declaredEffect,
        appliedEffect: entry.appliedEffect,
        responseSpec: clone(entry.responseSpec),
        targetRef: entry.targetRef,
        activationPolicy: entry.activationPolicy,
        effectConstraint: entry.effectConstraint,
        hasActiveSelection: entry.hasActiveSelection,
        appliedStatePaths: describeAppliedStatePathsForEffect(entry.appliedEffect),
        effect: clone(entry.effect),
      }],
      skippedTargets: [],
      effects: entry.effect ? [clone(entry.effect)] : [],
    }
  }

  applyPropagationEntry({ entry, state, activeSelection, allowManual = false }) {
    const targetRef = entry?.targetRef
    if (!targetRef) return { applied: false, nextState: state, reason: normalizePropagationSkipReason('missing_target_ref') }

    const targetState = this.store.getWidgetState?.(targetRef) || state?.widgets?.[targetRef] || null
    if (!targetState) return { applied: false, nextState: state, reason: normalizePropagationSkipReason('missing_target_widget') }

    const { feedback, inboundLinkIds, linkedSourceRefs } = this.buildLinkedFeedback(targetState, entry)
    if (entry.appliedEffect === 'applyFilter') {
      const filterEntries = this.listPlanEntriesForTargetEffect({
        targetRef,
        effect: 'applyFilter',
        state,
        includeManual: allowManual,
      })
      const filterLinkRefs = new Set(filterEntries.map((item) => item.linkRef))
      let nextTransformState = {
        ...state,
        widgets: {
          ...(state?.widgets || {}),
          [targetRef]: {
            ...targetState,
            transforms: (Array.isArray(targetState.transforms) ? targetState.transforms : [])
              .filter((transform) => !filterLinkRefs.has(transform?.spec?.linkRef)),
          },
        },
      }
      const visibleDataRef = targetState.data?.currentDataRef || null
      const runtimeEntry = visibleDataRef ? this.store.readRuntimeData?.(visibleDataRef) : null
      const { baseRows } = readRuntimeRows(runtimeEntry)

      for (const filterEntry of filterEntries) {
        if (!filterEntry.mappedSelection) continue
        const predicates = Array.isArray(filterEntry.mappedSelection?.predicates)
          ? clone(filterEntry.mappedSelection.predicates)
          : []
        const canonicalSourceRef = filterEntry.sourceStateRef || filterEntry.sourceSelectionRef
        const canonicalTransformRef = filterEntry.targetStateRef
          || `${targetRef}/transform/${this.resolveLinkId(filterEntry.linkRef) || 'coordination-filter'}`
        const nextTransform = {
          kind: 'filter',
          source: filterEntry.isCoordinationRelation ? 'coordination' : filterEntry.sourceSelectionRef,
          sourceRef: canonicalSourceRef,
          sourceWidgetId: filterEntry.sourceWidgetId || null,
          sourceSelectionRef: filterEntry.sourceSelectionRef,
          linkId: this.resolveLinkId(filterEntry.linkRef),
          ...(canonicalTransformRef ? { ref: canonicalTransformRef } : {}),
          ...(predicates.length === 1 ? { predicate: predicates[0] } : {}),
          ...(predicates.length > 1 ? { predicate: predicates } : {}),
          params: {
            relationRef: filterEntry.linkRef,
            transformKind: filterEntry.transform?.kind || null,
            domain: clone(filterEntry.mappedSelection?.domain || null),
          },
          spec: {
            linkRef: filterEntry.linkRef,
            sourceSelectionRef: filterEntry.sourceSelectionRef,
            sourceStateRef: canonicalSourceRef,
            targetStateRef: canonicalTransformRef,
            predicates,
            domain: clone(filterEntry.mappedSelection?.domain || null),
          },
        }
        nextTransformState = patchStateByRef(nextTransformState, canonicalTransformRef, nextTransform)
      }
      const patchedTargetState = nextTransformState.widgets?.[targetRef] || targetState

      const nextVisibleRows = filterEntries.reduce(
        (rows, filterEntry) => (
          filterEntry.mappedSelection
            ? rows.filter((row) => rowMatchesSelection(row, filterEntry.mappedSelection))
            : rows
        ),
        baseRows,
      )
      const activeSelectionStates = Object.values(targetState.selections || {}).filter(Boolean)
      const selectedCount = countSelectedRowsForSelections(nextVisibleRows, activeSelectionStates)
      if (visibleDataRef) {
        this.store.updateRuntimeData?.(visibleDataRef, (currentEntry) => ({
          ...currentEntry,
          rows: nextVisibleRows,
          baseRows: Array.isArray(currentEntry?.baseRows) ? currentEntry.baseRows : baseRows,
          handle: {
            ...(currentEntry?.handle || {}),
            stats: {
              ...(currentEntry?.handle?.stats || {}),
              rowCount: baseRows.length,
              visibleCount: nextVisibleRows.length,
              selectedCount,
            },
          },
        }))
      }

      return {
        applied: true,
        nextState: this.store.patchWidget(targetRef, {
          transforms: patchedTargetState.transforms,
          data: {
            ...(targetState.data || {}),
            visibleCount: nextVisibleRows.length,
            selectedCount,
          },
          feedback: {
            ...feedback,
            inboundLinkIds,
            linkedSourceRefs,
          },
        }),
      }
    }

    if (entry.appliedEffect === 'applyHighlight') {
      const highlightEntries = this.listPlanEntriesForTargetEffect({
        targetRef,
        effect: 'applyHighlight',
        state,
        includeManual: allowManual,
      }).filter((item) => item.mappedSelection)
      const highlightedKeys = uniqueValues(
        highlightEntries.flatMap((item) => categoricalValuesFromSelection(item.mappedSelection)),
      )
      const visibleDataRef = targetState.data?.currentDataRef || null
      if (visibleDataRef) {
        this.store.updateRuntimeData?.(visibleDataRef, (currentEntry) => {
          const { visibleRows } = readRuntimeRows(currentEntry)
          return {
            ...currentEntry,
            rows: markRows(
              visibleRows,
              '__widgetva_highlight',
              (row) => highlightEntries.some((item) => rowMatchesSelection(row, item.mappedSelection)),
            ),
          }
        })
      }
      const nextState = this.store.patchWidget(targetRef, {
        rawSpec: Array.isArray(targetState.rawSpec?.data?.values)
          ? {
              ...clone(targetState.rawSpec),
              data: {
                ...(targetState.rawSpec.data || {}),
                values: markRows(
                  targetState.rawSpec.data.values,
                  '__widgetva_highlight',
                  (row) => highlightEntries.some((item) => rowMatchesSelection(row, item.mappedSelection)),
                ),
              },
            }
          : targetState.rawSpec,
        ...(entry.isCoordinationRelation
          ? {
              view: {
                ...(targetState.view || {}),
                highlight: {
                  sourceAction: 'coordination.selectionToHighlight',
                  relationRef: entry.linkRef,
                  sourceStateRef: entry.sourceStateRef || entry.sourceSelectionRef,
                  targetStateRef: entry.targetStateRef || null,
                  predicates: highlightEntries.flatMap((item) => item.mappedSelection?.predicates || []),
                  values: highlightedKeys,
                },
              },
            }
          : {}),
        feedback: {
          ...feedback,
          inboundLinkIds,
          linkedSourceRefs,
          highlightedKeys,
        },
      })
      return {
        applied: true,
        nextState: updateSharedStateInStore(this.store, (shared) =>
          withHighlightSubmodel(shared, deriveHighlightState(nextState)),
        ),
      }
    }

    if (entry.appliedEffect === 'focusTarget') {
      const nextState = this.store.patchWidget(targetRef, {
        feedback: {
          ...feedback,
          inboundLinkIds,
          linkedSourceRefs,
          focusLinkIds: uniqueValues([...(feedback.focusLinkIds || []), this.resolveLinkId(entry.linkRef)]),
          focusedBySelectionRef: entry.sourceSelectionRef || null,
        },
      })
      const nextStateWithSharedFocus = updateSharedStateInStore(this.store, (shared) =>
        withFocusSubmodel(shared, {
          widgetRef: targetRef,
          widgetId: targetState.widgetId || null,
          source: 'link',
        }, nextState?.widgets || state?.widgets || {}),
      )
      return {
        applied: true,
        nextState: nextStateWithSharedFocus,
      }
    }

    if (entry.appliedEffect === 'syncDomain') {
      const syncEntries = this.listPlanEntriesForTargetEffect({
        targetRef,
        effect: 'syncDomain',
        state,
        includeManual: allowManual,
      })
      const activeSyncEntries = [
        entry,
        ...syncEntries.filter((item) => item.linkRef !== entry.linkRef),
      ].filter((item) => item.mappedSelection?.domain)
      const resolvedXDomain = [...activeSyncEntries]
        .reverse()
        .find((item) => Array.isArray(item.mappedSelection?.domain?.xDomain))
        ?.mappedSelection?.domain?.xDomain || null
      const resolvedYDomain = [...activeSyncEntries]
        .reverse()
        .find((item) => Array.isArray(item.mappedSelection?.domain?.yDomain))
        ?.mappedSelection?.domain?.yDomain || null
      return {
        applied: true,
        nextState: this.store.patchWidget(targetRef, {
          view: {
            ...(targetState.view || {}),
              xDomain: resolvedXDomain,
              yDomain: resolvedYDomain,
              zoom: buildViewZoomState({
                widgetSpec: targetState.rawSpec,
                xDomain: resolvedXDomain,
                yDomain: resolvedYDomain,
              }),
            },
          feedback: {
            ...feedback,
            inboundLinkIds,
            linkedSourceRefs,
          },
        }),
      }
    }

    if (entry.appliedEffect === 'reencodeView') {
      const reencode = entry.mappedSelection?.reencode || null
      if (!reencode || typeof reencode !== 'object') {
        return { applied: false, nextState: state, reason: normalizePropagationSkipReason('mapping_unresolved') }
      }
      return {
        applied: true,
        nextState: this.store.patchWidget(targetRef, {
          view: {
            ...(targetState.view || {}),
            reencode: clone(reencode),
          },
          feedback: {
            ...feedback,
            inboundLinkIds,
            linkedSourceRefs,
          },
        }),
      }
    }

    if (entry.appliedEffect === 'shareSelection') {
      const shareEntries = this.listPlanEntriesForTargetEffect({
        targetRef,
        effect: 'shareSelection',
        state,
        includeManual: allowManual,
      }).filter((item) => item.mappedSelection)
      const shareSelectionRefs = new Set(
        shareEntries.map((item) => this.buildMirroredSelectionRef(targetRef, item.sourceSelectionRef)),
      )
      const visibleDataRef = targetState.data?.currentDataRef || null
      const runtimeEntry = visibleDataRef ? this.store.readRuntimeData?.(visibleDataRef) : null
      const { visibleRows } = readRuntimeRows(runtimeEntry)
      const mirroredSelectionEntries = shareEntries.map((shareEntry) => {
        const selectionRef = shareEntry.isCoordinationRelation && shareEntry.targetStateRef
          ? shareEntry.targetStateRef
          : this.buildMirroredSelectionRef(targetRef, shareEntry.sourceSelectionRef)
        const selectionId = selectionRef.split('/').pop() || null
        const selectionState = makeSelectionState({
          ...buildSelectionStateInput(shareEntry.mappedSelection),
          selectionRef,
          selectionId,
          sourceWidgetRef: targetRef,
          sourceWidgetId: targetState.widgetId || targetRef,
        })
        return [selectionRef, selectionState]
      })
      const selectedCount = countRowsMatching(
        visibleRows,
        (row) => shareEntries.some((item) => rowMatchesSelection(row, item.mappedSelection)),
      )
      if (visibleDataRef) {
        this.store.updateRuntimeData?.(visibleDataRef, (currentEntry) => {
          const { visibleRows: currentRows } = readRuntimeRows(currentEntry)
          return {
            ...currentEntry,
            rows: markRows(
              currentRows,
              '__widgetva_selected',
              (row) => shareEntries.some((item) => rowMatchesSelection(row, item.mappedSelection)),
            ),
            handle: {
              ...(currentEntry?.handle || {}),
              stats: {
                ...(currentEntry?.handle?.stats || {}),
                selectedCount,
              },
            },
          }
        })
      }
      const baseSelections = Object.fromEntries(
        Object.entries(targetState.selections || {}).filter(([selectionRef]) => !shareSelectionRefs.has(selectionRef)),
      )
      const nextState = this.store.patchWidget(targetRef, {
        selections: {
          ...baseSelections,
          ...Object.fromEntries(mirroredSelectionEntries),
        },
        data: {
          ...(targetState.data || {}),
          selectedCount,
        },
        rawSpec: Array.isArray(targetState.rawSpec?.data?.values)
          ? {
              ...clone(targetState.rawSpec),
              data: {
                ...(targetState.rawSpec.data || {}),
                values: markRows(
                  targetState.rawSpec.data.values,
                  '__widgetva_selected',
                  (row) => shareEntries.some((item) => rowMatchesSelection(row, item.mappedSelection)),
                ),
              },
            }
          : targetState.rawSpec,
        feedback: {
          ...feedback,
          inboundLinkIds,
          linkedSourceRefs,
          sharedSelectionSourceWidgetId: shareEntries[0]?.sourceWidgetId || null,
        },
      })
      const nextStateWithSharedSelections = updateSharedStateInStore(this.store, (shared) => {
        const registry = {
          ...readSelectionRegistry(shared),
        }
        for (const selectionRef of shareSelectionRefs) {
          delete registry[selectionRef]
        }
        for (const [selectionRef, selectionState] of mirroredSelectionEntries) {
          registry[selectionRef] = selectionState
        }

        const byWidget = {
          ...readSelectionByWidgetView(shared),
        }
        const widgetKey = targetState.widgetId || targetRef
        if (mirroredSelectionEntries.length > 0) {
          const [selectionRef, selectionState] = mirroredSelectionEntries[mirroredSelectionEntries.length - 1]
          byWidget[widgetKey] = {
            ...selectionState,
            selectionRef,
          }
        } else {
          delete byWidget[widgetKey]
        }

        return withSelectionSubmodel(shared, {
          registry,
          primary: undefined,
          byWidget,
        })
      })
      return {
        applied: true,
        nextState: nextStateWithSharedSelections || nextState,
      }
    }

    if (entry.appliedEffect === 'transformView' || entry.appliedEffect === 'transformDataView' || entry.appliedEffect === 'transformStructure') {
      return {
        applied: false,
        nextState: state,
        reason: normalizePropagationSkipReason('unsupported_advanced_response'),
      }
    }

    return { applied: false, nextState: state, reason: normalizePropagationSkipReason('unsupported_effect') }
  }

  resolveLinkId(linkRef) {
    const link = this.store.getLink?.(linkRef) || this.listLinks().find((item) => item.ref === linkRef) || null
    if (link?.linkId) return link.linkId
    if (typeof linkRef === 'string' && linkRef.includes('/link/')) {
      return linkRef.split('/').pop() || null
    }
    return null
  }

  evaluatePropagation({ sourceRef, state = this.store.readState() }) {
    const activeSelection = this.resolveActiveSelection({ sourceRef, state })
    const plan = this.buildPropagationPlan({ sourceRef, state })
    const results = plan.map((entry) => this.evaluatePlanEntry({ entry, state, activeSelection }))
    const passedCount = results.filter((item) => item.passed).length
    return {
      ok: results.every((item) => item.passed),
      sourceRef,
      activeSelection: clone(activeSelection),
      linkCount: results.length,
      passedCount,
      consistencyScore: results.length === 0 ? 1 : passedCount / results.length,
      results,
    }
  }

  evaluatePlanEntry({ entry, state, activeSelection }) {
    const resolvedLinkId = this.resolveLinkId(entry.linkRef)
    const targetState = entry.targetRef ? state?.widgets?.[entry.targetRef] || null : null
    const checks = []
    const applicability = this.assessPropagationEntry({ entry, state, activeSelection })

    checks.push({
      name: 'targetExists',
      passed: Boolean(targetState),
      actual: Boolean(targetState),
      expected: true,
    })

    if (targetState && applicability.canApply && entry.appliedEffect !== 'focusTarget') {
      checks.push({
        name: 'inboundLinkRegistered',
        passed: Array.isArray(targetState.feedback?.inboundLinkIds) && targetState.feedback.inboundLinkIds.includes(resolvedLinkId),
        actual: targetState.feedback?.inboundLinkIds || [],
        expected: resolvedLinkId,
      })
    }

    if (targetState && applicability.canApply) {
      if (entry.appliedEffect === 'applyFilter') {
        const matchingTransform = (Array.isArray(targetState.transforms) ? targetState.transforms : []).find((transform) => (
          transform?.kind === 'filter' && transform?.spec?.linkRef === entry.linkRef
        ))
        checks.push({
          name: 'filterTransformRegistered',
          passed: Boolean(matchingTransform),
          actual: Boolean(matchingTransform),
          expected: true,
        })
      }

      if (entry.appliedEffect === 'shareSelection' && entry.mappedSelection) {
        const mirroredSelection = Object.values(targetState.selections || {}).find((selection) => selection?.summary === entry.mappedSelection.summary)
        const runtimeData = this.store.readRuntimeData?.(targetState.data?.currentDataRef)
        const { visibleRows } = readRuntimeRows(runtimeData)
        const expectedSelectedCount = countSelectedRows(visibleRows, entry.mappedSelection)
        checks.push({
          name: 'mirroredSelectionExists',
          passed: Boolean(mirroredSelection),
          actual: Boolean(mirroredSelection),
          expected: true,
        })
        checks.push({
          name: 'mirroredSelectionCountMatches',
          passed: targetState.data?.selectedCount === expectedSelectedCount,
          actual: targetState.data?.selectedCount ?? 0,
          expected: expectedSelectedCount,
        })
      }

      if (entry.appliedEffect === 'syncDomain') {
        checks.push({
          name: 'xDomainSynced',
          passed: arraysEqual(targetState.view?.xDomain, activeSelection?.domain?.xDomain),
          actual: targetState.view?.xDomain || null,
          expected: activeSelection?.domain?.xDomain || null,
        })
        checks.push({
          name: 'yDomainSynced',
          passed: arraysEqual(targetState.view?.yDomain, activeSelection?.domain?.yDomain),
          actual: targetState.view?.yDomain || null,
          expected: activeSelection?.domain?.yDomain || null,
        })
      }

      if (entry.appliedEffect === 'applyHighlight') {
        const highlightedKeys = targetState.feedback?.highlightedKeys || []
        const runtimeData = this.store.readRuntimeData?.(targetState.data?.currentDataRef)
        const { visibleRows } = readRuntimeRows(runtimeData)
        const highlightedRows = visibleRows.filter((row) => row?.__widgetva_highlight === true).length
        checks.push({
          name: 'highlightFeedbackPresent',
          passed: highlightedKeys.length > 0 || highlightedRows > 0,
          actual: { highlightedKeys: highlightedKeys.length, highlightedRows },
          expected: 'at least one highlight feedback channel should be populated',
        })
      }

      if (entry.appliedEffect === 'reencodeView') {
        checks.push({
          name: 'reencodeViewRegistered',
          passed: Boolean(targetState.view?.reencode),
          actual: targetState.view?.reencode || null,
          expected: 'view.reencode',
        })
      }

      if (entry.appliedEffect === 'focusTarget') {
        const focusState = state?.shared?.focus || null
        checks.push({
          name: 'focusedWidgetMatchesTarget',
          passed: state?.shared?.focusedWidget === entry.targetRef,
          actual: state?.shared?.focusedWidget || null,
          expected: entry.targetRef,
        })
        checks.push({
          name: 'focusStateMatchesTarget',
          passed: focusState?.widgetRef === entry.targetRef,
          actual: focusState?.widgetRef || null,
          expected: entry.targetRef,
        })
      }
    }

    checks.push({
      name: 'linkCanApply',
      passed: applicability.canApply,
      actual: applicability.reason || 'applicable',
      expected: 'applicable',
    })

    return {
      linkRef: entry.linkRef,
      linkKind: entry.linkKind,
      declaredEffect: entry.declaredEffect,
      appliedEffect: entry.appliedEffect,
      responseSpec: clone(entry.responseSpec),
      targetRef: entry.targetRef,
      activationPolicy: entry.activationPolicy,
      effectConstraint: entry.effectConstraint,
      reason: applicability.reason,
      passed: checks.every((check) => check.passed),
      checks,
    }
  }
}
