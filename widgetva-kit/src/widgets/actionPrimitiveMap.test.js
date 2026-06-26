import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WIDGET_ACTION_PRIMITIVE_FAMILIES,
  getWidgetActionPrimitive,
  listAllWidgetActionNames,
  listUnmappedWidgetActions,
} from './actionPrimitiveMap.js'

test('every current widget action is mapped to a declared primitive family', () => {
  const actionNames = listAllWidgetActionNames()
  const unmapped = listUnmappedWidgetActions()

  assert.equal(actionNames.length > 0, true)
  assert.deepEqual(unmapped, [])

  for (const actionName of actionNames) {
    const primitive = getWidgetActionPrimitive(actionName)
    assert.equal(WIDGET_ACTION_PRIMITIVE_FAMILIES.includes(primitive), true, `${actionName} should map to a declared primitive family`)
  }
})
