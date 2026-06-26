import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeWorkspaceDescriptionSchema,
  makeWorkspaceDescription,
  makeWorkspaceDescriptionPlanning,
  makeWorkspaceTransportHints,
} from './description.js'
import { describeActionDescriptorSchema, makeActionDescriptor, describeActionCallSchema } from './actions.js'
import { describeDataHandleSchema, describeDataQueryDescriptorSchema, describeDataQueryCallSchema } from './dataHandles.js'
import { describePerceptionDescriptorSchema, makePerceptionDescriptor, describePerceptionQueryCallSchema } from './perception.js'

test('describeWorkspaceDescriptionSchema admits runtimeTopology summaries', () => {
  const schema = describeWorkspaceDescriptionSchema()

  assert.equal(schema.properties?.runtimeTopology?.anyOf?.[0]?.type, 'object')
  assert.equal(
    schema.properties?.runtimeTopology?.anyOf?.[0]?.properties?.topology?.type,
    'string',
  )
  assert.equal(
    schema.properties?.runtimeTopology?.anyOf?.[0]?.properties?.topologyLabel?.type,
    'string',
  )
})

test('describeWorkspaceDescriptionSchema admits transportHints', () => {
  const schema = describeWorkspaceDescriptionSchema()
  const transportHintsSchema = schema.properties?.transportHints
  const optionalToolsEnum = transportHintsSchema?.properties?.optionalTools?.items?.enum || []

  assert.equal(transportHintsSchema?.type?.[0], 'object')
  assert.equal(
    transportHintsSchema?.properties?.recommendedTools?.items?.type,
    'string',
  )
  assert.equal(
    transportHintsSchema?.properties?.optionalTools?.items?.type,
    'string',
  )
  assert.equal(optionalToolsEnum.includes('workspace_plan'), true)
  assert.equal(optionalToolsEnum.includes('agent_loop_describe'), true)
  assert.equal(optionalToolsEnum.includes('state_constraints_evaluate'), false)
  assert.equal(optionalToolsEnum.includes('benchmark_task_evaluate'), false)
})

test('describeWorkspaceDescriptionSchema admits widgetAdapters and protocol schema bundles', () => {
  const schema = describeWorkspaceDescriptionSchema()

  assert.equal(schema.properties?.widgetAdapters?.items?.type, 'object')
  assert.equal(schema.properties?.__schemas?.type, 'object')
  assert.equal(schema.properties?.benchmarkSupport, undefined)
})

test('describeWorkspaceDescriptionSchema admits planner contract enums', () => {
  const schema = describeWorkspaceDescriptionSchema()
  const planning = schema.properties?.planning?.properties || {}

  assert.equal(planning?.supportedTopologies?.items?.enum?.includes('T6'), true)
  assert.deepEqual(planning?.supportedRunModes?.items?.enum, ['goal_oriented', 'open_ended', 'autonomous'])
  assert.equal(planning?.supportedComplexityBudgets?.items?.enum?.includes('extended'), true)
  assert.equal(planning?.supportedPlanSources?.items?.enum?.includes('workspace_spec'), true)
  assert.equal(planning?.supportedPlanningModes?.items?.enum?.includes('topology_driven'), true)
  assert.equal(planning?.planner?.anyOf?.[0]?.properties?.primaryWidgetId?.type?.includes?.('string') ?? false, true)
  assert.equal(planning?.planner?.anyOf?.[0]?.properties?.widgets?.items?.properties?.widgetId?.type, 'string')
  assert.equal(planning?.planner?.anyOf?.[0]?.properties?.links?.items?.properties?.sourceWidgetId?.type, 'string')
  assert.equal(planning?.planningRequest?.anyOf?.[0]?.properties?.runMode?.type, 'string')
  assert.equal(planning?.requestedWorkspaceSpec?.anyOf?.[0]?.properties?.widgetCount?.type, 'integer')
})

test('describeWorkspaceDescriptionSchema admits runtime task context metadata', () => {
  const schema = describeWorkspaceDescriptionSchema()
  const taskContext = schema.properties?.taskContext?.anyOf?.[0]?.properties || {}

  assert.equal(taskContext?.taskId?.type, 'string')
  assert.equal(taskContext?.coordinationScope?.type, 'string')
  assert.equal(taskContext?.targetWidgetRefs?.items?.type, 'string')
})

test('makeWorkspaceDescription normalizes nested transport and planning payloads', () => {
  const description = makeWorkspaceDescription({
    transportHints: {
      recommendedTools: ['workspace_describe'],
    },
    planning: {
      requestedWorkspaceSpec: {
        topology: 'T2',
      },
      planningRequest: {
        mode: 'topology_driven',
      },
      planner: {
        topology: 'T2',
      },
    },
  })

  assert.equal(description.transportHints?.note, '')
  assert.deepEqual(description.transportHints?.optionalTools, [])
  assert.equal(description.benchmarkSupport, undefined)
  assert.equal(description.planning?.requestedWorkspaceSpec?.widgetCount, 0)
  assert.equal(description.planning?.planningRequest?.runMode, 'goal_oriented')
  assert.deepEqual(description.planning?.planner?.widgets, [])
})

test('workspace description nested constructors expose stable defaults', () => {
  const transportHints = makeWorkspaceTransportHints({
    recommendedTools: ['workspace_describe'],
  })
  const planning = makeWorkspaceDescriptionPlanning({
    workspaceSpecStatus: 'valid',
  })

  assert.deepEqual(transportHints.optionalTools, [])
  assert.equal(transportHints.note, '')
  assert.deepEqual(planning.supportedTopologies, [])
  assert.deepEqual(planning.workspaceSpecIssues, [])
  assert.equal(planning.materializedFromSpec, false)
  assert.equal(planning.materializedFromPlanner, false)
})

test('descriptor schemas allow describeWorkspace to omit schemas/examples', () => {
  assert.equal(describeActionDescriptorSchema().required.includes('paramsSchema'), false)
  assert.equal(describePerceptionDescriptorSchema().required.includes('paramsSchema'), false)
  assert.equal(describeDataQueryDescriptorSchema().required.includes('inputSchema'), false)
  assert.equal(describeDataHandleSchema().required.includes('schema'), false)
})

test('perception descriptors and calls admit queryScope as a first-class query input', () => {
  const descriptor = makePerceptionDescriptor({
    name: 'perception.findExtremes',
    title: 'Find extremes',
    description: 'Test descriptor',
    category: 'compute',
    paramsSchema: {
      type: 'object',
      properties: {
        field: { type: 'string' },
      },
    },
  })
  const callSchema = describePerceptionQueryCallSchema()

  assert.equal(descriptor.paramsSchema?.properties?.queryScope?.type, 'object')
  assert.equal(callSchema.properties?.queryScope?.type, 'object')
  assert.equal(callSchema.properties?.targetRef, undefined)
})

test('action descriptors and calls admit queryScope as a first-class query input', () => {
  const descriptor = makeActionDescriptor({
    name: 'widget.testAction',
    title: 'Test action',
    description: 'Test descriptor',
    primitive: 'select',
    category: 'selection',
    paramsSchema: {
      type: 'object',
      properties: {
        field: { type: 'string' },
      },
    },
  })
  const callSchema = describeActionCallSchema()

  assert.equal(descriptor.paramsSchema?.properties?.queryScope?.type, 'object')
  assert.equal(callSchema.properties?.queryScope?.type, 'object')
  assert.equal(callSchema.properties?.targetRef, undefined)
})

test('data query calls admit queryScope without exposing targetRef as a first-class input', () => {
  const callSchema = describeDataQueryCallSchema()

  assert.equal(callSchema.properties?.query?.properties?.spec?.type, 'object')
  assert.equal(callSchema.properties?.targetRef, undefined)
})
