import { createVgplotController } from './vgplotController.js'
import { resolveVgplotCapabilities } from './vgplotCapabilityResolver.js'

function firstSelectionName(capabilities, allowedTypes = []) {
  if (!Array.isArray(capabilities?.selectionNames) || capabilities.selectionNames.length === 0) return null
  if (!Array.isArray(allowedTypes) || allowedTypes.length === 0) return capabilities.selectionNames[0]
  const selectionTypeToNames = capabilities?.selectionTypeToNames || {}
  for (const allowedType of allowedTypes) {
    const matchingNames = Array.isArray(selectionTypeToNames?.[allowedType]) ? selectionTypeToNames[allowedType] : []
    if (matchingNames.length > 0) return matchingNames[0]
  }
  return null
}

function firstParamName(capabilities, allowedTypes = []) {
  if (!Array.isArray(capabilities?.paramNames) || capabilities.paramNames.length === 0) return null
  if (!Array.isArray(allowedTypes) || allowedTypes.length === 0) return capabilities.paramNames[0]
  const paramTypeToNames = capabilities?.paramTypeToNames || {}
  for (const allowedType of allowedTypes) {
    const matchingNames = Array.isArray(paramTypeToNames?.[allowedType]) ? paramTypeToNames[allowedType] : []
    if (matchingNames.length > 0) return matchingNames[0]
  }
  return null
}

function firstPlotId(capabilities) {
  return Array.isArray(capabilities?.plotIds) && capabilities.plotIds.length > 0
    ? capabilities.plotIds[0]
    : null
}

function firstAvailableType(capabilities, mapName, allowedTypes = []) {
  const typeToNames = capabilities?.[mapName] || {}
  for (const allowedType of allowedTypes) {
    const matchingNames = Array.isArray(typeToNames?.[allowedType]) ? typeToNames[allowedType] : []
    if (matchingNames.length > 0) return allowedType
  }
  return null
}

export function applyVgplotIntervalSelection({ view = null, runtime = null, nextValue = null } = {}) {
  const capabilities = resolveVgplotCapabilities({ view, runtime })
  const selectionName = firstSelectionName(capabilities, ['intervalXY', 'intervalX', 'intervalY'])
  if (!selectionName) return false
  return createVgplotController({ view, runtime }).updateSelection(selectionName, nextValue)
}

export function applyVgplotToggleSelection({ view = null, runtime = null, nextValue = null } = {}) {
  const capabilities = resolveVgplotCapabilities({ view, runtime })
  const selectionName = firstSelectionName(capabilities, ['toggle', 'toggleX', 'toggleY', 'toggleColor'])
  if (!selectionName) return false
  return createVgplotController({ view, runtime }).updateSelection(selectionName, nextValue)
}

export function applyVgplotNearestSelection({ view = null, runtime = null, nextValue = null } = {}) {
  const capabilities = resolveVgplotCapabilities({ view, runtime })
  const selectionName = firstSelectionName(capabilities, ['nearestX', 'nearestY'])
  if (!selectionName) return false
  return createVgplotController({ view, runtime }).updateSelection(selectionName, nextValue)
}

export function applyVgplotRegionSelection({ view = null, runtime = null, nextValue = null } = {}) {
  const capabilities = resolveVgplotCapabilities({ view, runtime })
  const selectionName = firstSelectionName(capabilities, ['region'])
  if (!selectionName) return false
  return createVgplotController({ view, runtime }).updateSelection(selectionName, nextValue)
}

export function applyVgplotViewport({ view = null, runtime = null, xDomain = null, yDomain = null } = {}) {
  const controller = createVgplotController({ view, runtime })
  const capabilities = resolveVgplotCapabilities({ view, runtime })
  const plotId = firstPlotId(capabilities)
  const paramName = firstParamName(capabilities, ['panZoom', 'panZoomX', 'panZoomY'])
  const paramType = firstAvailableType(capabilities, 'paramTypeToNames', ['panZoom', 'panZoomX', 'panZoomY'])

  let changed = false
  if (plotId && Array.isArray(xDomain) && capabilities.supportsXDomain) {
    changed = controller.setPlotAttribute(plotId, 'xDomain', xDomain) || changed
  }
  if (plotId && Array.isArray(yDomain) && capabilities.supportsYDomain) {
    changed = controller.setPlotAttribute(plotId, 'yDomain', yDomain) || changed
  }
  if (paramName && paramType) {
    const currentParamState = controller.readParamState(paramName)
    const currentParamValue = currentParamState?.value && typeof currentParamState.value === 'object' && !Array.isArray(currentParamState.value)
      ? currentParamState.value
      : {}
    const nextParamValue = {
      ...currentParamValue,
      ...(Array.isArray(xDomain) ? { xDomain } : {}),
      ...(Array.isArray(yDomain) ? { yDomain } : {}),
    }
    if (Object.keys(nextParamValue).length > 0) {
      changed = controller.updateParam(paramName, {
        type: paramType,
        value: nextParamValue,
      }) || changed
    }
  }
  return changed
}

export function resolveVgplotToggleSelectionType({ view = null, runtime = null, preferredTypes = [] } = {}) {
  const capabilities = resolveVgplotCapabilities({ view, runtime })
  return firstAvailableType(capabilities, 'selectionTypeToNames', preferredTypes)
}

export function resolveVgplotIntervalSelectionType({ view = null, runtime = null, preferredTypes = [] } = {}) {
  const capabilities = resolveVgplotCapabilities({ view, runtime })
  return firstAvailableType(capabilities, 'selectionTypeToNames', preferredTypes)
}
