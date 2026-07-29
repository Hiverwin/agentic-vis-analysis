import {
  DEFAULT_WIDGETVA_AGENT_MODEL,
  runWidgetVAAgentSession,
  runWidgetVAAgentTurn,
} from 'widgetva-kit'

import {
  completeOfficialPageAgentChat,
  isRecoverableOfficialPageBridgeError,
} from './officialPageAgentClient.js'
import { runOfficialPageWithManager } from './officialPageRuntimeManager.js'

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

function resolveManagedAgentTarget(controller = null) {
  return typeof controller?.workspace?.readObservation === 'function'
    ? controller.workspace
    : controller
}

function readManagedAgentTarget(controller = null) {
  const target = resolveManagedAgentTarget(controller)
  if (!target) {
    throw new Error('WidgetVA official page agent target is unavailable.')
  }
  return target
}

export function createOfficialPageNaturalLanguageTurnRunner(root) {
  return async (target, options = {}) => {
    const normalized = typeof options === 'string' ? { objective: options } : { ...(options || {}) }
    return runWidgetVAAgentTurn({
      target,
      objective: normalized.objective || normalized.prompt || null,
      model: normalized.model || DEFAULT_WIDGETVA_AGENT_MODEL,
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
  return async (target, options = {}) => {
    const normalized = typeof options === 'string' ? { objective: options } : { ...(options || {}) }
    return runWidgetVAAgentSession({
      target,
      objective: normalized.objective || normalized.prompt || null,
      model: normalized.model || DEFAULT_WIDGETVA_AGENT_MODEL,
      temperature: normalized.temperature,
      maxTurns: readOfficialPageMaxTurns(normalized),
      onTurn: typeof normalized.onTurn === 'function' ? normalized.onTurn : undefined,
      completeChat: (request) =>
        completeOfficialPageAgentChat(root, {
          ...request,
          timeoutMs: readOfficialPageChatTimeout(normalized),
        }),
    })
  }
}

export function createOfficialPageManagedRequestRunner({
  entry,
  root,
  pagePort,
  runAgentLoop,
  runNaturalLanguageTurn,
  runNaturalLanguageLoop,
  rebootstrap,
  configureAgent,
  readAgentConfig,
} = {}) {
  const runPagePortMethod = (methodName, payload = null) => runOfficialPageWithManager(
    entry,
    async () => {
      if (typeof pagePort?.[methodName] !== 'function') {
        throw new Error(`WidgetVA official page pagePort.${methodName}() is unavailable.`)
      }
      return payload == null ? pagePort[methodName]() : pagePort[methodName](payload)
    },
    {
      rebootstrap,
    },
  )

  return async function request(incoming = {}) {
    if (typeof incoming === 'string') {
      return runOfficialPageWithManager(
        entry,
        (currentController) => runNaturalLanguageTurn(readManagedAgentTarget(currentController), incoming),
        {
          rebootstrap,
          retryRecoverableBridgeError: true,
          isRecoverableBridgeError: isRecoverableOfficialPageBridgeError,
        },
      )
    }

    const normalized = incoming && typeof incoming === 'object' ? { ...incoming } : {}
    const mode = normalized.mode || normalized.kind || 'naturalLanguageSession'

    if (mode === 'runAgentLoop' || mode === 'agentLoop') {
      return runOfficialPageWithManager(
        entry,
        (currentController) => {
          if (typeof currentController?.runAgentLoop !== 'function') {
            throw new Error('WidgetVA official page agent loop is unavailable.')
          }
          return runAgentLoop(currentController, normalized.options || {})
        },
        {
          rebootstrap,
        },
      )
    }

    if (mode === 'runNaturalLanguageTurn' || mode === 'naturalLanguageTurn') {
      return runOfficialPageWithManager(
        entry,
        (currentController) => runNaturalLanguageTurn(readManagedAgentTarget(currentController), normalized.options || normalized),
        {
          rebootstrap,
          retryRecoverableBridgeError: true,
          isRecoverableBridgeError: isRecoverableOfficialPageBridgeError,
        },
      )
    }

    if (mode === 'runNaturalLanguageLoop' || mode === 'naturalLanguageSession') {
      return runOfficialPageWithManager(
        entry,
        (currentController) => runNaturalLanguageLoop(readManagedAgentTarget(currentController), normalized.options || normalized),
        {
          rebootstrap,
          retryRecoverableBridgeError: true,
          isRecoverableBridgeError: isRecoverableOfficialPageBridgeError,
        },
      )
    }

    if (mode === 'describeWorkspace') {
      return runPagePortMethod('describeWorkspace', normalized.options || normalized.payload || undefined)
    }

    if (mode === 'readObservation') {
      return runPagePortMethod('readObservation', normalized.options || normalized.payload || undefined)
    }

    if (mode === 'executeAction') {
      return runPagePortMethod('executeAction', normalized.options || normalized.call || normalized.payload || {})
    }

    if (mode === 'executeVerifiedAction' || mode === 'runVerifiedAction') {
      return runPagePortMethod('executeVerifiedAction', normalized.options || normalized.call || normalized.payload || {})
    }

    if (mode === 'queryPerception' || mode === 'perceptionQuery') {
      return runPagePortMethod('queryPerception', normalized.options || normalized.call || normalized.payload || {})
    }

    if (mode === 'runDataQuery' || mode === 'queryData') {
      return runPagePortMethod('runDataQuery', normalized.options || normalized.call || normalized.payload || {})
    }

    if (mode === 'readLatestCoordinationResult' || mode === 'latestCoordinationResult') {
      return runPagePortMethod('readLatestCoordinationResult')
    }

    if (mode === 'configureAgent' || mode === 'configure') {
      return configureAgent(root, normalized.options || normalized)
    }

    if (mode === 'readAgentConfig' || mode === 'readConfig') {
      return readAgentConfig(root)
    }

    throw new Error(`Unsupported WidgetVA official page request mode: ${mode}.`)
  }
}
