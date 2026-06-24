import test from 'node:test'
import assert from 'node:assert/strict'

import { WORKSPACE_CASES } from '../presets/workspaceCases.js'
import { buildEvidenceEntry } from '../app/sessionModel.js'
import { buildWorkspaceComposition } from './workspaceComposition.js'
import {
  buildAppSnapshotFromState,
  buildWorkspaceGlobalFilters,
  createInitialSessionStateFromCase,
} from './sessionBootstrapAdapter.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

test('buildWorkspaceGlobalFilters adapts first-party control state into canonical workspace filters', () => {
  const state = {
    runtimeSessionKey: 'case-1',
    analysisOrigin: 'Japan',
    analysisYear: 1971,
    analysisCylinders: [4],
    horsepowerMin: 80,
    horsepowerMax: 160,
    dataset: {
      horsepowerDomain: [40, 220],
    },
  }

  const filters = buildWorkspaceGlobalFilters(state, {
    getRuntimeSession() {
      return {
        workspace: {
          buildGlobalFiltersFromControlState(controlState, { rangeDomains }) {
            return { controlState, rangeDomains }
          },
        },
      }
    },
  })

  assert.deepEqual(filters, {
    controlState: {
      origin: 'Japan',
      year: 1971,
      cylinders: [4],
      horsepowerRange: [80, 160],
    },
    rangeDomains: {
      horsepower: [40, 220],
    },
  })
})

test('createInitialSessionStateFromCase assembles the first-party app session shell from case data and runtime state', () => {
  const caseDef = WORKSPACE_CASES[0]
  const composition = buildWorkspaceComposition(caseDef)
  const runtimeSession = {
    workspaceSpec: {
      widgets: [
        {
          widgetId: 'w_scatter_cars',
          kind: 'scatter',
          provider: 'vega-lite',
          source: {
            providerSpec: { provider: 'vega-lite', specType: 'scatter' },
            renderModel: { widgetKind: 'scatter' },
            interactionConfig: { brush: 'interval-selection' },
            providerCapabilities: { zoom: true },
          },
        },
      ],
      links: [],
    },
    trace: [{ id: 'trace_1' }],
    agentMessages: [{ id: 'message_1' }],
  }

  const state = createInitialSessionStateFromCase(caseDef, {
    composition,
    runtimeSession,
    selectedWidgetId: composition.selectedWidgetId,
    buildEvidenceEntry,
    clone,
  })

  assert.equal(state.activeCaseId, caseDef.id)
  assert.equal(state.currentWorkspaceSpec, runtimeSession.workspaceSpec)
  assert.equal(state.selectedWidgetId, composition.selectedWidgetId)
  assert.equal(state.selectedTraceStepId, 'trace_1')
  assert.deepEqual(state.agentMessages, [{ id: 'message_1' }])
  assert.deepEqual(state.analysisOrigin, 'All')
  assert.deepEqual(state.analysisCylinders, [])
  assert.equal(state.horsepowerMin, caseDef.dataset.horsepowerDomain[0])
  assert.equal(state.horsepowerMax, caseDef.dataset.horsepowerDomain[1])
  assert.equal(state.widgets[0].providerSpec?.provider, 'vega-lite')
  assert.equal(state.widgets[0].baseRenderModel?.widgetKind, 'scatter')
  assert.equal(state.workspaceComposition.widgets[0].providerCapabilities?.zoom, true)
})

test('buildAppSnapshotFromState assembles the first-party app snapshot from state and view model', () => {
  const snapshot = buildAppSnapshotFromState({
    mode: 'manual',
    dataset: { name: 'cars' },
    topology: 'grid-overview',
    selectedWidgetId: 'w_bar_origin',
    findings: [{ id: 'f1' }],
    traceOpen: false,
    links: [{ id: 'l1' }],
    runtimeSessionKey: 'case-1',
  }, {
    createWorkspaceViewModel() {
      return {
        widgetMap: {
          w_bar_origin: { id: 'w_bar_origin' },
          w_line_year: { id: 'w_line_year' },
        },
        focusedCar: { id: 'car_1' },
        activeFilters: ['origin: Japan'],
      }
    },
    getRuntimeSession() {
      return { id: 'session_1' }
    },
  })

  assert.deepEqual(snapshot, {
    mode: 'manual',
    dataset: { name: 'cars' },
    topology: 'grid-overview',
    widgets: [{ id: 'w_bar_origin' }, { id: 'w_line_year' }],
    selectedWidget: { id: 'w_bar_origin' },
    focusedCar: { id: 'car_1' },
    findings: [{ id: 'f1' }],
    traceOpen: false,
    activeFilters: ['origin: Japan'],
    links: [{ id: 'l1' }],
    runtimeSession: { id: 'session_1' },
  })
})
