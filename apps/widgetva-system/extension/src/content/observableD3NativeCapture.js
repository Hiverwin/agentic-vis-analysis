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

export function readObservableD3NativeApi(root = globalThis.window) {
  const api = root?.__widgetVAObservableD3Native || null
  return isNativeD3Api(api) ? api : null
}

export function readObservableD3NativeCaptureSnapshot(root = globalThis.window) {
  const api = readObservableD3NativeApi(root)
  if (!api || typeof api.readCaptureSnapshot !== 'function') {
    return { brushBindings: [] }
  }
  const snapshot = api.readCaptureSnapshot()
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? snapshot
    : { brushBindings: [] }
}

export function applyObservableD3NativeBrushRegion(root = globalThis.window, command = null) {
  const api = readObservableD3NativeApi(root)
  if (!api || typeof api.applyBrushRegion !== 'function') {
    throw new Error('Observable D3 page does not expose a native brush-region executor.')
  }
  return api.applyBrushRegion(command)
}

export function clearObservableD3NativeBrush(root = globalThis.window, command = null) {
  const api = readObservableD3NativeApi(root)
  if (!api || typeof api.clearBrush !== 'function') {
    throw new Error('Observable D3 page does not expose a native brush clear executor.')
  }
  return api.clearBrush(command)
}

