import test from 'node:test'
import assert from 'node:assert/strict'

import { buildEvidenceEntry } from '../../app/store/sessionModel.js'
import { buildImportedVisualizationCase } from '../imports/importedArtifactLoader.js'
import { buildWorkspaceComposition } from '../workspace/workspaceComposition.js'
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
    controlState: {
      category: 'A',
      range: [0, 10],
    },
    controlRangeDomains: {
      range: [0, 100],
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
      category: 'A',
      range: [0, 10],
    },
    rangeDomains: {
      range: [0, 100],
    },
  })
})

test('createInitialSessionStateFromCase assembles the first-party app session shell from case data and runtime state', () => {
  const caseDef = buildImportedVisualizationCase({
    caseId: 'imported-bootstrap-scatter',
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Imported bootstrap scatter",
      "data": { "values": [{ "x": 1, "y": 2 }] },
      "mark": "point",
      "encoding": {
        "x": { "field": "x", "type": "quantitative" },
        "y": { "field": "y", "type": "quantitative" }
      }
    })`,
  })
  const composition = buildWorkspaceComposition(caseDef)
  const runtimeSession = {
    workspaceSpec: {
      widgets: [
        {
          widgetId: 'w_imported_primary',
          kind: 'scatter',
          provider: 'vega-lite',
          source: {
            providerSpec: { provider: 'vega-lite', specType: 'scatter' },
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
  assert.deepEqual(state.controlState, {})
  assert.deepEqual(state.controlRangeDomains, {})
  assert.equal(state.widgets[0].providerSpec?.provider, 'vega-lite')
  assert.equal('providerCapabilities' in state.workspaceComposition.widgets[0], false)
})

test('buildAppSnapshotFromState assembles the first-party app snapshot from runtime-facing state', () => {
  const snapshot = buildAppSnapshotFromState({
    mode: 'manual',
    dataset: { name: 'sample' },
    topology: 'grid-overview',
    selectedWidgetId: 'w_bar_origin',
    widgets: [{ id: 'w_bar_origin' }, { id: 'w_line_year' }],
    findings: [{ id: 'f1' }],
    traceOpen: false,
    links: [{ id: 'l1' }],
    runtimeSessionKey: 'case-1',
  }, {
    getRuntimeSession() {
      return { id: 'session_1' }
    },
  })

  assert.deepEqual(snapshot, {
    mode: 'manual',
    dataset: { name: 'sample' },
    topology: 'grid-overview',
    widgets: [{ id: 'w_bar_origin' }, { id: 'w_line_year' }],
    selectedWidget: { id: 'w_bar_origin' },
    focusedRecord: null,
    findings: [{ id: 'f1' }],
    traceOpen: false,
    activeFilters: [],
    links: [{ id: 'l1' }],
    runtimeSession: { id: 'session_1' },
  })
})

test('createInitialSessionStateFromCase preserves imported workspace metadata for a host-loaded spec', () => {
  const caseDef = buildImportedVisualizationCase({
    caseId: 'imported-line-state',
    scriptText: `({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Imported bootstrap line",
      "data": { "values": [{ "date": "2024-01-01", "value": 1 }] },
      "mark": "line",
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "value", "type": "quantitative" }
      }
    })`,
  })
  const composition = buildWorkspaceComposition(caseDef)
  const runtimeSession = {
    workspaceSpec: {
      widgets: [
        {
          widgetId: 'w_imported_primary',
          kind: 'line',
          provider: 'vega-lite',
          source: caseDef.widgets[0].source,
        },
      ],
      links: [],
    },
    trace: [],
    agentMessages: [],
  }

  const state = createInitialSessionStateFromCase(caseDef, {
    composition,
    runtimeSession,
    selectedWidgetId: composition.selectedWidgetId,
    buildEvidenceEntry,
    clone,
  })

  assert.equal(state.workspaceSourceType, 'importedSpec')
  assert.equal(state.caseTitle, 'Imported bootstrap line')
  assert.equal(state.workspaceProviderEnvironment, 'vega-lite')
  assert.equal(state.widgets.length, 1)
  assert.equal(state.widgets[0].widgetKind, 'line')
  assert.equal(state.widgets[0].providerSpec?.provider, 'vega-lite')
  assert.equal('providerCapabilities' in state.widgets[0], false)
})
