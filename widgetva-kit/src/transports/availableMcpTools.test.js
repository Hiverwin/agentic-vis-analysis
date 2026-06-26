import test from 'node:test'
import assert from 'node:assert/strict'

import { filterAvailableWidgetVAMcpTools } from './availableMcpTools.js'

const ALL_TOOLS = [
  { name: 'page_port_describe' },
  { name: 'workspace_describe' },
  { name: 'view_read' },
  { name: 'interaction_trace_read' },
]

test('filterAvailableWidgetVAMcpTools returns only page-port tools from explicit aliases', () => {
  const tools = filterAvailableWidgetVAMcpTools({
    allTools: ALL_TOOLS,
    pagePortDescription: {
      aliases: {
        page_port_describe: 'describePagePort',
        workspace_describe: 'describeWorkspace',
      },
    },
  })

  assert.deepEqual(
    tools.map((tool) => tool.name),
    ['page_port_describe', 'workspace_describe'],
  )
})

test('filterAvailableWidgetVAMcpTools derives aliases from method descriptors and stable method names', () => {
  const tools = filterAvailableWidgetVAMcpTools({
    allTools: ALL_TOOLS,
    pagePortDescription: {
      methodDescriptors: {
        describePagePort: { aliases: ['page_port_describe'] },
      },
      methods: ['describeWorkspace', 'readView'],
    },
  })

  assert.deepEqual(
    tools.map((tool) => tool.name),
    ['page_port_describe', 'workspace_describe', 'view_read'],
  )
})
