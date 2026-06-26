import {
  makeWidgetAdapterCapabilities,
  makeWidgetAdapterHumanInteraction,
  makeWidgetAdapterProviderCapabilities,
  makeWidgetAdapterSummary,
} from '../protocol/widgetAdapters.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function summarizeWidgetAdapter(adapter) {
  if (!adapter) return null
  const humanInteraction = adapter.getHumanInteractionConfig?.() || null
  const description = adapter.getDescription?.() || null
  return makeWidgetAdapterSummary({
    widgetRef: adapter.widgetRef,
    dataRef: adapter.dataRef || null,
    kind: adapter.kind || description?.kind || null,
    title: description?.title || '',
    description: description?.description || '',
    analyticRoles: Array.isArray(description?.analyticRoles) ? [...description.analyticRoles] : [],
    primaryDataRef: description?.primaryDataRef || null,
    provider: adapter.provider || 'custom',
    providerCapabilities: makeWidgetAdapterProviderCapabilities(clone(adapter.providerCapabilities || {})),
    role: description?.role || null,
    sourceKind: description?.sourceKind || null,
    supportsSpecMutation: description?.supportsSpecMutation === true,
    metadata: clone(adapter.metadata || {}),
    usageNotes: Array.isArray(description?.usageNotes) ? [...description.usageNotes] : [],
    actionNames: Array.isArray(description?.actionNames) ? [...description.actionNames] : [],
    perceptionQueryNames: Array.isArray(description?.perceptionQueryNames) ? [...description.perceptionQueryNames] : [],
    humanInteraction: makeWidgetAdapterHumanInteraction(clone(humanInteraction)),
    capabilities: makeWidgetAdapterCapabilities({
      canDescribe: typeof adapter.getDescription === 'function',
      canReadState: typeof adapter.getState === 'function',
      canApplyState: typeof adapter.applyState === 'function',
      canMount: typeof adapter.mount === 'function',
      canUpdate: typeof adapter.update === 'function',
      canDisposeRenderer: typeof adapter.dispose === 'function',
      canBindHumanInteractions: typeof adapter.bindHumanInteractions === 'function',
      canReadSelection: typeof adapter.readSelection === 'function',
      canReadViewport: typeof adapter.readViewport === 'function',
      canRegisterActions: typeof adapter.registerActions === 'function',
      canRegisterPerceptionQueries: typeof adapter.registerPerceptionQueries === 'function',
    }),
  })
}
