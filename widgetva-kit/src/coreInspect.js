export {
  buildSelectionAdvancedResponseContext,
  buildSelectionCoordinationContext,
  buildSelectionDomainCoordinationContext,
  readDeclaredLinkEffect,
  readLinkActivationPolicy,
  readLinkEffectConstraint,
  resolveSelectionDrivenRows,
  resolveSelectionDrivenViewState,
} from './core/runtime/linkSemantics.js'
export {
  deriveHighlightedRows,
  deriveHighlightPredicatesFromState,
  deriveHighlightSummaryFromState,
  deriveSelectionFilteredRows,
} from './core/runtime/sharedStateDerivation.js'
export {
  readRuntimeDataFromStore,
  readWorkspaceDescriptionFromStore,
  readWorkspaceStateFromStore,
} from './core/runtime/workspaceStoreReaders.js'
export { summarizeInteractionTraceRecord } from './core/runtime/summarizeInteractionTraceRecord.js'
export { summarizeWorkspaceState } from './core/runtime/summarizeWorkspaceState.js'
export {
  makeCurrentSelectionDataRef,
  makeCurrentViewDataRef,
  makeWidgetRef,
  makeSelectionScopedDataRef,
  makeWidgetSelectionDataRef,
} from './core/protocol/refs.js'
export { PAGE_PORT_ALIASES } from './core/protocol/pagePort.js'
export { normalizeWidgetLink } from './core/protocol/widgetLinks.js'
