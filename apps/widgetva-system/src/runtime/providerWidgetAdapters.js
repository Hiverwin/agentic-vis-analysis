import {
  createD3WidgetAdapter,
  createEChartsWidgetAdapter,
  getWidgetFamilyAdapter,
  createVegaLiteWidgetAdapter,
} from '../../../../widgetva-kit/src/adapters/index.js'

function bindIfFunction(target, name) {
  const value = target?.[name]
  return typeof value === 'function' ? value.bind(target) : undefined
}

function pickSharedDefinition(kind) {
  const familyAdapter = getWidgetFamilyAdapter(kind)
  if (!familyAdapter) {
    throw new Error(`Unsupported widget family for provider-backed adapter creation: ${kind}`)
  }

  return {
    kind,
    buildActionDescriptors: bindIfFunction(familyAdapter, 'buildActionDescriptors'),
    buildPerceptionDescriptors: bindIfFunction(familyAdapter, 'buildPerceptionDescriptors'),
    getHumanInteractionConfig: bindIfFunction(familyAdapter, 'getHumanInteractionConfig'),
    registerActions: bindIfFunction(familyAdapter, 'registerActions'),
    registerPerceptionQueries: bindIfFunction(familyAdapter, 'registerPerceptionQueries'),
    bindHumanInteractions: bindIfFunction(familyAdapter, 'bindHumanInteractions'),
    applyState: bindIfFunction(familyAdapter, 'applyState'),
    mount: bindIfFunction(familyAdapter, 'mount'),
    update: bindIfFunction(familyAdapter, 'update'),
    dispose: bindIfFunction(familyAdapter, 'dispose'),
    readSelection: bindIfFunction(familyAdapter, 'readSelection'),
    readViewport: bindIfFunction(familyAdapter, 'readViewport'),
  }
}

export function createProviderWidgetAdapter(kind, provider = 'vega-lite') {
  const sharedDefinition = pickSharedDefinition(kind)
  if (provider === 'echarts') {
    return createEChartsWidgetAdapter(sharedDefinition)
  }
  if (provider === 'd3') {
    return createD3WidgetAdapter(sharedDefinition)
  }
  return createVegaLiteWidgetAdapter(sharedDefinition)
}
