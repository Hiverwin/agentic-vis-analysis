import { runAgentLoop } from '../loop/runAgentLoop.js'

function bindOptionalMethod(target, methodName) {
  return typeof target?.[methodName] === 'function'
    ? target[methodName].bind(target)
    : undefined
}

function isAgentTargetSurface(value) {
  return Boolean(value)
    && typeof value === 'object'
    && typeof value.readObservation === 'function'
}

export function createAgentTargetPort(target) {
  if (!isAgentTargetSurface(target)) {
    return null
  }

  const targetReadObservation = bindOptionalMethod(target, 'readObservation')

  return {
    readObservation: targetReadObservation,
    describeWorkspace: bindOptionalMethod(target, 'describeWorkspace'),
    readLatestCoordinationResult: bindOptionalMethod(target, 'readLatestCoordinationResult'),
    listAvailableDataQueries: bindOptionalMethod(target, 'listAvailableDataQueries'),
    executeVerifiedAction: bindOptionalMethod(target, 'executeVerifiedAction'),
    executeAction: bindOptionalMethod(target, 'executeAction'),
    queryPerception: bindOptionalMethod(target, 'queryPerception'),
    runDataQuery: bindOptionalMethod(target, 'runDataQuery'),
    queryData: bindOptionalMethod(target, 'queryData') || bindOptionalMethod(target, 'runDataQuery'),
    planWorkspace: bindOptionalMethod(target, 'planWorkspace'),
  }
}

export function resolveAgentTargetPort(target, sessionOptions = {}) {
  const candidates = [
    target,
    target?.pagePort,
    target?.runtime?.pagePort,
    target?.widget?.runtime?.pagePort,
    target?.workspace,
    target?.widget,
  ]

  for (const candidate of candidates) {
    const port = createAgentTargetPort(candidate, sessionOptions)
    if (port) return port
  }

  throw new Error(
    'WidgetVA agent execution requires a target that exposes readObservation() through a page port, runtime page port, widget, or workspace surface.',
  )
}

export async function runAgentLoopOnTarget(target, options = {}) {
  return runAgentLoop(resolveAgentTargetPort(target, options), options)
}
