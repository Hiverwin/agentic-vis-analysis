import { DataQueryEngine } from './DataQueryEngine.js'
import { JsArrayDataQueryEngine } from './JsArrayDataQueryEngine.js'

export class DuckDbDataQueryEngine extends DataQueryEngine {
  constructor(options = {}) {
    super()
    this.options = options
    this.kind = options.kind || 'duckdb'
    this.execute = options.request || options.execute || null
    this.fallbackEngine = new JsArrayDataQueryEngine(options)
  }

  unsupported() {
    return {
      ok: false,
      error: {
        code: 'DUCKDB_ENGINE_UNAVAILABLE',
        message: 'DuckDB-backed data queries are not configured in this frontend runtime build.',
      },
    }
  }

  listSupportedQueryKinds() {
    return [
      'schema',
      'sampleRows',
      'filter',
      'aggregate',
      'groupBy',
      'sql',
      'summary',
      'computeCorrelation',
      'findExtremes',
      'findOutliers',
      'compareGroups',
    ]
  }

  getSchema() {
    return this.fallbackEngine.getSchema(...arguments)
  }

  filter() {
    return this.fallbackEngine.filter(...arguments)
  }

  sampleRows() {
    return this.fallbackEngine.sampleRows(...arguments)
  }

  executeSql() {
    if (typeof this.execute === 'function') {
      return this.execute({
        kind: 'sql',
        rows: arguments[0],
        spec: arguments[1] || {},
      })
    }
    return this.unsupported()
  }

  aggregate() {
    if (typeof this.execute === 'function') {
      return this.execute({
        kind: 'aggregate',
        rows: arguments[0],
        spec: arguments[1] || {},
      })
    }
    return this.fallbackEngine.aggregate(...arguments)
  }

  summarize() {
    if (typeof this.execute === 'function') {
      return this.execute({
        kind: 'summary',
        rows: arguments[0],
        spec: arguments[1] || {},
      })
    }
    return this.fallbackEngine.summarize(...arguments)
  }

  computeCorrelation() {
    if (typeof this.execute === 'function') {
      return this.execute({
        kind: 'computeCorrelation',
        rows: arguments[0],
        spec: arguments[1] || {},
      })
    }
    return this.fallbackEngine.computeCorrelation(...arguments)
  }

  findExtremes() {
    if (typeof this.execute === 'function') {
      return this.execute({
        kind: 'findExtremes',
        rows: arguments[0],
        spec: arguments[1] || {},
      })
    }
    return this.fallbackEngine.findExtremes(...arguments)
  }

  findOutliers() {
    if (typeof this.execute === 'function') {
      return this.execute({
        kind: 'findOutliers',
        rows: arguments[0],
        spec: arguments[1] || {},
      })
    }
    return this.fallbackEngine.findOutliers(...arguments)
  }

  compareGroups() {
    if (typeof this.execute === 'function') {
      return this.execute({
        kind: 'compareGroups',
        rows: arguments[0],
        spec: arguments[1] || {},
      })
    }
    return this.fallbackEngine.compareGroups(...arguments)
  }

  describeEngine() {
    const summary = super.describeEngine()
    return {
      ...summary,
      capabilities: {
        ...summary.capabilities,
        localExecution: true,
        remoteExecution: false,
        sqlSupport: typeof this.execute === 'function',
        fallbackEngine: true,
      },
    }
  }
}
