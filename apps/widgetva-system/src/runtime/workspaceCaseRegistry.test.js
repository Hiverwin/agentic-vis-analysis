import test from 'node:test'
import assert from 'node:assert/strict'

import {
  clearWorkspaceCaseOverride,
  getWorkspaceCase,
  registerWorkspaceCaseProviderEnvironment,
  registerWorkspaceCaseOverride,
} from './workspaceCaseRegistry.js'

test('workspace case registry returns built-in cases by id and falls back to the default case', () => {
  const builtIn = getWorkspaceCase('cars-horsepower')
  assert.equal(builtIn.id, 'cars-horsepower')
  assert.equal(getWorkspaceCase('missing-case').id, builtIn.id)
})

test('workspace case registry stores and clears first-party case overrides', () => {
  const caseId = 'override-case'
  const override = registerWorkspaceCaseOverride(caseId, {
    id: caseId,
    title: 'Override',
    dataset: { horsepowerDomain: [0, 1] },
  })
  assert.equal(override.id, caseId)
  assert.equal(getWorkspaceCase(caseId).title, 'Override')
  assert.equal(clearWorkspaceCaseOverride(caseId), true)
})

test('workspace case registry can derive a whole-case provider environment override', () => {
  const caseId = 'cars-horsepower-provider-env'
  registerWorkspaceCaseOverride(caseId, {
    ...getWorkspaceCase('cars-horsepower'),
    id: caseId,
  })

  const override = registerWorkspaceCaseProviderEnvironment(caseId, 'echarts')
  assert.equal(override.workspaceProviderEnvironment, 'echarts')
  assert.equal(override.widgets.every((widget) => widget.provider === 'echarts'), true)
  assert.equal(override.widgets.every((widget) => typeof widget.type === 'string' && widget.type.endsWith('-echarts')), true)

  clearWorkspaceCaseOverride(caseId)
})
