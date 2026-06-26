import { DataQueryEngine } from './DataQueryEngine.js'
import { JsArrayDataQueryEngine } from './JsArrayDataQueryEngine.js'

export class RemoteDataQueryEngine extends DataQueryEngine {
  constructor(options = {}) {
    super()
    const { request, execute } = options
    this.request = request || execute || null
    this.kind = 'remote'
    this.fallbackEngine = new JsArrayDataQueryEngine(options)
  }

  unsupported() {
    return {
      ok: false,
      error: {
        code: 'REMOTE_ENGINE_UNAVAILABLE',
        message: 'Remote data query execution is not configured in this frontend runtime build.',
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
    if (typeof this.request === 'function') {
      return this.request({
        kind: 'sql',
        rows: arguments[0],
        spec: arguments[1] || {},
      })
    }
    return this.unsupported()
  }

  aggregate() {
    if (typeof this.request === 'function') {
      return this.request({
        kind: 'aggregate',
        rows: arguments[0],
        spec: arguments[1] || {},
      })
    }
    return this.fallbackEngine.aggregate(...arguments)
  }

  summarize() {
    if (typeof this.request === 'function') {
      return this.request({
        kind: 'summary',
        rows: arguments[0],
        spec: arguments[1] || {},
      })
    }
    return this.fallbackEngine.summarize(...arguments)
  }

  computeCorrelation() {
    if (typeof this.request === 'function') {
      return this.request({
        kind: 'computeCorrelation',
        rows: arguments[0],
        spec: arguments[1] || {},
      })
    }
    return this.fallbackEngine.computeCorrelation(...arguments)
  }

  findExtremes() {
    if (typeof this.request === 'function') {
      return this.request({
        kind: 'findExtremes',
        rows: arguments[0],
        spec: arguments[1] || {},
      })
    }
    return this.fallbackEngine.findExtremes(...arguments)
  }

  findOutliers() {
    if (typeof this.request === 'function') {
      return this.request({
        kind: 'findOutliers',
        rows: arguments[0],
        spec: arguments[1] || {},
      })
    }
    return this.fallbackEngine.findOutliers(...arguments)
  }

  compareGroups() {
    if (typeof this.request === 'function') {
      return this.request({
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
        localExecution: typeof this.request !== 'function',
        remoteExecution: typeof this.request === 'function',
        sqlSupport: typeof this.request === 'function',
        fallbackEngine: true,
      },
    }
  }
}
