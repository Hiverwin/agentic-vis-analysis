import { makeCoordinationRelation } from '../../contracts/coordination-contracts.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function slug(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'field'
}

function readWorkspaceRef(caseId) {
  return `wl://widgetva-app/workspace/${caseId || 'workspace'}`
}

function readWidgetRef(caseId, widgetId) {
  return `${readWorkspaceRef(caseId)}/widget/${widgetId}`
}

function readWidgetId(model = {}) {
  return model?.widget?.id || model?.widgetId || null
}

function readModelWidgetRef(caseId, model = {}) {
  return model?.widgetRef || (readWidgetId(model) ? readWidgetRef(caseId, readWidgetId(model)) : null)
}

function normalizeAvailableFields(fields) {
  if (fields instanceof Set) return fields
  if (Array.isArray(fields)) return new Set(fields)
  return new Set()
}

function normalizeFieldModel(model = {}) {
  if (!model || typeof model !== 'object' || Array.isArray(model)) return null
  const widgetId = readWidgetId(model)
  if (!widgetId) return null
  const widgetKind = model.widgetKind || model.kind || model.widget?.widgetKind || model.widget?.kind || null
  if (!widgetKind || widgetKind === 'custom') return null
  return {
    ...model,
    widget: model.widget || { id: widgetId },
    widgetKind,
    availableFields: normalizeAvailableFields(model.availableFields),
    reencodeTargets: Array.isArray(model.reencodeTargets) ? model.reencodeTargets : [],
  }
}

function supportsField(model, field) {
  return typeof field === 'string' && field.length > 0 && model?.availableFields?.has(field)
}

function supportsReencode(model) {
  return Array.isArray(model?.reencodeTargets) && model.reencodeTargets.length > 0
}

function readPreferredReencodeChannel(model = {}, fallback = 'color') {
  const target = Array.isArray(model?.reencodeTargets)
    ? model.reencodeTargets.find((entry) => typeof entry?.channel === 'string' && entry.channel.length > 0)
    : null
  return target?.channel || fallback
}

function buildCommonFieldMapping(source = {}, target = {}) {
  const targetFields = target?.availableFields instanceof Set ? target.availableFields : new Set()
  return listAvailableFields(source)
    .filter((field) => targetFields.has(field))
    .map((field) => ({ sourceField: field, targetField: field }))
}

function supportsHighlight(model) {
  return ['scatter', 'bar', 'line', 'heatmap', 'parallelCoordinates', 'sankey'].includes(model?.widgetKind)
}

function listAvailableFields(model = {}) {
  return Array.from(model?.availableFields || []).filter((field) => typeof field === 'string' && field.length > 0)
}

function compactFieldList(fields = []) {
  return [...new Set((Array.isArray(fields) ? fields : []).filter((field) => typeof field === 'string' && field.length > 0))]
}

function readSelectionSources(source) {
  const sourceSelections = []
  if (source.widgetKind === 'bar' && source.categoryField) {
    sourceSelections.push({ fields: [source.categoryField], selectionId: source.categoryField })
  }
  if (source.widgetKind === 'line' && source.seriesField) {
    sourceSelections.push({ fields: [source.seriesField], selectionId: `${source.seriesField}-series` })
  }
  if (source.widgetKind === 'line' && source.xField) {
    sourceSelections.push({ fields: [source.xField], selectionId: `${source.xField}-value` })
  }
  if (source.widgetKind === 'scatter') {
    const fields = compactFieldList([source.xField, source.yField])
    if (fields.length > 0) {
      sourceSelections.push({ fields, selectionId: 'brush', selectionKind: 'interval', skipFilter: true })
    }
  }
  if (source.widgetKind === 'heatmap') {
    const fields = compactFieldList([source.xField, source.yField])
    if (fields.length > 0) {
      sourceSelections.push({ fields, selectionId: 'cell', requireAllFields: true })
      sourceSelections.push({ fields, selectionId: 'submatrix', requireAllFields: true })
    }
  }
  if (source.widgetKind === 'parallelCoordinates') {
    const fields = listAvailableFields(source)
    if (fields.length > 0) {
      sourceSelections.push({ fields, selectionId: 'axes', selectionKind: 'interval' })
      sourceSelections.push({ fields, selectionId: 'record' })
    }
  }
  if (source.widgetKind === 'sankey') {
    const fields = listAvailableFields(source)
    if (fields.length > 0) {
      sourceSelections.push({ fields, selectionId: 'flow' })
      sourceSelections.push({ fields, selectionId: 'node' })
    }
  }
  return sourceSelections
}

function readDomainSources(source) {
  const sourceChannels = []
  if (source.widgetKind === 'scatter') {
    if (source.xField) sourceChannels.push({ sourceChannel: 'x', field: source.xField })
    if (source.yField) sourceChannels.push({ sourceChannel: 'y', field: source.yField })
  }
  if (source.widgetKind === 'line' && source.xField) {
    sourceChannels.push({ sourceChannel: 'x', field: source.xField })
  }
  return sourceChannels
}

function readIntervalSources(source) {
  if (source.widgetKind !== 'scatter') return []
  const channels = readDomainSources(source)
  return channels.length > 0
    ? [{ selectionId: 'brush', channels }]
    : []
}

function buildFieldFilterChannelMapping(sourceChannels = [], target = {}) {
  return sourceChannels
    .filter(({ field }) => supportsField(target, field))
    .map(({ sourceChannel, field }) => ({ sourceChannel, targetField: field }))
}

function buildTargetDomainChannelMapping(sourceChannels = [], target = {}) {
  const targetChannels = [
    target.xField ? { targetChannel: 'x', field: target.xField } : null,
    target.yField ? { targetChannel: 'y', field: target.yField } : null,
  ].filter(Boolean)
  return sourceChannels.flatMap(({ sourceChannel, field }) =>
    targetChannels
      .filter((targetChannel) => targetChannel.field === field)
      .map((targetChannel) => ({
        sourceChannel,
        targetChannel: targetChannel.targetChannel,
      })))
}

function buildSelectionFieldMapping(sourceSelection = {}, target = {}) {
  const fields = compactFieldList(sourceSelection.fields)
  const mappings = fields
    .filter((field) => supportsField(target, field))
    .map((field) => ({ sourceField: field, targetField: field }))
  if (sourceSelection.requireAllFields && mappings.length !== fields.length) return []
  return mappings
}

function readSelectionSafeKey(sourceSelection = {}, fieldMapping = []) {
  if (fieldMapping.length > 0) {
    return fieldMapping.map((mapping) => slug(mapping.targetField)).join('-')
  }
  return slug(sourceSelection.selectionId || 'selection')
}

function readSelectionRelationKey(sourceSelection = {}, fieldMapping = []) {
  const selectionKey = slug(sourceSelection.selectionId || 'selection')
  const fieldKey = readSelectionSafeKey(sourceSelection, fieldMapping)
  return fieldKey && fieldKey !== selectionKey ? `${selectionKey}-${fieldKey}` : selectionKey
}

function makeRelationLink(link) {
  const relation = makeCoordinationRelation({
    ...link,
    activation: link.activation || 'automatic',
  })
  const linkId = link.id || link.linkId || link.ref
  return {
    ...relation,
    id: linkId,
    linkId,
    transform: relation.transform || link.transform,
  }
}

function buildSelectionToFilterRelations({ caseId, source, targets }) {
  const sourceWidgetId = readWidgetId(source)
  const sourceWidgetRef = readModelWidgetRef(caseId, source)
  const sourceSelections = readSelectionSources(source)

  return sourceSelections.filter((selection) => !selection.skipFilter).flatMap((sourceSelection) => targets
    .filter((target) => readWidgetId(target) !== sourceWidgetId)
    .map((target) => {
      const fieldMapping = buildSelectionFieldMapping(sourceSelection, target)
      if (fieldMapping.length === 0) return null
      const targetWidgetId = readWidgetId(target)
      const targetWidgetRef = readModelWidgetRef(caseId, target)
      const safeField = readSelectionSafeKey(sourceSelection, fieldMapping)
      const relationKey = readSelectionRelationKey(sourceSelection, fieldMapping)
      return makeRelationLink({
        ref: `${readWorkspaceRef(caseId)}/coordination/${sourceWidgetId}-${relationKey}-selection-to-${targetWidgetId}-${safeField}-filter`,
        sourceStateRef: `${sourceWidgetRef}/selection/${sourceSelection.selectionId}`,
        targetStateRef: `${targetWidgetRef}/transform/${safeField}-filter`,
        relation: 'controls',
        transform: {
          kind: 'selectionToFilter',
          fieldMapping,
        },
        activation: 'automatic',
      })
    })
    .filter(Boolean))
}

function buildSelectionToHighlightRelations({ caseId, source, targets }) {
  const sourceWidgetId = readWidgetId(source)
  const sourceWidgetRef = readModelWidgetRef(caseId, source)
  const sourceSelections = readSelectionSources(source)

  return sourceSelections.flatMap((sourceSelection) => targets
    .filter((target) => readWidgetId(target) !== sourceWidgetId && supportsHighlight(target))
    .map((target) => {
      const fieldMapping = buildSelectionFieldMapping(sourceSelection, target)
      if (fieldMapping.length === 0) return null
      const targetWidgetId = readWidgetId(target)
      const targetWidgetRef = readModelWidgetRef(caseId, target)
      const safeField = readSelectionSafeKey(sourceSelection, fieldMapping)
      const relationKey = readSelectionRelationKey(sourceSelection, fieldMapping)
      return makeRelationLink({
        ref: `${readWorkspaceRef(caseId)}/coordination/${sourceWidgetId}-${relationKey}-selection-to-${targetWidgetId}-${safeField}-highlight`,
        sourceStateRef: `${sourceWidgetRef}/selection/${sourceSelection.selectionId}`,
        targetStateRef: `${targetWidgetRef}/view/highlight`,
        relation: 'controls',
        transform: {
          kind: 'selectionToHighlight',
          fieldMapping,
        },
        activation: 'automatic',
      })
    })
    .filter(Boolean))
}

function buildDomainToFilterRelations({ caseId, source, targets }) {
  const sourceWidgetId = readWidgetId(source)
  const sourceWidgetRef = readModelWidgetRef(caseId, source)
  const sourceChannels = readDomainSources(source)
  if (sourceChannels.length === 0) return []

  return targets
    .filter((target) => readWidgetId(target) !== sourceWidgetId)
    .map((target) => {
      const channelMapping = buildFieldFilterChannelMapping(sourceChannels, target)
      if (channelMapping.length === 0) return null
      const targetWidgetId = readWidgetId(target)
      const targetWidgetRef = readModelWidgetRef(caseId, target)
      const mappedFields = channelMapping.map((mapping) => slug(mapping.targetField)).join('-')
      return makeRelationLink({
        ref: `${readWorkspaceRef(caseId)}/coordination/${sourceWidgetId}-zoom-to-${targetWidgetId}-${mappedFields}-domain-filter`,
        sourceStateRef: `${sourceWidgetRef}/view/zoom`,
        targetStateRef: `${targetWidgetRef}/transform/${mappedFields}-domain-filter`,
        relation: 'controls',
        transform: {
          kind: 'domainToFilter',
          channelMapping,
        },
        activation: 'automatic',
      })
    })
    .filter(Boolean)
}

function buildIntervalToFilterRelations({ caseId, source, targets }) {
  const sourceWidgetId = readWidgetId(source)
  const sourceWidgetRef = readModelWidgetRef(caseId, source)
  const intervalSources = readIntervalSources(source)
  if (intervalSources.length === 0) return []

  return intervalSources.flatMap(({ selectionId, channels }) => targets
    .filter((target) => readWidgetId(target) !== sourceWidgetId)
    .map((target) => {
      const channelMapping = buildFieldFilterChannelMapping(channels, target)
      if (channelMapping.length === 0) return null
      const targetWidgetId = readWidgetId(target)
      const targetWidgetRef = readModelWidgetRef(caseId, target)
      const mappedFields = channelMapping.map((mapping) => slug(mapping.targetField)).join('-')
      return makeRelationLink({
        ref: `${readWorkspaceRef(caseId)}/coordination/${sourceWidgetId}-${selectionId}-to-${targetWidgetId}-${mappedFields}-interval-filter`,
        sourceStateRef: `${sourceWidgetRef}/selection/${selectionId}`,
        targetStateRef: `${targetWidgetRef}/transform/${mappedFields}-interval-filter`,
        relation: 'controls',
        transform: {
          kind: 'intervalToFilter',
          channelMapping,
        },
        activation: 'automatic',
      })
    })
    .filter(Boolean))
}

function buildIntervalToDomainRelations({ caseId, source, targets }) {
  const sourceWidgetId = readWidgetId(source)
  const sourceWidgetRef = readModelWidgetRef(caseId, source)
  const intervalSources = readIntervalSources(source)
  if (intervalSources.length === 0) return []

  return intervalSources.flatMap(({ selectionId, channels }) => targets
    .filter((target) => readWidgetId(target) !== sourceWidgetId)
    .map((target) => {
      const channelMapping = buildTargetDomainChannelMapping(channels, target)
      if (channelMapping.length === 0) return null
      const targetWidgetId = readWidgetId(target)
      const targetWidgetRef = readModelWidgetRef(caseId, target)
      const mappedChannels = channelMapping.map((mapping) => `${mapping.sourceChannel}-${mapping.targetChannel}`).join('-')
      return makeRelationLink({
        ref: `${readWorkspaceRef(caseId)}/coordination/${sourceWidgetId}-${selectionId}-to-${targetWidgetId}-${mappedChannels}-interval-domain`,
        sourceStateRef: `${sourceWidgetRef}/selection/${selectionId}`,
        targetStateRef: `${targetWidgetRef}/view/zoom`,
        relation: 'controls',
        transform: {
          kind: 'intervalToDomain',
          channelMapping,
        },
        activation: 'automatic',
      })
    })
    .filter(Boolean))
}

function buildDomainToDomainRelations({ caseId, source, targets }) {
  const sourceWidgetId = readWidgetId(source)
  const sourceWidgetRef = readModelWidgetRef(caseId, source)
  const sourceChannels = readDomainSources(source)
  if (sourceChannels.length === 0) return []

  return targets
    .filter((target) => readWidgetId(target) !== sourceWidgetId)
    .map((target) => {
      const channelMapping = buildTargetDomainChannelMapping(sourceChannels, target)
      if (channelMapping.length === 0) return null
      const targetWidgetId = readWidgetId(target)
      const targetWidgetRef = readModelWidgetRef(caseId, target)
      const mappedChannels = channelMapping.map((mapping) => `${mapping.sourceChannel}-${mapping.targetChannel}`).join('-')
      return makeRelationLink({
        ref: `${readWorkspaceRef(caseId)}/coordination/${sourceWidgetId}-zoom-to-${targetWidgetId}-${mappedChannels}-domain-sync`,
        sourceStateRef: `${sourceWidgetRef}/view/zoom`,
        targetStateRef: `${targetWidgetRef}/view/zoom`,
        relation: 'controls',
        transform: {
          kind: 'domainToDomain',
          channelMapping,
        },
        activation: 'automatic',
      })
    })
    .filter(Boolean)
}

function buildSelectionToReencodeRelations({ caseId, source, targets }) {
  const sourceWidgetId = readWidgetId(source)
  const sourceWidgetRef = readModelWidgetRef(caseId, source)
  const sourceSelections = readSelectionSources(source)

  return sourceSelections.flatMap((sourceSelection) => targets
    .filter((target) => readWidgetId(target) !== sourceWidgetId && supportsReencode(target))
    .map((target) => {
      const fieldMapping = buildSelectionFieldMapping(sourceSelection, target)
      if (fieldMapping.length === 0) return null
      const targetWidgetId = readWidgetId(target)
      const targetWidgetRef = readModelWidgetRef(caseId, target)
      const safeField = readSelectionSafeKey(sourceSelection, fieldMapping)
      const relationKey = readSelectionRelationKey(sourceSelection, fieldMapping)
      return makeRelationLink({
        ref: `${readWorkspaceRef(caseId)}/coordination/${sourceWidgetId}-${relationKey}-selection-to-${targetWidgetId}-reencode`,
        sourceStateRef: `${sourceWidgetRef}/selection/${sourceSelection.selectionId}`,
        targetStateRef: `${targetWidgetRef}/view/reencode`,
        relation: 'controls',
        transform: {
          kind: 'selectionToReencode',
          fieldMapping,
          reencode: {
            channel: readPreferredReencodeChannel(target, 'color'),
            mode: 'emphasizeSelection',
          },
        },
        activation: 'automatic',
      })
    })
    .filter(Boolean))
}

function buildReencodeToReencodeRelations({ caseId, source, targets }) {
  if (!supportsReencode(source)) return []
  const sourceWidgetId = readWidgetId(source)
  const sourceWidgetRef = readModelWidgetRef(caseId, source)
  const sourceChannel = readPreferredReencodeChannel(source, 'color')

  return targets
    .filter((target) => readWidgetId(target) !== sourceWidgetId && supportsReencode(target))
    .map((target) => {
      const targetWidgetId = readWidgetId(target)
      const targetWidgetRef = readModelWidgetRef(caseId, target)
      const targetChannel = readPreferredReencodeChannel(target, sourceChannel)
      return makeRelationLink({
        ref: `${readWorkspaceRef(caseId)}/coordination/${sourceWidgetId}-reencode-to-${targetWidgetId}-reencode`,
        sourceStateRef: `${sourceWidgetRef}/view/reencode`,
        targetStateRef: `${targetWidgetRef}/view/reencode`,
        relation: 'controls',
        transform: {
          kind: 'reencodeToReencode',
          reencodeMapping: [{ sourceChannel, targetChannel }],
          fieldMapping: buildCommonFieldMapping(source, target),
        },
        activation: 'automatic',
      })
    })
}

function buildSortToReencodeRelations({ caseId, source, targets }) {
  if (source.widgetKind !== 'bar' || !source.categoryField) return []
  const sourceWidgetId = readWidgetId(source)
  const sourceWidgetRef = readModelWidgetRef(caseId, source)

  return targets
    .filter((target) => (
      readWidgetId(target) !== sourceWidgetId
      && supportsReencode(target)
      && supportsField(target, source.categoryField)
    ))
    .map((target) => {
      const targetWidgetId = readWidgetId(target)
      const targetWidgetRef = readModelWidgetRef(caseId, target)
      const targetChannel = readPreferredReencodeChannel(target, 'opacity')
      return makeRelationLink({
        ref: `${readWorkspaceRef(caseId)}/coordination/${sourceWidgetId}-sort-to-${targetWidgetId}-${slug(source.categoryField)}-reencode`,
        sourceStateRef: `${sourceWidgetRef}/view/sort`,
        targetStateRef: `${targetWidgetRef}/view/reencode`,
        relation: 'controls',
        transform: {
          kind: 'reencodeToReencode',
          fieldMapping: [{ sourceField: source.categoryField, targetField: source.categoryField }],
          reencodeMapping: [{ sourceChannel: 'order', targetChannel }],
          reencode: {
            channel: targetChannel,
            mode: 'alignSortOrder',
            sourceSlot: 'view.sort',
          },
        },
        activation: 'automatic',
      })
    })
}

function buildStructureToReencodeRelations({ caseId, source, targets }) {
  if (source.widgetKind !== 'sankey') return []
  const sourceWidgetId = readWidgetId(source)
  const sourceWidgetRef = readModelWidgetRef(caseId, source)

  return targets
    .filter((target) => (
      readWidgetId(target) !== sourceWidgetId
      && target.widgetKind === 'bar'
      && supportsReencode(target)
    ))
    .map((target) => {
      const fieldMapping = buildCommonFieldMapping(source, target)
      if (fieldMapping.length === 0) return null
      const targetWidgetId = readWidgetId(target)
      const targetWidgetRef = readModelWidgetRef(caseId, target)
      const targetChannel = readPreferredReencodeChannel(target, 'color')
      return makeRelationLink({
        ref: `${readWorkspaceRef(caseId)}/coordination/${sourceWidgetId}-structure-to-${targetWidgetId}-grouping-reencode`,
        sourceStateRef: `${sourceWidgetRef}/view/addRemove`,
        targetStateRef: `${targetWidgetRef}/view/reencode`,
        relation: 'controls',
        transform: {
          kind: 'reencodeToReencode',
          fieldMapping,
          reencodeMapping: [{ sourceChannel: 'grouping', targetChannel }],
          reencode: {
            channel: targetChannel,
            mode: 'projectGrouping',
            sourceSlot: 'view.addRemove',
          },
        },
        activation: 'automatic',
      })
    })
    .filter(Boolean)
}

export function buildDerivedCoordinationRelations(caseDefinition = {}, fieldModels = []) {
  const caseId = caseDefinition?.id || 'workspace'
  const models = (Array.isArray(fieldModels) ? fieldModels : [])
    .map(normalizeFieldModel)
    .filter(Boolean)

  if (models.length < 2) return []

  return clone(models.flatMap((source) => [
    ...buildSelectionToFilterRelations({ caseId, source, targets: models }),
    ...buildSelectionToHighlightRelations({ caseId, source, targets: models }),
    ...buildDomainToFilterRelations({ caseId, source, targets: models }),
    ...buildIntervalToFilterRelations({ caseId, source, targets: models }),
    ...buildIntervalToDomainRelations({ caseId, source, targets: models }),
    ...buildDomainToDomainRelations({ caseId, source, targets: models }),
    ...buildSelectionToReencodeRelations({ caseId, source, targets: models }),
    ...buildReencodeToReencodeRelations({ caseId, source, targets: models }),
    ...buildSortToReencodeRelations({ caseId, source, targets: models }),
    ...buildStructureToReencodeRelations({ caseId, source, targets: models }),
  ]))
}
