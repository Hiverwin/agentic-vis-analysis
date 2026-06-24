import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describePagePortCapabilities,
  describePagePortSchemasForMethods,
  PAGE_PORT_METHOD_DESCRIPTORS,
  makePagePortDescription,
  makePagePortMethodDescriptor,
  makePagePortTransportHints,
} from './pagePort.js'

test('describePagePortCapabilities exposes stable transport hints', () => {
  const description = describePagePortCapabilities()

  assert.deepEqual(
    description.transportHints?.recommendedTools,
    ['workspace_describe', 'view_read', 'action_run', 'perception_query', 'interaction_trace_read'],
  )
  assert.deepEqual(
    description.transportHints?.optionalTools,
    [
      'data_query',
      'workspace_plan',
      'agent_loop_describe',
      'action_usage_describe',
      'trace_graph_read',
      'read_snapshot',
      'state_history_read',
      'branch_list',
      'verified_action_run',
      'jump_to_state',
      'branch_from_state',
      'link_propagation_evaluate',
      'response_recorder_describe',
      'agent_response_read',
      'agent_response_list',
      'agent_response_record',
    ],
  )
})

test('response-read page-port descriptors admit workspace-scoped filters', () => {
  const latestDescriptor = PAGE_PORT_METHOD_DESCRIPTORS.getLatestAgentResponse
  const listDescriptor = PAGE_PORT_METHOD_DESCRIPTORS.listAgentResponses
  const recordDescriptor = PAGE_PORT_METHOD_DESCRIPTORS.recordAgentResponse
  const latestInput = PAGE_PORT_METHOD_DESCRIPTORS.getLatestAgentResponse.inputSchema?.properties || {}
  const listInput = PAGE_PORT_METHOD_DESCRIPTORS.listAgentResponses.inputSchema?.properties || {}

  assert.equal(latestDescriptor.description.includes('specified workspace'), true)
  assert.equal(listDescriptor.description.includes('specified workspace'), true)
  assert.equal(recordDescriptor.description.includes('current workspace'), true)
  assert.equal(latestInput.workspaceId?.type, 'string')
  assert.equal(listInput.workspaceId?.type, 'string')
  assert.equal(listInput.limit?.type, 'integer')
})

test('describePagePortSchemasForMethods filters schema catalog to the installed method subset', () => {
  const schemas = describePagePortSchemasForMethods([
    'describePagePort',
    'describeWorkspace',
    'evaluateLinkPropagation',
  ])

  assert.equal(typeof schemas.pagePortDescription, 'object')
  assert.equal(typeof schemas.workspaceDescription, 'object')
  assert.equal(typeof schemas.linkPropagationEvaluation, 'object')
  assert.equal(schemas.runtimeStoreSummary, undefined)
  assert.equal(schemas.agentResponseRecord, undefined)
})

test('page-port constructors normalize self-description defaults', () => {
  const transportHints = makePagePortTransportHints({
    recommendedTools: ['workspace_describe'],
  })
  const methodDescriptor = makePagePortMethodDescriptor({
    aliases: ['workspace_describe'],
    description: 'Describe workspace',
  })
  const description = makePagePortDescription({
    methods: ['describeWorkspace'],
    methodDescriptors: {
      describeWorkspace: {
        aliases: ['workspace_describe'],
      },
    },
  })

  assert.deepEqual(transportHints.optionalTools.includes('workspace_plan'), true)
  assert.equal(transportHints.note.length > 0, true)
  assert.deepEqual(methodDescriptor.aliases, ['workspace_describe'])
  assert.equal(methodDescriptor.inputSchema?.type, 'object')
  assert.deepEqual(description.methods, ['describeWorkspace'])
  assert.deepEqual(description.methodDescriptors.describeWorkspace.aliases, ['workspace_describe'])
  assert.equal(typeof description.schemas.pagePortDescription, 'object')
})
