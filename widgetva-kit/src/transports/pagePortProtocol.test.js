import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PAGE_PORT_ALIASES,
  PAGE_PORT_ERROR_CODES,
  PAGE_PORT_METHOD_DESCRIPTORS,
  PAGE_PORT_METHODS,
  makePagePortProtocolMethodDescriptor,
} from './pagePortProtocol.js'

test('page-port contracts apply stable method descriptor defaults', () => {
  const descriptor = makePagePortProtocolMethodDescriptor({
    description: 'Describe the current workspace.',
  })

  assert.equal(descriptor.stability, 'stable')
  assert.deepEqual(descriptor.aliases, [])
  assert.equal(descriptor.inputSchema.type, 'object')
  assert.deepEqual(descriptor.returns, {
    kind: 'result',
    description: '',
  })
  assert.deepEqual(descriptor.errors, [])
  assert.equal(descriptor.description, 'Describe the current workspace.')
})

test('page-port contracts expose stable method and alias catalogs', () => {
  assert.equal(PAGE_PORT_METHODS.includes('describeWorkspace'), true)
  assert.equal(PAGE_PORT_METHODS.includes('executeVerifiedAction'), true)
  assert.equal(PAGE_PORT_ALIASES.workspace_describe, 'describeWorkspace')
  assert.equal(PAGE_PORT_ALIASES.verified_action_run, 'executeVerifiedAction')
})

test('page-port contracts do not expose runtime internals or agent loop APIs', () => {
  assert.equal(PAGE_PORT_METHODS.includes('describeRuntimeCore'), false)
  assert.equal(PAGE_PORT_METHODS.includes('describeAgentLoop'), false)
  assert.equal(PAGE_PORT_METHODS.includes('runAgentTurn'), false)
  assert.equal(PAGE_PORT_METHODS.includes('readSharedAnalyticalState'), false)
  assert.equal(PAGE_PORT_METHODS.includes('readSharedFilterContext'), false)

  assert.equal(PAGE_PORT_ALIASES.runtime_core_describe, undefined)
  assert.equal(PAGE_PORT_ALIASES.agent_loop_describe, undefined)
  assert.equal(PAGE_PORT_ALIASES.shared_analytical_state_read, undefined)
  assert.equal(PAGE_PORT_METHOD_DESCRIPTORS.describeRuntimeCore, undefined)
  assert.equal(PAGE_PORT_METHOD_DESCRIPTORS.describeAgentLoop, undefined)
})

test('page-port contracts expose stable error catalog groups', () => {
  assert.equal(PAGE_PORT_ERROR_CODES.pagePort[0].code, 'METHOD_NOT_INSTALLED')
  assert.equal(PAGE_PORT_ERROR_CODES.action.some((entry) => entry.code === 'INVALID_PARAMS'), true)
  assert.equal(PAGE_PORT_ERROR_CODES.perception.some((entry) => entry.code === 'UNKNOWN_QUERY'), true)
  assert.equal(PAGE_PORT_ERROR_CODES.dataQuery.some((entry) => entry.code === 'INVALID_QUERY_SPEC'), true)
})

test('page-port contracts expose stable method descriptors', () => {
  const workspaceDescriptor = PAGE_PORT_METHOD_DESCRIPTORS.describeWorkspace
  const actionDescriptor = PAGE_PORT_METHOD_DESCRIPTORS.executeAction

  assert.equal(workspaceDescriptor.description.includes('Describe the current workspace'), true)
  assert.deepEqual(workspaceDescriptor.aliases, ['workspace_describe'])
  assert.equal(actionDescriptor.inputSchema.type, 'object')
  assert.equal(actionDescriptor.returns.kind, 'actionResult')
  assert.equal(actionDescriptor.errors, PAGE_PORT_ERROR_CODES.action)
})
