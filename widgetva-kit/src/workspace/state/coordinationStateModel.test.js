import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCoordinationStateFromWorkspaceState } from './coordinationStateModel.js'

test('buildCoordinationStateFromWorkspaceState exposes state-to-state coordination relations', () => {
  const relationRef = 'wl://widgetva-app/workspace/demo/coordination/bar-region-to-scatter-filter'
  const sourceStateRef = 'wl://widgetva-app/workspace/demo/widget/w_bar/selection/region'
  const targetStateRef = 'wl://widgetva-app/workspace/demo/widget/w_scatter/transform/region-filter'

  const coordinationState = buildCoordinationStateFromWorkspaceState({
    stateId: 'demo:s1',
    shared: {
      links: {
        definitions: [
          {
            ref: relationRef,
            sourceStateRef,
            targetStateRef,
            relation: 'controls',
            transform: {
              kind: 'selectionToFilter',
              fieldMapping: [{ sourceField: 'region', targetField: 'region' }],
            },
            activation: 'automatic',
          },
        ],
      },
    },
  })

  assert.deepEqual(coordinationState.coordination.relations[relationRef], {
    ref: relationRef,
    sourceStateRef,
    targetStateRef,
    relation: 'controls',
    transform: {
      kind: 'selectionToFilter',
      fieldMapping: [{ sourceField: 'region', targetField: 'region' }],
    },
    activation: 'automatic',
  })
  assert.equal(coordinationState.links.definitions[0]?.ref, relationRef)
  assert.equal(coordinationState.links.definitions[0]?.sourceStateRef, sourceStateRef)
})

test('buildCoordinationStateFromWorkspaceState prefers canonical relations for link readers', () => {
  const relationRef = 'wl://widgetva-app/workspace/demo/coordination/scatter-zoom-to-bar-filter'
  const sourceStateRef = 'wl://widgetva-app/workspace/demo/widget/w_scatter/view/zoom'
  const targetStateRef = 'wl://widgetva-app/workspace/demo/widget/w_bar/transform/filter'

  const coordinationState = buildCoordinationStateFromWorkspaceState({
    stateId: 'demo:s2',
    shared: {
      links: {
        definitions: [{ ref: 'legacy-link', kind: 'filter' }],
      },
    },
    coordination: {
      relations: {
        [relationRef]: {
          ref: relationRef,
          sourceStateRef,
          targetStateRef,
          relation: 'controls',
          transform: { kind: 'domainToFilter' },
          activation: 'automatic',
        },
      },
    },
  })

  assert.deepEqual(coordinationState.links.definitions.map((entry) => entry.ref), [relationRef])
})
