import test from 'node:test'
import assert from 'node:assert/strict'

import {
  listAvailableWidgetVAMcpTools,
  WIDGETVA_MCP_TOOLS,
  invokeWidgetVAMcpTool,
} from './mcpTools.js'

test('WIDGETVA_MCP_TOOLS only includes page-port aliases on the mainline surface', () => {
  const toolNames = WIDGETVA_MCP_TOOLS.map((tool) => tool.name)

  assert.equal(toolNames.includes('page_port_describe'), true)
  assert.equal(toolNames.includes('workspace_describe'), true)
  assert.equal(toolNames.includes('view_read'), true)
  assert.equal(toolNames.includes('evaluation_surface_describe'), false)
  assert.equal(toolNames.includes('evaluation_action_verification'), false)
})

test('invokeWidgetVAMcpTool dispatches page-port tools through the page port only', async () => {
  globalThis.window = {
    __widgetVA: {
      describePagePort() {
        return { version: '1.0.0', methods: ['describeWorkspace'] }
      },
      describeWorkspace(options = {}) {
        return { workspaceId: options.workspaceId || 'main' }
      },
    },
  }

  assert.deepEqual(await invokeWidgetVAMcpTool('page_port_describe'), {
    version: '1.0.0',
    methods: ['describeWorkspace'],
  })
  assert.deepEqual(await invokeWidgetVAMcpTool('workspace_describe', { workspaceId: 'workspace_b' }), {
    workspaceId: 'workspace_b',
  })

  delete globalThis.window
})

test('listAvailableWidgetVAMcpTools only returns installed page-port tools', async () => {
  globalThis.window = {
    __widgetVA: {
      page_port_describe() {
        return {
          aliases: {
            page_port_describe: 'describePagePort',
            workspace_describe: 'describeWorkspace',
            view_read: 'readView',
          },
        }
      },
    },
  }

  assert.deepEqual(
    (await listAvailableWidgetVAMcpTools()).map((tool) => tool.name),
    ['page_port_describe', 'workspace_describe', 'view_read'],
  )

  delete globalThis.window
})
