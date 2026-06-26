import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WIDGET_PERCEPTION_PRIMITIVE_FAMILIES,
  getWidgetPerceptionPrimitive,
  listAllWidgetPerceptionNames,
  listUnmappedWidgetPerceptions,
} from './perceptionPrimitiveMap.js'

test('all current widget perceptions map to declared primitive families', () => {
  const perceptionNames = listAllWidgetPerceptionNames()
  const unmapped = listUnmappedWidgetPerceptions()

  assert.equal(perceptionNames.length > 0, true)
  assert.deepEqual(unmapped, [])
  for (const name of perceptionNames) {
    assert.equal(
      WIDGET_PERCEPTION_PRIMITIVE_FAMILIES.includes(getWidgetPerceptionPrimitive(name)),
      true,
      `${name} should map to a declared perception primitive family`,
    )
  }
})

test('known widget perceptions resolve to stable primitive families', () => {
  assert.equal(getWidgetPerceptionPrimitive('perception.getNodeOptions'), 'inspect')
  assert.equal(getWidgetPerceptionPrimitive('perception.findExtremes'), 'summarize')
  assert.equal(getWidgetPerceptionPrimitive('perception.compareGroups'), 'summarize')
  assert.equal(getWidgetPerceptionPrimitive('perception.computeCorrelation'), 'compute')
  assert.equal(getWidgetPerceptionPrimitive('perception.findBottleneck'), 'compute')
})
