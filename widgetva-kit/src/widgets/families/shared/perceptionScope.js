export function buildScopedPerceptionParamsSchema(extraProperties = {}, required = []) {
  return {
    type: 'object',
    properties: {
      ...(extraProperties || {}),
    },
    ...(Array.isArray(required) && required.length > 0 ? { required } : {}),
  }
}

export function buildQueryScopeExample({
  userGoal,
  params = {},
  dataRef = 'wl://demo/workspace/main/data/current_view',
  selectionRef = null,
} = {}) {
  return {
    userGoal,
    params: {
      ...(params || {}),
      queryScope: {
        dataRef,
        ...(selectionRef ? { selectionRef } : {}),
      },
    },
  }
}

export function appendQueryScopeGuidance(description) {
  const base = typeof description === 'string' ? description.trim() : ''
  const guidance = 'Use target.widgetRef for widget targeting and queryScope for data/selection targeting.'
  if (!base) return guidance
  return `${base} ${guidance}`
}
