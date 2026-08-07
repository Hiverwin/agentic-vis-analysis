import { WORKSPACE_CASES } from '../../presets/workspaceCases.js'
import { buildWorkspaceCaseForProviderEnvironment, normalizeWorkspaceProviderEnvironment } from './workspaceProviderEnvironment.js'
import { cloneJsonValue as clone } from '../../shared/clone.js'

const caseOverrideRegistry = new Map()

const EMPTY_WORKSPACE_CASE = {
  id: 'empty-workspace',
  sourceType: 'empty',
  title: 'Untitled workspace',
  summary: 'Load a visualization to begin.',
  topology: 'single-view',
  dataset: {
    name: '',
    rows: 0,
    fields: 0,
    coverage: '',
    rowsData: [],
  },
  widgets: [],
  coordinationLinks: [],
  findings: [],
  trace: [],
  agentChat: [],
  replaySteps: [],
  branches: [],
  log: [],
  workspaceProviderEnvironment: 'vega-lite',
}

export function getWorkspaceCase(caseId) {
  return caseOverrideRegistry.get(caseId)
    || (caseId === EMPTY_WORKSPACE_CASE.id ? EMPTY_WORKSPACE_CASE : null)
    || WORKSPACE_CASES.find((item) => item.id === caseId)
    || EMPTY_WORKSPACE_CASE
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
