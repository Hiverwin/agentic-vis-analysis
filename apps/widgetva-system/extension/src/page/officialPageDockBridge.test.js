import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WIDGETVA_DOCK_BRIDGE_REQUEST,
  WIDGETVA_DOCK_BRIDGE_RESPONSE,
  WIDGETVA_DOCK_BRIDGE_SOURCE_CONTENT,
  WIDGETVA_DOCK_BRIDGE_SOURCE_PAGE,
} from '../shared/officialPageDockBridge.js'
import {
  createOfficialPageDockBridgeMessageHandler,
  installOfficialPageDockBridge,
} from './officialPageDockBridge.js'

function createRoot(url = 'https://vega.github.io/vega-lite/examples/interactive_seattle_weather.html') {
  return {
    posted: [],
    location: {
      href: url,
      pathname: new URL(url).pathname,
    },
    postMessage(message) {
      this.posted.push(message)
    },
  }
}

test('official page Dock bridge binds through the supplied page bootstrap and returns a safe summary', async () => {
  const root = createRoot()
  const handler = createOfficialPageDockBridgeMessageHandler(root, {
    route: {
      provider: 'vega-lite',
      pageType: 'official-vega-lite-page',
    },
    async bind() {
      root.__widgetVAOfficialPage = {
        provider: 'vega-lite',
        pageType: 'official-vega-lite-page',
        status: 'ready',
        pagePort: {
          async readState() {
            throw new Error('pagePort.readState should not be used by the Dock snapshot.')
          },
          async listStateHistory() {
            throw new Error('pagePort.listStateHistory should not be used by the Dock snapshot.')
          },
          async readTrace() {
            throw new Error('pagePort.readTrace should not be used by the Dock snapshot.')
          },
          async readObservation() {
            throw new Error('pagePort.readObservation should not be used by the Dock snapshot.')
          },
        },
        api: {
          async readWorkspace() {
            return {
              widgets: [{ ref: 'w_primary', kind: 'scatter', title: 'Example' }],
              links: [{ sourceAction: 'bar.select', targetAction: 'scatter.filter', kind: 'filter' }],
              actions: [{ name: 'scatter.brushRegion' }],
              perceptionQueries: [{ name: 'perception.summarizeVisible' }],
            }
          },
          async readObservation() {
            return {
              state: { stateId: 'main:s1' },
            }
          },
          async readRecoverableState() {
            return {
              stateId: 'main:s0',
              shared: {
                activeSelections: {},
              },
            }
          },
        },
      }
      return root.__widgetVAOfficialPage
    },
  })

  await handler({
    source: root,
    data: {
      source: WIDGETVA_DOCK_BRIDGE_SOURCE_CONTENT,
      type: WIDGETVA_DOCK_BRIDGE_REQUEST,
      id: 'dock_1',
      method: 'bind',
      params: { forceReattach: true },
    },
  })

  assert.equal(root.posted.length, 1)
  assert.equal(root.posted[0].source, WIDGETVA_DOCK_BRIDGE_SOURCE_PAGE)
  assert.equal(root.posted[0].type, WIDGETVA_DOCK_BRIDGE_RESPONSE)
  assert.equal(root.posted[0].id, 'dock_1')
  assert.equal(root.posted[0].ok, true)
  assert.equal(root.posted[0].result.route.provider, 'vega-lite')
  assert.equal(root.posted[0].result.status, 'ready')
  assert.equal(root.posted[0].result.widget.kind, 'scatter')
  assert.deepEqual(root.posted[0].result.tools.actions, ['scatter.brushRegion'])
  assert.deepEqual(root.posted[0].result.tools.perceptions, ['perception.summarizeVisible'])
  assert.equal(root.posted[0].result.state.stateId, 'main:s1')
  assert.equal(root.posted[0].result.recoverableState.stateId, 'main:s0')
  assert.deepEqual(root.posted[0].result.recoverableState.shared.activeSelections, {})
})

test('official page Dock bridge restores a trace node through pagePort.jumpToState', async () => {
  const root = createRoot()
  const restored = []
  root.__widgetVAOfficialPage = {
    provider: 'vega-lite',
    pageType: 'official-vega-lite-page',
    status: 'ready',
    pagePort: {
      async jumpToState(options = {}) {
        restored.push(options.stateId)
        return { ok: true, stateId: options.stateId }
      },
      async readState() {
        return { stateId: restored.at(-1) || 'main:s1' }
      },
    },
    api: {
      async readWorkspace() {
        return { widgets: [], links: [], actions: [], perceptionQueries: [] }
      },
      async readObservation() {
        return { state: { stateId: restored.at(-1) || 'main:s1' } }
      },
    },
  }

  const handler = createOfficialPageDockBridgeMessageHandler(root, {
    route: {
      provider: 'vega-lite',
      pageType: 'official-vega-lite-page',
    },
  })

  await handler({
    source: root,
    data: {
      source: WIDGETVA_DOCK_BRIDGE_SOURCE_CONTENT,
      type: WIDGETVA_DOCK_BRIDGE_REQUEST,
      id: 'dock_2',
      method: 'restore',
      params: { stateId: 'main:s0' },
    },
  })

  assert.deepEqual(restored, ['main:s0'])
  assert.equal(root.posted[0].ok, true)
  assert.deepEqual(root.posted[0].result.restore, { ok: true, stateId: 'main:s0' })
  assert.equal(root.posted[0].result.snapshot.state.stateId, 'main:s0')
})

test('official page Dock bridge restores a trace node through the stable surface restore hook', async () => {
  const root = createRoot()
  const restored = []
  const entry = {
    provider: 'vega-lite',
    pageType: 'official-vega-lite-page',
    status: 'ready',
  }
  root.__widgetVAOfficialVegaLitePage = {
    readEntry() {
      return entry
    },
    async restoreRecoverableState(state = {}) {
      restored.push(state)
      return { ok: true, stateId: state.stateId, method: 'stableSurface' }
    },
    async readWorkspace() {
      return { widgets: [], links: [], actions: [], perceptionQueries: [] }
    },
    async readObservation() {
      return { state: { stateId: restored.at(-1)?.stateId || 'main:s1' } }
    },
  }
  entry.api = root.__widgetVAOfficialVegaLitePage

  const handler = createOfficialPageDockBridgeMessageHandler(root, {
    route: {
      provider: 'vega-lite',
      pageType: 'official-vega-lite-page',
    },
  })

  await handler({
    source: root,
    data: {
      source: WIDGETVA_DOCK_BRIDGE_SOURCE_CONTENT,
      type: WIDGETVA_DOCK_BRIDGE_REQUEST,
      id: 'dock_restore_stable',
      method: 'restore',
      params: {
        stateId: 'main:s0',
        state: {
          stateId: 'main:s0',
          shared: {
            activeSelections: {
              weather: {
                selectionId: 'weather',
                value: { weather: 'rain' },
              },
            },
          },
        },
      },
    },
  })

  assert.equal(restored[0].stateId, 'main:s0')
  assert.deepEqual(restored[0].shared.activeSelections.weather.value, { weather: 'rain' })
  assert.equal(root.posted[0].ok, true)
  assert.deepEqual(root.posted[0].result.restore, {
    ok: true,
    stateId: 'main:s0',
    method: 'stableSurface',
  })
  assert.equal(root.posted[0].result.snapshot.state.stateId, 'main:s0')
})

test('installOfficialPageDockBridge updates handlers when the provider page script is injected later', async () => {
  const root = createRoot()
  const listeners = new Set()
  root.addEventListener = (type, listener) => {
    if (type === 'message') listeners.add(listener)
  }
  root.removeEventListener = (type, listener) => {
    if (type === 'message') listeners.delete(listener)
  }

  installOfficialPageDockBridge(root, {
    route: {
      provider: 'unknown',
      pageType: 'unknown-page',
    },
  })
  installOfficialPageDockBridge(root, {
    route: {
      provider: 'vega-lite',
      pageType: 'official-vega-lite-page',
    },
    async bind() {
      return {
        provider: 'vega-lite',
        pageType: 'official-vega-lite-page',
        status: 'ready',
        pagePort: {
          async readState() {
            return { stateId: 'main:s1' }
          },
        },
        api: {
          async readWorkspace() {
            return {
              widgets: [{ ref: 'w_primary', kind: 'scatter' }],
              links: [],
              actions: [],
              perceptionQueries: [],
            }
          },
          async readObservation() {
            return { state: { stateId: 'main:s1' } }
          },
        },
      }
    },
  })

  assert.equal(listeners.size, 1)
  const listener = Array.from(listeners)[0]
  await listener({
    source: root,
    data: {
      source: WIDGETVA_DOCK_BRIDGE_SOURCE_CONTENT,
      type: WIDGETVA_DOCK_BRIDGE_REQUEST,
      id: 'dock_late_bind',
      method: 'bind',
      params: {},
    },
  })

  assert.equal(root.posted[0].ok, true)
  assert.equal(root.posted[0].result.status, 'ready')
  assert.equal(root.posted[0].result.route.provider, 'vega-lite')
  assert.equal(root.posted[0].result.widget.kind, 'scatter')
})

test('official page Dock bridge runs sessions through the Vega-Lite stable surface', async () => {
  const root = createRoot()
  const entry = {
    provider: 'vega-lite',
    pageType: 'official-vega-lite-page',
    status: 'ready',
    pagePort: {
      async readState() {
        return { stateId: 'main:s1' }
      },
    },
  }
  root.__widgetVAOfficialVegaLitePage = {
    readEntry() {
      return entry
    },
    async readWorkspace() {
      return {
        widgets: [{ ref: 'w_primary', kind: 'custom', title: 'Seattle Weather' }],
        links: [],
        actions: [],
        perceptionQueries: [],
      }
    },
    async readObservation() {
      return {
        state: { stateId: 'main:s1' },
      }
    },
    async runObjectiveLoop(options = {}) {
      assert.equal(options.objective, 'Explain the chart')
      return {
        answer: 'This is a weather exploration chart.',
        turns: [],
      }
    },
  }
  entry.api = root.__widgetVAOfficialVegaLitePage

  const handler = createOfficialPageDockBridgeMessageHandler(root, {
    route: {
      provider: 'vega-lite',
      pageType: 'official-vega-lite-page',
    },
  })

  await handler({
    source: root,
    data: {
      source: WIDGETVA_DOCK_BRIDGE_SOURCE_CONTENT,
      type: WIDGETVA_DOCK_BRIDGE_REQUEST,
      id: 'dock_run_session',
      method: 'runSession',
      params: { objective: 'Explain the chart' },
    },
  })

  assert.equal(root.posted[0].ok, true)
  assert.equal(root.posted[0].result.session.answer, 'This is a weather exploration chart.')
  assert.equal(root.posted[0].result.snapshot.status, 'ready')
  assert.equal(root.posted[0].result.snapshot.widget.label, 'Seattle Weather')
})

test('official page Dock bridge streams turn progress during runSession', async () => {
  const root = createRoot()
  const entry = {
    provider: 'vega-lite',
    pageType: 'official-vega-lite-page',
    status: 'ready',
    pagePort: {
      async readState() {
        return { stateId: 'main:s1' }
      },
    },
  }
  root.__widgetVAOfficialVegaLitePage = {
    readEntry() {
      return entry
    },
    async readWorkspace() {
      return {
        widgets: [{ ref: 'w_primary', kind: 'custom', title: 'Seattle Weather' }],
        links: [],
        actions: [],
        perceptionQueries: [],
      }
    },
    async readObservation() {
      return {
        state: { stateId: 'main:s2' },
      }
    },
    async runObjectiveLoop(options = {}) {
      assert.equal(typeof options.onTurn, 'function')
      await options.onTurn({
        index: 0,
        turn: {
          index: 0,
          act: {
            kind: 'action',
            name: 'bar.filterCategories',
            params: { field: 'weather', values: ['snow'] },
            ok: true,
            stateId: 'main:s2',
          },
          reason: {
            answer: 'Filtered to snow.',
          },
        },
        turns: [{
          index: 0,
          act: {
            kind: 'action',
            name: 'bar.filterCategories',
            params: { field: 'weather', values: ['snow'] },
            ok: true,
            stateId: 'main:s2',
          },
          reason: {
            answer: 'Filtered to snow.',
          },
        }],
        history: { turns: [{ turnId: 'turn_1' }] },
      })
      return {
        answer: 'Done.',
        turns: [],
      }
    },
  }
  entry.api = root.__widgetVAOfficialVegaLitePage

  const handler = createOfficialPageDockBridgeMessageHandler(root, {
    route: {
      provider: 'vega-lite',
      pageType: 'official-vega-lite-page',
    },
  })

  await handler({
    source: root,
    data: {
      source: WIDGETVA_DOCK_BRIDGE_SOURCE_CONTENT,
      type: WIDGETVA_DOCK_BRIDGE_REQUEST,
      id: 'dock_run_session_progress',
      method: 'runSession',
      params: { objective: 'Filter to snow' },
    },
  })

  assert.equal(root.posted.length, 2)
  assert.equal(root.posted[0].id, 'dock_run_session_progress')
  assert.equal(root.posted[0].event, 'turn')
  assert.equal(root.posted[0].result.progress.turn.act.name, 'bar.filterCategories')
  assert.equal(root.posted[0].result.snapshot.state.stateId, 'main:s2')
  assert.equal(root.posted[1].ok, true)
  assert.equal(root.posted[1].result.session.answer, 'Done.')
})
