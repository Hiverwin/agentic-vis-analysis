import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildActionCallSchemaInput,
  buildExecutableCall,
  buildInvalidParamsRecoveryHints,
  descriptorCanTargetWidget,
  makeActionExecutorSummary,
  mergeUniqueRefs,
  selectionPayloadFromSnapshot,
} from './ActionExecutorModels.js'

test('action executor model helpers summarize actions with stable defaults', () => {
  const summary = makeActionExecutorSummary({
    counts: { descriptorCount: 1 },
    capabilities: { paramsValidation: true },
    actions: [{
      name: 'bar.selectCategory',
      affectedRefs: ['widget-a'],
      effectKinds: ['selection'],
      supportedWidgetKinds: ['bar'],
    }],
  })

  assert.equal(summary.counts.descriptorCount, 1)
  assert.equal(summary.counts.handlerCount, 0)
  assert.equal(summary.capabilities.paramsValidation, true)
  assert.equal(summary.capabilities.linkPropagation, false)
  assert.deepEqual(summary.actions[0].affectedRefs, ['widget-a'])
  assert.deepEqual(summary.actions[0].supportedWidgetKinds, ['bar'])
})

test('action call helpers normalize query scope and params without legacy top-level targets', () => {
  const call = {
    name: 'bar.selectCategory',
    targetRef: 'legacy-target',
    params: {
      category: 'A',
      targetRef: 'scoped-target',
    },
  }

  const schemaInput = buildActionCallSchemaInput(call)
  const executable = buildExecutableCall(call)

  assert.equal(schemaInput.targetRef, undefined)
  assert.equal(executable.targetRef, 'legacy-target')
  assert.equal(executable.params.category, 'A')
  assert.deepEqual(executable.queryScope, {})
})

test('selection and target helpers preserve representative action context behavior', () => {
  const snapshot = {
    shared: {
      focusedWidget: 'widget-b-ref',
      selections: {
        registry: {
          'widget-a-ref/selection/a': { field: 'category', values: ['A'] },
          'widget-b-ref/selection/b': { field: 'category', values: ['B'] },
        },
      },
    },
    widgets: {
      'widget-a-ref': {
        widgetId: 'widget-a',
        selections: {
          'widget-a-ref/selection/a': { field: 'category', values: ['A'] },
        },
        data: { selectedCount: 1 },
      },
      'widget-b-ref': {
        widgetId: 'widget-b',
        selections: {
          'widget-b-ref/selection/b': { field: 'category', values: ['B'] },
        },
        data: { selectedCount: 2 },
      },
    },
  }

  const payload = selectionPayloadFromSnapshot(snapshot)
  assert.equal(payload.selection_ref, 'widget-b-ref/selection/b')
  assert.equal(payload.source_widget_id, 'widget-b')
  assert.equal(payload.count, 2)

  assert.equal(
    descriptorCanTargetWidget({ name: 'bar.selectCategory', supportedWidgetKinds: ['bar'] }, 'bar.selectCategory', 'bar'),
    true,
  )
  assert.equal(
    descriptorCanTargetWidget({ name: 'bar.selectCategory' }, 'bar.selectCategory', 'bar'),
    true,
  )
  assert.deepEqual(mergeUniqueRefs(['a', 'b'], ['b', null, 'c']), ['a', 'b', 'c'])
})

test('invalid param hints name missing required params', () => {
  assert.deepEqual(
    buildInvalidParamsRecoveryHints({
      call: { name: 'bar.selectCategory' },
      requiredParams: ['category'],
      executableCall: { params: {} },
    }),
    [
      'Provide the required params for bar.selectCategory: category.',
      'Call describeWorkspace() to inspect the action descriptor and params schema for bar.selectCategory.',
    ],
  )
})
