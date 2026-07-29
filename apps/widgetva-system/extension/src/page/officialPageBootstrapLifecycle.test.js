import test from 'node:test'
import assert from 'node:assert/strict'

import {
  clearOfficialVegaLitePageBootstrapRuntime,
  resetOfficialVegaLitePageBootstrapBindings,
} from './officialVegaLitePageLifecycle.js'
import {
  attachOfficialPageController,
  ensureOfficialPageRuntimeManager,
  readManagedController,
} from './officialPageRuntimeManager.js'
import {
  bindOfficialVegaLitePageAgentRuntime,
  OFFICIAL_VEGA_LITE_PAGE_STABLE_SURFACE,
} from './officialVegaLitePageBindings.js'

function createRoot() {
  return {
    __widgetVA: { kind: 'page-port' },
  }
}

test('bindOfficialVegaLitePageAgentRuntime exposes only the stable official Vega-Lite surface without legacy globals', async () => {
  const entry = {}
  const root = createRoot()

  ensureOfficialPageRuntimeManager(entry)
  await attachOfficialPageController(entry, {
    pagePort: root.__widgetVA,
    dispose() {},
  })
  bindOfficialVegaLitePageAgentRuntime({
    entry,
    root,
    request: async () => ({ ok: true }),
    runNaturalLanguageAgentTurn: async () => ({ ok: true }),
  })

  assert.equal(typeof root[OFFICIAL_VEGA_LITE_PAGE_STABLE_SURFACE], 'object')
  assert.equal(root[OFFICIAL_VEGA_LITE_PAGE_STABLE_SURFACE]?.readEntry(), entry)
  assert.equal(root.__widgetVAOfficialPage, undefined)
  assert.equal(root.__widgetVAOfficialPageEntry, undefined)
  assert.equal(root.__widgetVAOfficialPageController, undefined)
  assert.equal(root.__widgetVAOfficialPageReadEntry, undefined)
  assert.equal(root.__widgetVAOfficialPageRunAgentLoop, undefined)
  assert.equal(root.__widgetVAOfficialPageRunNaturalLanguageAgentTurn, undefined)
  assert.equal(root.__widgetVAOfficialPageRequest, undefined)
})

test('clearOfficialVegaLitePageBootstrapRuntime clears the managed controller and WidgetVA binding', async () => {
  const entry = {}
  const root = createRoot()
  const resetCalls = []

  ensureOfficialPageRuntimeManager(entry)
  await attachOfficialPageController(entry, {
    pagePort: root.__widgetVA,
    dispose() {},
  })
  bindOfficialVegaLitePageAgentRuntime({
    entry,
    root,
    request: () => null,
    runNaturalLanguageAgentTurn: () => null,
  })

  assert.equal(root[OFFICIAL_VEGA_LITE_PAGE_STABLE_SURFACE]?.readEntry(), entry)

  await clearOfficialVegaLitePageBootstrapRuntime({
    entry,
    root,
    clearWidgetVA: true,
    resetEntry(currentEntry) {
      resetCalls.push(currentEntry)
      currentEntry.status = 'idle'
    },
  })

  assert.equal(readManagedController(entry), null)
  assert.equal(root.__widgetVA, undefined)
  assert.equal(root.__widgetVAOfficialPage, undefined)
  assert.equal(root.__widgetVAOfficialVegaLitePage, undefined)
  assert.equal(root.__widgetVAOfficialPageController, undefined)
  assert.equal(root.__widgetVAOfficialPageEntry, undefined)
  assert.equal(root.__widgetVAOfficialPageReadEntry, undefined)
  assert.equal(root.__widgetVAOfficialPageReadController, undefined)
  assert.equal(root.__widgetVAOfficialPageReadWorkspace, undefined)
  assert.equal(root.__widgetVAOfficialPageReadWidget, undefined)
  assert.equal(root.__widgetVAOfficialPageReadWidgetRef, undefined)
  assert.equal(root.__widgetVAOfficialPageReadObservation, undefined)
  assert.equal(root.__widgetVAOfficialPageReadSelections, undefined)
  assert.equal(root.__widgetVAOfficialPageExecuteAction, undefined)
  assert.equal(root.__widgetVAOfficialPageExecuteVerifiedAction, undefined)
  assert.equal(root.__widgetVAOfficialPageQueryPerception, undefined)
  assert.equal(root.__widgetVAOfficialPageRunDataQuery, undefined)
  assert.equal(root.__widgetVAOfficialPageReadLatestCoordinationResult, undefined)
  assert.equal(root.__widgetVAOfficialPageRunAction, undefined)
  assert.equal(root.__widgetVAOfficialPageRunVerifiedAction, undefined)
  assert.equal(root.__widgetVAOfficialPageRunObjective, undefined)
  assert.equal(root.__widgetVAOfficialPageRunObjectiveLoop, undefined)
  assert.equal(root.__widgetVAOfficialPageSetPointParam, undefined)
  assert.equal(root.__widgetVAOfficialPageSetIntervalParam, undefined)
  assert.equal(root.__widgetVAOfficialPageClearParam, undefined)
  assert.equal(root.__widgetVAOfficialPageClearSelection, undefined)
  assert.equal(root.__widgetVAOfficialPageInspectVisibleRows, undefined)
  assert.equal(root.__widgetVAOfficialPageSummarizeVisible, undefined)
  assert.equal(root.__widgetVAOfficialPageInspectSelection, undefined)
  assert.equal(root.__widgetVAOfficialPageSummarizeSelection, undefined)
  assert.equal(entry.api, null)
  assert.equal(entry.request, null)
  assert.equal(entry.runNaturalLanguageAgentTurn, null)
  assert.equal(entry.status, 'idle')
  assert.equal(resetCalls.length, 1)
})

test('resetOfficialVegaLitePageBootstrapBindings clears public bindings without touching the managed controller', async () => {
  const entry = {}
  const root = createRoot()
  const resetCalls = []

  ensureOfficialPageRuntimeManager(entry)
  await attachOfficialPageController(entry, {
    pagePort: root.__widgetVA,
    dispose() {},
  })
  bindOfficialVegaLitePageAgentRuntime({
    entry,
    root,
    request: () => null,
    runNaturalLanguageAgentTurn: () => null,
  })

  assert.equal(root[OFFICIAL_VEGA_LITE_PAGE_STABLE_SURFACE]?.readEntry(), entry)

  resetOfficialVegaLitePageBootstrapBindings({
    entry,
    root,
    clearWidgetVA: true,
    resetEntry(currentEntry) {
      resetCalls.push(currentEntry)
      currentEntry.status = 'idle'
    },
  })

  assert.notEqual(readManagedController(entry), null)
  assert.equal(root.__widgetVA, undefined)
  assert.equal(root.__widgetVAOfficialPage, undefined)
  assert.equal(root.__widgetVAOfficialVegaLitePage, undefined)
  assert.equal(root.__widgetVAOfficialPageController, undefined)
  assert.equal(root.__widgetVAOfficialPageEntry, undefined)
  assert.equal(root.__widgetVAOfficialPageReadEntry, undefined)
  assert.equal(root.__widgetVAOfficialPageReadController, undefined)
  assert.equal(root.__widgetVAOfficialPageReadWorkspace, undefined)
  assert.equal(root.__widgetVAOfficialPageReadWidget, undefined)
  assert.equal(root.__widgetVAOfficialPageReadWidgetRef, undefined)
  assert.equal(root.__widgetVAOfficialPageReadObservation, undefined)
  assert.equal(root.__widgetVAOfficialPageReadSelections, undefined)
  assert.equal(root.__widgetVAOfficialPageExecuteAction, undefined)
  assert.equal(root.__widgetVAOfficialPageExecuteVerifiedAction, undefined)
  assert.equal(root.__widgetVAOfficialPageQueryPerception, undefined)
  assert.equal(root.__widgetVAOfficialPageRunDataQuery, undefined)
  assert.equal(root.__widgetVAOfficialPageReadLatestCoordinationResult, undefined)
  assert.equal(root.__widgetVAOfficialPageRunAction, undefined)
  assert.equal(root.__widgetVAOfficialPageRunVerifiedAction, undefined)
  assert.equal(root.__widgetVAOfficialPageRunObjective, undefined)
  assert.equal(root.__widgetVAOfficialPageRunObjectiveLoop, undefined)
  assert.equal(root.__widgetVAOfficialPageSetPointParam, undefined)
  assert.equal(root.__widgetVAOfficialPageSetIntervalParam, undefined)
  assert.equal(root.__widgetVAOfficialPageClearParam, undefined)
  assert.equal(root.__widgetVAOfficialPageClearSelection, undefined)
  assert.equal(root.__widgetVAOfficialPageInspectVisibleRows, undefined)
  assert.equal(root.__widgetVAOfficialPageSummarizeVisible, undefined)
  assert.equal(root.__widgetVAOfficialPageInspectSelection, undefined)
  assert.equal(root.__widgetVAOfficialPageSummarizeSelection, undefined)
  assert.equal(entry.api, null)
  assert.equal(entry.request, null)
  assert.equal(entry.runNaturalLanguageAgentTurn, null)
  assert.equal(entry.status, 'idle')
  assert.equal(resetCalls.length, 1)
})
