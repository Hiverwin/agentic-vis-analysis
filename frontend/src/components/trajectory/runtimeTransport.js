import {
  jumpToState,
  linkPropagationEvaluate,
  snapshotRead,
  traceGraphRead,
} from 'widgetva-kit/transport-inspect'
import { PAGE_PORT_ALIASES } from 'widgetva-kit/core-inspect'

function hasPagePortMethod(root, stableMethodName) {
  const port = root?.__widgetVA
  if (!port || typeof stableMethodName !== 'string' || stableMethodName.length === 0) {
    return false
  }

  if (typeof port[stableMethodName] === 'function') {
    return true
  }

  const alias = Object.entries(PAGE_PORT_ALIASES).find(([, methodName]) => methodName === stableMethodName)?.[0]
  return typeof alias === 'string' && typeof port[alias] === 'function'
}

export function hasRuntimeTraceGraphAccess(root = globalThis.window) {
  return hasPagePortMethod(root, 'getTraceGraph')
}

export function hasRuntimeSnapshotEvidenceAccess(root = globalThis.window) {
  return hasPagePortMethod(root, 'readSnapshot')
}

export function hasRuntimeStateJumpAccess(root = globalThis.window) {
  return hasPagePortMethod(root, 'jumpToState')
}

export function createRuntimeSnapshotEvidencePort() {
  return {
    readSnapshot: snapshotRead,
    evaluateLinkPropagation: linkPropagationEvaluate,
  }
}

export async function readRuntimeTraceGraph(options = {}) {
  return traceGraphRead(options)
}

export async function jumpRuntimeState(options = {}) {
  return jumpToState(options)
}
