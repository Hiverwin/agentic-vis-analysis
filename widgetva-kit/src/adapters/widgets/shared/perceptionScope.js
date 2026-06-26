export function buildScopedPerceptionParamsSchema(extraProperties = {}) {
  return {
    type: 'object',
    properties: {
      ...(extraProperties || {}),
    },
  }
}

export function buildQueryScopeExample({
  userGoal,
  params = {},
  widgetRef = 'wl://demo/workspace/main/widget/current',
  dataRef = 'wl://demo/workspace/main/data/current_view',
  selectionRef = null,
} = {}) {
  return {
    userGoal,
    params: {
      ...(params || {}),
      queryScope: {
        widgetRef,
        dataRef,
        ...(selectionRef ? { selectionRef } : {}),
      },
    },
  }
}

export function appendQueryScopeGuidance(description) {
  const base = typeof description === 'string' ? description.trim() : ''
  const guidance = 'Use queryScope for widget/data/selection targeting.'
  if (!base) return guidance
  return `${base} ${guidance}`
}
