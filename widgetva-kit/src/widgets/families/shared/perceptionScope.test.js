import test from 'node:test'
import assert from 'node:assert/strict'

import {
  appendQueryScopeGuidance,
  buildQueryScopeExample,
  buildScopedPerceptionParamsSchema,
} from './perceptionScope.js'

test('buildScopedPerceptionParamsSchema leaves target/query scoping outside task params', () => {
  const schema = buildScopedPerceptionParamsSchema({
    field: { type: 'string' },
  })

  assert.equal(schema.properties?.field?.type, 'string')
  assert.equal(schema.properties?.dataRef, undefined)
  assert.equal(schema.properties?.targetDataRef, undefined)
  assert.equal(schema.properties?.selectionRef, undefined)
  assert.equal(schema.properties?.targetRef, undefined)
})

test('buildQueryScopeExample emits data/selection scoped examples without removing task params', () => {
  const example = buildQueryScopeExample({
    userGoal: 'Find extremes in one scoped view.',
    params: { field: 'value', limit: 5 },
    dataRef: 'wl://demo/workspace/main/data/current_selection',
    selectionRef: 'wl://demo/workspace/main/widget/scatter_a/selection/brush',
  })

  assert.equal(example.userGoal, 'Find extremes in one scoped view.')
  assert.equal(example.params?.field, 'value')
  assert.equal(example.params?.limit, 5)
  assert.deepEqual(example.params?.queryScope, {
    dataRef: 'wl://demo/workspace/main/data/current_selection',
    selectionRef: 'wl://demo/workspace/main/widget/scatter_a/selection/brush',
  })
})

test('appendQueryScopeGuidance adds compatibility guidance exactly once per description string', () => {
  const description = appendQueryScopeGuidance('Compute grouped statistics over the visible rows.')

  assert.equal(
    description.includes('Use target.widgetRef for widget targeting and queryScope for data/selection targeting.'),
    true,
  )
  assert.equal(
    description.startsWith('Compute grouped statistics over the visible rows.'),
    true,
  )
})
