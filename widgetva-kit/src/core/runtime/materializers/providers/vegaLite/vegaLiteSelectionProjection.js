function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function readSelectionId(selection = {}) {
  return selection?.selectionId || selection?.selection_id || null
}

export function normalizeSelectionMap(selections = []) {
  const map = new Map()
  for (const selection of Array.isArray(selections) ? selections : []) {
    const selectionId = readSelectionId(selection)
    if (typeof selectionId === 'string' && selectionId.length > 0) {
      map.set(selectionId, selection)
    }
  }
  return map
}

export function collectScaleBoundParamNames(spec, collected = new Set()) {
  if (!isPlainObject(spec)) return collected

  for (const param of Array.isArray(spec?.params) ? spec.params : []) {
    if (
      isPlainObject(param)
      && typeof param?.name === 'string'
      && param.name.length > 0
      && param?.bind === 'scales'
    ) {
      collected.add(param.name)
    }
  }

  if (Array.isArray(spec.layer)) {
    for (const child of spec.layer) collectScaleBoundParamNames(child, collected)
  }
  if (Array.isArray(spec.vconcat)) {
    for (const child of spec.vconcat) collectScaleBoundParamNames(child, collected)
  }
  if (Array.isArray(spec.hconcat)) {
    for (const child of spec.hconcat) collectScaleBoundParamNames(child, collected)
  }
  if (Array.isArray(spec.concat)) {
    for (const child of spec.concat) collectScaleBoundParamNames(child, collected)
  }
  if (isPlainObject(spec.spec)) {
    collectScaleBoundParamNames(spec.spec, collected)
  }

  return collected
}

function escapeDatumField(field) {
  return String(field).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function isTemporalLikeValue(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return true
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed)
  }
  return false
}

export function buildComparableExpression(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return `toDate(${JSON.stringify(value.toISOString())})`
  }
  if (isTemporalLikeValue(value)) {
    return `toDate(${JSON.stringify(value)})`
  }
  return JSON.stringify(value)
}

export function buildDatumFieldExpression(field, predicate = null) {
  const datumRef = `datum['${escapeDatumField(field)}']`
  const value = predicate?.value
  const firstValue = Array.isArray(value) ? value[0] : value
  return isTemporalLikeValue(firstValue)
    ? `toDate(${datumRef})`
    : datumRef
}

export function buildPredicateExpression(predicate) {
  const field = typeof predicate?.field === 'string' ? predicate.field : null
  if (!field) return null
  const datumRef = buildDatumFieldExpression(field, predicate)

  if (predicate.op === 'equals' || predicate.op === 'eq') {
    return `${datumRef} === ${buildComparableExpression(predicate.value)}`
  }
  if (predicate.op === 'in' && Array.isArray(predicate.value) && predicate.value.length > 0) {
    return `indexof([${predicate.value.map((entry) => buildComparableExpression(entry)).join(', ')}], ${datumRef}) >= 0`
  }
  if (predicate.op === 'between' && Array.isArray(predicate.value) && predicate.value.length >= 2) {
    return `${datumRef} >= ${buildComparableExpression(predicate.value[0])} && ${datumRef} <= ${buildComparableExpression(predicate.value[1])}`
  }
  if (predicate.op === 'gte' || predicate.op === 'greaterThanOrEqual') {
    return `${datumRef} >= ${buildComparableExpression(predicate.value)}`
  }
  if (predicate.op === 'lte' || predicate.op === 'lessThanOrEqual') {
    return `${datumRef} <= ${buildComparableExpression(predicate.value)}`
  }
  if (predicate.op === 'gt' || predicate.op === 'greaterThan') {
    return `${datumRef} > ${buildComparableExpression(predicate.value)}`
  }
  if (predicate.op === 'lt' || predicate.op === 'lessThan') {
    return `${datumRef} < ${buildComparableExpression(predicate.value)}`
  }
  return null
}

function buildSelectionExpression(selection) {
  const predicates = Array.isArray(selection?.predicates) ? selection.predicates : []
  const predicateClauses = predicates.map((predicate) => buildPredicateExpression(predicate)).filter(Boolean)
  return predicateClauses.length > 0 ? predicateClauses.join(' && ') : null
}

function rewriteParamTestExpression(testSpec, selectionMap, consumedSelectionIds) {
  if (!isPlainObject(testSpec)) return null

  if (typeof testSpec.param === 'string') {
    const selection = selectionMap.get(testSpec.param) || null
    const expression = buildSelectionExpression(selection)
    const emptyFalse = testSpec.empty === false
    if (!selection) {
      return emptyFalse ? 'false' : null
    }
    const selectionId = readSelectionId(selection)
    if (selectionId) consumedSelectionIds.add(selectionId)
    return expression || (emptyFalse ? 'false' : null)
  }

  if (Array.isArray(testSpec.and) && testSpec.and.length > 0) {
    const parts = testSpec.and
      .map((entry) => rewriteParamTestExpression(entry, selectionMap, consumedSelectionIds))
      .filter((entry) => typeof entry === 'string' && entry.length > 0)
    return parts.length > 0 ? parts.map((entry) => `(${entry})`).join(' && ') : null
  }

  if (Array.isArray(testSpec.or) && testSpec.or.length > 0) {
    const parts = testSpec.or
      .map((entry) => rewriteParamTestExpression(entry, selectionMap, consumedSelectionIds))
      .filter((entry) => typeof entry === 'string' && entry.length > 0)
    return parts.length > 0 ? parts.map((entry) => `(${entry})`).join(' || ') : null
  }

  if (isPlainObject(testSpec.not)) {
    const inner = rewriteParamTestExpression(testSpec.not, selectionMap, consumedSelectionIds)
    return typeof inner === 'string' && inner.length > 0 ? `!(${inner})` : null
  }

  return null
}

function readSelectionDomainForChannel(selection, channelDef, channelName = null) {
  if (!isPlainObject(selection) || !isPlainObject(channelDef)) return null

  const explicitDomain = channelName === 'x'
    ? selection?.domain?.xDomain
    : channelName === 'y'
      ? selection?.domain?.yDomain
      : null
  if (Array.isArray(explicitDomain) && explicitDomain.length >= 2) {
    return clone(explicitDomain)
  }

  const fieldName = typeof channelDef?.field === 'string' ? channelDef.field : null
  if (!fieldName) return null

  const matchingPredicate = (Array.isArray(selection?.predicates) ? selection.predicates : []).find((predicate) => (
    predicate?.field === fieldName
    && predicate?.op === 'between'
    && Array.isArray(predicate?.value)
    && predicate.value.length >= 2
  ))
  return matchingPredicate ? clone(matchingPredicate.value) : null
}

function rewriteParamFilterTransform(transform, selectionMap, consumedSelectionIds) {
  if (!isPlainObject(transform) || !isPlainObject(transform.filter)) {
    return { transform, rewritten: false }
  }

  if (typeof transform.filter.param !== 'string') {
    const rewrittenExpression = rewriteParamTestExpression(transform.filter, selectionMap, consumedSelectionIds)
    if (typeof rewrittenExpression !== 'string' || rewrittenExpression.length === 0) {
      return { transform, rewritten: false }
    }
    return {
      transform: {
        ...transform,
        filter: rewrittenExpression,
      },
      rewritten: true,
    }
  }

  const paramName = transform.filter.param
  const selection = selectionMap.get(paramName) || null
  if (!selection) {
    return { transform, rewritten: false }
  }

  const expression = buildSelectionExpression(selection)
  if (!expression) {
    return { transform, rewritten: false }
  }

  const selectionId = readSelectionId(selection)
  if (selectionId) consumedSelectionIds.add(selectionId)
  return {
    transform: {
      ...transform,
      filter: expression,
    },
    rewritten: true,
  }
}

function rewriteParamCondition(channelDef, selectionMap, consumedSelectionIds) {
  if (!isPlainObject(channelDef) || !isPlainObject(channelDef.condition)) {
    return channelDef
  }

  if (typeof channelDef.condition.param !== 'string') {
    if (!isPlainObject(channelDef.condition.test)) {
      return channelDef
    }
    const rewrittenTest = rewriteParamTestExpression(channelDef.condition.test, selectionMap, consumedSelectionIds)
    if (typeof rewrittenTest !== 'string' || rewrittenTest.length === 0) {
      return channelDef
    }
    return {
      ...channelDef,
      condition: {
        ...channelDef.condition,
        test: rewrittenTest,
      },
    }
  }

  const paramName = channelDef.condition.param
  const selection = selectionMap.get(paramName) || null
  const { param, empty, ...conditionBody } = channelDef.condition
  const nextChannel = {
    ...channelDef,
  }
  if (!selection) {
    return channelDef
  }

  delete nextChannel.condition

  const expression = buildSelectionExpression(selection)
  const selectionId = readSelectionId(selection)
  if (selectionId) consumedSelectionIds.add(selectionId)
  return {
    ...nextChannel,
    condition: {
      ...conditionBody,
      test: expression || 'false',
    },
  }
}

function rewriteParamScaleDomain(channelDef, channelName, selectionMap, consumedSelectionIds) {
  if (
    !isPlainObject(channelDef)
    || !isPlainObject(channelDef.scale)
    || !isPlainObject(channelDef.scale.domain)
    || typeof channelDef.scale.domain.param !== 'string'
  ) {
    return channelDef
  }

  const paramName = channelDef.scale.domain.param
  const selection = selectionMap.get(paramName) || null
  if (!selection) {
    return channelDef
  }

  const domain = readSelectionDomainForChannel(selection, channelDef, channelName)
  if (!Array.isArray(domain) || domain.length < 2) {
    return channelDef
  }

  const selectionId = readSelectionId(selection)
  if (selectionId) consumedSelectionIds.add(selectionId)
  return {
    ...channelDef,
    scale: {
      ...channelDef.scale,
      domain,
    },
  }
}

function injectScaleBoundDomain(channelDef, channelName, selectionMap, scaleBoundParamNames, consumedSelectionIds) {
  if (!isPlainObject(channelDef) || scaleBoundParamNames.size === 0) {
    return channelDef
  }

  const explicitDomain = channelName === 'x'
    ? Array.isArray(channelDef?.scale?.domain) ? channelDef.scale.domain : null
    : channelName === 'y'
      ? Array.isArray(channelDef?.scale?.domain) ? channelDef.scale.domain : null
      : null
  if (explicitDomain) {
    return channelDef
  }

  for (const paramName of scaleBoundParamNames) {
    const selection = selectionMap.get(paramName) || null
    const domain = readSelectionDomainForChannel(selection, channelDef, channelName)
    if (!Array.isArray(domain) || domain.length < 2) {
      continue
    }
    const selectionId = readSelectionId(selection)
    if (selectionId) consumedSelectionIds.add(selectionId)
    return {
      ...channelDef,
      scale: {
        ...(isPlainObject(channelDef.scale) ? channelDef.scale : {}),
        domain,
      },
    }
  }

  return channelDef
}

function rewriteSpecEncodings(spec, selectionMap, scaleBoundParamNames, consumedSelectionIds) {
  if (!isPlainObject(spec?.encoding)) return spec
  const nextEncoding = {}
  for (const [channel, channelDef] of Object.entries(spec.encoding)) {
    const domainRewritten = rewriteParamScaleDomain(channelDef, channel, selectionMap, consumedSelectionIds)
    const scaleBoundRewritten = injectScaleBoundDomain(
      domainRewritten,
      channel,
      selectionMap,
      scaleBoundParamNames,
      consumedSelectionIds,
    )
    nextEncoding[channel] = rewriteParamCondition(scaleBoundRewritten, selectionMap, consumedSelectionIds)
  }
  return {
    ...spec,
    encoding: nextEncoding,
  }
}

function rewriteSpecTransforms(spec, selectionMap, consumedSelectionIds) {
  if (!Array.isArray(spec?.transform)) return spec
  const nextTransforms = []
  let rewrittenAny = false
  for (const transform of spec.transform) {
    const { transform: nextTransform, rewritten } = rewriteParamFilterTransform(transform, selectionMap, consumedSelectionIds)
    rewrittenAny = rewrittenAny || rewritten
    if (nextTransform) nextTransforms.push(nextTransform)
  }
  if (!rewrittenAny) return spec
  const nextSpec = {
    ...spec,
  }
  if (nextTransforms.length > 0) nextSpec.transform = nextTransforms
  else delete nextSpec.transform
  return nextSpec
}

export function rewriteSpecForParamSelections(spec, selectionMap, scaleBoundParamNames, consumedSelectionIds) {
  if (!isPlainObject(spec)) return spec

  let nextSpec = rewriteSpecTransforms(spec, selectionMap, consumedSelectionIds)
  nextSpec = rewriteSpecEncodings(nextSpec, selectionMap, scaleBoundParamNames, consumedSelectionIds)

  if (Array.isArray(nextSpec.layer)) {
    nextSpec = {
      ...nextSpec,
      layer: nextSpec.layer.map((child) => rewriteSpecForParamSelections(child, selectionMap, scaleBoundParamNames, consumedSelectionIds)),
    }
  }
  if (Array.isArray(nextSpec.vconcat)) {
    nextSpec = {
      ...nextSpec,
      vconcat: nextSpec.vconcat.map((child) => rewriteSpecForParamSelections(child, selectionMap, scaleBoundParamNames, consumedSelectionIds)),
    }
  }
  if (Array.isArray(nextSpec.hconcat)) {
    nextSpec = {
      ...nextSpec,
      hconcat: nextSpec.hconcat.map((child) => rewriteSpecForParamSelections(child, selectionMap, scaleBoundParamNames, consumedSelectionIds)),
    }
  }
  if (Array.isArray(nextSpec.concat)) {
    nextSpec = {
      ...nextSpec,
      concat: nextSpec.concat.map((child) => rewriteSpecForParamSelections(child, selectionMap, scaleBoundParamNames, consumedSelectionIds)),
    }
  }
  if (isPlainObject(nextSpec.spec)) {
    nextSpec = {
      ...nextSpec,
      spec: rewriteSpecForParamSelections(nextSpec.spec, selectionMap, scaleBoundParamNames, consumedSelectionIds),
    }
  }

  return nextSpec
}

function deriveSelectionValueFromPredicates(selection = {}) {
  const predicates = Array.isArray(selection?.predicates) ? selection.predicates : []
  if (predicates.length === 0) return null
  const value = {}
  for (const predicate of predicates) {
    const field = typeof predicate?.field === 'string' ? predicate.field : null
    if (!field) continue
    if (predicate?.op === 'between' && Array.isArray(predicate?.value) && predicate.value.length >= 2) {
      value[field] = clone(predicate.value.slice(0, 2))
      continue
    }
    if ((predicate?.op === 'in' || predicate?.op === 'eq' || predicate?.op === 'equals') && predicate?.value !== undefined) {
      value[field] = clone(predicate.value)
    }
  }
  return Object.keys(value).length > 0 ? value : null
}

function readParamSelectionType(param = {}) {
  if (typeof param?.selectionType === 'string' && param.selectionType.length > 0) {
    return param.selectionType
  }
  if (typeof param?.select === 'string' && param.select.length > 0) {
    return param.select
  }
  if (isPlainObject(param?.select) && typeof param.select.type === 'string' && param.select.type.length > 0) {
    return param.select.type
  }
  return null
}

function readParamEncodings(param = {}) {
  if (Array.isArray(param?.encodings)) {
    return param.encodings.filter((entry) => typeof entry === 'string' && entry.length > 0)
  }
  if (Array.isArray(param?.select?.encodings)) {
    return param.select.encodings.filter((entry) => typeof entry === 'string' && entry.length > 0)
  }
  return []
}

function readEncodingChannelDef(spec = {}, channel = null) {
  if (!isPlainObject(spec?.encoding) || typeof channel !== 'string' || channel.length === 0) {
    return null
  }
  return isPlainObject(spec.encoding[channel]) ? spec.encoding[channel] : null
}

function readEncodingFieldDefByField(spec = {}, field = null) {
  if (!isPlainObject(spec?.encoding) || typeof field !== 'string' || field.length === 0) {
    return null
  }
  return Object.values(spec.encoding).find((channelDef) => (
    isPlainObject(channelDef)
    && typeof channelDef.field === 'string'
    && channelDef.field === field
  )) || null
}

function isTemporalEncoding(channelDef = {}) {
  return Boolean(
    isPlainObject(channelDef)
    && (
      channelDef.type === 'temporal'
      || (typeof channelDef.timeUnit === 'string' && channelDef.timeUnit.length > 0)
    )
  )
}

function normalizeTemporalSelectionInitScalar(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.getTime()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return clone(value)
}

function normalizeSelectionInitValueForEncoding(value, channelDef = null) {
  if (!isTemporalEncoding(channelDef)) {
    return clone(value)
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeTemporalSelectionInitScalar(entry))
  }
  return normalizeTemporalSelectionInitScalar(value)
}

function readIntervalRangeForField(selection = {}, field = null) {
  if (typeof field !== 'string' || field.length === 0) return null
  const matchingPredicate = (Array.isArray(selection?.predicates) ? selection.predicates : []).find((predicate) => (
    predicate?.field === field
    && predicate?.op === 'between'
    && Array.isArray(predicate?.value)
    && predicate.value.length >= 2
  ))
  return matchingPredicate ? clone(matchingPredicate.value.slice(0, 2)) : null
}

function deriveParamValueForSelectionParam(param = {}, selection = {}, spec = {}) {
  if (!param || typeof param !== 'object' || !selection || typeof selection !== 'object') {
    return null
  }
  const selectionType = readParamSelectionType(param)
  const projectedEncodings = readParamEncodings(param)

  if (selectionType === 'point') {
    let pointValue = null
    if (selection?.value && typeof selection.value === 'object' && !Array.isArray(selection.value)) {
      pointValue = clone(selection.value)
    } else {
      const derived = deriveSelectionValueFromPredicates(selection)
      pointValue = derived ? clone(derived) : null
    }
    if (!pointValue || typeof pointValue !== 'object' || Array.isArray(pointValue)) {
      return null
    }

    for (const [field, fieldValue] of Object.entries(pointValue)) {
      const fieldDef = readEncodingFieldDefByField(spec, field)
      pointValue[field] = normalizeSelectionInitValueForEncoding(fieldValue, fieldDef)
    }

    if (projectedEncodings.length > 0) {
      const entries = Object.entries(pointValue)
      for (const [index, encoding] of projectedEncodings.entries()) {
        const channelDef = readEncodingChannelDef(spec, encoding)
        if (Object.prototype.hasOwnProperty.call(pointValue, encoding)) {
          pointValue[encoding] = normalizeSelectionInitValueForEncoding(pointValue[encoding], channelDef)
          continue
        }
        const match = entries[index] || entries[0] || null
        if (!match) continue
        pointValue[encoding] = normalizeSelectionInitValueForEncoding(match[1], channelDef)
      }
    }
    return pointValue
  }

  if (selectionType === 'interval') {
    const pointLikeValue = {}

    if (projectedEncodings.length > 0) {
      for (const encoding of projectedEncodings) {
        const channelDef = readEncodingChannelDef(spec, encoding)
        let range = null
        if (encoding === 'x') {
          range = Array.isArray(selection?.domain?.xDomain)
            ? selection.domain.xDomain.slice(0, 2)
            : readIntervalRangeForField(selection, channelDef?.field)
        } else if (encoding === 'y') {
          range = Array.isArray(selection?.domain?.yDomain)
            ? selection.domain.yDomain.slice(0, 2)
            : readIntervalRangeForField(selection, channelDef?.field)
        } else if (typeof channelDef?.field === 'string') {
          range = readIntervalRangeForField(selection, channelDef.field)
        }
        if (!Array.isArray(range) || range.length < 2) continue
        pointLikeValue[encoding] = normalizeSelectionInitValueForEncoding(range, channelDef)
      }
      if (Object.keys(pointLikeValue).length > 0) {
        return pointLikeValue
      }
    }

    const predicateValue = deriveSelectionValueFromPredicates(selection)
    if (predicateValue && typeof predicateValue === 'object') {
      for (const [field, value] of Object.entries(predicateValue)) {
        const fieldDef = readEncodingFieldDefByField(spec, field)
        pointLikeValue[field] = normalizeSelectionInitValueForEncoding(value, fieldDef)
      }
    }

    return Object.keys(pointLikeValue).length > 0 ? pointLikeValue : null
  }

  return null
}

export function injectParamValuesIntoSpec(spec, selectionMap, consumedSelectionIds) {
  if (!isPlainObject(spec)) return spec

  let nextSpec = spec
  if (Array.isArray(spec.params) && spec.params.length > 0) {
    let changed = false
    const nextParams = spec.params.map((param) => {
      if (!isPlainObject(param) || typeof param?.name !== 'string' || param.name.length === 0) {
        return param
      }
      const selection = selectionMap.get(param.name) || null
      if (!selection) {
        return param
      }
      const nextValue = deriveParamValueForSelectionParam(param, selection, spec)
      const selectionId = readSelectionId(selection)
      if (selectionId) consumedSelectionIds.add(selectionId)
      if (nextValue == null) {
        if (!Object.prototype.hasOwnProperty.call(param, 'value')) {
          return param
        }
        changed = true
        const { value, ...rest } = param
        return rest
      }
      changed = true
      return {
        ...param,
        value: nextValue,
      }
    })
    if (changed) {
      nextSpec = {
        ...nextSpec,
        params: nextParams,
      }
    }
  }

  if (Array.isArray(nextSpec.layer)) {
    nextSpec = {
      ...nextSpec,
      layer: nextSpec.layer.map((child) => injectParamValuesIntoSpec(child, selectionMap, consumedSelectionIds)),
    }
  }
  if (Array.isArray(nextSpec.vconcat)) {
    nextSpec = {
      ...nextSpec,
      vconcat: nextSpec.vconcat.map((child) => injectParamValuesIntoSpec(child, selectionMap, consumedSelectionIds)),
    }
  }
  if (Array.isArray(nextSpec.hconcat)) {
    nextSpec = {
      ...nextSpec,
      hconcat: nextSpec.hconcat.map((child) => injectParamValuesIntoSpec(child, selectionMap, consumedSelectionIds)),
    }
  }
  if (Array.isArray(nextSpec.concat)) {
    nextSpec = {
      ...nextSpec,
      concat: nextSpec.concat.map((child) => injectParamValuesIntoSpec(child, selectionMap, consumedSelectionIds)),
    }
  }
  if (isPlainObject(nextSpec.spec)) {
    nextSpec = {
      ...nextSpec,
      spec: injectParamValuesIntoSpec(nextSpec.spec, selectionMap, consumedSelectionIds),
    }
  }

  return nextSpec
}
