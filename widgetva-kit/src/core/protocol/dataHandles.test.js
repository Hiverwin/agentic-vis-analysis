import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DATA_QUERY_DESCRIPTOR_TEMPLATES,
  DATA_QUERY_RESULT_SCHEMAS,
  DATA_QUERY_SCHEMAS,
  describeDataQueryCallSchema,
} from './dataHandles.js'

test('data query descriptor templates expose current_view examples for shared visible-data access', () => {
  const templateNames = [
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

  for (const name of templateNames) {
    const template = DATA_QUERY_DESCRIPTOR_TEMPLATES[name]
    assert.ok(template)
    assert.ok(
      Array.isArray(template.examples)
        && template.examples.some((example) => example?.spec?.queryScope?.dataRef === 'wl://demo/workspace/main/data/current_view'),
      `${name} should include a current_view example`,
    )
  }
})

test('data query descriptor templates expose current_selection examples for scoped shared-selection access', () => {
  const templateNames = [
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

  for (const name of templateNames) {
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

test('data query schemas admit scoped data targets inside query specs', () => {
  const schemaNames = [
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

  for (const name of schemaNames) {
    const schema = DATA_QUERY_SCHEMAS[name]
    assert.ok(schema)
    assert.equal(schema.properties?.targetDataRef, undefined, `${name} should not expose targetDataRef`)
    assert.equal(schema.properties?.targetRef, undefined, `${name} should not expose targetRef`)
    assert.equal(schema.properties?.selectionRef, undefined, `${name} should not expose selectionRef`)
    assert.equal(schema.properties?.queryScope?.type, 'object', `${name} should admit queryScope`)
  }
})

test('data query call schema admits runtime callId metadata', () => {
  const schema = describeDataQueryCallSchema()
  assert.equal(schema.properties?.callId?.type, 'string')
  assert.equal(schema.properties?.query?.properties?.spec?.type, 'object')
})

test('data query result schemas admit the structured filter result envelope used by the runtime', () => {
  const schema = DATA_QUERY_RESULT_SCHEMAS.filter

  assert.equal(schema?.type, 'object')
  assert.equal(schema?.properties?.rows?.type, 'array')
  assert.equal(schema?.properties?.rowCount?.type, 'integer')
  assert.equal(schema?.properties?.predicates?.type, 'array')
})
