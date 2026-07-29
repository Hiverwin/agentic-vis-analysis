import { cloneJsonValue } from '../../shared/clone.js'

export function readNamedFunction(objectValue, names = []) {
  if (!objectValue || typeof objectValue !== 'object' || Array.isArray(objectValue)) return null
  for (const name of names) {
    const candidate = objectValue?.[name]
    if (typeof candidate === 'function') return candidate
  }
  return null
}

function readMarkType(mark) {
  if (typeof mark === 'string' && mark.length > 0) return mark
  if (mark && typeof mark === 'object' && !Array.isArray(mark) && typeof mark.type === 'string' && mark.type.length > 0) {
    return mark.type
  }
  return null
}

function readEChartsSeriesType(seriesEntry) {
  if (!seriesEntry || typeof seriesEntry !== 'object' || Array.isArray(seriesEntry)) return null
  return typeof seriesEntry.type === 'string' && seriesEntry.type.length > 0
    ? seriesEntry.type
    : null
}

export function hasOwnObjectKey(objectValue, key) {
  return Boolean(objectValue && typeof objectValue === 'object' && !Array.isArray(objectValue) && key in objectValue)
}

function classifyMarkType(markType) {
  const normalized = typeof markType === 'string' ? markType.toLowerCase() : ''
  if (['point', 'circle', 'square'].includes(normalized)) return 'scatter'
  if (normalized === 'bar') return 'bar'
  if (['line', 'area'].includes(normalized)) return 'line'
  if (normalized === 'rect') return 'heatmap'
  return null
}

function normalizeWidgetKindHint(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return null
  if (normalized === 'parallelCoordinates') return 'parallelCoordinates'
  const lower = normalized.toLowerCase()
  if (lower === 'parallelcoordinates' || lower === 'parallel-coordinates' || lower === 'parallel_coordinates') return 'parallelCoordinates'
  if (lower === 'sankey') return 'sankey'
  if (['scatter', 'bar', 'line', 'heatmap', 'map', 'custom'].includes(lower)) return lower
  return null
}

function readTitleText(title) {
  if (typeof title === 'string') return title
  if (title && typeof title === 'object' && !Array.isArray(title) && typeof title.text === 'string') return title.text
  return ''
}

function inferWidgetKindFromTitle(title) {
  const normalizedTitle = readTitleText(title).toLowerCase()
  if (!normalizedTitle) return null
  if (normalizedTitle.includes('parallel coordinates') || normalizedTitle.includes('parallel coordinate') || normalizedTitle.includes('平行坐标')) {
    return 'parallelCoordinates'
  }
  if (normalizedTitle.includes('sankey') || normalizedTitle.includes('桑基')) {
    return 'sankey'
  }
  return null
}

export function readExplicitWidgetKindHint(spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null
  return normalizeWidgetKindHint(spec.widgetKind)
    || normalizeWidgetKindHint(spec.kind)
    || normalizeWidgetKindHint(spec?.usermeta?.widgetva?.widgetKind)
    || normalizeWidgetKindHint(spec?.usermeta?.widgetva?.kind)
    || inferWidgetKindFromTitle(spec.title)
}

function classifyEChartsSeriesType(seriesType) {
  const normalized = typeof seriesType === 'string' ? seriesType.toLowerCase() : ''
  if (normalized === 'scatter') return 'scatter'
  if (normalized === 'bar') return 'bar'
  if (normalized === 'line') return 'line'
  if (normalized === 'heatmap') return 'heatmap'
  if (normalized === 'parallel') return 'parallelCoordinates'
  if (normalized === 'sankey') return 'sankey'
  return null
}

function classifyVgplotSource(sourceText = '') {
  const source = String(sourceText || '').toLowerCase()
  if (/(^|[^a-z])(?:wg|vgplot)\.(dot|circle|hexagon|hexbin|voronoi|regressiony)\s*\(/.test(source)) return 'scatter'
  if (/(^|[^a-z])(?:wg|vgplot)\.(line|linex|liney|area|areax|areay|denseline)\s*\(/.test(source)) return 'line'
  if (/(^|[^a-z])(?:wg|vgplot)\.(barx|bary|tickx|ticky)\s*\(/.test(source)) return 'bar'
  if (/(^|[^a-z])(?:wg|vgplot)\.(heatmap|cell|cellx|celly|rect|rectx|recty|raster|contour|hexgrid)\s*\(/.test(source)) return 'heatmap'
  return 'custom'
}

export function collectWidgetKindCandidates(spec = {}, results = new Set()) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return results

  const explicitKind = readExplicitWidgetKindHint(spec)
  if (explicitKind) results.add(explicitKind)

  const directKind = classifyMarkType(readMarkType(spec.mark))
  if (directKind) results.add(directKind)

  if (Array.isArray(spec.layer)) {
    spec.layer.forEach((layerSpec) => collectWidgetKindCandidates(layerSpec, results))
  }
  if (spec.spec && typeof spec.spec === 'object' && !Array.isArray(spec.spec)) {
    collectWidgetKindCandidates(spec.spec, results)
  }
  if (Array.isArray(spec.vconcat)) {
    spec.vconcat.forEach((childSpec) => collectWidgetKindCandidates(childSpec, results))
  }
  if (Array.isArray(spec.hconcat)) {
    spec.hconcat.forEach((childSpec) => collectWidgetKindCandidates(childSpec, results))
  }
  if (Array.isArray(spec.concat)) {
    spec.concat.forEach((childSpec) => collectWidgetKindCandidates(childSpec, results))
  }
  if (spec.facet && typeof spec.facet === 'object' && spec.spec && typeof spec.spec === 'object') {
    collectWidgetKindCandidates(spec.spec, results)
  }
  if (spec.repeat && spec.spec && typeof spec.spec === 'object') {
    collectWidgetKindCandidates(spec.spec, results)
  }

  return results
}

function isCompositeVegaLiteSpec(spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return false
  return (
    Array.isArray(spec.layer)
    || Array.isArray(spec.vconcat)
    || Array.isArray(spec.hconcat)
    || Array.isArray(spec.concat)
    || Boolean(spec.repeat)
    || Boolean(spec.facet)
  )
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function looksLikeVegaLiteSpecObject(candidate = {}) {
  if (!isPlainObject(candidate)) return false

  const schema = typeof candidate?.$schema === 'string' ? candidate.$schema.toLowerCase() : ''
  if (schema.includes('/vega/') && !schema.includes('vega-lite')) {
    return false
  }
  if (schema.includes('vega-lite')) {
    return true
  }

  const vegaLiteFeatureKeys = [
    'mark',
    'encoding',
    'layer',
    'vconcat',
    'hconcat',
    'concat',
    'repeat',
    'facet',
    'params',
    'transform',
    'projection',
    'data',
    'datasets',
    'resolve',
  ]

  return vegaLiteFeatureKeys.some((key) => hasOwnObjectKey(candidate, key))
}

export function looksLikeVegaSpecObject(candidate = {}) {
  if (!isPlainObject(candidate)) return false

  const schema = typeof candidate?.$schema === 'string' ? candidate.$schema.toLowerCase() : ''
  if (schema.includes('/vega/') && !schema.includes('vega-lite')) {
    return true
  }

  return Array.isArray(candidate.marks)
    || Array.isArray(candidate.scales)
    || Array.isArray(candidate.signals)
}

function looksLikeEChartsOptionObject(candidate = {}) {
  if (!isPlainObject(candidate)) return false

  const echartsFeatureKeys = [
    'series',
    'xAxis',
    'yAxis',
    'grid',
    'legend',
    'tooltip',
    'visualMap',
    'dataset',
    'parallelAxis',
    'parallel',
    'angleAxis',
    'radiusAxis',
  ]

  return echartsFeatureKeys.some((key) => hasOwnObjectKey(candidate, key))
}

export function resolveImportedVegaLiteSpec(artifactObject = {}) {
  if (looksLikeVegaLiteSpecObject(artifactObject)) {
    return cloneJsonValue(artifactObject)
  }
  if (isPlainObject(artifactObject?.spec)) {
    return cloneJsonValue(artifactObject.spec)
  }
  return cloneJsonValue(artifactObject)
}

export function resolveImportedEChartsOption(artifactObject = {}) {
  if (looksLikeEChartsOptionObject(artifactObject)) {
    return cloneJsonValue(artifactObject)
  }
  if (isPlainObject(artifactObject?.option)) {
    return cloneJsonValue(artifactObject.option)
  }
  return cloneJsonValue(artifactObject)
}

export function parseVisualizationArtifactScript(scriptText = '') {
  const source = String(scriptText || '').trim()
  if (!source) {
    throw new Error('Visualization script is empty.')
  }

  if (/export\s+default/.test(source)) {
    const executableSource = source.replace(/export\s+default/, 'return')
    return Function('"use strict";\n' + executableSource)()
  }

  try {
    return Function('"use strict"; return (' + source + ');')()
  } catch {
    return Function('"use strict";\n' + source)()
  }
}

export function inferWidgetKindFromVgplotScript(scriptText = '') {
  return classifyVgplotSource(scriptText)
}

export function resolveVgplotArtifact(artifact, scriptText = '') {
  if (typeof artifact === 'function') {
    return {
      title: 'Imported vgplot visualization',
      widgetKind: inferWidgetKindFromVgplotScript(scriptText),
      factory: artifact,
    }
  }

  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    throw new Error('Vgplot script must export a function or an object with a render function.')
  }

  const factory = readNamedFunction(artifact, ['render', 'plot', 'create', 'source', 'default'])
  if (!factory) {
    throw new Error('Vgplot script must export a function or provide render/create/plot/source on the exported object.')
  }

  return {
    title: resolveImportedTitle(artifact, 'Imported vgplot visualization'),
    widgetKind: typeof artifact?.widgetKind === 'string' && artifact.widgetKind.length > 0
      ? artifact.widgetKind
      : inferWidgetKindFromVgplotScript(scriptText),
    factory,
  }
}

export function inferWidgetKindFromVegaLiteSpec(spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('Visualization spec must be a plain object.')
  }

  const explicitKind = readExplicitWidgetKindHint(spec)
  if (explicitKind) return explicitKind

  const candidateKinds = [...collectWidgetKindCandidates(spec)]
  if (candidateKinds.length === 0) {
    return 'custom'
  }
  if (isCompositeVegaLiteSpec(spec) || candidateKinds.length > 1) {
    return 'custom'
  }
  return candidateKinds[0]
}

export function inferWidgetKindFromEChartsOption(option = {}) {
  if (!option || typeof option !== 'object' || Array.isArray(option)) {
    throw new Error('ECharts option must be a plain object.')
  }

  const series = Array.isArray(option.series) ? option.series : []
  for (const entry of series) {
    const widgetKind = classifyEChartsSeriesType(readEChartsSeriesType(entry))
    if (widgetKind) return widgetKind
  }
  return 'custom'
}

export function detectVisualizationProvider(artifactObject = {}, {
  fallbackProvider = 'vega-lite',
  sourceText = '',
} = {}) {
  if (typeof artifactObject === 'function') {
    return 'vgplot'
  }
  if (typeof artifactObject?.provider === 'string' && artifactObject.provider.length > 0) {
    return artifactObject.provider
  }

  if (readNamedFunction(artifactObject, ['render', 'plot', 'create', 'source', 'default'])) {
    return 'vgplot'
  }

  const normalizedSourceText = String(sourceText || '').toLowerCase()
  if (
    normalizedSourceText.includes('@uwdata/vgplot')
    || normalizedSourceText.includes('createapicontext(')
    || normalizedSourceText.includes('wg.plot(')
    || normalizedSourceText.includes('vgplot.plot(')
    || normalizedSourceText.includes('loadobjects(')
  ) {
    return 'vgplot'
  }

  if (looksLikeVegaSpecObject(artifactObject)) {
    return 'vega'
  }
  if (looksLikeVegaSpecObject(artifactObject?.spec)) {
    return 'vega'
  }
  if (looksLikeVegaLiteSpecObject(artifactObject)) {
    return 'vega-lite'
  }
  if (looksLikeVegaLiteSpecObject(artifactObject?.spec)) {
    return 'vega-lite'
  }
  if (looksLikeEChartsOptionObject(artifactObject)) {
    return 'echarts'
  }
  if (looksLikeEChartsOptionObject(artifactObject?.option)) {
    return 'echarts'
  }

  return fallbackProvider
}

export function resolveImportedTitle(artifactObject = {}, fallback = 'Imported visualization') {
  if (typeof artifactObject?.title === 'string' && artifactObject.title.length > 0) {
    return artifactObject.title
  }
  if (typeof artifactObject?.spec?.title === 'string' && artifactObject.spec.title.length > 0) {
    return artifactObject.spec.title
  }
  if (typeof artifactObject?.option?.title?.text === 'string' && artifactObject.option.title.text.length > 0) {
    return artifactObject.option.title.text
  }
  if (typeof artifactObject?.title?.text === 'string' && artifactObject.title.text.length > 0) {
    return artifactObject.title.text
  }
  return fallback
}

