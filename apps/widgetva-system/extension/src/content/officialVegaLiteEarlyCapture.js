export function installEarlyVegaEmbedCapture(root = globalThis.window) {
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value))
  }

  function createCaptureState(host) {
    return {
      root: host,
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
      view: result && result.view ? result.view : null,
    }
  }

  function recordCapture(state, source, args, result) {
    const target = args.length > 0 ? args[0] : null
    const spec = args.length > 1 ? args[1] : null
    const options = args.length > 2 ? args[2] : null
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

  function wrapCapturedFunction(state, fn, source, rawKey, wrappedKey) {
    if (typeof fn !== 'function') return null
    if (state[rawKey] === fn && state[wrappedKey]) {
      return state[wrappedKey]
    }

    const wrapped = async function widgetvaCapturedOfficialVegaCall() {
      const args = Array.prototype.slice.call(arguments)
      const result = await fn.apply(this, args)
      recordCapture(state, source, args, result)
      return result
    }

    state[rawKey] = fn
    state[wrappedKey] = wrapped
    state.wrapped = true
    return wrapped
  }

  function installCapturedProperty(host, state, propertyName, source, rawKey, wrappedKey) {
    let currentValue = typeof host[propertyName] === 'function'
      ? wrapCapturedFunction(state, host[propertyName], source, rawKey, wrappedKey)
      : (propertyName in host ? host[propertyName] : null)

    try {
      Object.defineProperty(host, propertyName, {
        configurable: true,
        enumerable: true,
        get() {
          return currentValue
        },
        set(nextValue) {
          currentValue = typeof nextValue === 'function'
            ? wrapCapturedFunction(state, nextValue, source, rawKey, wrappedKey)
            : nextValue
        },
      })
    } catch {
      if (typeof host[propertyName] === 'function') {
        currentValue = wrapCapturedFunction(state, host[propertyName], source, rawKey, wrappedKey)
        host[propertyName] = currentValue
      }
    }
  }

  if (!root || typeof root !== 'object') {
    throw new Error('installEarlyVegaEmbedCapture requires a browser-like root object.')
  }

  if (root.__widgetvaVegaEmbedCapture) {
    return root.__widgetvaVegaEmbedCapture
  }

  const state = createCaptureState(root)
  installCapturedProperty(root, state, 'vegaEmbed', 'vegaEmbed', 'rawVegaEmbed', 'wrappedVegaEmbed')
  installCapturedProperty(root, state, 'embedExample', 'embedExample', 'rawEmbedExample', 'wrappedEmbedExample')

  const api = {
    isInstalled: true,
    getLatest() {
      return state.latest
    },
    listCalls() {
      return state.calls.slice()
    },
    hasCapturedView() {
      return Boolean(state.latest && state.latest.view)
    },
  }

  root.__widgetvaVegaEmbedCapture = api
  return api
}

export function buildEarlyVegaEmbedCaptureScript() {
  return `;(${installEarlyVegaEmbedCapture.toString()})(window);`
}
