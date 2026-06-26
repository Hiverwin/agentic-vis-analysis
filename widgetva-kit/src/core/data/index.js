import { DuckDbDataQueryEngine } from './DuckDbDataQueryEngine.js'
import { JsArrayDataQueryEngine } from './JsArrayDataQueryEngine.js'
import { RemoteDataQueryEngine } from './RemoteDataQueryEngine.js'

export const DATA_QUERY_ENGINE_KINDS = ['js_array', 'duckdb', 'remote']

export function createDataQueryEngine({ kind = 'js_array', ...options } = {}) {
  if (kind === 'duckdb') {
    return new DuckDbDataQueryEngine({ kind, ...options })
  }
  if (kind === 'remote') {
    return new RemoteDataQueryEngine({ kind, ...options })
  }
  return new JsArrayDataQueryEngine({ kind, ...options })
}

export {
  DataQueryEngine,
} from './DataQueryEngine.js'
export {
  JsArrayDataQueryEngine,
} from './JsArrayDataQueryEngine.js'
export {
  DuckDbDataQueryEngine,
} from './DuckDbDataQueryEngine.js'
export {
  RemoteDataQueryEngine,
} from './RemoteDataQueryEngine.js'
