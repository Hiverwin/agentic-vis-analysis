import { WORKSPACE_CASES } from '../presets/workspaceCases.js'
import { buildWorkspaceCaseForProviderEnvironment, normalizeWorkspaceProviderEnvironment } from './workspaceProviderEnvironment.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

const caseOverrideRegistry = new Map()

export function getWorkspaceCase(caseId) {
  return caseOverrideRegistry.get(caseId) || WORKSPACE_CASES.find((item) => item.id === caseId) || WORKSPACE_CASES[0]
}

export function registerWorkspaceCaseOverride(caseId, caseDef) {
  if (!caseId || !caseDef) return null
  caseOverrideRegistry.set(caseId, clone(caseDef))
  return caseOverrideRegistry.get(caseId)
}

export function registerWorkspaceCaseProviderEnvironment(caseId, providerEnvironment = 'mixed') {
  const existing = getWorkspaceCase(caseId)
  if (!existing) return null
  const nextCase = buildWorkspaceCaseForProviderEnvironment(existing, normalizeWorkspaceProviderEnvironment(providerEnvironment))
  caseOverrideRegistry.set(caseId, clone(nextCase))
  return caseOverrideRegistry.get(caseId)
}

export function clearWorkspaceCaseOverride(caseId) {
  if (!caseId) return false
  return caseOverrideRegistry.delete(caseId)
}
