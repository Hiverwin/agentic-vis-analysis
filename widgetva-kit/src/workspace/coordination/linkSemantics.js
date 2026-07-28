import { makeWidgetLink } from '../../contracts/widget-links-contracts.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function resolveLinkEndpoints(link) {
  const normalizedLink = makeWidgetLink(link)
  return {
    from:
      normalizedLink?.sourceWidgetId
      || normalizedLink?.from
      || normalizedLink?.sourceRef
      || null,
    to:
      normalizedLink?.targetWidgetId
      || normalizedLink?.to
      || normalizedLink?.targetRef
      || null,
  }
}

export function readLinkActivationPolicy(link) {
  const normalizedLink = makeWidgetLink(link)
  return normalizedLink?.activationPolicy === 'manual' ? 'manual' : 'automatic'
}

export function readLinkEffectConstraint(link) {
  const normalizedLink = makeWidgetLink(link)
  return normalizedLink?.effectConstraint === 'highlightOnly' || normalizedLink?.effectConstraint === 'focusOnly'
    ? normalizedLink.effectConstraint
    : null
}

export function readLinkResponseSpec(link) {
  const normalizedLink = makeWidgetLink(link)
  return normalizedLink?.responseSpec && typeof normalizedLink.responseSpec === 'object'
    ? clone(normalizedLink.responseSpec)
    : null
}

export function readDeclaredLinkEffect(link) {
  const normalizedLink = makeWidgetLink(link)
  if (typeof normalizedLink?.effect === 'string' && normalizedLink.effect.length > 0) {
    return normalizedLink.effect
  }
  if (normalizedLink?.kind === 'filter') return 'applyFilter'
  if (normalizedLink?.kind === 'highlight') return 'applyHighlight'
  if (normalizedLink?.kind === 'syncDomain') return 'syncDomain'
  if (normalizedLink?.kind === 'sharesSelection') return 'shareSelection'
  if (normalizedLink?.kind === 'drillDown' || normalizedLink?.kind === 'reencode') return 'transformView'
  if (normalizedLink?.kind === 'aggregate') return 'transformDataView'
  if (normalizedLink?.kind === 'structure') return 'transformStructure'
  return null
}

export function readAppliedLinkEffect(link) {
  const effectConstraint = readLinkEffectConstraint(link)
  if (effectConstraint === 'highlightOnly') return 'applyHighlight'
  if (effectConstraint === 'focusOnly') return 'focusTarget'
  return readDeclaredLinkEffect(link)
}

export function isSelectionPropagationEffect(effect) {
  return ['applyFilter', 'applyHighlight', 'focusTarget', 'shareSelection'].includes(effect)
}

export function isAdvancedResponseEffect(effect) {
  return ['transformView', 'transformDataView', 'transformStructure'].includes(effect)
}

export function describeSelectionPropagationLinks(links = [], sourceWidgetId = null) {
  if (!sourceWidgetId) return []
  return (Array.isArray(links) ? links : [])
    .map((link) => {
      const normalizedLink = makeWidgetLink(link)
      const { from, to } = resolveLinkEndpoints(normalizedLink)
      const effect = readDeclaredLinkEffect(normalizedLink)
      const appliedEffect = readAppliedLinkEffect(normalizedLink)
      return {
        ...clone(normalizedLink),
        sourceWidgetId: from || null,
        targetWidgetId: to || null,
        effect,
        appliedEffect,
        activationPolicy: readLinkActivationPolicy(normalizedLink),
        effectConstraint: readLinkEffectConstraint(normalizedLink),
      }
    })
    .filter((link) => link.sourceWidgetId === sourceWidgetId && isSelectionPropagationEffect(link.appliedEffect))
}

export function describeSelectionAdvancedResponseLinks(links = [], sourceWidgetId = null) {
  if (!sourceWidgetId) return []
  return (Array.isArray(links) ? links : [])
    .map((link) => {
      const normalizedLink = makeWidgetLink(link)
      const { from, to } = resolveLinkEndpoints(normalizedLink)
      const effect = readDeclaredLinkEffect(normalizedLink)
      const appliedEffect = readAppliedLinkEffect(normalizedLink)
      return {
        ...clone(normalizedLink),
        sourceWidgetId: from || null,
        targetWidgetId: to || null,
        effect,
        appliedEffect,
        activationPolicy: readLinkActivationPolicy(normalizedLink),
        effectConstraint: readLinkEffectConstraint(normalizedLink),
        responseSpec: readLinkResponseSpec(normalizedLink),
      }
    })
    .filter((link) => link.sourceWidgetId === sourceWidgetId && isAdvancedResponseEffect(link.appliedEffect))
}

export function findSelectionPropagationLink(links = [], sourceWidgetId, targetWidgetId) {
  if (!sourceWidgetId || !targetWidgetId || sourceWidgetId === targetWidgetId) return null
  return describeSelectionPropagationLinks(links, sourceWidgetId)
    .find((link) => link.targetWidgetId === targetWidgetId) || null
}

export function allowsSelectionPropagationToWidget(links = [], sourceWidgetId, targetWidgetId, effect = null) {
  const link = findSelectionPropagationLink(links, sourceWidgetId, targetWidgetId)
  if (!link) return false
  return effect ? link.appliedEffect === effect : true
}

export function buildSelectionCoordinationEffects(links = [], sourceWidgetId = null) {
  const effectMap = {}
  for (const link of describeSelectionPropagationLinks(links, sourceWidgetId)) {
    const targetKey = link.targetWidgetId || link.targetRef || null
    if (!targetKey) continue
    if (!effectMap[targetKey]) {
      effectMap[targetKey] = {
        targetWidgetId: link.targetWidgetId || null,
        targetRef: link.targetRef || link.to || null,
        effects: [],
        applyFilter: false,
        applyHighlight: false,
        focusTarget: false,
        shareSelection: false,
      }
    }
    const targetEffects = effectMap[targetKey]
    if (!targetEffects.effects.includes(link.appliedEffect)) {
      targetEffects.effects.push(link.appliedEffect)
    }
    if (link.appliedEffect === 'applyFilter') targetEffects.applyFilter = true
    if (link.appliedEffect === 'applyHighlight') targetEffects.applyHighlight = true
    if (link.appliedEffect === 'focusTarget') targetEffects.focusTarget = true
    if (link.appliedEffect === 'shareSelection') targetEffects.shareSelection = true
  }
  return effectMap
}

export function readPrimarySelectionValue(primarySelection = null, field = null) {
  if (!field || !primarySelection || !Array.isArray(primarySelection.predicates)) return null
  const predicate = primarySelection.predicates.find((entry) => entry?.field === field)
  if (!predicate) return null
  if (predicate.op === 'equals' || predicate.op === 'eq') return predicate.value
  if (predicate.op === 'in' && Array.isArray(predicate.value) && predicate.value.length === 1) {
    return predicate.value[0]
  }
  return null
}

export function buildSelectionCoordinationContext({
  primarySelection = null,
  links = [],
} = {}) {
  const sourceWidgetId = primarySelection?.sourceWidgetId || null
  const effectsByWidget = sourceWidgetId
    ? buildSelectionCoordinationEffects(links, sourceWidgetId)
    : {}
  const readEffectsForWidget = (widgetId) => effectsByWidget?.[widgetId] || {
    applyFilter: false,
    applyHighlight: false,
    focusTarget: false,
    shareSelection: false,
    effects: [],
  }
  return {
    sourceWidgetId,
    effectsByWidget,
    readPrimarySelectionValue: (field) => readPrimarySelectionValue(primarySelection, field),
    readEffectsForWidget,
    shouldApplyFilter: (widgetId) => readEffectsForWidget(widgetId).applyFilter === true,
    shouldApplyHighlight: (widgetId) => readEffectsForWidget(widgetId).applyHighlight === true,
    shouldApplyFocus: (widgetId) => readEffectsForWidget(widgetId).focusTarget === true,
    shouldShareSelection: (widgetId) => readEffectsForWidget(widgetId).shareSelection === true,
  }
}

export function buildSelectionDomainCoordinationContext({
  primarySelection = null,
  links = [],
} = {}) {
  const sourceWidgetId = primarySelection?.sourceWidgetId || null
  const domainByWidget = {}
  for (const link of Array.isArray(links) ? links : []) {
    const normalizedLink = makeWidgetLink(link)
    const { from, to } = resolveLinkEndpoints(normalizedLink)
    if (!sourceWidgetId || from !== sourceWidgetId) continue
    if (readAppliedLinkEffect(normalizedLink) !== 'syncDomain') continue
    if (!to) continue
    domainByWidget[to] = clone(primarySelection?.domain || null)
  }
  return {
    sourceWidgetId,
    domainByWidget,
    shouldSyncDomain: (widgetId) => domainByWidget?.[widgetId] != null,
    readDomainForWidget: (widgetId) => clone(domainByWidget?.[widgetId] || null),
  }
}

export function buildSelectionAdvancedResponseContext({
  primarySelection = null,
  links = [],
} = {}) {
  const sourceWidgetId = primarySelection?.sourceWidgetId || null
  const responsesByWidget = {}
  for (const link of describeSelectionAdvancedResponseLinks(links, sourceWidgetId)) {
    const targetKey = link.targetWidgetId || link.targetRef || null
    if (!targetKey) continue
    responsesByWidget[targetKey] = {
      targetWidgetId: link.targetWidgetId || null,
      targetRef: link.targetRef || link.to || null,
      effect: link.appliedEffect || null,
      declaredEffect: link.effect || null,
      responseSpec: clone(link.responseSpec || null),
      activationPolicy: link.activationPolicy || 'automatic',
      effectConstraint: link.effectConstraint || null,
    }
  }
  return {
    sourceWidgetId,
    responsesByWidget,
    readResponseForWidget: (widgetId) => responsesByWidget?.[widgetId] || null,
  }
}

export function resolveSelectionDrivenViewValue({
  widgetId = null,
  responseSourceWidgetId = null,
  field = null,
  fallbackValue = null,
  selectionCoordination = null,
  responseType = 'highlight',
  mapValue = null,
} = {}) {
  if (!field || !selectionCoordination) return fallbackValue

  const sourceWidgetId = selectionCoordination?.sourceWidgetId || null
  const ownsPrimarySelection = Boolean(
    responseSourceWidgetId
    && sourceWidgetId
    && responseSourceWidgetId === sourceWidgetId,
  )
  const receivesLinkedResponse =
    responseType === 'focus'
      ? selectionCoordination?.shouldApplyFocus?.(widgetId) === true
      : responseType === 'filter'
        ? selectionCoordination?.shouldApplyFilter?.(widgetId) === true
        : selectionCoordination?.shouldApplyHighlight?.(widgetId) === true

  if (!ownsPrimarySelection && !receivesLinkedResponse) {
    return fallbackValue
  }

  const selectedValue = selectionCoordination?.readPrimarySelectionValue?.(field)
  if (selectedValue == null) return fallbackValue
  return typeof mapValue === 'function' ? mapValue(selectedValue) : selectedValue
}

export function resolveSelectionDrivenViewState({
  widgetId = null,
  responseSourceWidgetId = null,
  selectionCoordination = null,
  fields = [],
} = {}) {
  const nextViewState = {}
  for (const fieldEntry of Array.isArray(fields) ? fields : []) {
    if (!fieldEntry || typeof fieldEntry !== 'object') continue
    const viewKey = typeof fieldEntry.viewKey === 'string' && fieldEntry.viewKey.length > 0
      ? fieldEntry.viewKey
      : null
    if (!viewKey) continue
    nextViewState[viewKey] = resolveSelectionDrivenViewValue({
      widgetId,
      responseSourceWidgetId,
      field: fieldEntry.field || null,
      fallbackValue: fieldEntry.fallbackValue,
      selectionCoordination,
      responseType: fieldEntry.responseType || 'highlight',
      mapValue: typeof fieldEntry.mapValue === 'function' ? fieldEntry.mapValue : null,
    })
  }
  return nextViewState
}

export function resolveSelectionDrivenRows({
  widgetId = null,
  selectionCoordination = null,
  filteredRows = [],
  fallbackRows = [],
} = {}) {
  if (selectionCoordination?.shouldApplyFilter?.(widgetId) === true) {
    return Array.isArray(filteredRows) ? filteredRows : []
  }
  return Array.isArray(fallbackRows) ? fallbackRows : []
}
