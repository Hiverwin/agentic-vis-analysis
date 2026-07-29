import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHandlerInput,
  buildPerceptionCallSchemaInput,
  buildPerceptionTraceNotes,
  countSemanticSelectionRows,
  makePerceptionRegistrySummary,
  resolveViewConfigEncodings,
} from './PerceptionExecutorModels.js'

test('perception registry model helpers summarize queries with stable defaults', () => {
  const summary = makePerceptionRegistrySummary({
    counts: { descriptorCount: 1 },
    capabilities: { traceRecording: true },
    queries: [{
      name: 'perception.inspectViewConfig',
      category: 'inspection',
      handlerVariantCount: 2,
      evidenceKinds: ['view-config'],
      supportedWidgetKinds: ['bar'],
    }],
  })

  assert.equal(summary.counts.descriptorCount, 1)
  assert.equal(summary.counts.handlerEntryCount, 0)
  assert.equal(summary.capabilities.paramsValidation, true)
  assert.equal(summary.capabilities.traceRecording, true)
  assert.equal(summary.capabilities.linkPropagationEvidence, false)
  assert.equal(summary.queries[0].sideEffectFree, true)
  assert.deepEqual(summary.queries[0].supportedWidgetKinds, ['bar'])
})

test('perception call helpers normalize schema input while preserving existing legacy data scope behavior', () => {
  const call = {
    name: 'perception.inspectVisibleRows',
    callId: 'call-a',
    targetRef: 'legacy-widget',
    dataRef: 'legacy-data',
    params: {
      limit: 10,
      targetRef: 'scoped-widget',
      dataRef: 'scoped-data',
      selectionRef: 'selection-a',
    },
  }

  const schemaInput = buildPerceptionCallSchemaInput(call)
  const handlerInput = buildHandlerInput(call)

  assert.equal(schemaInput.targetRef, undefined)
  assert.equal(schemaInput.dataRef, undefined)
  assert.equal(handlerInput.targetRef, undefined)
  assert.equal(handlerInput.dataRef, undefined)
  assert.equal(handlerInput.params.limit, 10)
  assert.equal(handlerInput.params.targetRef, undefined)
  assert.equal(handlerInput.params.dataRef, undefined)
  assert.equal(handlerInput.params.selectionRef, undefined)
  assert.deepEqual(handlerInput.queryScope, {
    dataRef: 'legacy-data',
    selectionRef: null,
    focusRef: null,
    viewportRef: null,
  })
})

test('resolveViewConfigEncodings collects nested and layered Vega-Lite encodings', () => {
  const encodings = resolveViewConfigEncodings({
    rawSpec: {
      layer: [
        { mark: 'bar', encoding: { x: { field: 'category' }, y: { field: 'value' } } },
        { mark: 'rule', encoding: { y: { aggregate: 'mean', field: 'value' } } },
      ],
    },
  })

  assert.deepEqual(encodings.representative, {
    x: { field: 'category' },
    y: { field: 'value' },
  })
  assert.deepEqual(
    encodings.views.map((entry) => ({ path: entry.path, channels: entry.channels })),
    [
      { path: 'spec.layer[0]', channels: ['x', 'y'] },
      { path: 'spec.layer[1]', channels: ['y'] },
    ],
  )
})

test('countSemanticSelectionRows deduplicates folded parallel-coordinate rows by detail field', () => {
  const spec = {
    transform: [{ fold: ['a', 'b'], as: ['dimension', 'value'] }],
    encoding: {
      x: { field: 'dimension' },
      detail: { field: 'rowId' },
    },
  }
  const rows = [
    { rowId: 'r1', dimension: 'a', value: 1 },
    { rowId: 'r1', dimension: 'b', value: 2 },
    { rowId: 'r2', dimension: 'a', value: 3 },
  ]

  assert.equal(countSemanticSelectionRows({ widgetKind: 'parallelCoordinates', spec, rows }), 2)
  assert.equal(countSemanticSelectionRows({ widgetKind: 'bar', spec: null, rows }), 3)
})

test('buildPerceptionTraceNotes trims useful text and omits blank notes', () => {
  assert.deepEqual(
    buildPerceptionTraceNotes({
      userVisibleSummary: '  inspected rows  ',
      rationale: '   ',
      verification: ' ok ',
    }),
    {
      userVisibleSummary: 'inspected rows',
      verification: 'ok',
    },
  )
})
