function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readWorkspaceRef(caseId) {
  return `wl://widgetva-app/workspace/${caseId || 'workspace'}`
}

function readWidgetRef(caseId, widgetId) {
  return `${readWorkspaceRef(caseId)}/widget/${widgetId}`
}

function readWidgetKind(widget = {}) {
  return widget.widgetKind || widget.kind || widget.type || null
}

function readProviderSpec(widget = {}) {
  return widget?.source?.providerSpec
    || widget?.providerSpec
    || widget?.runtimeSource?.providerSpec
    || null
}

function readVegaLiteSpec(widget = {}) {
  const providerSpec = readProviderSpec(widget)
  return providerSpec?.spec || widget?.source?.spec || widget?.runtimeSource?.spec || null
}

function readProvider(widget = {}) {
  return widget.provider || readProviderSpec(widget)?.provider || null
}

function readMarkType(mark) {
  if (typeof mark === 'string') return mark
  return typeof mark?.type === 'string' ? mark.type : null
}

function classifyMark(markType) {
  const normalized = String(markType || '').toLowerCase()
  if (['point', 'circle', 'square'].includes(normalized)) return 'scatter'
  if (normalized === 'bar') return 'bar'
  if (['line', 'area'].includes(normalized)) return 'line'
  if (normalized === 'rect') return 'heatmap'
  return null
}

function nestedSpecs(spec = {}) {
  if (!isPlainObject(spec)) return []
  const nested = []
  for (const key of ['layer', 'vconcat', 'hconcat', 'concat']) {
    if (Array.isArray(spec[key])) nested.push(...spec[key].filter(isPlainObject))
  }
  if (isPlainObject(spec.spec)) nested.push(spec.spec)
  return nested
}

function findRepresentativeSpec(spec = {}, widgetKind = null) {
  if (!isPlainObject(spec)) return null
  const markKind = classifyMark(readMarkType(spec.mark))
  if (markKind && (!widgetKind || markKind === widgetKind)) return spec
  for (const child of nestedSpecs(spec)) {
    const match = findRepresentativeSpec(child, widgetKind)
    if (match) return match
  }
  return null
}

function collectDataRows(spec = {}, rootSpec = spec, rows = []) {
  if (!isPlainObject(spec)) return rows
  if (Array.isArray(spec?.data?.values)) rows.push(...spec.data.values)
  const dataName = typeof spec?.data?.name === 'string' ? spec.data.name : null
  if (dataName && Array.isArray(rootSpec?.datasets?.[dataName])) rows.push(...rootSpec.datasets[dataName])
  if (spec === rootSpec && isPlainObject(spec.datasets)) {
    for (const dataset of Object.values(spec.datasets)) {
      if (Array.isArray(dataset)) rows.push(...dataset)
    }
  }
  nestedSpecs(spec).forEach((child) => collectDataRows(child, rootSpec, rows))
  return rows
}

function collectRowFields(rows = []) {
  const fields = new Set()
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isPlainObject(row)) continue
    Object.keys(row).forEach((field) => fields.add(field))
  }
  return fields
}

function collectEncodingFields(spec = {}) {
  const fields = new Set()
  if (!isPlainObject(spec)) return fields
  const encoding = isPlainObject(spec.encoding) ? spec.encoding : {}
  for (const channel of Object.values(encoding)) {
    if (typeof channel?.field === 'string' && channel.field.length > 0) fields.add(channel.field)
  }
  nestedSpecs(spec).forEach((child) => {
    collectEncodingFields(child).forEach((field) => fields.add(field))
  })
  return fields
}

function readEncodingField(spec = {}, channel) {
  const field = spec?.encoding?.[channel]?.field
  return typeof field === 'string' && field.length > 0 ? field : null
}

function isCategoricalEncoding(encoding = {}) {
  return encoding?.type === 'nominal' || encoding?.type === 'ordinal'
}

function readBarCategoryField(spec = {}) {
  const encoding = spec?.encoding || {}
  const x = encoding.x || {}
  const y = encoding.y || {}
  if (readEncodingField(spec, 'x') && (isCategoricalEncoding(x) || y.aggregate)) return readEncodingField(spec, 'x')
  if (readEncodingField(spec, 'y') && (isCategoricalEncoding(y) || x.aggregate)) return readEncodingField(spec, 'y')
  return readEncodingField(spec, 'x') || readEncodingField(spec, 'y')
}

function readLineSeriesField(spec = {}) {
  return readEncodingField(spec, 'color')
    || readEncodingField(spec, 'stroke')
    || readEncodingField(spec, 'detail')
    || null
}

function readReencodeTargets(widgetKind) {
  switch (widgetKind) {
    case 'heatmap':
      return [
        { channel: 'opacity', stateRefKey: 'view/reencode' },
        { channel: 'color', stateRefKey: 'view/reencode' },
      ]
    case 'parallelCoordinates':
      return [
        { channel: 'opacity', stateRefKey: 'view/reencode' },
        { channel: 'color', stateRefKey: 'view/reencode' },
      ]
    case 'sankey':
      return [
        { channel: 'stroke', stateRefKey: 'view/reencode' },
        { channel: 'color', stateRefKey: 'view/reencode' },
      ]
    case 'scatter':
    case 'bar':
    case 'line':
      return [
        { channel: 'color', stateRefKey: 'view/reencode' },
        { channel: 'opacity', stateRefKey: 'view/reencode' },
      ]
    default:
      return []
  }
}

export function canBuildVegaLiteCoordinationFieldModel(widget = {}) {
  return readProvider(widget) === 'vega-lite'
}

export function buildVegaLiteCoordinationFieldModel(widget = {}, { caseId = 'workspace' } = {}) {
  if (!canBuildVegaLiteCoordinationFieldModel(widget)) return null

  const widgetKind = readWidgetKind(widget)
  const spec = readVegaLiteSpec(widget)
  const representativeSpec = findRepresentativeSpec(spec, widgetKind) || spec || {}
  const encodingFields = collectEncodingFields(spec)
  const dataFields = collectRowFields(collectDataRows(spec))
  const availableFields = new Set([...encodingFields, ...dataFields])
  const xField = readEncodingField(representativeSpec, 'x')
  const yField = readEncodingField(representativeSpec, 'y')

  return {
    widget,
    widgetRef: widget?.id ? readWidgetRef(caseId, widget.id) : null,
    widgetKind,
    provider: 'vega-lite',
    availableFields,
    xField,
    yField,
    categoryField: widgetKind === 'bar' ? readBarCategoryField(representativeSpec) : null,
    seriesField: widgetKind === 'line' ? readLineSeriesField(representativeSpec) : null,
    reencodeTargets: readReencodeTargets(widgetKind),
  }
}
