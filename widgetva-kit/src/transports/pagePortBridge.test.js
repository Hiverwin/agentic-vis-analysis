import test from 'node:test'
import assert from 'node:assert/strict'

import { PAGE_PORT_ALIASES } from '../core/protocol/pagePort.js'
import {
  TRANSPORT_PAGE_PORT_ALIASES,
  evaluatePagePortAlias,
  invokePagePortAlias,
} from './pagePortBridge.js'

test('TRANSPORT_PAGE_PORT_ALIASES is derived from PAGE_PORT_ALIASES', () => {
  assert.deepEqual(TRANSPORT_PAGE_PORT_ALIASES, Object.keys(PAGE_PORT_ALIASES))
  assert.equal(TRANSPORT_PAGE_PORT_ALIASES.includes('workspace_plan'), true)
  assert.equal(TRANSPORT_PAGE_PORT_ALIASES.includes('verified_action_run'), true)
  assert.equal(TRANSPORT_PAGE_PORT_ALIASES.includes('agent_response_record'), true)
})

test('invokePagePortAlias falls back to the stable page-port method when the alias is unavailable', async () => {
  const previousWindow = globalThis.window
  globalThis.window = {
    __widgetVA: {
      describeWorkspace(options = {}) {
        return {
          workspaceId: options.workspaceId || 'main',
        }
      },
    },
  }

  try {
    assert.deepEqual(
      await invokePagePortAlias('workspace_describe', [{ workspaceId: 'workspace_b' }]),
      {
        workspaceId: 'workspace_b',
      },
    )
  } finally {
    globalThis.window = previousWindow
  }
})

test('evaluatePagePortAlias falls back to the stable page-port method when the alias is unavailable in the page context', async () => {
  const page = {
    async evaluate(fn, arg) {
      const previousWindow = globalThis.window
      globalThis.window = {
        __widgetVA: {
          describeWorkspace(options = {}) {
            return {
              workspaceId: options.workspaceId || 'main',
            }
          },
        },
      }
      try {
        return await fn(arg)
      } finally {
        globalThis.window = previousWindow
      }
    },
  }

  assert.deepEqual(
    await evaluatePagePortAlias(page, 'workspace_describe', [{ workspaceId: 'workspace_b' }]),
    {
      workspaceId: 'workspace_b',
    },
  )
})
