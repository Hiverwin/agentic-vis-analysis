export function createCustomWidgetAdapter(definition = {}) {
  return {
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
  }
}
