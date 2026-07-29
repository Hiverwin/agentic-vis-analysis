import { cloneJsonValue as clone } from '../../shared/clone.js'
import {
  inferWidgetKindFromMark,
  isRecord,
} from './officialVegaLiteWidgetKinds.js'

function readMarkType(mark) {
  return typeof mark === 'string' ? mark : mark?.type || null
}

function makeSpecPathId(path = []) {
  if (!Array.isArray(path) || path.length === 0) {
    return 'root'
  }
  return path.join('.')
}

function pushUniqueRecord(target, nextRecord, keyBuilder) {
  if (!Array.isArray(target) || !isRecord(nextRecord) || typeof keyBuilder !== 'function') return
  const nextKey = keyBuilder(nextRecord)
  if (!nextKey) return
  const hasMatch = target.some((entry) => keyBuilder(entry) === nextKey)
  if (!hasMatch) {
    target.push(nextRecord)
  }
}

function collectParamNamesFromNode(node, target) {
  if (Array.isArray(node)) {
    for (const entry of node) {
      collectParamNamesFromNode(entry, target)
    }
    return
  }
  if (!isRecord(node)) return

  if (typeof node.param === 'string' && node.param.length > 0) {
    target.add(node.param)
  }

  for (const value of Object.values(node)) {
    collectParamNamesFromNode(value, target)
  }
}

function collectVegaLiteViewNodes(spec, path = [], inherited = {}) {
  if (!isRecord(spec)) return []

  const repeat = inherited.repeat || null
  const node = {
    path,
    pathId: makeSpecPathId(path),
    mark: readMarkType(spec.mark),
    repeat,
    hasLayerChildren: Array.isArray(spec.layer) && spec.layer.length > 0,
    spec,
  }

  const nodes = [node]
  const childCollections = [
    ['layer', spec.layer],
    ['vconcat', spec.vconcat],
    ['hconcat', spec.hconcat],
    ['concat', spec.concat],
  ]

  for (const [key, entries] of childCollections) {
    if (!Array.isArray(entries)) continue
    entries.forEach((entry, index) => {
      nodes.push(...collectVegaLiteViewNodes(entry, [...path, key, index], { repeat }))
    })
  }

  if (isRecord(spec.spec)) {
    const nextRepeat = isRecord(spec.repeat) ? clone(spec.repeat) : repeat
    nodes.push(...collectVegaLiteViewNodes(spec.spec, [...path, 'spec'], { repeat: nextRepeat }))
  }

  return nodes
}

function normalizeSelectionType(select = {}) {
  const normalizedType = typeof select?.type === 'string' ? select.type.trim().toLowerCase() : ''
  if (normalizedType === 'interval') return 'interval'
  if (normalizedType === 'point' || normalizedType === 'single' || normalizedType === 'multi') return 'point'
  return normalizedType || null
}

function collectEncodingParamConsumers(encoding = {}, path = [], paramConsumers = []) {
  if (!isRecord(encoding)) return

  for (const [channel, channelSpec] of Object.entries(encoding)) {
    if (!isRecord(channelSpec)) continue

    if (typeof channelSpec?.scale?.domain?.param === 'string') {
      pushUniqueRecord(paramConsumers, {
        paramName: channelSpec.scale.domain.param,
        consumerType: 'scaleDomain',
        channel,
        pathId: makeSpecPathId(path),
      }, (entry) => `${entry.paramName}:${entry.consumerType}:${entry.channel}:${entry.pathId}`)
    }

    const directCondition = channelSpec.condition
    const conditionEntries = Array.isArray(directCondition) ? directCondition : [directCondition]
    for (const condition of conditionEntries) {
      if (typeof condition?.param === 'string') {
        pushUniqueRecord(paramConsumers, {
          paramName: condition.param,
          consumerType: 'condition',
          channel,
          pathId: makeSpecPathId(path),
        }, (entry) => `${entry.paramName}:${entry.consumerType}:${entry.channel}:${entry.pathId}`)
      }
      const nestedTestParams = new Set()
      collectParamNamesFromNode(condition?.test, nestedTestParams)
      for (const paramName of nestedTestParams) {
        pushUniqueRecord(paramConsumers, {
          paramName,
          consumerType: 'conditionTest',
          channel,
          pathId: makeSpecPathId(path),
        }, (entry) => `${entry.paramName}:${entry.consumerType}:${entry.channel}:${entry.pathId}`)
      }
    }
  }
}

function collectTransformParamConsumers(transforms = [], path = [], paramConsumers = []) {
  if (!Array.isArray(transforms)) return

  for (const transform of transforms) {
    if (!isRecord(transform)) continue
    const filterParams = new Set()
    collectParamNamesFromNode(transform.filter, filterParams)
    for (const paramName of filterParams) {
      pushUniqueRecord(paramConsumers, {
        paramName,
        consumerType: 'filter',
        channel: null,
        pathId: makeSpecPathId(path),
      }, (entry) => `${entry.paramName}:${entry.consumerType}:${entry.pathId}`)
    }
  }
}

function summarizeCompositeKinds(spec) {
  const compositionKinds = []
  if (Array.isArray(spec?.vconcat)) compositionKinds.push('vconcat')
  if (Array.isArray(spec?.hconcat)) compositionKinds.push('hconcat')
  if (Array.isArray(spec?.concat)) compositionKinds.push('concat')
  if (Array.isArray(spec?.layer)) compositionKinds.push('layer')
  if (isRecord(spec?.repeat)) compositionKinds.push('repeat')
  if (isRecord(spec?.facet)) compositionKinds.push('facet')
  return compositionKinds
}

function buildParamInteractionModel({
  paramDefinitions = [],
  paramConsumers = [],
  views = [],
} = {}) {
  return paramDefinitions.map((definition) => {
    const consumers = paramConsumers.filter((entry) => entry.paramName === definition.name)
    const producerViews = [definition.pathId]
    const consumerViews = Array.from(new Set(consumers.map((entry) => entry.pathId)))
    const consumerTypes = Array.from(new Set(consumers.map((entry) => entry.consumerType)))
    const channels = Array.from(new Set(consumers.map((entry) => entry.channel).filter(Boolean)))
    const producerView = views.find((entry) => entry.viewId === definition.pathId) || null

    return {
      name: definition.name,
      selectionType: definition.selectionType,
      producerViewId: definition.pathId,
      producerMark: producerView?.mark || null,
      producerViews,
      consumerViews,
      consumerTypes,
      channels,
      resolve: definition.resolve || null,
      encodings: Array.isArray(definition.encodings) ? [...definition.encodings] : [],
      fields: Array.isArray(definition.fields) ? [...definition.fields] : [],
      isScaleBound: definition.isScaleBound,
      isBoundInput: definition.isBoundInput,
      eventHandlers: {
        on: definition.on || null,
        translate: definition.translate || null,
        zoom: definition.zoom || null,
      },
    }
  })
}

function deriveInteractionPatternIds({
  compositeKinds = [],
  paramInteractions = [],
} = {}) {
  const patternIds = []
  const hasRepeat = compositeKinds.includes('repeat')
  const hasLayer = compositeKinds.includes('layer')
  const hasConcat = compositeKinds.includes('vconcat')
    || compositeKinds.includes('hconcat')
    || compositeKinds.includes('concat')

  const intervalParams = paramInteractions.filter((entry) => entry.selectionType === 'interval')
  const pointParams = paramInteractions.filter((entry) => entry.selectionType === 'point')
  const anyScaleDomainDriver = paramInteractions.some((entry) => entry.consumerTypes.includes('scaleDomain'))
  const anyFilterDriver = paramInteractions.some((entry) => entry.consumerTypes.includes('filter'))
  const anyConditionDriver = paramInteractions.some((entry) => (
    entry.consumerTypes.includes('condition')
    || entry.consumerTypes.includes('conditionTest')
  ))
  const anyScaleBound = paramInteractions.some((entry) => entry.isScaleBound)
  const anyUnionResolve = paramInteractions.some((entry) => entry.resolve === 'union')
  const anyHoverProducer = paramInteractions.some((entry) => typeof entry.eventHandlers?.on === 'string' && entry.eventHandlers.on.includes('pointerover'))
  const anyBoundRange = paramInteractions.some((entry) => entry.selectionType === 'point' && entry.isBoundInput)

  if (hasConcat && intervalParams.length === 1 && anyScaleDomainDriver) {
    patternIds.push('overview_detail_scale_domain')
  }
  if (hasRepeat && intervalParams.length >= 1 && anyFilterDriver && !anyConditionDriver) {
    patternIds.push('repeat_brush_filter')
  }
  if (hasRepeat && intervalParams.length >= 1 && anyFilterDriver && hasLayer) {
    patternIds.push('repeat_brush_overlay')
  }
  if (hasRepeat && anyUnionResolve && anyScaleBound) {
    patternIds.push('repeat_scatter_matrix_brush_panzoom')
  }
  if (hasConcat && pointParams.length === 1 && anyFilterDriver && anyConditionDriver) {
    patternIds.push('cross_highlight_dashboard')
  }
  if (paramInteractions.length >= 2 && hasConcat && intervalParams.length >= 1 && pointParams.length >= 1 && anyFilterDriver && anyConditionDriver) {
    patternIds.push('bidirectional_crossfilter')
  }
  if (hasLayer && pointParams.length >= 1 && anyHoverProducer && anyFilterDriver) {
    patternIds.push('hover_driven_detail')
  }
  if (hasLayer && paramInteractions.length >= 2 && anyConditionDriver && anyBoundRange) {
    patternIds.push('bound_scrubber_focus')
  }

  return patternIds
}

function deriveStableInteractionModes({
  patternIds = [],
  paramInteractions = [],
} = {}) {
  const modes = []
  const hasPattern = (patternId) => patternIds.includes(patternId)
  const hasConsumerType = (consumerType) => paramInteractions.some((entry) => entry.consumerTypes.includes(consumerType))
  const hasScaleBinding = paramInteractions.some((entry) => entry.isScaleBound)
  const hasHoverDrivenPoint = paramInteractions.some((entry) => (
    entry.selectionType === 'point'
    && typeof entry.eventHandlers?.on === 'string'
    && entry.eventHandlers.on.includes('pointerover')
  ))
  const hasBoundInput = paramInteractions.some((entry) => entry.selectionType === 'point' && entry.isBoundInput)

  if (hasPattern('overview_detail_scale_domain') || hasScaleBinding || hasConsumerType('scaleDomain')) {
    modes.push('sharedDomain')
  }
  if (
    hasPattern('repeat_brush_filter')
    || hasPattern('bidirectional_crossfilter')
    || hasPattern('hover_driven_detail')
    || hasConsumerType('filter')
  ) {
    modes.push('sharedFilter')
  }
  if (
    hasPattern('repeat_brush_overlay')
    || hasPattern('cross_highlight_dashboard')
    || hasPattern('bidirectional_crossfilter')
    || hasConsumerType('condition')
    || hasConsumerType('conditionTest')
  ) {
    modes.push('sharedHighlight')
  }
  if (hasPattern('hover_driven_detail') || hasHoverDrivenPoint) {
    modes.push('focusDetail')
  }
  if (hasPattern('bound_scrubber_focus') || hasBoundInput) {
    modes.push('boundParameter')
  }

  return modes
}

function buildMultiViewActionSurface(paramInteractions = []) {
  const actions = []
  for (const param of paramInteractions) {
    if (param.selectionType === 'interval') {
      actions.push({
        name: 'vegaLite.setIntervalParam',
        paramName: param.name,
      })
      actions.push({
        name: 'vegaLite.clearParam',
        paramName: param.name,
      })
      continue
    }
    if (param.selectionType === 'point') {
      actions.push({
        name: 'vegaLite.setPointParam',
        paramName: param.name,
      })
      actions.push({
        name: 'vegaLite.clearParam',
        paramName: param.name,
      })
    }
  }
  return actions
}

function normalizeScopeKinds(compositeKinds = []) {
  return compositeKinds.map((kind) => {
    if (kind === 'vconcat' || kind === 'hconcat' || kind === 'concat') return 'across_concat_views'
    if (kind === 'repeat') return 'across_repeated_views'
    if (kind === 'layer') return 'within_layered_view'
    if (kind === 'facet') return 'within_faceted_view'
    return kind
  })
}

function normalizeConsumerEffectKind(consumerType) {
  if (consumerType === 'filter') return 'filter'
  if (consumerType === 'condition' || consumerType === 'conditionTest') return 'highlight'
  if (consumerType === 'scaleDomain') return 'syncDomain'
  return consumerType || null
}

function buildInteractionClassification({
  compositeKinds = [],
  paramInteractions = [],
  patternIds = [],
} = {}) {
  const sourceStateKinds = Array.from(new Set(
    paramInteractions
      .map((entry) => entry.selectionType)
      .filter(Boolean),
  ))
  const consumerEffectKinds = Array.from(new Set(
    paramInteractions
      .flatMap((entry) => entry.consumerTypes)
      .map((entry) => normalizeConsumerEffectKind(entry))
      .filter(Boolean),
  ))
  const scopeKinds = Array.from(new Set(normalizeScopeKinds(compositeKinds)))
  const interactionModes = Array.from(new Set(deriveStableInteractionModes({
    patternIds,
    paramInteractions,
  })))
  return {
    sourceStateKinds,
    consumerEffectKinds,
    scopeKinds,
    interactionModes,
  }
}

function buildProjectedWidgetLinks(paramInteractions = []) {
  const projectedLinks = []
  for (const param of paramInteractions) {
    for (const consumerViewId of param.consumerViews) {
      for (const consumerType of param.consumerTypes) {
        const effectKind = normalizeConsumerEffectKind(consumerType)
        if (!effectKind) continue
        pushUniqueRecord(projectedLinks, {
          ref: `wl://widgetva-app/vega-lite/link/${param.name}/${param.producerViewId}/${consumerViewId}/${effectKind}`,
          sourceViewId: param.producerViewId,
          targetViewId: consumerViewId,
          sourceParamName: param.name,
          sourceSelectionType: param.selectionType,
          kind: effectKind,
          primitive: effectKind,
          effect:
            effectKind === 'filter'
              ? 'applyFilter'
              : effectKind === 'highlight'
                ? 'applyHighlight'
                : effectKind === 'syncDomain'
                  ? 'syncDomain'
                  : null,
          activationPolicy: 'automatic',
          channels: [...param.channels],
          description: `${param.name} propagates ${effectKind} semantics from ${param.producerViewId} to ${consumerViewId}.`,
        }, (entry) => entry.ref)
      }
    }
  }
  return projectedLinks
}

function buildSharedStateCandidates(paramInteractions = []) {
  return paramInteractions.map((param) => {
    const surfaces = []
    if (param.selectionType === 'interval' || param.selectionType === 'point') {
      surfaces.push('selection')
    }
    if (param.consumerTypes.includes('filter')) {
      surfaces.push('globalFilters')
    }
    if (param.consumerTypes.includes('condition') || param.consumerTypes.includes('conditionTest')) {
      surfaces.push('highlight')
    }
    if (param.consumerTypes.includes('scaleDomain') || param.isScaleBound) {
      surfaces.push('viewport')
    }
    if (typeof param.eventHandlers?.on === 'string' && param.eventHandlers.on.includes('pointerover')) {
      surfaces.push('focus')
    }
    if (param.isBoundInput) {
      surfaces.push('view')
    }
    return {
      paramName: param.name,
      sourceSelectionType: param.selectionType,
      sharedSurfaces: Array.from(new Set(surfaces)),
    }
  })
}

export function projectVegaLiteMultiViewToWidgetSemantics(interactionModel = {}) {
  const paramInteractions = Array.isArray(interactionModel?.params) ? interactionModel.params : []
  const classification = buildInteractionClassification({
    compositeKinds: Array.isArray(interactionModel?.compositeKinds) ? interactionModel.compositeKinds : [],
    paramInteractions,
    patternIds: Array.isArray(interactionModel?.patternIds) ? interactionModel.patternIds : [],
  })
  return {
    classification,
    projectedLinks: buildProjectedWidgetLinks(paramInteractions),
    sharedStateCandidates: buildSharedStateCandidates(paramInteractions),
  }
}

export function describeVegaLiteMultiViewInteractions(spec) {
  if (!isRecord(spec)) {
    throw new Error('describeVegaLiteMultiViewInteractions requires a Vega-Lite spec object.')
  }

  const normalizedSpec = clone(spec)
  const collectedNodes = collectVegaLiteViewNodes(normalizedSpec)
  const views = collectedNodes
    .filter((entry) => entry.mark || Array.isArray(entry.spec?.layer) || isRecord(entry.spec?.repeat))
    .map((entry) => ({
      viewId: entry.pathId,
      path: entry.path,
      mark: entry.mark,
      repeat: entry.repeat || null,
      compositionKinds: summarizeCompositeKinds(entry.spec),
    }))

  const paramDefinitions = []
  const paramConsumers = []

  for (const node of collectedNodes) {
    const params = Array.isArray(node.spec?.params) ? node.spec.params : []
    for (const param of params) {
      if (!isRecord(param) || !isRecord(param.select) || typeof param.name !== 'string' || param.name.length === 0) continue
      pushUniqueRecord(paramDefinitions, {
        name: param.name,
        selectionType: normalizeSelectionType(param.select),
        pathId: node.pathId,
        resolve: typeof param.select?.resolve === 'string' ? param.select.resolve : null,
        encodings: Array.isArray(param.select?.encodings) ? [...param.select.encodings] : [],
        fields: Array.isArray(param.select?.fields) ? [...param.select.fields] : [],
        isScaleBound: param.bind === 'scales',
        isBoundInput: param.bind != null && param.bind !== 'scales',
        on: typeof param.select?.on === 'string' ? param.select.on : null,
        translate: typeof param.select?.translate === 'string' ? param.select.translate : null,
        zoom: typeof param.select?.zoom === 'string' ? param.select.zoom : null,
      }, (entry) => `${entry.name}:${entry.pathId}`)
    }

    collectTransformParamConsumers(node.spec?.transform, node.path, paramConsumers)
    collectEncodingParamConsumers(node.spec?.encoding, node.path, paramConsumers)
  }

  const compositeKinds = Array.from(new Set([
    ...summarizeCompositeKinds(normalizedSpec),
    ...collectedNodes.flatMap((entry) => summarizeCompositeKinds(entry.spec)),
  ]))
  const paramInteractions = buildParamInteractionModel({
    paramDefinitions,
    paramConsumers,
    views,
  })
  const patternIds = deriveInteractionPatternIds({
    compositeKinds,
    paramInteractions,
  })
  const widgetSemantics = projectVegaLiteMultiViewToWidgetSemantics({
    compositeKinds,
    params: paramInteractions,
  })

  return {
    topology: compositeKinds.length > 0 ? 'composite_spec_multiview' : 'single_view',
    compositeKinds,
    viewCount: views.length,
    views,
    params: paramInteractions,
    patternIds,
    actionSurface: buildMultiViewActionSurface(paramInteractions),
    widgetSemantics,
  }
}
