import { cloneJsonValue as clone } from '../../shared/clone.js'
import { mapSelectionToTargetSelection } from '../../core/runtime/materializers/state/selectionHelpers.js'
import { makeCoordinationRelation } from '../../contracts/coordination-contracts.js'
import { readWidgetRefFromStateRef } from '../store/workspaceStoreReaders.js'
import { readAppliedLinkEffect } from './linkSemantics.js'

export function valuesEqual(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

export function buildLinkStatePatch({ beforeState, afterState, affectedRefs = [] } = {}) {
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

export function arraysEqual(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

export function uniqueValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => value != null))]
}

export function makeCoordinationEngineLinkKindEntry(entry = {}) {
  return {
    name: entry?.name || '',
    appliedStatePaths: Array.isArray(entry?.appliedStatePaths) ? [...entry.appliedStatePaths] : [],
  }
}

export function makeCoordinationEngineCapabilities(capabilities = {}) {
  return {
    propagationExecution: false,
    propagationPlan: false,
    effectCollection: false,
    consistencyEvaluation: false,
    ...capabilities,
  }
}

export function makeCoordinationEngineSummary(summary = {}) {
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

export function readWidgetIdFromRef(ref) {
  if (typeof ref !== 'string' || ref.length === 0) return null
  const marker = '/widget/'
  const index = ref.lastIndexOf(marker)
  if (index < 0) return null
  const rest = ref.slice(index + marker.length)
  const widgetId = rest.split('/')[0]
  return widgetId || null
}

export function isCoordinationRelation(link) {
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

export function makeCoordinationRelationLink(relation) {
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

export function stableKey(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function categoricalValuesFromSelection(selection) {
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

export function mapCoordinationSourceToTarget({ activeSelection, sourceValue, link }) {
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

export function markRows(rows, marker, predicate) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    [marker]: Boolean(predicate?.(row)),
  }))
}

export function countRowsMatching(rows, predicate) {
  if (!Array.isArray(rows) || typeof predicate !== 'function') return 0
  return rows.filter((row) => predicate(row)).length
}

export function readRuntimeRows(runtimeEntry = null) {
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

export function describeLinkEffect(link) {
  const appliedEffect = readAppliedLinkEffect(link)
  const metadata = readEffectMetadata(appliedEffect)
  if (!metadata) return null
  return {
    kind: metadata.effectKind,
    targetRef: link.to,
    description: link.description || metadata.defaultDescription,
  }
}

export function describeAppliedStatePathsForEffect(effect) {
  return [...(readEffectMetadata(effect)?.appliedStatePaths || [])]
}
