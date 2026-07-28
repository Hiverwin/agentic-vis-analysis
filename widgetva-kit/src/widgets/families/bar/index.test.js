import test from 'node:test'
import assert from 'node:assert/strict'

import {
  barFamily,
  buildBarActionDescriptors,
  buildBarPerceptionDescriptors,
  describeBarWidgetContract,
  getBarHumanInteractionConfig,
  registerBarPerceptionQueries,
} from './index.js'

test('bar family owns the complete semantic family surface', () => {
  assert.equal(barFamily.kind, 'bar')
  assert.equal(barFamily.describeContract, describeBarWidgetContract)
  assert.equal(barFamily.actions.buildDescriptors, buildBarActionDescriptors)
  assert.equal('widgetKind' in barFamily.actions, false)
  assert.equal('buildCatalog' in barFamily.actions, false)
  assert.equal('register' in barFamily.actions, false)
  assert.equal(barFamily.perception.buildDescriptors, buildBarPerceptionDescriptors)
  assert.equal(barFamily.perception.register, registerBarPerceptionQueries)
  assert.equal(barFamily.interactionProfile.getConfig, getBarHumanInteractionConfig)
  assert.equal('playbook' in barFamily, false)
})

test('bar family contract describes action and perception capabilities', () => {
  const contract = barFamily.describeContract()

  assert.equal(contract.kind, 'bar')
  assert.ok(contract.actionNames.includes('bar.selectCategory'))
  assert.ok(contract.actionNames.includes('bar.highlightTopN'))
  assert.ok(contract.perceptionNames.includes('perception.compareGroups'))
  assert.equal(contract.perceptionNames.includes('perception.findExtremes'), false)
})
