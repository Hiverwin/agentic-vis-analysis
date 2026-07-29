function readNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeRefToken(value, fallback = 'field') {
  const token = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return token || fallback
}

function makeScatterCellRef({ xField = null, yField = null, index = 0 } = {}) {
  const xToken = normalizeRefToken(xField, `x-${index + 1}`)
  const yToken = normalizeRefToken(yField, `y-${index + 1}`)
  return `wl://observable-d3/scatter-matrix/cell/${xToken}-${yToken}`
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isD3BrushBehavior(value) {
  return Boolean(
    typeof value === 'function'
    && typeof value.move === 'function'
  )
}

function isNativeD3Api(candidate) {
  return Boolean(
    candidate
    && typeof candidate === 'object'
    && (
      typeof candidate.readCaptureSnapshot === 'function'
      || typeof candidate.applyBrushRegion === 'function'
      || typeof candidate.clearBrush === 'function'
    )
  )
}

function readSelectionNodes(selection) {
  if (!selection || typeof selection !== 'object') return []
  if (Array.isArray(selection._groups)) {
    return selection._groups.flat().filter(Boolean)
  }
  if (typeof selection.nodes === 'function') {
    try {
      return selection.nodes().filter(Boolean)
    } catch {}
  }
  return []
}

function readScaleDomain(scale) {
  if (typeof scale?.domain !== 'function') return null
  try {
    const domain = scale.domain()
    return Array.isArray(domain) ? domain.slice(0, 2) : null
  } catch {
    return null
  }
}

function readScaleFromContext(context = {}, axis = 'x', datum = null) {
  const value = context?.[axis]
  if (typeof value === 'function') return value
  if (Array.isArray(value) && Array.isArray(datum)) {
    const index = axis === 'x' ? datum[0] : datum[1]
    return typeof value[index] === 'function' ? value[index] : null
  }
  return null
}

function readFieldFromContext(context = {}, axis = 'x', datum = null) {
  const explicit = axis === 'x'
    ? context?.xField || context?.fields?.x
    : context?.yField || context?.fields?.y
  if (readNonEmptyString(explicit)) return explicit

  if (Array.isArray(context?.columns) && Array.isArray(datum)) {
    const index = axis === 'x' ? datum[0] : datum[1]
    return readNonEmptyString(context.columns[index])
  }

  return null
}

function readBrushContext(args = []) {
  return args.slice(1).find((arg) => isPlainObject(arg) && (
    arg.xField
    || arg.yField
    || arg.fields
    || arg.columns
    || arg.x
    || arg.y
    || arg.targetRef
    || arg.bindingId
  )) || {}
}

function projectExtent(scale, domain = []) {
  if (typeof scale !== 'function' || !Array.isArray(domain) || domain.length < 2) {
    return null
  }
  const pixels = domain.slice(0, 2).map((value) => Number(scale(value)))
  if (!pixels.every(Number.isFinite)) return null
  return [Math.min(...pixels), Math.max(...pixels)]
}

function createCaptureState(root) {
  return {
    root,
    nextBindingIndex: 1,
    patchedD3Objects: new WeakSet(),
    bindings: new Map(),
    bindingIdByNode: new WeakMap(),
  }
}

function createBindingSnapshot(binding) {
  return {
    bindingId: binding.bindingId,
    targetRef: binding.targetRef,
    kind: 'scatter',
    interaction: 'brush',
    fields: {
      x: binding.xField,
      y: binding.yField,
    },
    domain: {
      x: readScaleDomain(binding.xScale),
      y: readScaleDomain(binding.yScale),
    },
  }
}

function registerBrushBinding(state, {
  d3,
  brush,
  node,
  context = {},
  index = 0,
} = {}) {
  if (!state || !d3 || !brush || !node) return null

  const datum = Array.isArray(node.__data__) ? node.__data__ : null
  const xField = readFieldFromContext(context, 'x', datum)
  const yField = readFieldFromContext(context, 'y', datum)
  const xScale = readScaleFromContext(context, 'x', datum)
  const yScale = readScaleFromContext(context, 'y', datum)
  if (!xField || !yField || typeof xScale !== 'function' || typeof yScale !== 'function') {
    return null
  }

  const existingId = state.bindingIdByNode.get(node)
  const bindingId = readNonEmptyString(context.bindingId)
    || existingId
    || `observable_d3_brush_${state.nextBindingIndex++}`
  const targetRef = readNonEmptyString(context.targetRef)
    || makeScatterCellRef({ xField, yField, index })

  const binding = {
    bindingId,
    targetRef,
    d3,
    brush,
    node,
    xField,
    yField,
    xScale,
    yScale,
  }
  state.bindingIdByNode.set(node, bindingId)
  state.bindings.set(bindingId, binding)
  return binding
}

function applyBrushBinding(binding, { xDomain = null, yDomain = null } = {}) {
  const xPixels = projectExtent(binding?.xScale, xDomain)
  const yPixels = projectExtent(binding?.yScale, yDomain)
  if (!xPixels || !yPixels) {
    throw new Error('Observable D3 native brush requires xDomain and yDomain values that can be projected by the captured scales.')
  }

  const pixelSelection = [
    [xPixels[0], yPixels[0]],
    [xPixels[1], yPixels[1]],
  ]
  binding.d3.select(binding.node).call(binding.brush.move, pixelSelection)
  return {
    ok: true,
    bindingId: binding.bindingId,
    targetRef: binding.targetRef,
    pixelSelection,
  }
}

function clearBrushBinding(binding) {
  binding.d3.select(binding.node).call(binding.brush.move, null)
  return {
    ok: true,
    bindingId: binding.bindingId,
    targetRef: binding.targetRef,
    cleared: true,
  }
}

function patchD3SelectionCall(state, d3) {
  if (!d3 || typeof d3 !== 'object' || state.patchedD3Objects.has(d3)) return false
  const selectionPrototype = d3.selection?.prototype
  if (!selectionPrototype || typeof selectionPrototype.call !== 'function') return false

  const originalCall = selectionPrototype.call
  const widgetvaState = state
  selectionPrototype.call = function widgetvaCapturedD3SelectionCall() {
    const args = Array.prototype.slice.call(arguments)
    const callback = args[0]
    if (isD3BrushBehavior(callback)) {
      const context = readBrushContext(args)
      const nodes = readSelectionNodes(this)
      nodes.forEach((node, index) => {
        registerBrushBinding(widgetvaState, {
          d3,
          brush: callback,
          node,
          context,
          index,
        })
      })
    }
    return originalCall.apply(this, args)
  }
  selectionPrototype.call.__widgetvaOriginalCall = originalCall
  state.patchedD3Objects.add(d3)
  return true
}

function installD3PropertyCapture(root, state) {
  let currentValue = root.d3
  patchD3SelectionCall(state, currentValue)

  try {
    Object.defineProperty(root, 'd3', {
      configurable: true,
      enumerable: true,
      get() {
        return currentValue
      },
      set(nextValue) {
        currentValue = nextValue
        patchD3SelectionCall(state, currentValue)
      },
    })
  } catch {
    patchD3SelectionCall(state, root.d3)
  }
}

export function installObservableD3EarlyCapture(root = globalThis.window) {
  if (!root || typeof root !== 'object') {
    throw new Error('installObservableD3EarlyCapture requires a browser-like root object.')
  }

  if (isNativeD3Api(root.__widgetVAObservableD3Native)) {
    return root.__widgetVAObservableD3Native
  }

  const state = createCaptureState(root)
  installD3PropertyCapture(root, state)

  const api = {
    isInstalled: true,
    readCaptureSnapshot() {
      return {
        brushBindings: [...state.bindings.values()].map(createBindingSnapshot),
      }
    },
    applyBrushRegion(command = {}) {
      const binding = state.bindings.get(command?.bindingId)
      if (!binding) {
        throw new Error(`Observable D3 native brush binding not found: ${command?.bindingId || 'unknown'}.`)
      }
      return applyBrushBinding(binding, command)
    },
    clearBrush(command = {}) {
      const binding = state.bindings.get(command?.bindingId)
      if (!binding) {
        throw new Error(`Observable D3 native brush binding not found: ${command?.bindingId || 'unknown'}.`)
      }
      return clearBrushBinding(binding)
    },
    patchD3(d3) {
      return patchD3SelectionCall(state, d3)
    },
  }

  root.__widgetVAObservableD3Native = api
  return api
}
