import { DEFAULT_WIDGETVA_AGENT_MODEL } from '../../../../../widgetva-kit/src/index.js'

export const WIDGETVA_AGENT_CONFIG_KEY = 'widgetvaOfficialPageAgentConfig'
export const MAX_OPENROUTER_MESSAGE_CHARS = 250000
export const DEFAULT_OPENAI_COMPATIBLE_CHAT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeEndpoint(value) {
  const endpoint = trimString(value)
  if (!endpoint) return DEFAULT_OPENAI_COMPATIBLE_CHAT_ENDPOINT
  try {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return DEFAULT_OPENAI_COMPATIBLE_CHAT_ENDPOINT
    }
    return url.toString()
  } catch {
    return DEFAULT_OPENAI_COMPATIBLE_CHAT_ENDPOINT
  }
}

export function normalizeStoredAgentConfig(config = {}) {
  const apiKey = trimString(config?.apiKey)
  const model = trimString(config?.model) || DEFAULT_WIDGETVA_AGENT_MODEL
  const endpoint = normalizeEndpoint(config?.endpoint || config?.chatEndpoint)
  const siteUrl = trimString(config?.siteUrl)
  const appName = trimString(config?.appName) || 'WidgetVA Official Page Integration'
  return {
    provider: 'openai-compatible',
    endpoint,
    ...(apiKey ? { apiKey } : {}),
    model,
    ...(siteUrl ? { siteUrl } : {}),
    ...(appName ? { appName } : {}),
  }
}

export async function readStoredAgentConfig(storage) {
  const result = await storage.get(WIDGETVA_AGENT_CONFIG_KEY)
  return normalizeStoredAgentConfig(result?.[WIDGETVA_AGENT_CONFIG_KEY] || {})
}

export async function writeStoredAgentConfig(storage, config = {}) {
  const next = normalizeStoredAgentConfig(config)
  await storage.set({
    [WIDGETVA_AGENT_CONFIG_KEY]: next,
  })
  return {
    apiKeyConfigured: Boolean(next.apiKey),
    provider: next.provider,
    endpoint: next.endpoint,
    model: next.model,
    siteUrl: next.siteUrl || null,
    appName: next.appName || null,
  }
}

export function buildOpenAICompatibleChatRequest({
  config = {},
  payload = {},
} = {}) {
  const apiKey = trimString(config?.apiKey)
  if (!apiKey) {
    throw new Error('WidgetVA agent is not configured with an API key.')
  }
  const endpoint = normalizeEndpoint(config?.endpoint || config?.chatEndpoint)

  const messages = Array.isArray(payload?.messages) ? clone(payload.messages) : []
  const messageSizes = messages.map((message, index) => ({
    index,
    role: trimString(message?.role) || 'unknown',
    chars: typeof message?.content === 'string'
      ? message.content.length
      : JSON.stringify(message?.content ?? '').length,
  }))
  const totalMessageChars = messageSizes.reduce((total, entry) => total + entry.chars, 0)
  if (totalMessageChars > MAX_OPENROUTER_MESSAGE_CHARS) {
    const summary = messageSizes
      .map((entry) => `${entry.index}:${entry.role}:${entry.chars}`)
      .join(', ')
    throw new Error(
      `WidgetVA refused to send an oversized OpenAI-compatible prompt (${totalMessageChars} chars; messages ${summary}). This usually means raw page text, code, rows, or full history leaked into the agent prompt.`,
    )
  }

  return {
    url: endpoint,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(config?.siteUrl ? { 'HTTP-Referer': config.siteUrl } : {}),
        ...(config?.appName ? { 'X-Title': config.appName } : {}),
      },
      body: JSON.stringify({
        model: trimString(payload?.model) || config.model || DEFAULT_WIDGETVA_AGENT_MODEL,
        temperature: Number.isFinite(payload?.temperature) ? Number(payload.temperature) : 0.2,
        messages,
      }),
    },
  }
}

export const buildOpenRouterChatRequest = buildOpenAICompatibleChatRequest

export async function executeOpenRouterChat({
  storage,
  fetchImpl,
  payload = {},
} = {}) {
  const config = await readStoredAgentConfig(storage)
  const request = buildOpenAICompatibleChatRequest({
    config,
    payload,
  })
  const response = await fetchImpl(request.url, request.init)
  const json = await response.json()

  if (!response.ok) {
    const message = json?.error?.message || json?.message || 'OpenAI-compatible chat request failed.'
    throw new Error(message)
  }

  return {
    model: trimString(payload?.model) || config.model || DEFAULT_WIDGETVA_AGENT_MODEL,
    raw: json,
    content: json?.choices?.[0]?.message?.content || '',
  }
}

export function createOpenAICompatibleAgentService({
  storage,
  fetchImpl,
} = {}) {
  if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
    throw new Error('createOpenAICompatibleAgentService requires a storage facade with get/set.')
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('createOpenAICompatibleAgentService requires fetchImpl().')
  }

  return {
    async configure(params = {}) {
      return writeStoredAgentConfig(storage, params)
    },
    async readConfig() {
      const config = await readStoredAgentConfig(storage)
      return {
        apiKeyConfigured: Boolean(config.apiKey),
        provider: config.provider,
        endpoint: config.endpoint,
        model: config.model || DEFAULT_WIDGETVA_AGENT_MODEL,
        siteUrl: config.siteUrl || null,
        appName: config.appName || null,
      }
    },
    async chat(params = {}) {
      return executeOpenRouterChat({
        storage,
        fetchImpl,
        payload: params,
      })
    },
  }
}

export const createOpenRouterAgentService = createOpenAICompatibleAgentService
