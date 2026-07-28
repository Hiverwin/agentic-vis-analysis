import { buildVegaLiteRenderSpecFromRuntimeState } from './vegaLite/vegaLiteOfficialPageMaterializer.js'
import {
  applyVegaLiteAddRemoveState,
  applyVegaLiteEmphasisState,
  applyVegaLiteReencodeState,
} from './vegaLite/vegaLiteStateProjection.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function readProvider(widgetDescription = null, widgetState = null) {
  const spec = widgetState?.currentSpec
    || widgetState?.rawSpec
    || widgetDescription?.source?.providerSpec?.spec
    || widgetDescription?.source?.spec
    || null
  return widgetDescription?.provider
    || widgetState?.provider
    || widgetDescription?.source?.provider
    || widgetDescription?.source?.providerSpec?.provider
    || widgetState?.source?.providerSpec?.provider
    || (spec?.$schema && String(spec.$schema).includes('/vega/') ? 'vega' : null)
    || (spec?.$schema && String(spec.$schema).includes('vega-lite') ? 'vega-lite' : null)
    || (Array.isArray(spec?.marks) || Array.isArray(spec?.signals) ? 'vega' : null)
    || (spec?.mark || spec?.encoding || spec?.vconcat || spec?.hconcat || spec?.layer ? 'vega-lite' : null)
    || null
}

function readVegaLiteSemanticSpec(widgetDescription = null, widgetState = null) {
  return clone(
    widgetState?.currentSpec
      || widgetState?.rawSpec
      || widgetDescription?.source?.providerSpec?.spec
      || widgetDescription?.source?.spec
      || null,
  )
}

function readEChartsOption(widgetDescription = null, widgetState = null) {
  return clone(
    widgetState?.currentOption
      || widgetState?.rawOption
      || widgetDescription?.source?.providerSpec?.option
      || null,
  )
}

function readVgplotScriptText(widgetDescription = null, widgetState = null) {
  return typeof widgetState?.scriptText === 'string'
    ? widgetState.scriptText
    : (widgetDescription?.source?.providerSpec?.scriptText || '')
}

function buildVegaRenderSpecFromRuntimeState({ semanticSpec, state } = {}) {
  let spec = clone(semanticSpec)

  spec = applyVegaLiteReencodeState(spec, state?.view?.reencode)
  spec = applyVegaLiteAddRemoveState(spec, state?.view?.addRemove)
  spec = applyVegaLiteEmphasisState(spec, state?.view?.highlight)

  return spec
}

export function buildWidgetRenderPayload({
  widgetDescription = null,
  widgetState = null,
  runtime = null,
} = {}) {
  const provider = readProvider(widgetDescription, widgetState)
  const widgetId = widgetDescription?.widgetId || widgetState?.widgetId || null
  const widgetRef = widgetDescription?.ref || widgetState?.ref || null
  const kind = widgetDescription?.kind || widgetState?.kind || null

  if (provider === 'vega-lite') {
    const semanticSpec = readVegaLiteSemanticSpec(widgetDescription, widgetState)
    const spec = buildVegaLiteRenderSpecFromRuntimeState({
      semanticSpec,
      state: widgetState || {},
      runtime,
    })
    const providerSpec = {
      ...(widgetDescription?.source?.providerSpec || {}),
      provider: 'vega-lite',
      spec,
    }
    return {
      widgetId,
      widgetRef,
      kind,
      provider: 'vega-lite',
      providerSpec,
    }
  }

  if (provider === 'vega') {
    const semanticSpec = readVegaLiteSemanticSpec(widgetDescription, widgetState)
    const spec = buildVegaRenderSpecFromRuntimeState({
      semanticSpec,
      state: widgetState || {},
    })
    const providerSpec = {
      ...(widgetDescription?.source?.providerSpec || {}),
      provider: 'vega',
      spec,
    }
    return {
      widgetId,
      widgetRef,
      kind,
      provider: 'vega',
      providerSpec,
    }
  }

  if (provider === 'echarts') {
    const providerSpec = {
      ...(widgetDescription?.source?.providerSpec || {}),
      provider: 'echarts',
      option: readEChartsOption(widgetDescription, widgetState),
    }
    return {
      widgetId,
      widgetRef,
      kind,
      provider: 'echarts',
      providerSpec,
    }
  }

  if (provider === 'vgplot') {
    const providerSpec = {
      ...(widgetDescription?.source?.providerSpec || {}),
      provider: 'vgplot',
      scriptText: readVgplotScriptText(widgetDescription, widgetState),
    }
    return {
      widgetId,
      widgetRef,
      kind,
      provider: 'vgplot',
      providerSpec,
    }
  }

  return {
    widgetId,
    widgetRef,
    kind,
    provider,
    providerSpec: clone(widgetDescription?.source?.providerSpec || null),
  }
}
