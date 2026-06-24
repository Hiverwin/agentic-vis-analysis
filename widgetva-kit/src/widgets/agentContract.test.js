import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SINGLE_WIDGET_AGENT_CONTRACT_VERSION,
  describeSingleWidgetAgentContractSchema,
  makeSingleWidgetAgentContract,
} from './agentContract.js'

test('single-widget agent contract builder normalizes core surfaces and schema catalog', () => {
  const contract = makeSingleWidgetAgentContract({
    widget: {
      ref: 'widget://demo/scatter',
      widgetId: 'scatter_demo',
      kind: 'scatter',
      title: 'Demo Scatter',
      role: 'primary',
    },
    catalog: {
      actionDescriptors: [
        { name: 'scatter.brushRegion', primitive: 'select', category: 'selection', title: 'Brush', description: 'Brush region', paramsSchema: { type: 'object' } },
      ],
      perceptionDescriptors: [
        { name: 'perception.inspectVisibleRows', description: 'Inspect rows', evidenceKinds: [], targetRef: null },
      ],
    },
  })

  assert.equal(contract.version, SINGLE_WIDGET_AGENT_CONTRACT_VERSION)
  assert.equal(contract.observe.observationMethodName, 'readObservation')
  assert.equal(contract.act.actionMethodName, 'executeAction')
  assert.equal(contract.act.verifiedActionMethodName, 'executeVerifiedAction')
  assert.equal(contract.verify.verifyQueryName, 'perception.verifyActionEffect')
  assert.deepEqual(contract.catalog.availableActionNames, ['scatter.brushRegion'])
  assert.deepEqual(contract.catalog.availablePerceptionNames, ['perception.inspectVisibleRows'])
  assert.equal(contract.schemas.actionCall.required.includes('name'), true)
  assert.equal(contract.schemas.actionResult.required.includes('actionName'), true)
  assert.equal(contract.schemas.verifiedActionResult.required.includes('verification'), true)
})

test('single-widget agent contract schema requires the stable top-level sections', () => {
  const schema = describeSingleWidgetAgentContractSchema()

  assert.deepEqual(
    schema.required,
    ['version', 'widget', 'observe', 'act', 'verify', 'catalog', 'schemas'],
  )
  assert.equal(schema.properties.observe.properties.observationMethodName.type, 'string')
  assert.equal(schema.properties.act.properties.verifiedActionMethodName.type, 'string')
  assert.equal(schema.properties.verify.properties.verifyQueryName.type, 'string')
  assert.equal(schema.properties.catalog.properties.actionDescriptors.type, 'array')
})
