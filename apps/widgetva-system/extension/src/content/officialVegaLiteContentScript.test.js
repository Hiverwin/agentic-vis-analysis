import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WIDGETVA_LOAD_OFFICIAL_VEGA_LITE_PAGE,
  createOfficialVegaLitePageLoadHandler,
} from './officialVegaLiteContentScript.js'

test('official Vega-Lite content handler ignores unrelated extension messages', async () => {
  let bridgeInstalls = 0
  let dockInstalls = 0
  const loadPage = createOfficialVegaLitePageLoadHandler({
    root: {},
    installBridge() {
      bridgeInstalls += 1
    },
    installDock() {
      dockInstalls += 1
      return {}
    },
    ensurePageScript() {},
  })

  assert.equal(await loadPage({ type: 'other-message' }), null)
  assert.equal(bridgeInstalls, 0)
  assert.equal(dockInstalls, 0)
})

test('official Vega-Lite content handler installs Dock and binds only after Load message', async () => {
  let bridgeInstalls = 0
  let dockInstalls = 0
  let bindCalls = 0
  let opened = false
  const loadPage = createOfficialVegaLitePageLoadHandler({
    root: { name: 'page' },
    installBridge(root) {
      assert.deepEqual(root, { name: 'page' })
      bridgeInstalls += 1
    },
    installDock(options) {
      dockInstalls += 1
      assert.equal(options.provider, 'vega-lite')
      assert.equal(options.openOnInstall, true)
      return {
        open() {
          opened = true
        },
        async bind() {
          bindCalls += 1
        },
        isBound() {
          return bindCalls > 0
        },
      }
    },
    ensurePageScript() {},
  })

  const result = await loadPage({
    type: WIDGETVA_LOAD_OFFICIAL_VEGA_LITE_PAGE,
  })

  assert.deepEqual(result, {
    loaded: true,
    bound: true,
  })
  assert.equal(bridgeInstalls, 1)
  assert.equal(dockInstalls, 1)
  assert.equal(opened, true)
  assert.equal(bindCalls, 1)
})
