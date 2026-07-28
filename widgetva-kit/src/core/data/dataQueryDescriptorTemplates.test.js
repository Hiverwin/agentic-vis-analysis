import test from 'node:test'
import assert from 'node:assert/strict'

import { DATA_QUERY_DESCRIPTOR_TEMPLATES } from './dataQueryDescriptorTemplates.js'

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
