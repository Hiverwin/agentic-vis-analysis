import test from 'node:test'
import assert from 'node:assert/strict'

import { classifyOpenRouterProxyError } from './vite.config.js'

test('classifyOpenRouterProxyError reports DNS failures without blaming the API key', () => {
  const error = new TypeError('fetch failed', {
    cause: {
      code: 'ENOTFOUND',
    },
  })

  const payload = classifyOpenRouterProxyError(error)

  assert.equal(payload.error, 'OpenRouter upstream DNS resolution failed.')
  assert.match(payload.detail, /ENOTFOUND/)
  assert.equal(payload.detail.includes('OPENROUTER_API_KEY'), false)
})

test('classifyOpenRouterProxyError keeps generic fetch failures readable', () => {
  const payload = classifyOpenRouterProxyError(new TypeError('fetch failed'))

  assert.equal(payload.error, 'OpenRouter proxy could not reach the upstream chat endpoint.')
  assert.equal(payload.detail, 'fetch failed')
})
