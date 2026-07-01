import {
  DEFAULT_OPENROUTER_AGENT_MODEL,
  runNaturalLanguagePagePortAgentTurn,
  runNaturalLanguagePagePortAgentSession,
} from '../../../../../widgetva-kit/src/coreRuntime.js'

import { completeOfficialPageAgentChat } from './officialPageAgentClient.js'

export function readOfficialPageChatTimeout(normalized) {
  if (!normalized || typeof normalized !== 'object') {
    return undefined
  }

  return normalized.chatTimeoutMs ?? normalized.timeoutMs
}

export function readOfficialPageMaxTurns(normalized) {
  if (!normalized || typeof normalized !== 'object') {
    return undefined
  }

  return normalized.maxTurns
}

export function createOfficialPageNaturalLanguageTurnRunner(root) {
  return async (pagePort, options = {}) => {
    const normalized = typeof options === 'string' ? { objective: options } : { ...(options || {}) }
    return runNaturalLanguagePagePortAgentTurn(pagePort, {
      objective: normalized.objective || normalized.prompt || null,
      model: normalized.model || DEFAULT_OPENROUTER_AGENT_MODEL,
      temperature: normalized.temperature,
      completeChat: (request) =>
        completeOfficialPageAgentChat(root, {
          ...request,
          timeoutMs: readOfficialPageChatTimeout(normalized),
        }),
    })
  }
}

export function createOfficialPageNaturalLanguageLoopRunner(root) {
  return async (pagePort, options = {}) => {
    const normalized = typeof options === 'string' ? { objective: options } : { ...(options || {}) }
    return runNaturalLanguagePagePortAgentSession(pagePort, {
      objective: normalized.objective || normalized.prompt || null,
      model: normalized.model || DEFAULT_OPENROUTER_AGENT_MODEL,
      temperature: normalized.temperature,
      maxTurns: readOfficialPageMaxTurns(normalized),
      completeChat: (request) =>
        completeOfficialPageAgentChat(root, {
          ...request,
          timeoutMs: readOfficialPageChatTimeout(normalized),
        }),
    })
  }
}
