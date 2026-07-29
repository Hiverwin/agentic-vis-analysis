import { cloneJsonValue as clone } from '../../shared/clone.js'

export const WORKSPACE_PROVIDER_ENVIRONMENTS = ['mixed', 'vega-lite', 'vega', 'echarts', 'vgplot', 'd3']

export function normalizeWorkspaceProviderEnvironment(value) {
  return WORKSPACE_PROVIDER_ENVIRONMENTS.includes(value) ? value : 'mixed'
}

export function buildWorkspaceCaseForProviderEnvironment(caseDef, providerEnvironment = 'mixed') {
  const normalizedEnvironment = normalizeWorkspaceProviderEnvironment(providerEnvironment)
  const baseCase = clone(caseDef || {})
  return {
    ...baseCase,
    workspaceProviderEnvironment: normalizedEnvironment,
  }
}
