import {
  DATA_QUERY_DESCRIPTOR_TEMPLATES,
  DATA_QUERY_SCHEMAS,
  makeDataQueryDescriptor,
} from '../protocol/dataHandles.js'
import {
  makeDataQueryEngineCapabilities,
  makeDataQueryEngineCounts,
  makeDataQueryEngineEngineSummary,
  makeDataQueryEngineSummary,
} from '../protocol/dataQueryEngine.js'

function buildSupportedQueryDescriptors(kinds = []) {
  return kinds.map((kind) =>
    makeDataQueryDescriptor({
      name: kind,
      ...DATA_QUERY_DESCRIPTOR_TEMPLATES[kind],
      inputSchema: DATA_QUERY_SCHEMAS[kind] || {
        type: 'object',
        additionalProperties: true,
        properties: {},
      },
    }),
  )
}

function buildSummaryMeasures({ fields = [], metrics = [] } = {}) {
  const normalizedFields = Array.isArray(fields) ? fields.filter((field) => typeof field === 'string' && field.length > 0) : []
  const normalizedMetrics = Array.isArray(metrics) ? metrics.filter((metric) => typeof metric === 'string' && metric.length > 0) : []
  const measures = []
  for (const metric of normalizedMetrics) {
    if (metric === 'count') {
      measures.push({ op: 'count', as: 'count' })
      continue
    }
    for (const field of normalizedFields) {
      measures.push({
        op: metric,
        field,
        as: `${field}_${metric}`,
      })
    }
  }
  return measures
}

function normalizeAggregateSpec(spec = {}) {
  const groupBy = Array.isArray(spec.groupBy) ? spec.groupBy : []
  const measures = Array.isArray(spec.measures)
    ? spec.measures
    : Array.isArray(spec.metrics)
      ? spec.metrics
      : []
  return {
    ...spec,
    groupBy,
    measures,
  }
}

function normalizeSummarySpec(spec = {}) {
  const measures = Array.isArray(spec.measures) && spec.measures.length > 0
    ? spec.measures
    : buildSummaryMeasures({
        fields: spec.fields,
        metrics: spec.metrics,
      })
  return {
    ...spec,
    measures,
  }
}

function normalizeExtremesSpec(spec = {}) {
  const direction = typeof spec.direction === 'string' ? spec.direction : null
  return {
    ...spec,
    order: direction === 'min' ? 'ascending' : 'descending',
  }
}

function normalizeCompareGroupsSpec(spec = {}) {
  if (Array.isArray(spec.groups) && spec.groups.length >= 2) return spec
  return {
    ...spec,
    groups: [spec.leftGroup, spec.rightGroup].filter((value) => value != null),
  }
}

export class DataQueryEngine {
  resolveQuerySource(source) {
    if (typeof source !== 'string' || source.length === 0) return source

    const resolver = typeof this.resolveSource === 'function'
      ? this.resolveSource.bind(this)
      : typeof this.options?.resolveSource === 'function'
        ? this.options.resolveSource.bind(this.options)
        : null

    if (typeof resolver !== 'function') return source

    const resolvedSource = resolver(source)
    return resolvedSource == null ? source : resolvedSource
  }

  query(source, query = {}) {
    const resolvedSource = this.resolveQuerySource(source)
    const kind = query?.kind || null
    const spec = query?.spec || {}

    if (kind === 'schema') return this.getSchema(resolvedSource)
    if (kind === 'filter') return this.filter(resolvedSource, Array.isArray(spec?.predicates) ? spec.predicates : [])
    if (kind === 'sampleRows') return this.sampleRows(resolvedSource, spec?.limit || 20)
    if (kind === 'aggregate' || kind === 'groupBy') return this.aggregate(resolvedSource, normalizeAggregateSpec(spec))
    if (kind === 'summary') return this.summarize(resolvedSource, normalizeSummarySpec(spec))
    if (kind === 'sql') return this.executeSql(resolvedSource, spec)
    if (kind === 'computeCorrelation') return this.computeCorrelation(resolvedSource, spec)
    if (kind === 'findExtremes') return this.findExtremes(resolvedSource, normalizeExtremesSpec(spec))
    if (kind === 'findOutliers') return this.findOutliers(resolvedSource, spec)
    if (kind === 'compareGroups') return this.compareGroups(resolvedSource, normalizeCompareGroupsSpec(spec))

    throw new Error(`Unsupported data query kind: ${kind || 'missing'}.`)
  }

  describeEngine() {
    const supportedQueryKinds =
      typeof this.listSupportedQueryKinds === 'function'
        ? this.listSupportedQueryKinds()
        : []
    const supportedQueryDescriptors = buildSupportedQueryDescriptors(supportedQueryKinds)
    return makeDataQueryEngineSummary({
      engine: makeDataQueryEngineEngineSummary({
        kind: this.kind || null,
        className: this.constructor?.name || null,
      }),
      counts: makeDataQueryEngineCounts({
        supportedQueryKindCount: supportedQueryKinds.length,
        supportedQueryDescriptorCount: supportedQueryDescriptors.length,
      }),
      supportedQueryKinds,
      supportedQueryDescriptors,
      capabilities: makeDataQueryEngineCapabilities({
        localExecution: true,
        remoteExecution: false,
        sqlSupport: supportedQueryKinds.includes('sql'),
        fallbackEngine: false,
      }),
    })
  }

  listSupportedQueryKinds() {
    return ['schema', 'sampleRows', 'filter', 'aggregate', 'groupBy', 'summary']
  }

  getSchema() {
    throw new Error('DataQueryEngine.getSchema() must be implemented by subclasses.')
  }

  filter() {
    throw new Error('DataQueryEngine.filter() must be implemented by subclasses.')
  }

  sampleRows() {
    throw new Error('DataQueryEngine.sampleRows() must be implemented by subclasses.')
  }

  executeSql() {
    throw new Error('DataQueryEngine.executeSql() must be implemented by subclasses.')
  }

  aggregate() {
    throw new Error('DataQueryEngine.aggregate() must be implemented by subclasses.')
  }

  summarize() {
    throw new Error('DataQueryEngine.summarize() must be implemented by subclasses.')
  }

  computeCorrelation() {
    throw new Error('DataQueryEngine.computeCorrelation() must be implemented by subclasses.')
  }

  findExtremes() {
    throw new Error('DataQueryEngine.findExtremes() must be implemented by subclasses.')
  }

  findOutliers() {
    throw new Error('DataQueryEngine.findOutliers() must be implemented by subclasses.')
  }

  compareGroups() {
    throw new Error('DataQueryEngine.compareGroups() must be implemented by subclasses.')
  }
}
