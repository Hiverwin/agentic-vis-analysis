import { bindWidgetHumanInteractions } from './humanInteractionBindings.js'

export function createVegaLiteWidgetAdapter(definition = {}) {
  return {
    provider: 'vega-lite',
    providerCapabilities: {
      supportedWidgetKinds: definition.kind ? [definition.kind] : [],
      renderStrategy: 'vegaEmbed',
      stateApplyStrategy: 'signalPatch',
      interactionBindingStrategy: 'vegaViewListeners',
      supportsRendererMount: true,
      supportsRendererUpdate: true,
      supportsRendererDispose: true,
      supportsSignalPatching: true,
      supportsOptionMerging: false,
      supportsImperativeRender: false,
      supportsPointSelection: true,
      supportsIntervalSelection: true,
      supportsZoomPan: true,
      supportsSelectionReadback: true,
      supportsViewportReadback: true,
      supportsHighlightProjection: true,
      supportsInteractionEvents: true,
    },
    mount({ view = null, surface = null } = {}) {
      return { view, surface }
    },
    update({ view = null, surface = null } = {}) {
      return { view, surface }
    },
    dispose({ view = null } = {}) {
      return view?.finalize?.()
    },
    bindHumanInteractions({
      view,
      spec,
      interactionConfig,
      selectionSourceWidgetId,
      actionTargetRef,
      onActionCall,
      onSelectionChange,
    }) {
      return bindWidgetHumanInteractions({
        view,
        spec,
        interactionConfig,
        selectionSourceWidgetId,
        actionTargetRef,
        onActionCall,
        onSelectionChange,
      })
    },
    async applyState({ view }) {
      try {
        await view.runAsync?.()
      } catch {}
    },
    readSelection() {
      return null
    },
    readViewport() {
      return null
    },
    ...definition,
  }
}
