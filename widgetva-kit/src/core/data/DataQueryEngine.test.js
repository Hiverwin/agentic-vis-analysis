import test from 'node:test'
import assert from 'node:assert/strict'

import { JsArrayDataQueryEngine } from './JsArrayDataQueryEngine.js'
import { DuckDbDataQueryEngine } from './DuckDbDataQueryEngine.js'
import { RemoteDataQueryEngine } from './RemoteDataQueryEngine.js'

test('DataQueryEngine.describeEngine exposes structured supported query descriptors', () => {
  const engine = new JsArrayDataQueryEngine()

  const summary = engine.describeEngine()
  const summaryDescriptor = summary.supportedQueryDescriptors.find((entry) => entry.name === 'summary')
  const schemaDescriptor = summary.supportedQueryDescriptors.find((entry) => entry.name === 'schema')

  assert.equal(summary.counts.supportedQueryKindCount, summary.supportedQueryKinds.length)
  assert.equal(summary.counts.supportedQueryDescriptorCount, summary.supportedQueryDescriptors.length)
  assert.equal(summary.supportedQueryKinds.includes('summary'), true)
  assert.equal(summary.supportedQueryDescriptors.length, summary.supportedQueryKinds.length)
  assert.equal(summaryDescriptor?.title, 'Summarize current data view')
  assert.equal(summaryDescriptor?.resultKind, 'summaryTable')
  assert.equal(schemaDescriptor?.title, 'Inspect data schema')
})

test('DataQueryEngine.query dispatches direct doc-style query calls to the matching engine primitive', () => {
  const engine = new JsArrayDataQueryEngine()
  const rows = [
    { Horsepower: 90, Origin: 'Japan' },
    { Horsepower: 130, Origin: 'USA' },
    { Horsepower: 160, Origin: 'USA' },
  ]

  const schema = engine.query(rows, {
    kind: 'schema',
    spec: {},
  })
  const summary = engine.query(rows, {
    kind: 'summary',
    spec: {
      fields: ['Horsepower'],
      metrics: ['mean', 'count'],
    },
  })

  assert.equal(Array.isArray(schema?.fields), true)
  assert.equal(summary?.rows?.[0]?.count, 3)
  assert.equal(summary?.rows?.[0]?.Horsepower_mean, 126.66666666666667)
})

test('DataQueryEngine.query supports documented dataRef-first calls when the engine can resolve runtime data by ref', () => {
  const dataRef = 'wl://demo/workspace/main/data/cars'
  const engine = new JsArrayDataQueryEngine({
    resolveSource(ref) {
      return ref === dataRef
        ? [
            { Horsepower: 90, Origin: 'Japan' },
            { Horsepower: 130, Origin: 'USA' },
            { Horsepower: 160, Origin: 'USA' },
          ]
        : null
    },
  })

  const summary = engine.query(dataRef, {
    kind: 'summary',
    spec: {
      fields: ['Horsepower'],
      metrics: ['mean', 'count'],
    },
  })

  assert.equal(summary?.rows?.[0]?.count, 3)
  assert.equal(summary?.rows?.[0]?.Horsepower_mean, 126.66666666666667)
})

test('DataQueryEngine.getSchema supports documented dataRef-first calls when the engine can resolve runtime data by ref', () => {
  const dataRef = 'wl://demo/workspace/main/data/cars'
  const engine = new JsArrayDataQueryEngine({
    resolveSource(ref) {
      return ref === dataRef
        ? [
            { Horsepower: 90, Origin: 'Japan', Electric: false },
            { Horsepower: 130, Origin: 'USA', Electric: false },
          ]
        : null
    },
  })

  const schema = engine.getSchema(dataRef)

  assert.deepEqual(schema?.fields, [
    { name: 'Horsepower', type: 'quantitative' },
    { name: 'Origin', type: 'nominal' },
    { name: 'Electric', type: 'boolean' },
  ])
})

test('DataQueryEngine.query throws for unsupported direct query kinds', () => {
  const engine = new JsArrayDataQueryEngine()

  assert.throws(
    () => engine.query([], { kind: 'unknownKind', spec: {} }),
    /Unsupported data query kind/,
  )
})

test('RemoteDataQueryEngine accepts an execute alias and routes direct query() calls through the remote executor', async () => {
  let receivedRequest = null
  const engine = new RemoteDataQueryEngine({
    execute(request) {
      receivedRequest = request
      return {
        ok: true,
        rows: [{ Horsepower_mean: 126.67 }],
      }
    },
  })

  const result = await engine.query(
    [
      { Horsepower: 90 },
      { Horsepower: 130 },
      { Horsepower: 160 },
    ],
    {
      kind: 'summary',
      spec: {
        fields: ['Horsepower'],
        metrics: ['mean'],
      },
    },
  )

  assert.equal(receivedRequest?.kind, 'summary')
  assert.equal(Array.isArray(receivedRequest?.rows), true)
  assert.deepEqual(receivedRequest?.spec, {
    fields: ['Horsepower'],
    metrics: ['mean'],
    measures: [{ op: 'mean', field: 'Horsepower', as: 'Horsepower_mean' }],
  })
  assert.deepEqual(result, {
    ok: true,
    rows: [{ Horsepower_mean: 126.67 }],
  })
})

test('RemoteDataQueryEngine supports documented getSchema(dataRef) calls when resolveSource is configured', () => {
  const dataRef = 'wl://demo/workspace/main/data/cars'
  const engine = new RemoteDataQueryEngine({
    resolveSource(ref) {
      return ref === dataRef
        ? [
            { Horsepower: 90, Origin: 'Japan' },
            { Horsepower: 130, Origin: 'USA' },
          ]
        : null
    },
  })

  const schema = engine.getSchema(dataRef)

  assert.deepEqual(schema?.fields, [
    { name: 'Horsepower', type: 'quantitative' },
    { name: 'Origin', type: 'nominal' },
  ])
})

test('DuckDbDataQueryEngine accepts an execute alias and routes direct query() calls through the configured local executor', async () => {
  let receivedRequest = null
  const engine = new DuckDbDataQueryEngine({
    execute(request) {
      receivedRequest = request
      return {
        ok: true,
        rows: [{ Horsepower_mean: 126.67 }],
      }
    },
  })

  const result = await engine.query(
    [
      { Horsepower: 90 },
      { Horsepower: 130 },
      { Horsepower: 160 },
    ],
    {
      kind: 'summary',
      spec: {
        fields: ['Horsepower'],
        metrics: ['mean'],
      },
    },
  )

  assert.equal(receivedRequest?.kind, 'summary')
  assert.equal(Array.isArray(receivedRequest?.rows), true)
  assert.deepEqual(receivedRequest?.spec, {
    fields: ['Horsepower'],
    metrics: ['mean'],
    measures: [{ op: 'mean', field: 'Horsepower', as: 'Horsepower_mean' }],
  })
  assert.deepEqual(result, {
    ok: true,
    rows: [{ Horsepower_mean: 126.67 }],
  })
})

test('DuckDbDataQueryEngine supports documented getSchema(dataRef) calls when resolveSource is configured', () => {
  const dataRef = 'wl://demo/workspace/main/data/cars'
  const engine = new DuckDbDataQueryEngine({
    resolveSource(ref) {
      return ref === dataRef
        ? [
            { Horsepower: 90, Origin: 'Japan' },
            { Horsepower: 130, Origin: 'USA' },
          ]
        : null
    },
  })

  const schema = engine.getSchema(dataRef)

  assert.deepEqual(schema?.fields, [
    { name: 'Horsepower', type: 'quantitative' },
    { name: 'Origin', type: 'nominal' },
  ])
})
