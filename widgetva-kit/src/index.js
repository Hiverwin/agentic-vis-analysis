import {
  DEFAULT_OPENROUTER_AGENT_MODEL,
  runNaturalLanguageAgentSession,
  runNaturalLanguageAgentTurn,
} from './core/agent/planning/naturalLanguagePlanner.js'
import { runAgentSession, runAgentTurn } from './core/agent/loop/runAgentLoop.js'
import { attachWidgetVAToObservableD3Page } from './integrations/officialPages/observableD3Examples.js'
import { attachWidgetVAToVegaLiteView } from './integrations/officialPages/officialVegaLitePageIntegrations.js'
import { attachWidgetVAToVgplotView } from './integrations/vgplot/vgplotViewIntegrations.js'
import { buildAgentKnowledge } from './core/agent/context/index.js'
import { resolveAgentTargetPort } from './core/agent/adapters/agentTargetPort.js'
import { createWidgetInstance } from './core/rendering/widgetRuntimeSurface.js'
import { createRendererAdapterRegistry } from './core/rendering/RendererAdapterRegistry.js'
import { createWidgetWorkspace } from './workspace/widgetWorkspace.js'
import {
  buildEmptyComputedPropagationSummary,
  buildEmptyCoordinationOperationResult,
} from './workspace/coordinationOperationResult.js'
export { createWidgetVAHost } from './host/createWidgetVAHost.js'
export {
  makeCoordinationRelation,
  makeCoordinationRelationMap,
} from './contracts/coordination-contracts.js'

export const DEFAULT_WIDGETVA_AGENT_MODEL = DEFAULT_OPENROUTER_AGENT_MODEL

function bindOptionalMethod(target, methodName) {
  return typeof target?.[methodName] === 'function'
    ? target[methodName].bind(target)
    : undefined
}

function normalizeIntegrationProvider(provider = null) {
  const normalizedProvider = typeof provider === 'string'
    ? provider.trim().toLowerCase()
    : null
  if (!normalizedProvider) return null
  if (normalizedProvider === 'vegalite') return 'vega-lite'
  if (normalizedProvider === 'observable-d3' || normalizedProvider === 'observabled3') return 'd3'
  return normalizedProvider
}

function createStableIntegrationBinding(controller, provider = null) {
  if (!controller || typeof controller !== 'object') {
    return controller
  }

  const stableProvider = normalizeIntegrationProvider(provider) || controller.provider || null
  const pagePort = controller.pagePort || controller.runtime?.pagePort || null
  const widget = controller.widget || null
  const workspace = controller.workspace || widget || null

  return {
    provider: stableProvider,
    widget,
    workspace,
    pagePort,
    runAgentLoop: bindOptionalMethod(controller, 'runAgentLoop'),
    readRecoverableState: bindOptionalMethod(controller, 'readRecoverableState'),
    restoreRecoverableState: bindOptionalMethod(controller, 'restoreRecoverableState'),
    dispose: bindOptionalMethod(controller, 'dispose'),
    controller,
  }
}

export const createWidgetVAWidget = createWidgetInstance

export const createWidgetVAWorkspace = createWidgetWorkspace

export const createWidgetVARendererRegistry = createRendererAdapterRegistry

export function buildWidgetVAAgentKnowledge(options = {}) {
  return buildAgentKnowledge(options)
}

export function buildWidgetVAEmptyCoordinationResult(options = {}) {
  return buildEmptyCoordinationOperationResult(options)
}

export function buildWidgetVAEmptyPropagationSummary(options = {}) {
  return buildEmptyComputedPropagationSummary(options)
}

export async function runWidgetVAAgentTurn({
  target = null,
  completeChat = null,
  ...options
} = {}) {
  const port = resolveAgentTargetPort(target, options)
  if (typeof completeChat === 'function') {
    return runNaturalLanguageAgentTurn(port, {
      ...options,
      completeChat,
    })
  }
  return runAgentTurn(port, options)
}

export async function runWidgetVAAgentSession({
  target = null,
  completeChat = null,
  ...options
} = {}) {
  const port = resolveAgentTargetPort(target, options)
  if (typeof completeChat === 'function') {
    return runNaturalLanguageAgentSession(port, {
      ...options,
      completeChat,
    })
  }
  return runAgentSession(port, options)
}

export async function attachWidgetVAIntegration({
  provider = null,
  ...options
} = {}) {
  const normalizedProvider = normalizeIntegrationProvider(provider)

  if (!normalizedProvider) {
    throw new Error('attachWidgetVAIntegration requires a provider.')
  }

  if (normalizedProvider === 'vega-lite' || normalizedProvider === 'vegalite') {
    const controller = await attachWidgetVAToVegaLiteView(options)
    return createStableIntegrationBinding(controller, normalizedProvider)
  }

  if (
    normalizedProvider === 'd3'
    || normalizedProvider === 'observable-d3'
    || normalizedProvider === 'observabled3'
  ) {
    const controller = await attachWidgetVAToObservableD3Page(options)
    return createStableIntegrationBinding(controller, normalizedProvider)
  }

  if (normalizedProvider === 'vgplot') {
    const controller = await attachWidgetVAToVgplotView(options)
    return createStableIntegrationBinding(controller, normalizedProvider)
  }

  if (normalizedProvider === 'vega') {
    throw new Error('attachWidgetVAIntegration does not yet provide a generic Vega integration entry.')
  }

  if (normalizedProvider === 'custom') {
    throw new Error('attachWidgetVAIntegration does not yet provide a generic custom-provider attach path.')
  }

  throw new Error(`Unsupported WidgetVA integration provider: ${provider}`)
}
