import { cloneJsonValue as clone } from '../../../shared/clone.js'

function hasRenderableProviderPayload(providerSpec = null) {
  if (!providerSpec || typeof providerSpec !== 'object' || Array.isArray(providerSpec)) return false
  if ((providerSpec.provider === 'vega-lite' || providerSpec.provider === 'vega') && providerSpec.spec) return true
  if (providerSpec.provider === 'echarts' && providerSpec.option) return true
  if (providerSpec.provider === 'vgplot' && typeof providerSpec.scriptText === 'string') return true
  return false
}

export function resolveWidgetProviderSpec(widget = {}) {
  const candidates = [
    widget?.providerSpec,
    widget?.runtimeSource?.providerSpec,
    widget?.source?.providerSpec,
  ]
  const renderable = candidates.find(hasRenderableProviderPayload)
  return clone(
    renderable
      || candidates.find(Boolean)
      || null,
  )
}

export function resolveWidgetRenderMode(widget = {}) {
  const provider = widget?.provider || null
  const providerSpec = resolveWidgetProviderSpec(widget)

  if (provider === 'vega-lite' && providerSpec?.provider === 'vega-lite' && providerSpec?.spec) {
    return {
      mode: 'vega-lite',
      provider,
      providerSpec,
    }
  }

  if (provider === 'vega' && providerSpec?.provider === 'vega' && providerSpec?.spec) {
    return {
      mode: 'vega',
      provider,
      providerSpec,
    }
  }

  if (provider === 'echarts' && providerSpec?.provider === 'echarts' && providerSpec?.option) {
    return {
      mode: 'echarts',
      provider,
      providerSpec,
    }
  }

  if (provider === 'vgplot' && providerSpec?.provider === 'vgplot' && typeof providerSpec?.scriptText === 'string') {
    return {
      mode: 'vgplot',
      provider,
      providerSpec,
    }
  }

  return {
    mode: 'unavailable',
    provider,
    providerSpec,
  }
}

export function resolveWidgetNativePayload(widget = {}) {
  const renderMode = resolveWidgetRenderMode(widget)
  if (renderMode.mode === 'vega-lite') {
    return {
      mode: 'vega-lite',
      payload: clone(renderMode.providerSpec?.spec || null),
      source: renderMode.providerSpec?.spec ? 'providerSpec' : 'none',
    }
  }
  if (renderMode.mode === 'vega') {
    return {
      mode: 'vega',
      payload: clone(renderMode.providerSpec?.spec || null),
      source: renderMode.providerSpec?.spec ? 'providerSpec' : 'none',
    }
  }
  if (renderMode.mode === 'echarts') {
    return {
      mode: 'echarts',
      payload: clone(renderMode.providerSpec?.option || null),
      source: renderMode.providerSpec?.option ? 'providerSpec' : 'none',
    }
  }
  if (renderMode.mode === 'vgplot') {
    return {
      mode: 'vgplot',
      payload: renderMode.providerSpec?.scriptText || '',
      source: renderMode.providerSpec?.scriptText ? 'providerSpec' : 'none',
    }
  }
  return {
    mode: 'unavailable',
    payload: null,
    source: 'none',
  }
}
