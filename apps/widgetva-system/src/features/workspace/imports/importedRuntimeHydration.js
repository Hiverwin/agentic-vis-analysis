import { cloneJsonValue as clone } from '../../../shared/clone.js'

function readProviderSpec(renderPayload = null, widget = {}) {
  return clone(
    renderPayload?.providerSpec
      || widget?.providerSpec
      || widget?.source?.providerSpec
      || null,
  )
}

function buildSourceWithProviderSpec(widget = {}, providerSpec = null) {
  if (!providerSpec) return widget?.source || {}
  const isSpecProvider = providerSpec.provider === 'vega-lite' || providerSpec.provider === 'vega'
  return {
    ...(widget?.source || {}),
    ...(isSpecProvider && providerSpec.spec ? { spec: providerSpec.spec } : {}),
    providerSpec,
  }
}

export function hydrateImportedRuntimeWidget(widget = {}, renderPayload = null, runtimeDescriptionWidget = null) {
  const providerSpec = readProviderSpec(renderPayload, widget)
  const provider = renderPayload?.provider
    || providerSpec?.provider
    || runtimeDescriptionWidget?.provider
    || widget?.provider
    || null

  return {
    ...widget,
    source: buildSourceWithProviderSpec(widget, providerSpec),
    ...(providerSpec ? { providerSpec } : {}),
    runtimeSource: {
      ...(widget?.runtimeSource || widget?.source || {}),
      ...((providerSpec?.provider === 'vega-lite' || providerSpec?.provider === 'vega') && providerSpec?.spec ? { spec: providerSpec.spec } : {}),
      ...(providerSpec ? { providerSpec } : {}),
    },
    provider: runtimeDescriptionWidget?.provider || provider || widget?.provider,
    widgetKind: runtimeDescriptionWidget?.kind || renderPayload?.kind || widget?.widgetKind,
    recognizedKinds: Array.isArray(runtimeDescriptionWidget?.recognizedKinds)
      ? [...runtimeDescriptionWidget.recognizedKinds]
      : (Array.isArray(widget?.recognizedKinds) ? [...widget.recognizedKinds] : []),
    actionNames: Array.isArray(runtimeDescriptionWidget?.actionNames)
      ? [...runtimeDescriptionWidget.actionNames]
      : (Array.isArray(widget?.actionNames) ? [...widget.actionNames] : []),
    perceptionQueryNames: Array.isArray(runtimeDescriptionWidget?.perceptionQueryNames)
      ? [...runtimeDescriptionWidget.perceptionQueryNames]
      : (Array.isArray(widget?.perceptionQueryNames) ? [...widget.perceptionQueryNames] : []),
  }
}

export function hydrateImportedRuntimeWidgets(widgets = [], {
  readWidgetRenderPayload,
  describeWorkspace,
} = {}) {
  const description = typeof describeWorkspace === 'function' ? describeWorkspace() : null
  const descriptionWidgets = Array.isArray(description?.widgets) ? description.widgets : []
  const descriptionByWidgetId = Object.fromEntries(
    descriptionWidgets.map((entry) => [entry?.widgetId, entry]),
  )

  return (Array.isArray(widgets) ? widgets : []).map((widget) => {
    const renderPayload = typeof readWidgetRenderPayload === 'function'
      ? readWidgetRenderPayload(widget?.id)
      : null
    const runtimeDescriptionWidget = descriptionByWidgetId[widget?.id] || null
    return hydrateImportedRuntimeWidget(
      widget,
      renderPayload,
      runtimeDescriptionWidget,
    )
  })
}
