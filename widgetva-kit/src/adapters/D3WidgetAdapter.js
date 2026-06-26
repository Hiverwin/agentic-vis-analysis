import { createWidgetAdapterDefinition } from './widgetAdapterContract.js'
import { applyD3HostState } from './providerFamilyBehavior.js'
import { RuntimeProviderWidgetAdapter } from './runtimeProviderWidgetAdapter.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function readCachedState(view) {
  return view?.__widgetvaLastAppliedState && typeof view.__widgetvaLastAppliedState === 'object'
    ? view.__widgetvaLastAppliedState
    : null
}

function resolveCachedSelection(view) {
  const selections = Object.values(readCachedState(view)?.selections || {}).filter(Boolean)
  if (selections.length === 1) return clone(selections[0])
  return clone(selections.find((selection) => selection?.kind === 'interval') || selections[0] || null)
}

function normalizeViewportCandidate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const viewport = {
    ...(Array.isArray(value.xDomain) ? { xDomain: clone(value.xDomain) } : {}),
    ...(Array.isArray(value.yDomain) ? { yDomain: clone(value.yDomain) } : {}),
    ...(value.zoom && typeof value.zoom === 'object' ? { zoom: clone(value.zoom) } : {}),
  }
  return Object.keys(viewport).length > 0 ? viewport : null
}

export function createD3WidgetAdapter(definition = {}) {
  return createWidgetAdapterDefinition({
    provider: 'd3',
    providerCapabilities: {
      supportedWidgetKinds: definition.kind ? [definition.kind] : [],
      renderStrategy: 'providerView',
      stateApplyStrategy: 'imperativeRender',
      interactionBindingStrategy: 'providerEvents',
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
      supportsHighlightProjection: true,
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
    async applyState(args) {
      const { view, state, surface } = args || {}
      if (view && state && typeof state === 'object' && !Array.isArray(state)) {
        view.__widgetvaLastAppliedState = clone(state)
      }
      applyD3HostState({
        view,
        surface,
        state,
      })
      return definition.renderFromState?.(args)
    },
    readSelection({ view } = {}) {
      if (typeof view?.getSelection === 'function') {
        return clone(view.getSelection() || null)
      }
      if (typeof view?.getBrush === 'function') {
        return clone(view.getBrush() || null)
      }
      return resolveCachedSelection(view)
    },
    readViewport({ view } = {}) {
      if (typeof view?.getViewport === 'function') {
        return clone(view.getViewport() || null)
      }
      if (typeof view?.getDomain === 'function') {
        return normalizeViewportCandidate(view.getDomain())
      }
      return normalizeViewportCandidate(readCachedState(view)?.view)
    },
    ...definition,
  })
}

export class D3WidgetAdapter extends RuntimeProviderWidgetAdapter {
  constructor({ definition = {}, ...args } = {}) {
    super({
      definition: createD3WidgetAdapter(definition),
      ...args,
    })
  }
}
