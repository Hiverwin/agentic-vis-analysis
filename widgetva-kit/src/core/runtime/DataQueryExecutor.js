import {
  DATA_QUERY_KINDS,
  DATA_QUERY_RESULT_SCHEMAS,
  DATA_QUERY_SCHEMAS,
} from '../../contracts/data-contracts.js'
import { DATA_QUERY_CALL_SCHEMA } from '../../schemas/data-handles.schema.js'
import { makeDataQueryResult } from '../../contracts/result-contracts.js'
import { createDefaultWidgetVAHostBridge } from '../../host/hostBridge.js'
import { validateAgainstSchema } from './support/schemaValidation.js'
import {
  DataQueryHandlerContext,
  buildDataQueryError,
  buildDataQueryTraceNotes,
  buildSupportedQueryDescriptors,
  makeDataQueryExecutorCapabilities,
  makeDataQueryExecutorCounts,
  makeDataQueryExecutorEngineSummary,
  makeDataQueryExecutorSummary,
  recordDataQueryFailure,
  supportsUnifiedEngineQuery,
} from './executor-support/DataQueryExecutorModels.js'

export class DataQueryExecutor {
  constructor({ store, dataQueryEngine, traceRecorder, hostBridge } = {}) {
    this.store = store || {
      readDescription() {
        return { widgets: [], dataHandles: [] }
      },
      readState() {
        return { shared: { focusedWidget: null } }
      },
      getResolvedWidgetForTarget() {
        return null
      },
      getResolvedWidget() {
        return null
      },
      getDataHandle() {
        return null
      },
      readRuntimeData() {
        return null
      },
      resolveSelectionDataRef() {
        return null
      },
    }
    this.dataQueryEngine = dataQueryEngine || {
      kind: 'manual',
      listSupportedQueryKinds() {
        return []
      },
    }
    this.traceRecorder = traceRecorder || null
    this.hostBridge = hostBridge || createDefaultWidgetVAHostBridge()
  }

  run(call = {}) {
    try {
      validateAgainstSchema(call, DATA_QUERY_CALL_SCHEMA, 'dataQuery')
    } catch (error) {
      recordDataQueryFailure(this.traceRecorder, call, {
        code: 'INVALID_QUERY_SPEC',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: ['Inspect the data query call schema in describeWorkspace() before retrying.'],
      })
      return buildDataQueryError({
        dataRef: call?.dataRef || null,
        code: 'INVALID_QUERY_SPEC',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: ['Inspect the data query call schema in describeWorkspace() before retrying.'],
      })
    }
    const ctx = this.createContext(call)
    const querySpec = ctx.readNormalizedQuerySpec()
    const queryScope = ctx.readQueryScope()
    const targetRef = ctx.readTargetWidgetRef() || null
    const explicitTargetRef =
      targetRef
      || queryScope?.dataRef
      || null
    const explicitTarget = ctx.resolveExplicitTarget({
      dataRef: call?.dataRef || querySpec?.queryScope?.dataRef || null,
      targetRef,
    })
    if (!call?.dataRef && !querySpec?.queryScope?.dataRef && explicitTargetRef && !explicitTarget) {
      recordDataQueryFailure(this.traceRecorder, call, {
        code: 'UNSUPPORTED_TARGET',
        message: `The requested data-query target ref is not available: ${explicitTargetRef}.`,
        details: {
          targetRef: explicitTargetRef,
        },
        recoveryHints: [
          'Call describeWorkspace() to inspect valid widget refs and data refs before retrying.',
          'Retry the data query with a targetRef that resolves to a materialized widget or data handle.',
        ],
      })
      return buildDataQueryError({
        dataRef: null,
        code: 'UNSUPPORTED_TARGET',
        message: `The requested data-query target ref is not available: ${explicitTargetRef}.`,
        details: {
          targetRef: explicitTargetRef,
        },
        recoveryHints: [
          'Call describeWorkspace() to inspect valid widget refs and data refs before retrying.',
          'Retry the data query with a targetRef that resolves to a materialized widget or data handle.',
        ],
      })
    }
    const dataRef = ctx.resolveDataRef(call?.dataRef)
    const query = call?.query || {}
    const selectionRef = ctx.resolveImplicitSelectionRef({
      queryScope: querySpec?.queryScope || queryScope || null,
      dataRef,
    })
    const runtimeData = ctx.readRuntimeData(dataRef)
    const dataHandle = ctx.resolveDataHandle(dataRef)
    if (!runtimeData) {
      recordDataQueryFailure(this.traceRecorder, call, {
        code: 'UNKNOWN_DATA_REF',
        message: `Unknown data ref: ${dataRef || 'missing'}.`,
        recoveryHints: [
          'Call describeWorkspace() to inspect materialized data handles and valid data refs.',
          'Retry the query with an explicit dataRef, a targetRef, or after focusing the widget whose data you want to inspect.',
        ],
      })
      return buildDataQueryError({
        dataRef,
        code: 'UNKNOWN_DATA_REF',
        message: `Unknown data ref: ${dataRef || 'missing'}.`,
        recoveryHints: [
          'Call describeWorkspace() to inspect materialized data handles and valid data refs.',
          'Retry the query with an explicit dataRef, a targetRef, or after focusing the widget whose data you want to inspect.',
        ],
      })
    }

    const rows = ctx.resolveRows(dataRef, { queryScope: { selectionRef } })
    const kind = query.kind
    if (!DATA_QUERY_KINDS.includes(kind)) {
      recordDataQueryFailure(this.traceRecorder, call, {
        code: 'UNKNOWN_QUERY_KIND',
        message: `Unsupported data query kind: ${kind || 'missing'}.`,
        recoveryHints: ['Inspect supportedQueryDescriptors on the current data handle before retrying.'],
      })
      return buildDataQueryError({
        dataRef,
        code: 'UNKNOWN_QUERY_KIND',
        message: `Unsupported data query kind: ${kind || 'missing'}.`,
        recoveryHints: ['Inspect supportedQueryDescriptors on the current data handle before retrying.'],
      })
    }

    if (dataHandle && Array.isArray(dataHandle.supportedQueries) && !dataHandle.supportedQueries.includes(kind)) {
      recordDataQueryFailure(this.traceRecorder, call, {
        code: 'UNSUPPORTED_QUERY_KIND',
        message: `Data query kind ${kind} is not supported by the current data handle.`,
        details: {
          supportedQueries: dataHandle.supportedQueries,
          dataHandleRef: dataHandle.ref || null,
        },
        recoveryHints: [
          'Inspect supportedQueries or supportedQueryDescriptors on the current data handle before retrying.',
          'Retry with a query kind exposed by the current widget data handle.',
        ],
      })
      return buildDataQueryError({
        dataRef,
        code: 'UNSUPPORTED_QUERY_KIND',
        message: `Data query kind ${kind} is not supported by the current data handle.`,
        details: {
          supportedQueries: dataHandle.supportedQueries,
          dataHandleRef: dataHandle.ref || null,
        },
        recoveryHints: [
          'Inspect supportedQueries or supportedQueryDescriptors on the current data handle before retrying.',
          'Retry with a query kind exposed by the current widget data handle.',
        ],
      })
    }

    if (selectionRef && rows == null) {
      recordDataQueryFailure(this.traceRecorder, call, {
        code: 'INVALID_QUERY_SPEC',
        message: `Selection ref ${selectionRef} is not active in the current workspace state.`,
        recoveryHints: [
          'Inspect shared.selections.registry in readState() or call perception.summarizeSelection() before retrying.',
          'Retry the data query with an active selectionRef or omit selectionRef to query the full current view.',
        ],
      })
      return buildDataQueryError({
        dataRef,
        code: 'INVALID_QUERY_SPEC',
        message: `Selection ref ${selectionRef} is not active in the current workspace state.`,
        recoveryHints: [
          'Inspect shared.selections.registry in readState() or call perception.summarizeSelection() before retrying.',
          'Retry the data query with an active selectionRef or omit selectionRef to query the full current view.',
        ],
      })
    }

    const querySchema = DATA_QUERY_SCHEMAS[kind]
    if (querySchema) {
      try {
        validateAgainstSchema(querySpec, querySchema, `query.spec.${kind}`)
      } catch (error) {
        recordDataQueryFailure(this.traceRecorder, call, {
          code: 'INVALID_QUERY_SPEC',
          message: error instanceof Error ? error.message : String(error),
          recoveryHints: ['Inspect the selected data query descriptor inputSchema/examples before retrying.'],
        })
        return buildDataQueryError({
          dataRef,
          code: 'INVALID_QUERY_SPEC',
          message: error instanceof Error ? error.message : String(error),
          recoveryHints: ['Inspect the selected data query descriptor inputSchema/examples before retrying.'],
        })
      }
    }
    const resultSchema = DATA_QUERY_RESULT_SCHEMAS[kind] || null
    try {
      let result
      const runUnifiedQuery = () => this.dataQueryEngine.query(dataRef, { kind, spec: querySpec })
      if (kind === 'schema') {
        result = runtimeData.handle?.schema || (
          supportsUnifiedEngineQuery(this.dataQueryEngine)
            ? runUnifiedQuery()
            : this.dataQueryEngine.getSchema(rows)
        )
      }
      if (kind === 'filter') {
        const predicates = Array.isArray(querySpec?.predicates) ? querySpec.predicates : []
        const filteredRows = supportsUnifiedEngineQuery(this.dataQueryEngine)
          ? runUnifiedQuery()
          : this.dataQueryEngine.filter(rows, predicates)
        result = {
          rows: Array.isArray(filteredRows?.rows) ? filteredRows.rows : filteredRows,
          rowCount: Array.isArray(filteredRows?.rows) ? filteredRows.rows.length : filteredRows.length,
          predicates,
        }
      }
      if (kind === 'sampleRows') {
        result = supportsUnifiedEngineQuery(this.dataQueryEngine)
          ? runUnifiedQuery()
          : this.dataQueryEngine.sampleRows(rows, querySpec?.limit || 20)
      }
      if (kind === 'summary') {
        result = supportsUnifiedEngineQuery(this.dataQueryEngine)
          ? runUnifiedQuery()
          : this.dataQueryEngine.summarize(rows, normalizeSummarySpec(querySpec))
      }
      if (kind === 'aggregate' || kind === 'groupBy') {
        const aggregateSpec = normalizeAggregateSpec(querySpec)
        result = normalizeAggregateResult(
          supportsUnifiedEngineQuery(this.dataQueryEngine)
            ? runUnifiedQuery()
            : this.dataQueryEngine.aggregate(rows, aggregateSpec),
        )
      }
      if (kind === 'sql') {
        result = supportsUnifiedEngineQuery(this.dataQueryEngine)
          ? runUnifiedQuery()
          : this.dataQueryEngine.executeSql(rows, querySpec)
      }
      if (kind === 'computeCorrelation') {
        result = normalizeCorrelationResult(
          supportsUnifiedEngineQuery(this.dataQueryEngine)
            ? runUnifiedQuery()
            : this.dataQueryEngine.computeCorrelation(rows, querySpec),
          querySpec,
        )
      }
      if (kind === 'findExtremes') {
        result = normalizeExtremesResult(
          supportsUnifiedEngineQuery(this.dataQueryEngine)
            ? runUnifiedQuery()
            : this.dataQueryEngine.findExtremes(rows, normalizeExtremesSpec(querySpec)),
          querySpec,
        )
      }
      if (kind === 'findOutliers') {
        result = normalizeOutliersResult(
          supportsUnifiedEngineQuery(this.dataQueryEngine)
            ? runUnifiedQuery()
            : this.dataQueryEngine.findOutliers(rows, querySpec),
          querySpec,
        )
      }
      if (kind === 'compareGroups') {
        result = normalizeCompareGroupsResult(
          supportsUnifiedEngineQuery(this.dataQueryEngine)
            ? runUnifiedQuery()
            : this.dataQueryEngine.compareGroups(rows, normalizeCompareGroupsSpec(querySpec)),
          querySpec,
        )
      }
      const output = makeDataQueryResult({
        ok: false,
        dataRef,
        error: null,
      })
      if (result !== undefined) {
        if (result?.ok === false && result?.error) {
          recordDataQueryFailure(this.traceRecorder, call, {
            code: result.error.code || 'RUNTIME_ERROR',
            message: result.error.message || 'Data query execution failed.',
            ...(result?.error?.details !== undefined ? { details: result.error.details } : {}),
            recoveryHints: Array.isArray(result?.recoveryHints) ? result.recoveryHints : [],
          })
          output.error = result.error
          if (Array.isArray(result?.recoveryHints)) {
            output.recoveryHints = result.recoveryHints
          }
          return output
        }
        output.ok = true
        output.result = result
        if (resultSchema) {
          validateAgainstSchema(output.result, resultSchema, `result.${kind}`)
        }
        ctx.recordDataQuery({
          affectedRefs: runtimeData.widgetRef ? [runtimeData.widgetRef] : [dataRef],
          notes: buildDataQueryTraceNotes({
            kind,
            selectionRef,
            dataRef,
            rowCount: Array.isArray(rows) ? rows.length : null,
          }),
        })
        const tracePayload = ctx.consumeRecordedDataQuery?.() || null
        if (tracePayload) {
          this.traceRecorder?.recordDataQuery?.(tracePayload)
        }
      } else {
        recordDataQueryFailure(this.traceRecorder, call, {
          code: 'UNKNOWN_QUERY_KIND',
          message: `Unsupported data query kind: ${kind || 'missing'}.`,
          recoveryHints: ['Inspect supportedQueryDescriptors on the current data handle before retrying.'],
        })
        output.error = {
          code: 'UNKNOWN_QUERY_KIND',
          message: `Unsupported data query kind: ${kind || 'missing'}.`,
        }
        output.recoveryHints = ['Inspect supportedQueryDescriptors on the current data handle before retrying.']
      }
      return output
    } catch (error) {
      recordDataQueryFailure(this.traceRecorder, call, {
        code: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: [
          'Inspect the current data handle, target ref, and query kind in describeWorkspace() before retrying.',
          'Inspect the selected data query descriptor inputSchema/resultSchema/examples if the runtime result shape does not match the declared contract.',
        ],
      })
      return buildDataQueryError({
        dataRef,
        code: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : String(error),
        recoveryHints: [
          'Inspect the current data handle, target ref, and query kind in describeWorkspace() before retrying.',
          'Inspect the selected data query descriptor inputSchema/resultSchema/examples if the runtime result shape does not match the declared contract.',
        ],
      })
    }
  }

  createContext(call = {}) {
    return new DataQueryHandlerContext({
      store: this.store,
      call,
      traceRecorder: this.traceRecorder,
      hostBridge: this.hostBridge,
    })
  }

  describeExecutor() {
    const supportedQueryKinds =
      typeof this.dataQueryEngine?.listSupportedQueryKinds === 'function'
        ? this.dataQueryEngine.listSupportedQueryKinds()
        : [...DATA_QUERY_KINDS]
    const supportedQueryDescriptors = buildSupportedQueryDescriptors(supportedQueryKinds)
    return makeDataQueryExecutorSummary({
      engine: makeDataQueryExecutorEngineSummary({
        kind: this.dataQueryEngine?.kind || null,
        className: this.dataQueryEngine?.constructor?.name || null,
      }),
      counts: makeDataQueryExecutorCounts({
        supportedQueryKindCount: supportedQueryKinds.length,
        supportedQueryDescriptorCount: supportedQueryDescriptors.length,
      }),
      capabilities: makeDataQueryExecutorCapabilities({
        schemaValidation: true,
        returnsValidation: true,
        traceRecording: typeof this.traceRecorder?.recordDataQuery === 'function',
        runtimeDataReads: typeof this.store?.readRuntimeData === 'function',
      }),
      supportedQueryKinds,
      supportedQueryDescriptors,
    })
  }

  describeContext() {
    return DataQueryHandlerContext.describeContract()
  }
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

function normalizeAggregateResult(result) {
  return {
    rows: Array.isArray(result?.rows) ? result.rows : [],
    rowCount: Number.isFinite(result?.rowCount) ? result.rowCount : (Array.isArray(result?.rows) ? result.rows.length : 0),
  }
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

function normalizeExtremesResult(result, spec = {}) {
  const direction = typeof spec.direction === 'string'
    ? spec.direction
    : (spec.order === 'ascending' ? 'min' : 'max')
  return {
    field: typeof spec.field === 'string' ? spec.field : null,
    direction,
    rows: Array.isArray(result?.rows) ? result.rows : [],
  }
}

function normalizeOutliersResult(result, spec = {}) {
  return {
    field: typeof spec.field === 'string' ? spec.field : null,
    method: typeof spec.method === 'string' ? spec.method : 'zscore',
    rows: Array.isArray(result?.rows) ? result.rows : [],
    ...(result?.summary ? { summary: result.summary } : {}),
  }
}

function normalizeCompareGroupsSpec(spec = {}) {
  if (Array.isArray(spec.groups) && spec.groups.length >= 2) return spec
  return {
    ...spec,
    groups: [spec.leftGroup, spec.rightGroup].filter((value) => value != null),
  }
}

function normalizeCompareGroupsResult(result, spec = {}) {
  const groups = Array.isArray(result?.groups) ? result.groups : []
  const groupField = typeof spec.groupField === 'string' ? spec.groupField : null
  const valueField = typeof spec.valueField === 'string' ? spec.valueField : null
  let comparison = null
  if (groups.length >= 2) {
    const [left, right] = groups
    const leftMean = typeof left?.mean === 'number' ? left.mean : null
    const rightMean = typeof right?.mean === 'number' ? right.mean : null
    comparison = {
      groupField,
      valueField,
      leftGroup: left?.group ?? null,
      rightGroup: right?.group ?? null,
      deltaMean: leftMean != null && rightMean != null ? leftMean - rightMean : null,
    }
  }
  return {
    groupField,
    valueField,
    groups,
    comparison,
  }
}

function normalizeCorrelationResult(result, spec = {}) {
  return {
    xField: typeof spec.xField === 'string' ? spec.xField : result?.fields?.[0] || null,
    yField: typeof spec.yField === 'string' ? spec.yField : result?.fields?.[1] || null,
    correlation: typeof result?.coefficient === 'number' ? result.coefficient : null,
    sampleSize: Number.isFinite(result?.sampleSize) ? result.sampleSize : 0,
  }
}
