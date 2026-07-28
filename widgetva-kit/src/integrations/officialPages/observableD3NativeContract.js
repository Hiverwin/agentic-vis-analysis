function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function readNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeBrushBinding(binding = null) {
  const bindingId = readNonEmptyString(binding?.bindingId)
  const targetRef = readNonEmptyString(binding?.targetRef)
  if (!bindingId || !targetRef) return null

  return {
    bindingId,
    targetRef,
    kind: readNonEmptyString(binding?.kind) || 'scatter',
    interaction: 'brush',
    fields: binding?.fields && typeof binding.fields === 'object' && !Array.isArray(binding.fields)
      ? clone(binding.fields)
      : {},
    domain: binding?.domain && typeof binding.domain === 'object' && !Array.isArray(binding.domain)
      ? clone(binding.domain)
      : {},
  }
}

export function readObservableD3NativeBrushBindings(captureSnapshot = {}) {
  return (Array.isArray(captureSnapshot?.brushBindings) ? captureSnapshot.brushBindings : [])
    .map(normalizeBrushBinding)
    .filter(Boolean)
}

export function buildObservableD3NativeContract(captureSnapshot = {}) {
  const brushBindings = readObservableD3NativeBrushBindings(captureSnapshot)
  const actions = brushBindings.map((binding) => ({
    name: 'scatter.brushRegion',
    targetRef: binding.targetRef,
    native: {
      provider: 'd3',
      kind: 'brush',
      bindingId: binding.bindingId,
    },
    paramsSchema: {
      type: 'object',
      required: ['xField', 'yField', 'xRange', 'yRange'],
      properties: {
        xField: { type: 'string' },
        yField: { type: 'string' },
        xRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
        yRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
      },
    },
  }))

  return {
    provider: 'd3',
    actions,
    perceptions: [
      { name: 'perception.inspectViewConfig' },
      { name: 'perception.summarizeSelection' },
      { name: 'perception.summarizeVisible' },
    ],
    native: {
      brushBindings,
    },
  }
}

export function findObservableD3NativeBrushBinding(contract = {}, targetRef = null) {
  const normalizedTargetRef = readNonEmptyString(targetRef)
  if (!normalizedTargetRef) return null
  const bindings = Array.isArray(contract?.native?.brushBindings)
    ? contract.native.brushBindings
    : readObservableD3NativeBrushBindings(contract)
  return bindings.find((binding) => binding?.targetRef === normalizedTargetRef) || null
}
