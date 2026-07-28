import { buildVegaLiteCoordinationFieldModel } from './vegaLite/coordinationFieldModel.js'

function cloneFieldModel(model = null) {
  if (!model || typeof model !== 'object' || Array.isArray(model)) return null
  return {
    ...model,
    availableFields: new Set(model.availableFields || []),
    reencodeTargets: Array.isArray(model.reencodeTargets)
      ? model.reencodeTargets.map((target) => ({ ...target }))
      : [],
  }
}

export function buildProviderCoordinationFieldModel(widget = {}, options = {}) {
  const vegaLiteModel = buildVegaLiteCoordinationFieldModel(widget, options)
  if (vegaLiteModel) return vegaLiteModel
  return null
}

export function buildProviderCoordinationFieldModels(widgets = [], options = {}) {
  return (Array.isArray(widgets) ? widgets : [])
    .filter((widget) => widget?.id)
    .map((widget) => buildProviderCoordinationFieldModel(widget, options))
    .filter(Boolean)
    .map(cloneFieldModel)
}
