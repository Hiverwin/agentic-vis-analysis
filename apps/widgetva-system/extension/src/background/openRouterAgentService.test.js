import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildOpenRouterChatRequest,
  createOpenRouterAgentService,
  normalizeStoredAgentConfig,
} from './openRouterAgentService.js'

function createMemoryStorage(initial = {}) {
  const state = { ...initial }
  return {
    async get(key) {
      return { [key]: state[key] }
    },
    async set(next) {
      Object.assign(state, next)
    },
    readState() {
      return { ...state }
    },
  }
}

test('normalizeStoredAgentConfig trims fields and fills model defaults', () => {
  assert.deepEqual(
    normalizeStoredAgentConfig({
      apiKey: '  sk-test  ',
      model: '  openai/gpt-4.1-mini  ',
      siteUrl: '  https://example.com  ',
      appName: '  WidgetVA Test  ',
    }),
    {
      apiKey: 'sk-test',
      model: 'openai/gpt-4.1-mini',
      siteUrl: 'https://example.com',
      appName: 'WidgetVA Test',
    },
  )
})

test('buildOpenRouterChatRequest requires an api key and preserves model/messages payload', () => {
  const request = buildOpenRouterChatRequest({
    config: {
      apiKey: 'sk-test',
      model: 'openai/gpt-4.1-mini',
      siteUrl: 'https://example.com',
      appName: 'WidgetVA Test',
    },
    payload: {
      temperature: 0.1,
      messages: [{ role: 'user', content: 'hello' }],
    },
  })

  assert.equal(request.url, 'https://openrouter.ai/api/v1/chat/completions')
  assert.match(request.init.headers.Authorization, /^Bearer sk-test$/)
  assert.equal(JSON.parse(request.init.body).model, 'openai/gpt-4.1-mini')
  assert.equal(JSON.parse(request.init.body).messages[0].content, 'hello')
})

test('createOpenRouterAgentService stores config and runs chat through fetch', async () => {
  const storage = createMemoryStorage()
  const requests = []
  const service = createOpenRouterAgentService({
    storage,
    fetchImpl: async (url, init) => {
      requests.push({ url, init })
      return {
        ok: true,
        async json() {
          return {
            choices: [{
              message: {
                content: '{"assistantMessage":"Inspect the scatterplot.","operation":{"kind":"perception","name":"perception.inspectViewConfig","queryScope":{"widgetRef":"scatter-ref"},"params":{}}}',
              },
            }],
          }
        },
      }
    },
  })

  const configured = await service.configure({
    apiKey: 'sk-test',
    model: 'openai/gpt-4.1-mini',
  })
  assert.equal(configured.apiKeyConfigured, true)
  assert.equal(configured.model, 'openai/gpt-4.1-mini')

  const config = await service.readConfig()
  assert.equal(config.apiKeyConfigured, true)
  assert.equal(config.model, 'openai/gpt-4.1-mini')

  const chat = await service.chat({
    messages: [{ role: 'user', content: 'Inspect the scatterplot.' }],
  })
  assert.equal(chat.model, 'openai/gpt-4.1-mini')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://openrouter.ai/api/v1/chat/completions')
})
