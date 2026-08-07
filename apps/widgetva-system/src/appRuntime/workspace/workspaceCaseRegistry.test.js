import test from 'node:test'
import assert from 'node:assert/strict'

import {
  clearWorkspaceCaseOverride,
  getWorkspaceCase,
  registerWorkspaceCaseProviderEnvironment,
  registerWorkspaceCaseOverride,
} from './workspaceCaseRegistry.js'

test('workspace case registry starts the application with an empty workspace', () => {
  const builtIn = getWorkspaceCase('cars-horsepower')
  assert.equal(builtIn.id, 'cars-horsepower')
  const emptyWorkspace = getWorkspaceCase('empty-workspace')
  assert.equal(emptyWorkspace.id, 'empty-workspace')
  assert.deepEqual(emptyWorkspace.widgets, [])
  assert.equal(getWorkspaceCase('missing-case').id, emptyWorkspace.id)
})

test('workspace case registry stores and clears first-party case overrides', () => {
  const caseId = 'override-case'
  const override = registerWorkspaceCaseOverride(caseId, {
    id: caseId,
    title: 'Override',
    dataset: { rowsData: [] },
  })
  assert.equal(override.id, caseId)
  assert.equal(getWorkspaceCase(caseId).title, 'Override')
  assert.equal(clearWorkspaceCaseOverride(caseId), true)
})

test('workspace case registry stores provider environment without rewriting widget definitions', () => {
  const caseId = 'starter-provider-env'
  registerWorkspaceCaseOverride(caseId, {
    ...getWorkspaceCase('starter-workspace'),
    widgets: [
      { id: 'w_imported_bar', widgetKind: 'bar', type: 'bar-vega-lite', provider: 'vega-lite' },
      { id: 'w_imported_line', widgetKind: 'line', type: 'line-vega-lite', provider: 'vega-lite' },
    ],
    id: caseId,
  })

  const override = registerWorkspaceCaseProviderEnvironment(caseId, 'echarts')
  assert.equal(override.workspaceProviderEnvironment, 'echarts')
  assert.equal(override.widgets[0].provider, 'vega-lite')
  assert.equal(override.widgets[0].type, 'bar-vega-lite')
  assert.equal(override.widgets[1].provider, 'vega-lite')
  assert.equal(override.widgets[1].type, 'line-vega-lite')

  clearWorkspaceCaseOverride(caseId)
})
