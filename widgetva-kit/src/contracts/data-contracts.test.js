import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DATA_QUERY_RESULT_SCHEMAS,
  DATA_QUERY_SCHEMAS,
  makeDataHandle,
  makeDataQueryDescriptor,
} from './data-contracts.js'
import { DATA_QUERY_DESCRIPTOR_TEMPLATES } from '../core/data/dataQueryDescriptorTemplates.js'

const TEMPLATE_NAMES = [
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

test('data query descriptor templates expose shared current-view examples', () => {
  for (const name of TEMPLATE_NAMES) {
    const template = DATA_QUERY_DESCRIPTOR_TEMPLATES[name]
    assert.ok(template)
    assert.ok(
      Array.isArray(template.examples)
        && template.examples.some((example) => example?.spec?.queryScope?.dataRef === 'wl://demo/workspace/main/data/current_view'),
      `${name} should include a current_view example`,
    )
  }
})

test('data query descriptor templates expose scoped current-selection examples', () => {
  for (const name of TEMPLATE_NAMES) {
    const template = DATA_QUERY_DESCRIPTOR_TEMPLATES[name]
    assert.ok(template)
    assert.ok(
      Array.isArray(template.examples)
        && template.examples.some((example) =>
          example?.spec?.queryScope?.dataRef === 'wl://demo/workspace/main/data/current_selection'
          && example?.spec?.queryScope?.selectionRef === 'wl://demo/workspace/main/widget/scatter/selection/brush'),
      `${name} should include a current_selection example`,
    )
  }
})

test('data query schemas remain available from the data contract surface', () => {
  for (const name of TEMPLATE_NAMES) {
    const schema = DATA_QUERY_SCHEMAS[name]
    assert.ok(schema)
    assert.equal(schema.properties?.targetDataRef, undefined, `${name} should not expose targetDataRef`)
    assert.equal(schema.properties?.targetRef, undefined, `${name} should not expose targetRef`)
    assert.equal(schema.properties?.selectionRef, undefined, `${name} should not expose selectionRef`)
    assert.equal(schema.properties?.queryScope?.type, 'object', `${name} should admit queryScope`)
  }
})

test('makeDataQueryDescriptor applies stable defaults and result schemas', () => {
  const descriptor = makeDataQueryDescriptor({
    name: 'filter',
    title: 'Filter rows',
  })

  assert.equal(descriptor.title, 'Filter rows')
  assert.deepEqual(descriptor.inputSchema, {
    type: 'object',
    additionalProperties: false,
    properties: {},
  })
  assert.deepEqual(descriptor.examples, [])
  assert.equal(descriptor.resultSchema, DATA_QUERY_RESULT_SCHEMAS.filter)
})

test('makeDataHandle applies stable data view defaults', () => {
  const handle = makeDataHandle({
    ref: 'wl://demo/workspace/main/data/primary',
  })

  assert.equal(handle.ref, 'wl://demo/workspace/main/data/primary')
  assert.equal(handle.sourceKind, 'inline')
  assert.equal(handle.kind, 'dataView')
  assert.equal(handle.scope, 'workspace')
  assert.deepEqual(handle.supportedQueries, ['sampleRows', 'summary'])
  assert.deepEqual(handle.supportedQueryDescriptors, [])
})
