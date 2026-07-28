import { deriveHighlightState } from './highlightStateModel.js'
import { readFocusState } from './focusStateModel.js'
import {
  readLinkDefinitions,
  readLinkTopologyState,
} from './linkStateModel.js'
import {
  readSelectionByWidgetView,
  readSelectionPrimaryView,
  readSelectionRegistry,
} from './selectionStateModel.js'
import { readViewportState } from './viewportStateModel.js'
import { makeCoordinationRelationMap } from '../../contracts/coordination-contracts.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function readCoordinationRelations(state = {}, shared = {}) {
  const explicitRelations = state?.coordination?.relations
  if (explicitRelations && typeof explicitRelations === 'object' && !Array.isArray(explicitRelations)) {
    return makeCoordinationRelationMap(explicitRelations)
  }
  const definitions = readLinkDefinitions(shared)
  return makeCoordinationRelationMap(
    definitions
      .filter((link) => typeof link?.sourceStateRef === 'string' && typeof link?.targetStateRef === 'string')
      .map((link) => {
        const relationRef = link.ref || link.linkId || link.id
        return {
          ref: relationRef,
          sourceStateRef: link.sourceStateRef,
          targetStateRef: link.targetStateRef,
          relation: link.relation || 'controls',
          transform: clone(link.transform || null),
          activation: link.activation || link.activationPolicy || 'automatic',
        }
      }),
  )
}

export function buildCoordinationStateFromWorkspaceState(state = {}, {
  currentBranchId = null,
  derivedTopology = {},
} = {}) {
  const shared = state?.shared || {}
  const sharedTopology = readLinkTopologyState(shared)
  const relations = readCoordinationRelations(state, shared)
  const legacyDefinitions = readLinkDefinitions(shared)
  return {
    stateId: state?.stateId || null,
    branchId: state?.branchId || currentBranchId || null,
    focusedWidgetRef: shared?.focusedWidget || null,
    selections: {
      registry: clone(readSelectionRegistry(shared)),
      views: {
        primary: clone(readSelectionPrimaryView(shared)),
        byWidget: clone(readSelectionByWidgetView(shared)),
      },
    },
    focus: readFocusState(shared, state?.widgets || {}),
    highlight: deriveHighlightState(state),
    viewport: readViewportState(shared),
    globalFilters: clone(shared?.globalFilters || {}),
    coordination: {
      relations,
    },
    links: {
      definitions: Object.keys(relations).length > 0
        ? clone(Object.values(relations))
        : clone(legacyDefinitions),
      topology: Object.keys(sharedTopology).length > 0 ? sharedTopology : derivedTopology,
    },
  }
}
