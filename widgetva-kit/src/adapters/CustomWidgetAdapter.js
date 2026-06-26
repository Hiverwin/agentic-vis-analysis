import { createWidgetAdapterDefinition } from './widgetAdapterContract.js'
import { RuntimeProviderWidgetAdapter } from './runtimeProviderWidgetAdapter.js'

export function createCustomWidgetAdapter(definition = {}) {
  return createWidgetAdapterDefinition({
    provider: 'custom',
    providerCapabilities: {
      supportedWidgetKinds: definition.kind ? [definition.kind] : [],
      renderStrategy: 'custom',
      stateApplyStrategy: 'custom',
      interactionBindingStrategy: 'custom',
      supportsRendererMount: true,
      supportsRendererUpdate: true,
      supportsRendererDispose: true,
      supportsSignalPatching: false,
      supportsOptionMerging: false,
      supportsImperativeRender: false,
    },
    ...definition,
  })
}

export class CustomWidgetAdapter extends RuntimeProviderWidgetAdapter {
  constructor({ definition = {}, ...args } = {}) {
    super({
      definition: createCustomWidgetAdapter(definition),
      ...args,
    })
  }
}
