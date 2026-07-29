import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDockTraceSteps,
  extractDockWorkspaceSummary,
} from './officialPageDockModel.js'

test('extractDockWorkspaceSummary keeps widget, links, and tools compact for the Dock', () => {
  const summary = extractDockWorkspaceSummary({
    workspace: {
      widgets: [
        {
          ref: 'w_primary',
          kind: 'scatter',
          title: 'Imported visualization',
        },
      ],
      links: [
        {
          sourceWidgetId: 'bar',
          sourceAction: 'bar.select',
          targetWidgetId: 'scatter',
          targetAction: 'scatter.filter',
          kind: 'filter',
        },
      ],
      actions: [
        { name: 'scatter.brushRegion' },
        { name: 'widget.clearSelection' },
      ],
      perceptionQueries: [
        { name: 'perception.summarizeVisible' },
      ],
    },
  })

  assert.equal(summary.widget.ref, 'w_primary')
  assert.equal(summary.widget.kind, 'scatter')
  assert.deepEqual(summary.tools.actions, ['scatter.brushRegion', 'widget.clearSelection'])
  assert.deepEqual(summary.tools.perceptions, ['perception.summarizeVisible'])
  assert.equal(summary.links[0].label, 'bar.select -> scatter.filter')
})

test('extractDockWorkspaceSummary collapses repeated generic coordination links', () => {
  const summary = extractDockWorkspaceSummary({
    workspace: {
      widgets: [{ ref: 'matrix-cell', kind: 'scatter' }],
      links: Array.from({ length: 6 }, () => ({
        kind: 'sharesSelection',
        source: 'source',
        target: 'target',
      })),
      actions: [],
      perceptionQueries: [],
    },
  })

  assert.equal(summary.links.length, 1)
  assert.equal(summary.links[0].label, 'Shared selection across views')
  assert.equal(summary.links[0].kind, 'sharesSelection')
  assert.equal(summary.links[0].count, 6)
})

test('buildDockTraceSteps maps each agent turn to one clickable action-state node', () => {
  const steps = buildDockTraceSteps({
    session: {
      turns: [
        {
          observe: {
            state: {
              stateId: 'main:s1',
              sharedAnalyticalState: {
                activeSelections: {},
              },
            },
          },
          act: {
            kind: 'action',
            name: 'line.boldLines',
            params: { series: 'AMZN' },
            ok: true,
            stateId: 'main:s2',
            updatedRefs: ['w_line'],
          },
          verify: {
            ok: true,
            summary: 'Line styling was applied.',
          },
          reason: {
            answer: 'I highlighted the AMZN line.',
          },
        },
      ],
    },
    snapshot: {
      state: {
        stateId: 'main:s2',
      },
    },
  })

  assert.equal(steps.length, 2)
  assert.equal(steps[0].label, 'State 0')
  assert.equal(steps[0].state.stateId, 'main:s1')
  assert.deepEqual(steps[0].state.recoverableState.sharedAnalyticalState.activeSelections, {})
  assert.equal(steps[1].label, 'State 1')
  assert.equal(steps[1].status, 'success')
  assert.equal(steps[1].operation.name, 'line.boldLines')
  assert.deepEqual(steps[1].operation.params, { series: 'AMZN' })
  assert.equal(steps[1].state.stateId, 'main:s2')
  assert.equal(steps[1].state.summary, 'State main:s2 updated w_line.')
  assert.equal(steps[1].reply, 'I highlighted the AMZN line.')
})

test('buildDockTraceSteps restores State 0 from the page recoverable snapshot', () => {
  const steps = buildDockTraceSteps({
    session: {
      turns: [
        {
          observe: {
            state: {
              stateId: 'main:s1',
              sharedAnalyticalState: {
                activeSelections: {
                  weather: {
                    value: { weather: 'rain' },
                  },
                },
              },
            },
          },
          act: {
            kind: 'action',
            name: 'bar.filterCategories',
            ok: true,
            stateId: 'main:s2',
          },
        },
      ],
    },
    snapshot: {
      recoverableState: {
        stateId: 'main:s0',
        shared: {
          activeSelections: {},
        },
      },
    },
  })

  assert.equal(steps[0].label, 'State 0')
  assert.equal(steps[0].state.stateId, 'main:s0')
  assert.deepEqual(steps[0].state.recoverableState.shared.activeSelections, {})
})

test('buildDockTraceSteps reads restorable state from nested action results', () => {
  const steps = buildDockTraceSteps({
    session: {
      turns: [
        {
          act: {
            kind: 'action',
            name: 'bar.filterCategories',
            params: { field: 'weather', values: ['snow'] },
            ok: true,
            result: {
              actionResult: {
                stateId: 'main:snow',
                updatedRefs: ['w_weather'],
                recoverableState: {
                  stateId: 'main:snow',
                  shared: {
                    activeSelections: {
                      weather: {
                        selectionId: 'weather',
                        value: { weather: 'snow' },
                      },
                    },
                  },
                },
              },
            },
          },
          verify: {
            ok: true,
            summary: 'Weather filter was applied.',
          },
          reason: {
            answer: 'I filtered the view to snow.',
          },
        },
      ],
    },
  })

  assert.equal(steps[0].state.stateId, 'main:snow')
  assert.deepEqual(steps[0].state.updatedRefs, ['w_weather'])
  assert.deepEqual(steps[0].state.recoverableState.shared.activeSelections.weather.value, { weather: 'snow' })
  assert.equal(steps[0].state.summary, 'State main:snow updated w_weather.')
})

test('buildDockTraceSteps preserves Observable D3 matrix brush state for trace restore', () => {
  const steps = buildDockTraceSteps({
    session: {
      turns: [
        {
          act: {
            kind: 'action',
            name: 'scatter.brushRegion',
            params: {
              xField: 'culmen_length_mm',
              yField: 'culmen_depth_mm',
              xRange: [38, 52],
              yRange: [15, 20],
            },
            ok: true,
            stateId: 'matrix:s1',
            recoverableState: {
              stateId: 'matrix:s1',
              brush: {
                targetRef: 'wl://observable-d3/scatter-matrix/cell/culmen_length_mm-culmen_depth_mm',
                xDomain: [38, 52],
                yDomain: [15, 20],
              },
            },
          },
        },
      ],
    },
  })

  assert.equal(steps[0].state.stateId, 'matrix:s1')
  assert.deepEqual(steps[0].state.recoverableState.brush, {
    targetRef: 'wl://observable-d3/scatter-matrix/cell/culmen_length_mm-culmen_depth_mm',
    xDomain: [38, 52],
    yDomain: [15, 20],
  })
})

test('buildDockTraceSteps reads restorable state from verification and view snapshots', () => {
  const steps = buildDockTraceSteps({
    session: {
      turns: [
        {
          act: {
            kind: 'action',
            name: 'bar.filterCategories',
            params: { field: 'weather', categories: ['fog'] },
            ok: true,
            stateId: 'main:fog',
          },
          verify: {
            ok: true,
            afterView: {
              stateId: 'main:fog',
              shared: {
                activeSelections: {
                  weather: {
                    selectionId: 'weather',
                    value: { weather: 'fog' },
                  },
                },
              },
            },
          },
        },
      ],
    },
  })

  assert.equal(steps[0].state.stateId, 'main:fog')
  assert.deepEqual(steps[0].state.recoverableState.shared.activeSelections.weather.value, { weather: 'fog' })
})
