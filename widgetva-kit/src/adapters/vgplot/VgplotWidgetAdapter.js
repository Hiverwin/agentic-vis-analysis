import { resolveVgplotCapabilities } from './vgplotCapabilityResolver.js'
import { createVgplotController } from './vgplotController.js'
import { readSelectionStateFromRuntime, readViewportStateFromRuntime } from './vgplotState.js'
import { isVgplotSupportedWidgetKind } from './vgplotSupportedKinds.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function readCachedState(view) {
  return view?.__widgetvaLastAppliedState && typeof view.__widgetvaLastAppliedState === 'object'
    ? view.__widgetvaLastAppliedState
    : null
}

function readFirstSelectionEntry(state) {
  const selectionEntries = Object.entries(state?.selections || {})
  return selectionEntries.length > 0 ? selectionEntries[0] : null
}

export function createVgplotWidgetAdapter(definition = {}) {
  const supportedWidgetKinds = isVgplotSupportedWidgetKind(definition.kind) ? [definition.kind] : []
  const {
    buildActionDescriptors: _buildActionDescriptors,
    buildPerceptionDescriptors: _buildPerceptionDescriptors,
    registerActions: _registerActions,
    registerPerceptionQueries: _registerPerceptionQueries,
    ...providerDefinition
  } = definition || {}

  return {
    provider: 'vgplot',
    providerCapabilities: {
      supportedWidgetKinds,
      renderStrategy: 'vgplotRuntime',
      stateApplyStrategy: 'providerState',
      interactionBindingStrategy: 'vgplotInteractors',
      supportsRendererMount: true,
      supportsRendererUpdate: true,
      supportsRendererDispose: true,
      supportsSignalPatching: false,
      supportsOptionMerging: false,
      supportsImperativeRender: true,
      supportsPointSelection: true,
      supportsIntervalSelection: true,
      supportsZoomPan: true,
      supportsSelectionReadback: true,
      supportsViewportReadback: true,
      supportsHighlightProjection: false,
      supportsInteractionEvents: true,
    },
    mount({ view = null, surface = null } = {}) {
      return { view, surface }
    },
    update({ view = null, surface = null } = {}) {
      return { view, surface }
    },
    dispose() {
      return undefined
    },
    bindHumanInteractions() {
      return () => {}
    },
    async applyState(args = {}) {
      const { view = null, runtime = null, state = null } = args
      if (view && state && typeof state === 'object' && !Array.isArray(state)) {
        view.__widgetvaLastAppliedState = clone(state)
      }

      const controller = createVgplotController({ view, runtime })
      const capabilities = resolveVgplotCapabilities({
        widgetKind: definition.kind || state?.kind || null,
        view,
        runtime,
      })
      const plotId = capabilities.plotIds[0] || null
      if (plotId) {
        if (Array.isArray(state?.view?.xDomain)) {
          controller.setPlotAttribute(plotId, 'xDomain', clone(state.view.xDomain))
        }
        if (Array.isArray(state?.view?.yDomain)) {
          controller.setPlotAttribute(plotId, 'yDomain', clone(state.view.yDomain))
        }
      }

      const firstSelectionEntry = readFirstSelectionEntry(state)
      if (firstSelectionEntry) {
        const [, selection] = firstSelectionEntry
        const selectionName = capabilities.selectionNames[0] || 'selection'
        controller.updateSelection(selectionName, clone(selection))
      }
    },
    readSelection({ view = null, runtime = null } = {}) {
      return readSelectionStateFromRuntime({
        view,
        runtime,
        state: readCachedState(view),
      })
    },
    readViewport({ view = null, runtime = null } = {}) {
      return readViewportStateFromRuntime({
        view,
        runtime,
        state: readCachedState(view),
      })
    },
    ...providerDefinition,
  }
}
