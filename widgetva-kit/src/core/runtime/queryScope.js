import { makeQueryScope } from '../protocol/queryScope.js'

export function readNormalizedQueryScope({ call = null, descriptor = null, querySpec = null } = {}) {
  const scope = makeQueryScope(
    querySpec?.queryScope
      || call?.params?.queryScope
      || call?.queryScope
      || descriptor?.queryScope
      || null,
  )

  return {
    widgetRef: scope.widgetRef
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
  const scope = readNormalizedQueryScope({
    call: normalizedCall,
    descriptor,
    querySpec,
  })

  const hasScope = Object.values(scope).some((value) => typeof value === 'string' && value.length > 0)
  if (hasScope) {
    normalizedParams.queryScope = scope
  } else if (normalizedParams.queryScope) {
    normalizedParams.queryScope = makeQueryScope(normalizedParams.queryScope)
  }

  delete normalizedParams.targetRef
  delete normalizedParams.targetDataRef
  delete normalizedParams.selectionRef
  delete normalizedParams.dataRef

  return normalizedParams
}
