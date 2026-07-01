import {
  DEFAULT_OPENROUTER_AGENT_MODEL,
  runNaturalLanguagePagePortAgentSession,
  runNaturalLanguagePagePortAgentTurn,
} from '../index.js'

function ensurePagePort(port) {
  if (!port || typeof port !== 'object') {
    throw new Error('WidgetVA agent-session example requires a page port object.')
  }
  if (typeof port.describeWorkspace !== 'function') {
    throw new Error('WidgetVA page port must expose describeWorkspace().')
  }
  if (typeof port.describeAgentLoop !== 'function') {
    throw new Error('WidgetVA page port must expose describeAgentLoop().')
  }
  return port
}

export function createWidgetVAAgentSessionDriver({
  port,
  completeChat,
  model = DEFAULT_OPENROUTER_AGENT_MODEL,
  baseOptions = {},
} = {}) {
  const resolvedPort = ensurePagePort(port)
  if (typeof completeChat !== 'function') {
    throw new Error('WidgetVA agent-session example requires a completeChat(messages) function.')
  }

  async function runTurn(options = {}) {
    return runNaturalLanguagePagePortAgentTurn(resolvedPort, {
      ...baseOptions,
      ...options,
      model: options.model || baseOptions.model || model,
      completeChat,
    })
  }

  async function runSession(options = {}) {
    return runNaturalLanguagePagePortAgentSession(resolvedPort, {
      ...baseOptions,
      ...options,
      model: options.model || baseOptions.model || model,
      completeChat,
    })
  }

  return {
    port: resolvedPort,
    model,
    runTurn,
    runSession,
  }
}
