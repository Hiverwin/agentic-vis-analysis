import test from 'node:test'
import assert from 'node:assert/strict'

import { planWorkspace } from './WorkspacePlanner.js'
import { deriveWorkspaceTopology } from '../../../workspace/coordination/deriveWorkspaceTopology.js'

test('planWorkspace uses datasetSchema to build a scatter-detail topology when sample rows are unavailable', () => {
  const plan = planWorkspace({
    sessionId: 'schema_only',
    preferredTopology: 'T3',
    datasetSchema: {
      fields: [
        { name: 'Horsepower', type: 'quantitative' },
        { name: 'Miles_per_Gallon', type: 'quantitative' },
        { name: 'Origin', type: 'nominal' },
      ],
    },
    spec: {
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative' },
        y: { field: 'Miles_per_Gallon', type: 'quantitative' },
      },
    },
  })
  const fieldMappedLink = plan?.links?.find((link) => link?.fieldMapping?.[0]?.sourceField)
  const derivedTopology = deriveWorkspaceTopology({
    widgets: plan?.widgets || [],
    links: plan?.links || [],
  })

  assert.equal(plan?.topology, 'T3')
  assert.equal(derivedTopology?.topology, 'T3')
  assert.ok((plan?.widgets?.length || 0) >= 2)
  assert.ok(Array.isArray(plan?.links))
  assert.equal(fieldMappedLink?.fieldMapping?.[0]?.sourceField, 'Origin')
  assert.equal(fieldMappedLink?.fieldMapping?.[0]?.targetField, 'Origin')
})

test('planWorkspace honors preferredTopology T4 with a link graph that derives to triple-dashboard topology', () => {
  const plan = planWorkspace({
    sessionId: 'triple_dashboard',
    preferredTopology: 'T4',
    spec: {
      data: {
        values: [
          { Horsepower: 90, Miles_per_Gallon: 32, Origin: 'Japan' },
          { Horsepower: 130, Miles_per_Gallon: 24, Origin: 'USA' },
          { Horsepower: 160, Miles_per_Gallon: 18, Origin: 'USA' },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative' },
        y: { field: 'Miles_per_Gallon', type: 'quantitative' },
        color: { field: 'Origin', type: 'nominal' },
      },
    },
  })
  const derivedTopology = deriveWorkspaceTopology({
    widgets: plan?.widgets || [],
    links: plan?.links || [],
  })

  assert.equal(plan?.topology, 'T4')
  assert.equal(derivedTopology?.topology, 'T4')
  assert.equal(plan?.widgets?.length, 3)
})

test('planWorkspace honors preferredTopology T5 with a linear drill-down chain', () => {
  const plan = planWorkspace({
    sessionId: 'drill_down_chain',
    preferredTopology: 'T5',
    spec: {
      data: {
        values: [
          { Horsepower: 90, Miles_per_Gallon: 32, Origin: 'Japan' },
          { Horsepower: 130, Miles_per_Gallon: 24, Origin: 'USA' },
          { Horsepower: 160, Miles_per_Gallon: 18, Origin: 'USA' },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative' },
        y: { field: 'Miles_per_Gallon', type: 'quantitative' },
        color: { field: 'Origin', type: 'nominal' },
      },
    },
  })
  const derivedTopology = deriveWorkspaceTopology({
    widgets: plan?.widgets || [],
    links: plan?.links || [],
  })

  assert.equal(plan?.topology, 'T5')
  assert.equal(derivedTopology?.topology, 'T5')
  assert.equal(plan?.widgets?.length, 3)
  assert.equal(plan?.links?.length, 2)
})

test('planWorkspace honors preferredTopology T6 with a global-control fan-out graph', () => {
  const plan = planWorkspace({
    sessionId: 'global_control',
    preferredTopology: 'T6',
    spec: {
      data: {
        values: [
          { Horsepower: 90, Miles_per_Gallon: 32, Origin: 'Japan' },
          { Horsepower: 130, Miles_per_Gallon: 24, Origin: 'USA' },
          { Horsepower: 160, Miles_per_Gallon: 18, Origin: 'USA' },
        ],
      },
      mark: 'point',
      encoding: {
        x: { field: 'Horsepower', type: 'quantitative' },
        y: { field: 'Miles_per_Gallon', type: 'quantitative' },
        color: { field: 'Origin', type: 'nominal' },
      },
    },
  })
  const derivedTopology = deriveWorkspaceTopology({
    widgets: plan?.widgets || [],
    links: plan?.links || [],
  })

  assert.equal(plan?.topology, 'T6')
  assert.equal(derivedTopology?.topology, 'T6')
  assert.equal(plan?.widgets?.length, 3)
  assert.equal(plan?.links?.length, 2)
})
