function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function createCaptureState(root) {
  return {
    root,
    wrapped: false,
    rawVegaEmbed: null,
    wrappedVegaEmbed: null,
    rawEmbedExample: null,
    wrappedEmbedExample: null,
    calls: [],
    latest: null,
  }
}

function normalizeCaptureResult(source, result) {
  if (source === 'embedExample') {
    return {
      result,
      view: result || null,
    }
  }

  return {
    result,
    view: result?.view || null,
  }
}

function recordCapture(state, source, args, result) {
  const [target = null, spec = null, options = null] = args
  const normalized = normalizeCaptureResult(source, result)
  const entry = {
    source,
    target,
    spec: clone(spec),
    options: clone(options),
    result: normalized.result,
    view: normalized.view,
  }
  state.calls.push(entry)
  state.latest = entry
}

function wrapCapturedFunction(state, fn, { source, rawKey, wrappedKey }) {
  if (typeof fn !== 'function') return null
  if (state[rawKey] === fn && state[wrappedKey]) {
    return state[wrappedKey]
  }

  const wrapped = async function widgetvaCapturedOfficialVegaCall(...args) {
    const result = await fn.apply(this, args)
    recordCapture(state, source, args, result)
    return result
  }

  state[rawKey] = fn
  state[wrappedKey] = wrapped
  state.wrapped = true
  return wrapped
}

function installCapturedProperty(root, state, propertyName, config) {
  let currentValue = typeof root[propertyName] === 'function'
    ? wrapCapturedFunction(state, root[propertyName], config)
    : (propertyName in root ? root[propertyName] : null)

  try {
    Object.defineProperty(root, propertyName, {
      configurable: true,
      enumerable: true,
      get() {
        return currentValue
      },
      set(nextValue) {
        currentValue = typeof nextValue === 'function'
          ? wrapCapturedFunction(state, nextValue, config)
          : nextValue
      },
    })
  } catch {
    if (typeof root[propertyName] === 'function') {
      currentValue = wrapCapturedFunction(state, root[propertyName], config)
      root[propertyName] = currentValue
    }
  }
}

export function installVegaEmbedCapture(root = globalThis.window) {
  if (!root || typeof root !== 'object') {
    throw new Error('installVegaEmbedCapture requires a browser-like root object.')
  }

  if (root.__widgetvaVegaEmbedCapture) {
    return root.__widgetvaVegaEmbedCapture
  }

  const state = createCaptureState(root)

  installCapturedProperty(root, state, 'vegaEmbed', {
    source: 'vegaEmbed',
    rawKey: 'rawVegaEmbed',
    wrappedKey: 'wrappedVegaEmbed',
  })
  installCapturedProperty(root, state, 'embedExample', {
    source: 'embedExample',
    rawKey: 'rawEmbedExample',
    wrappedKey: 'wrappedEmbedExample',
  })

  const api = {
    isInstalled: true,
    getLatest() {
      return state.latest
    },
    listCalls() {
      return [...state.calls]
    },
    hasCapturedView() {
      return Boolean(state.latest?.view)
    },
  }

  root.__widgetvaVegaEmbedCapture = api
  return api
}

export function readLatestVegaEmbedCapture(root = globalThis.window) {
  return root?.__widgetvaVegaEmbedCapture?.getLatest?.() || null
}
