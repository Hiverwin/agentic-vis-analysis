function normalizeString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function makeQueryScope(scope = {}) {
  const normalizedScope = scope && typeof scope === 'object' && !Array.isArray(scope) ? scope : {}
  return {
    dataRef: normalizeString(normalizedScope.dataRef || normalizedScope.data_ref),
    selectionRef: normalizeString(normalizedScope.selectionRef || normalizedScope.selection_ref),
    focusRef: normalizeString(normalizedScope.focusRef || normalizedScope.focus_ref),
    viewportRef: normalizeString(normalizedScope.viewportRef || normalizedScope.viewport_ref),
  }
}

export function readNormalizedQueryScope({ call = null, descriptor = null, querySpec = null } = {}) {
  const scope = makeQueryScope(
    querySpec?.queryScope
      || call?.params?.queryScope
      || call?.queryScope
      || call?.target
      || descriptor?.queryScope
      || null,
  )

  return {
    widgetRef: (typeof call?.target?.widgetRef === 'string' && call.target.widgetRef.length > 0 ? call.target.widgetRef : null)
      || (typeof call?.targetRef === 'string' && call.targetRef.length > 0 ? call.targetRef : null)
      || (typeof descriptor?.targetRef === 'string' && descriptor.targetRef.length > 0 ? descriptor.targetRef : null),
    dataRef: scope.dataRef
      || (typeof call?.dataRef === 'string' && call.dataRef.length > 0 ? call.dataRef : null),
    selectionRef: scope.selectionRef
      || (typeof call?.selectionRef === 'string' && call.selectionRef.length > 0 ? call.selectionRef : null),
    focusRef: scope.focusRef,
    viewportRef: scope.viewportRef,
  }
}

export function readScopedQueryScope(options = {}) {
  const scope = readNormalizedQueryScope(options)
  return {
    dataRef: scope.dataRef,
    selectionRef: scope.selectionRef,
    focusRef: scope.focusRef,
    viewportRef: scope.viewportRef,
  }
}

export function hasScopedQueryScopeValues(scope = {}) {
  return Object.values(scope || {}).some((value) => typeof value === 'string' && value.length > 0)
}

export function buildScopedParams({
  params = null,
  call = null,
  descriptor = null,
  querySpec = null,
  includeTopLevelLegacyTargeting = true,
} = {}) {
  const rawParams = params ?? call?.params ?? querySpec ?? null
  const normalizedParams = rawParams && typeof rawParams === 'object' && !Array.isArray(rawParams)
    ? { ...rawParams }
    : {}
  const normalizedCall = call
    ? {
        ...call,
        ...(includeTopLevelLegacyTargeting
          ? {}
          : {
              targetRef: null,
              dataRef: null,
            }),
        params: normalizedParams,
      }
    : { params: normalizedParams }
  if (normalizedParams.queryScope) {
    normalizedParams.queryScope = makeQueryScope(normalizedParams.queryScope)
  }

  delete normalizedParams.targetRef
  delete normalizedParams.targetDataRef
  delete normalizedParams.selectionRef
  delete normalizedParams.dataRef

  return normalizedParams
}
