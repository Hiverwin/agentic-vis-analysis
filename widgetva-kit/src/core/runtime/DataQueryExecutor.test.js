import test from 'node:test'
import assert from 'node:assert/strict'

import { DataQueryExecutor } from './DataQueryExecutor.js'

test('DataQueryExecutor.describeExecutor exposes structured supported query descriptors', () => {
  const executor = new DataQueryExecutor({
    store: {
      readDescription() {
        return { widgets: [], dataHandles: [] }
      },
    },
    dataQueryEngine: {
      kind: 'runtime-test',
      listSupportedQueryKinds() {
        return ['summary', 'schema']
      },
    },
    traceRecorder: null,
  })

  const summary = executor.describeExecutor()
  const summaryDescriptor = summary.supportedQueryDescriptors.find((entry) => entry.name === 'summary')
  const schemaDescriptor = summary.supportedQueryDescriptors.find((entry) => entry.name === 'schema')

  assert.equal(summary.counts.supportedQueryKindCount, 2)
  assert.equal(summary.counts.supportedQueryDescriptorCount, 2)
  assert.equal(summaryDescriptor?.title, 'Summarize current data view')
  assert.equal(summaryDescriptor?.resultKind, 'summaryTable')
  assert.equal(schemaDescriptor?.title, 'Inspect data schema')
})

test('DataQueryExecutor supports no-arg construction for manual runtime assembly', () => {
  const executor = new DataQueryExecutor()
  const summary = executor.describeExecutor()

  assert.equal(summary.engine.kind, 'manual')
  assert.deepEqual(summary.supportedQueryKinds, [])
  assert.deepEqual(summary.supportedQueryDescriptors, [])
})

test('DataQueryExecutor validates the data query call envelope before resolving runtime data', () => {
  const executor = new DataQueryExecutor()

  const result = executor.run({
    callId: 'invalid_data_query_envelope',
    query: {
      kind: 'summary',
      spec: {},
    },
    unexpected: true,
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'INVALID_QUERY_SPEC')
  assert.match(result.error.message, /dataQuery\.unexpected is not allowed/)
})

test('DataQueryExecutor supports documented DataQueryEngine.query(dataRef, query) contracts for manual runtime assembly', () => {
  let receivedCall = null
  const executor = new DataQueryExecutor({
    store: {
      readDescription() {
        return {
          widgets: [],
          dataHandles: [
            {
              ref: 'wl://widgetva-app/workspace/main/data/current_view',
              supportedQueries: ['summary'],
            },
          ],
        }
      },
      readState() {
        return {
          shared: {
            focusedWidget: null,
          },
        }
      },
      getResolvedWidgetForTarget() {
        return null
      },
      getResolvedWidget() {
        return null
      },
      getDataHandle(ref) {
        if (ref !== 'wl://widgetva-app/workspace/main/data/current_view') return null
        return {
          ref,
          supportedQueries: ['summary'],
        }
      },
      readRuntimeData(ref) {
        if (ref !== 'wl://widgetva-app/workspace/main/data/current_view') return null
        return {
          ref,
          rows: [{ value: 1 }, { value: 2 }, { value: 3 }],
        }
      },
      resolveSelectionDataRef() {
        return null
      },
    },
    dataQueryEngine: {
      kind: 'runtime-test',
      listSupportedQueryKinds() {
        return ['summary']
      },
      query(dataRef, query) {
        receivedCall = { dataRef, query }
        return {
          rows: [{ count: 3 }],
        }
      },
    },
    traceRecorder: null,
  })

  const result = executor.run({
    callId: 'dq_engine_query_contract',
    actor: 'agent',
    dataRef: 'wl://widgetva-app/workspace/main/data/current_view',
    query: {
      kind: 'summary',
      spec: {},
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(receivedCall, {
    dataRef: 'wl://widgetva-app/workspace/main/data/current_view',
    query: {
      kind: 'summary',
      spec: {},
    },
  })
  assert.deepEqual(result.result, {
    rows: [{ count: 3 }],
  })
})

test('DataQueryExecutor supports plain RuntimeStore record facades when runtimeData is provided for manual assembly', () => {
  let receivedCall = null
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_a'
  const dataRef = 'wl://widgetva-app/workspace/main/data/current_view'
  const executor = new DataQueryExecutor({
    store: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      descriptions: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          primaryDataRef: dataRef,
        },
      },
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          version: 1,
          data: {
            sourceDataRef: dataRef,
            currentDataRef: dataRef,
          },
        },
      },
      dataHandles: {
        [dataRef]: {
          ref: dataRef,
          supportedQueries: ['summary'],
        },
      },
      links: {},
      actions: {},
      perceptionQueries: {},
      interactionTrace: [],
      stateId: 'main:s1',
      version: 1,
      shared: {
        focusedWidget: widgetRef,
      },
      runtimeData: {
        [dataRef]: {
          ref: dataRef,
          widgetRef,
          rows: [{ value: 1 }, { value: 2 }, { value: 3 }],
        },
      },
    },
    dataQueryEngine: {
      kind: 'runtime-test',
      listSupportedQueryKinds() {
        return ['summary']
      },
      query(receivedDataRef, query) {
        receivedCall = { dataRef: receivedDataRef, query }
        return {
          rows: [{ count: 3 }],
        }
      },
    },
    traceRecorder: null,
  })

  const result = executor.run({
    callId: 'dq_plain_store_contract',
    actor: 'agent',
    dataRef,
    query: {
      kind: 'summary',
      spec: {},
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(receivedCall, {
    dataRef,
    query: {
      kind: 'summary',
      spec: {},
    },
  })
  assert.deepEqual(result.result, {
    rows: [{ count: 3 }],
  })
})

test('DataQueryExecutor records failed data queries into the interaction trace', () => {
  let recordedFailure = null
  const executor = new DataQueryExecutor({
    store: {
      readDescription() {
        return {
          widgets: [],
          dataHandles: [],
        }
      },
      readState() {
        return {
          shared: {
            focusedWidget: null,
          },
        }
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
    },
    dataQueryEngine: {
      kind: 'runtime-test',
    },
    traceRecorder: {
      recordDataQueryFailure(payload) {
        recordedFailure = payload
      },
    },
  })

  const result = executor.run({
    callId: 'dq_fail',
    actor: 'agent',
    target: { widgetRef: 'wl://widgetva-app/workspace/main/widget/missing' },
    query: {
      kind: 'summary',
      spec: {},
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'UNSUPPORTED_TARGET')
  assert.equal(recordedFailure?.code, 'UNSUPPORTED_TARGET')
  assert.equal(recordedFailure?.call?.target?.widgetRef, 'wl://widgetva-app/workspace/main/widget/missing')
})

test('DataQueryExecutor records structured trace notes for successful data queries', () => {
  let recordedSuccess = null
  const executor = new DataQueryExecutor({
    store: {
      readDescription() {
        return {
          widgets: [],
          dataHandles: [
            {
              ref: 'wl://widgetva-app/workspace/main/data/current_view',
              supportedQueries: ['summary'],
            },
          ],
        }
      },
      readState() {
        return {
          shared: {
            focusedWidget: 'wl://widgetva-app/workspace/main/widget/scatter_a',
            selections: {
              registry: {
                'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush': {
                  predicates: [{ field: 'region', op: 'equals', value: 'west' }],
                },
              },
              views: {
                primary: null,
                byWidget: {},
              },
            },
          },
        }
      },
      getResolvedWidgetForTarget() {
        return {
          ref: 'wl://widgetva-app/workspace/main/widget/scatter_a',
          data: {
            currentDataRef: 'wl://widgetva-app/workspace/main/data/current_view',
          },
          primaryDataRef: 'wl://widgetva-app/workspace/main/data/current_view',
        }
      },
      getResolvedWidget() {
        return this.getResolvedWidgetForTarget()
      },
      getDataHandle(ref) {
        if (ref !== 'wl://widgetva-app/workspace/main/data/current_view') return null
        return {
          ref,
          supportedQueries: ['summary'],
        }
      },
      readRuntimeData(ref) {
        if (ref !== 'wl://widgetva-app/workspace/main/data/current_view') return null
        return {
          ref,
          widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
          rows: [
            { region: 'west', value: 1 },
            { region: 'east', value: 2 },
          ],
        }
      },
      resolveSelectionDataRef() {
        return null
      },
    },
    dataQueryEngine: {
      kind: 'runtime-test',
      summarize(rows) {
        return {
          rows: [{ count: rows.length }],
        }
      },
    },
    traceRecorder: {
      recordDataQuery(payload) {
        recordedSuccess = payload
      },
    },
  })

  const result = executor.run({
    callId: 'dq_success',
    actor: 'agent',
    dataRef: 'wl://widgetva-app/workspace/main/data/current_view',
    query: {
      kind: 'summary',
      spec: {
        queryScope: {
          selectionRef: 'wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush',
        },
      },
    },
  })

  assert.equal(result.ok, true)
  assert.equal(recordedSuccess?.notes?.userVisibleSummary, 'Data query: summary scoped to wl://widgetva-app/workspace/main/widget/scatter_a/selection/brush over 1 row')
  assert.equal(recordedSuccess?.notes?.rationale, 'A selection-scoped data query was requested for the current runtime data view.')
  assert.equal(recordedSuccess?.notes?.verification, 'Query executed against wl://widgetva-app/workspace/main/data/current_view.')
})

test('DataQueryExecutor validates resultSchema before recording a successful data query trace', () => {
  let recordedSuccess = null
  let recordedFailure = null
  const executor = new DataQueryExecutor({
    store: {
      readDescription() {
        return {
          widgets: [],
          dataHandles: [
            {
              ref: 'wl://widgetva-app/workspace/main/data/current_view',
              supportedQueries: ['summary'],
            },
          ],
        }
      },
      readState() {
        return {
          stateId: 'main:s2',
          shared: {
            focusedWidget: null,
          },
        }
      },
      getResolvedWidgetForTarget() {
        return null
      },
      getResolvedWidget() {
        return null
      },
      getDataHandle(ref) {
        if (ref !== 'wl://widgetva-app/workspace/main/data/current_view') return null
        return {
          ref,
          supportedQueries: ['summary'],
        }
      },
      readRuntimeData(ref) {
        if (ref !== 'wl://widgetva-app/workspace/main/data/current_view') return null
        return {
          ref,
          rows: [{ value: 1 }],
        }
      },
      readCurrentSnapshotMeta() {
        return {
          stateId: 'main:s2',
          parentStateId: 'main:s1',
          branchId: 'main',
        }
      },
    },
    dataQueryEngine: {
      kind: 'runtime-test',
      summarize() {
        return []
      },
    },
    traceRecorder: {
      recordDataQuery(payload) {
        recordedSuccess = payload
      },
      recordDataQueryFailure(payload) {
        recordedFailure = payload
      },
    },
  })

  const result = executor.run({
    callId: 'dq_invalid_result',
    actor: 'agent',
    dataRef: 'wl://widgetva-app/workspace/main/data/current_view',
    query: {
      kind: 'summary',
      spec: {},
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'RUNTIME_ERROR')
  assert.match(result.error.message, /result/)
  assert.equal(recordedSuccess, null)
  assert.equal(recordedFailure?.code, 'RUNTIME_ERROR')
})

test('DataQueryExecutor inherits the active primary selection when a widget-scoped query omits selectionRef', () => {
  let recordedSuccess = null
  let receivedRows = null
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_a'
  const dataRef = 'wl://widgetva-app/workspace/main/data/current_view'
  const selectionRef = `${widgetRef}/selection/brush`

  const executor = new DataQueryExecutor({
    store: {
      readDescription() {
        return {
          widgets: [
            {
              ref: widgetRef,
              widgetId: 'scatter_a',
              kind: 'scatter',
              primaryDataRef: dataRef,
            },
          ],
          dataHandles: [
            {
              ref: dataRef,
              supportedQueries: ['summary'],
            },
          ],
        }
      },
      readState() {
        return {
          stateId: 'main:s3',
          shared: {
            focusedWidget: widgetRef,
            selections: {
              registry: {
                [selectionRef]: {
                  predicates: [{ field: 'region', op: 'equals', value: 'west' }],
                },
              },
              views: {
                primary: {
                  selectionRef,
                  sourceWidgetRef: widgetRef,
                },
                byWidget: {
                  scatter_a: {
                    selectionRef,
                    sourceWidgetRef: widgetRef,
                  },
                },
              },
            },
          },
          widgets: {
            [widgetRef]: {
              ref: widgetRef,
              widgetId: 'scatter_a',
              kind: 'scatter',
              data: {
                currentDataRef: dataRef,
                sourceDataRef: dataRef,
              },
              selections: {
                [selectionRef]: {
                  predicates: [{ field: 'region', op: 'equals', value: 'west' }],
                },
              },
            },
          },
        }
      },
      getResolvedWidgetForTarget(ref) {
        if (ref !== widgetRef) return null
        return {
          ref: widgetRef,
          widgetId: 'scatter_a',
          kind: 'scatter',
          data: {
            currentDataRef: dataRef,
            sourceDataRef: dataRef,
          },
          primaryDataRef: dataRef,
          selections: {
            [selectionRef]: {
              predicates: [{ field: 'region', op: 'equals', value: 'west' }],
            },
          },
        }
      },
      getResolvedWidget(ref) {
        return this.getResolvedWidgetForTarget(ref)
      },
      getDataHandle(ref) {
        if (ref !== dataRef) return null
        return {
          ref,
          supportedQueries: ['summary'],
        }
      },
      readRuntimeData(ref) {
        if (ref !== dataRef) return null
        return {
          ref,
          widgetRef,
          rows: [
            { region: 'west', value: 1 },
            { region: 'east', value: 2 },
            { region: 'west', value: 3 },
          ],
        }
      },
      resolveSelectionDataRef() {
        return null
      },
    },
    dataQueryEngine: {
      kind: 'runtime-test',
      summarize(rows) {
        receivedRows = rows
        return {
          rows: [{ count: rows.length }],
        }
      },
    },
    traceRecorder: {
      recordDataQuery(payload) {
        recordedSuccess = payload
      },
    },
  })

  const result = executor.run({
    callId: 'dq_inherit_primary_selection',
    actor: 'agent',
    query: {
      kind: 'summary',
      spec: {
        queryScope: {
          widgetRef,
        },
      },
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(receivedRows, [
    { region: 'west', value: 1 },
    { region: 'west', value: 3 },
  ])
  assert.equal(recordedSuccess?.notes?.userVisibleSummary, `Data query: summary scoped to ${selectionRef} over 2 rows`)
})
