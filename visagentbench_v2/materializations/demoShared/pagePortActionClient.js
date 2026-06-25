import {
  describePagePort,
  readWorkspaceState,
  verifiedActionRun,
  workspaceDescribe,
} from '../../../widgetva-kit/src/transports/inPageTransport.js'

function normalizeScopedCall(call, widgetRef) {
  if (!call || typeof call !== 'object') {
    return call
  }

  const normalizedQueryScope = call.queryScope && typeof call.queryScope === 'object' && !Array.isArray(call.queryScope)
    ? { ...call.queryScope }
    : {}
  if (widgetRef && !normalizedQueryScope.widgetRef && !normalizedQueryScope.widget_ref) {
    normalizedQueryScope.widgetRef = widgetRef
  }

  const normalizedParams = call.params && typeof call.params === 'object' && !Array.isArray(call.params)
    ? { ...call.params }
    : call.params

  return {
    ...call,
    ...(widgetRef ? { targetRef: call.targetRef || widgetRef } : {}),
    ...(Object.keys(normalizedQueryScope).length > 0 ? { queryScope: normalizedQueryScope } : {}),
    ...(normalizedParams && typeof normalizedParams === 'object' && !Array.isArray(normalizedParams)
      ? { params: normalizedParams }
      : {}),
  }
}

export async function connectSingleWidgetPagePortClient(options = {}) {
  const pagePort = await describePagePort()
  const workspace = await workspaceDescribe(options.workspaceOptions || {})
  const widgetRef = workspace?.widgets?.[0]?.ref || null

  return {
    pagePort,
    workspace,
    widgetRef,
    async executeVerifiedAction(call, runOptions = {}) {
      return verifiedActionRun(normalizeScopedCall(call, widgetRef), runOptions)
    },
    async readState(readOptions = {}) {
      return readWorkspaceState(readOptions)
    },
    async describeWorkspace(nextOptions = {}) {
      return workspaceDescribe(nextOptions)
    },
  }
}
