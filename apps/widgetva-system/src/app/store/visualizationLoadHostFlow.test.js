import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function sumVisitorsByRegion(rows = []) {
  return Object.fromEntries(
    Object.entries((Array.isArray(rows) ? rows : []).reduce((acc, row) => {
      const region = row?.region
      if (!region) return acc
      acc[region] = (acc[region] || 0) + (Number(row?.visitors) || 0)
      return acc
    }, {})).sort(([left], [right]) => left.localeCompare(right)),
  )
}

async function setupIsolatedAppStoreSession(label = 'default') {
  globalThis.window = globalThis.window || {}
  globalThis.document = globalThis.document || {}

  const [{ useAppStore }, runtimeBridge] = await Promise.all([
    import('./appStore.js'),
    import('../../appRuntime/contracts/runtimeBridge.js'),
  ])

  const store = useAppStore
  const baseCaseId = 'starter-workspace'
  const baseCase = runtimeBridge.getWorkspaceCase(baseCaseId)
  const isolatedCaseId = `${baseCaseId}-${label}-${Date.now()}`

  runtimeBridge.registerWorkspaceCaseOverride(isolatedCaseId, {
    ...JSON.parse(JSON.stringify(baseCase)),
    id: isolatedCaseId,
  })
  store.getState().setActiveCase(isolatedCaseId)

  return {
    store,
    cleanup() {
      runtimeBridge.disposeRuntimeSession(isolatedCaseId)
    },
  }
}

async function bindImportedFixture(store, fileName) {
  const script = readFileSync(new URL(`../../../docs/multi-widget-fixtures/${fileName}`, import.meta.url), 'utf8')
  await store.getState().loadVisualizationScript(script)
  await tick()
  await store.getState().bindCurrentVisualization()
  await tick()
}

test('loadVisualizationScript renders a preview without binding it into the runtime workspace', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('imported-visualization-load')

  try {
    const previousMode = store.getState().mode
    const previousAnalysisTab = store.getState().analysisTab
    const previousTraceOpen = store.getState().traceOpen
    const previousCaseId = store.getState().activeCaseId
    const previousCaseTitle = store.getState().caseTitle

    await store.getState().loadVisualizationScript(`({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Loaded line into current VA",
      "data": { "values": [{ "date": "2024-01-01", "value": 1 }] },
      "mark": "line",
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "value", "type": "quantitative" }
      }
    })`)
    await tick()

    const nextState = store.getState()
    assert.equal(nextState.activeCaseId, previousCaseId)
    assert.equal(nextState.workspaceSourceType, 'starter')
    assert.equal(nextState.caseTitle, previousCaseTitle)
    assert.equal(nextState.widgets.length, 0)
    assert.equal(nextState.loadedVisualizationPreview?.title, 'Loaded line into current VA')
    assert.equal(nextState.loadedVisualizationPreview?.provider, 'vega-lite')
    assert.equal(nextState.loadedVisualizationPreview?.widgetKind, 'line')
    assert.equal(nextState.visualizationLoadError, null)
    assert.equal(nextState.visualizationLoadSummary, 'Visualization rendered successfully via vega-lite.')
    assert.equal(nextState.mode, previousMode)
    assert.equal(nextState.analysisTab, previousAnalysisTab)
    assert.equal(nextState.traceOpen, previousTraceOpen)
    assert.equal(nextState.visualizationBindSummary, '')
  } finally {
    cleanup()
  }
})

test('bindCurrentVisualization registers the loaded preview into an imported runtime workspace', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('bind-imported-visualization')

  try {
    await store.getState().loadVisualizationScript(`({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Loaded line into current VA",
      "data": { "values": [{ "date": "2024-01-01", "value": 1 }] },
      "mark": "line",
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "value", "type": "quantitative" }
      }
    })`)
    await tick()

    await store.getState().bindCurrentVisualization()
    await tick()

    const nextState = store.getState()
    const contract = nextState.getActiveAgentRuntimeContract()
    const description = contract.describeWorkspace()
    const summaryQuery = contract.listAvailableDataQueries().find((entry) => entry?.queryKind === 'summary')
    const summaryResult = await contract.runDataQuery({
      callId: 'imported_line_summary_after_bind',
      actor: 'agent',
      dataRef: summaryQuery?.dataRef,
      query: {
        kind: summaryQuery?.queryKind,
        spec: {
          measures: [{ op: 'count', as: 'count' }],
        },
      },
    })

    assert.equal(nextState.workspaceSourceType, 'importedSpec')
    assert.equal(nextState.widgets.length, 1)
    assert.equal(nextState.caseTitle, 'Loaded line into current VA')
    assert.equal(nextState.dataset.rows, 1)
    assert.equal(nextState.dataset.fields, 2)
    assert.equal(nextState.loadedVisualizationPreview, null)
    assert.equal(nextState.visualizationBindError, null)
    assert.match(nextState.visualizationBindSummary, /Bound successfully/)
    assert.match(nextState.visualizationBindSummary, /Provider: vega-lite/)
    assert.match(nextState.visualizationBindSummary, /Widget kind: line/)
    assert.equal(description?.widgets?.length, 1)
    assert.equal(description?.widgets?.[0]?.kind, 'line')
    assert.equal(description?.widgetAdapters?.[0]?.provider, 'vega-lite')
    assert.equal(summaryResult?.ok, true)
    assert.deepEqual(summaryResult?.result?.rows, [{ count: 1 }])
  } finally {
    cleanup()
  }
})

test('bindCurrentVisualization appends additional rendered charts to the current imported workspace', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('append-imported-visualizations')

  try {
    await store.getState().loadVisualizationScript(`({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Imported line",
      "data": { "values": [{ "year": 2024, "value": 1 }] },
      "mark": "line",
      "encoding": {
        "x": { "field": "year", "type": "ordinal" },
        "y": { "field": "value", "type": "quantitative" }
      }
    })`)
    await tick()

    await store.getState().bindCurrentVisualization()
    await tick()

    const firstBoundState = store.getState()
    const importedCaseId = firstBoundState.activeCaseId

    assert.equal(firstBoundState.workspaceSourceType, 'importedSpec')
    assert.equal(firstBoundState.widgets.length, 1)
    assert.equal(firstBoundState.widgets[0]?.id, 'w_imported_primary')

    await store.getState().loadVisualizationScript(`({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Imported bar",
      "data": { "values": [{ "origin": "USA", "count": 3 }, { "origin": "Japan", "count": 2 }] },
      "mark": "bar",
      "encoding": {
        "x": { "field": "origin", "type": "nominal" },
        "y": { "field": "count", "type": "quantitative" }
      }
    })`)
    await tick()

    await store.getState().bindCurrentVisualization()
    await tick()

    const nextState = store.getState()
    const contract = nextState.getActiveAgentRuntimeContract()
    const description = contract.describeWorkspace()

    assert.equal(nextState.activeCaseId, importedCaseId)
    assert.equal(nextState.workspaceSourceType, 'importedSpec')
    assert.equal(nextState.caseTitle, 'Imported line')
    assert.equal(nextState.widgets.length, 2)
    assert.deepEqual(nextState.widgets.map((widget) => widget.id), ['w_imported_primary', 'w_imported_2'])
    assert.deepEqual(nextState.widgets.map((widget) => widget.widgetKind), ['line', 'bar'])
    assert.equal(description?.widgets?.length, 2)
    assert.deepEqual(description?.widgets?.map((widget) => widget.kind), ['line', 'bar'])
  } finally {
    cleanup()
  }
})

test('imported same-source multi-widget visualizations derive executable coordination links', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('imported-linked-selection')
  const runtimeBridge = await import('../../appRuntime/contracts/runtimeBridge.js')
  const { hydrateImportedRuntimeWidgets } = await import('../../features/workspace/imports/importedRuntimeHydration.js')

  try {
    await bindImportedFixture(store, '01_region_bar.vl.js')
    await bindImportedFixture(store, '02_monthly_line.vl.js')
    await bindImportedFixture(store, '03_spend_scatter.vl.js')

    const boundState = store.getState()
    const runtime = runtimeBridge.createFirstPartyRuntimeSessionFacade(boundState.runtimeSessionKey || boundState.activeCaseId)
    const description = runtime.describeWorkspace()

    assert.deepEqual(boundState.widgets.map((widget) => widget.id), [
      'w_imported_primary',
      'w_imported_2',
      'w_imported_3',
    ])
    assert.deepEqual(description.widgets.map((widget) => widget.kind), ['bar', 'line', 'scatter'])
    const structuralContext = runtime.readSharedStructuralContext()
    assert.equal(structuralContext.links.definitions.length > 0, true)
    assert.equal(
      description.links.some((link) => typeof link.sourceStateRef === 'string' && typeof link.targetStateRef === 'string'),
      true,
    )
    assert.equal(
      description.links.some((link) => (
        link.sourceStateRef?.endsWith('/widget/w_imported_primary/selection/region')
        && link.targetStateRef?.endsWith('/widget/w_imported_2/transform/region-filter')
        && link.transform?.kind === 'selectionToFilter'
      )),
      true,
    )
    assert.equal(
      description.links.some((link) => (
        link.sourceStateRef?.endsWith('/widget/w_imported_primary/selection/region')
        && link.targetStateRef?.endsWith('/widget/w_imported_3/transform/region-filter')
        && link.transform?.kind === 'selectionToFilter'
      )),
      true,
    )

    const actionResult = await runtime.executeWorkspaceAction({
      widgetId: 'w_imported_primary',
      name: 'bar.selectCategory',
      params: {
        field: 'region',
        values: ['Downtown'],
      },
    })

    assert.equal(actionResult?.ok, true)
    const verification = await runtime.queryPerception({
      name: 'perception.verifyActionEffect',
      params: {
        actionName: 'bar.selectCategory',
        stateId: actionResult.stateId,
        refs: actionResult.updatedRefs,
      },
    })

    assert.equal(verification?.result?.verified, true)

    const coordinationState = runtime.readCoordinationState()
    const primarySelection = coordinationState?.selections?.views?.primary || null
    const propagationSummary = runtimeBridge.readSelectionPropagationSummary(boundState.runtimeSessionKey || boundState.activeCaseId)

    assert.equal(primarySelection?.sourceWidgetId, 'w_imported_primary')
    assert.deepEqual(primarySelection?.predicates, [{ field: 'region', op: 'in', value: ['Downtown'] }])
    assert.equal(Object.keys(coordinationState?.coordination?.relations || {}).length > 0, true)
    assert.deepEqual((propagationSummary?.targetWidgetIds || []).sort(), ['w_imported_2', 'w_imported_3'])

    const hydratedWidgets = hydrateImportedRuntimeWidgets(boundState.widgets, {
      readWidgetRenderPayload: (widgetId) => runtime.readWidgetRenderPayload(widgetId),
      describeWorkspace: () => runtime.describeWorkspace(),
    })
    const barSpec = hydratedWidgets[0]?.providerSpec?.spec
    const lineSpec = hydratedWidgets[1]?.providerSpec?.spec
    const scatterSpec = hydratedWidgets[2]?.providerSpec?.spec
    const lineRows = lineSpec?.data?.values || []
    const scatterRows = scatterSpec?.data?.values || []

    assert.match(barSpec?.encoding?.opacity?.condition?.test || '', /Downtown/)
    assert.match(barSpec?.encoding?.opacity?.condition?.test || '', /region/)
    assert.equal(lineRows.length > 0, true)
    assert.equal(scatterRows.length > 0, true)
    assert.equal(lineRows.every((row) => row.region === 'Downtown'), true)
    assert.equal(scatterRows.every((row) => row.region === 'Downtown'), true)
  } finally {
    cleanup()
  }
})

test('imported same-source scatter zoom propagates into bar render payload', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('imported-linked-domain')
  const runtimeBridge = await import('../../appRuntime/contracts/runtimeBridge.js')
  const { hydrateImportedRuntimeWidgets } = await import('../../features/workspace/imports/importedRuntimeHydration.js')
  const { resolveWidgetNativePayload } = await import('../../features/workspace/models/widgetRenderSupport.js')

  try {
    await bindImportedFixture(store, '01_region_bar.vl.js')
    await bindImportedFixture(store, '02_monthly_line.vl.js')
    await bindImportedFixture(store, '03_spend_scatter.vl.js')

    const boundState = store.getState()
    const runtime = runtimeBridge.createFirstPartyRuntimeSessionFacade(boundState.runtimeSessionKey || boundState.activeCaseId)
    const description = runtime.describeWorkspace()
    const barRef = description.widgets.find((widget) => widget.widgetId === 'w_imported_primary')?.ref
    const scatterRef = description.widgets.find((widget) => widget.widgetId === 'w_imported_3')?.ref

    assert.equal(
      description.links.some((link) => (
        link.sourceStateRef === `${scatterRef}/view/zoom`
        && link.targetStateRef?.startsWith(`${barRef}/transform/`)
        && link.transform?.kind === 'domainToFilter'
        && link.transform?.channelMapping?.some((mapping) => (
          mapping.sourceChannel === 'x'
          && mapping.targetField === 'marketing_spend'
        ))
      )),
      true,
    )

    const actionResult = await runtime.executeWorkspaceAction({
      widgetId: 'w_imported_3',
      name: 'scatter.zoomDomain',
      params: {
        xDomain: [2400, 3600],
      },
    })

    assert.equal(actionResult?.ok, true)
    assert.equal(actionResult?.result?.propagationSourceRef, `${scatterRef}/view/zoom`)
    assert.equal(actionResult?.updatedRefs?.includes(barRef), true)

    const barState = runtime.readView({ refs: [barRef] })?.widgets?.[barRef] || null
    const domainFilter = barState?.transforms?.find((transform) => (
      transform?.ref?.startsWith(`${barRef}/transform/`)
      && JSON.stringify(transform?.predicate || {}).includes('marketing_spend')
    ))
    assert.deepEqual(domainFilter?.predicate, {
      field: 'marketing_spend',
      op: 'between',
      value: [2400, 3600],
    })

    const hydratedWidgets = hydrateImportedRuntimeWidgets(boundState.widgets, {
      readWidgetRenderPayload: (widgetId) => runtime.readWidgetRenderPayload(widgetId),
      describeWorkspace: () => runtime.describeWorkspace(),
    })
    const barWidget = hydratedWidgets.find((widget) => widget.id === 'w_imported_primary')
    const nativePayload = resolveWidgetNativePayload(barWidget || {})
    const projectedRows = nativePayload?.payload?.data?.values || []
    assert.equal(projectedRows.length > 0, true)
    assert.equal(projectedRows.every((row) => (
      row.marketing_spend >= 2400 && row.marketing_spend <= 3600
    )), true)
  } finally {
    cleanup()
  }
})

test('imported scatter zoom after a prior region selection still applies the zoom relation', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('imported-linked-selection-then-domain')
  const runtimeBridge = await import('../../appRuntime/contracts/runtimeBridge.js')
  const { hydrateImportedRuntimeWidgets } = await import('../../features/workspace/imports/importedRuntimeHydration.js')
  const { resolveWidgetNativePayload } = await import('../../features/workspace/models/widgetRenderSupport.js')

  try {
    await bindImportedFixture(store, '01_region_bar.vl.js')
    await bindImportedFixture(store, '02_monthly_line.vl.js')
    await bindImportedFixture(store, '03_spend_scatter.vl.js')

    const boundState = store.getState()
    const runtime = runtimeBridge.createFirstPartyRuntimeSessionFacade(boundState.runtimeSessionKey || boundState.activeCaseId)
    const description = runtime.describeWorkspace()
    const barRef = description.widgets.find((widget) => widget.widgetId === 'w_imported_primary')?.ref
    const scatterRef = description.widgets.find((widget) => widget.widgetId === 'w_imported_3')?.ref

    const selectResult = await runtime.executeWorkspaceAction({
      widgetId: 'w_imported_primary',
      name: 'bar.selectCategory',
      params: {
        field: 'region',
        values: ['South LA'],
      },
    })
    assert.equal(selectResult?.ok, true)

    const selectedHydratedWidgets = hydrateImportedRuntimeWidgets(boundState.widgets, {
      readWidgetRenderPayload: (widgetId) => runtime.readWidgetRenderPayload(widgetId),
      describeWorkspace: () => runtime.describeWorkspace(),
    })
    const selectedBarWidget = selectedHydratedWidgets.find((widget) => widget.id === 'w_imported_primary')
    const selectedBarPayload = resolveWidgetNativePayload(selectedBarWidget || {})
    const selectedRows = selectedBarPayload?.payload?.data?.values || []
    const selectedTotals = sumVisitorsByRegion(selectedRows)

    const zoomResult = await runtime.executeWorkspaceAction({
      widgetId: 'w_imported_3',
      name: 'scatter.zoomDomain',
      params: {
        xDomain: [2400, 3600],
      },
    })
    assert.equal(zoomResult?.ok, true)
    assert.equal(zoomResult?.result?.propagationSourceRef, `${scatterRef}/view/zoom`)
    assert.equal(zoomResult?.updatedRefs?.includes(barRef), true)
    assert.equal(
      zoomResult?.result?.propagated?.some((link) => link?.targetRef === barRef),
      true,
    )
    assert.equal(runtime.readLatestCoordinationResult()?.sourceRef, `${scatterRef}/view/zoom`)
    assert.equal(runtime.readCoordinationState()?.selections?.views?.primary?.summary, 'region: South LA')

    const barState = runtime.readView({ refs: [barRef] })?.widgets?.[barRef] || null
    const predicates = (barState?.transforms || []).flatMap((transform) => (
      Array.isArray(transform?.predicate) ? transform.predicate : [transform?.predicate].filter(Boolean)
    ))
    assert.equal(predicates.some((predicate) => (
      predicate?.field === 'marketing_spend'
      && predicate?.op === 'between'
      && predicate?.value?.[0] === 2400
      && predicate?.value?.[1] === 3600
    )), true)

    const hydratedWidgets = hydrateImportedRuntimeWidgets(boundState.widgets, {
      readWidgetRenderPayload: (widgetId) => runtime.readWidgetRenderPayload(widgetId),
      describeWorkspace: () => runtime.describeWorkspace(),
    })
    const barWidget = hydratedWidgets.find((widget) => widget.id === 'w_imported_primary')
    const nativePayload = resolveWidgetNativePayload(barWidget || {})
    const projectedRows = nativePayload?.payload?.data?.values || []
    const projectedTotals = sumVisitorsByRegion(projectedRows)
    assert.equal(projectedRows.length > 0, true)
    assert.notDeepEqual(projectedTotals, selectedTotals)
    assert.equal(projectedRows.every((row) => (
      row.marketing_spend >= 2400
      && row.marketing_spend <= 3600
    )), true)
  } finally {
    cleanup()
  }
})

test('bindCurrentVisualization keeps external Vega-Lite data bindings intact for imported gallery specs', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('bind-imported-gallery-visualization')

  try {
    await store.getState().loadVisualizationScript(`({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Seattle Weather, 2012-2015",
      "data": { "url": "data/seattle-weather.csv" },
      "vconcat": [
        {
          "mark": "point",
          "encoding": {
            "x": { "field": "date", "type": "temporal" },
            "y": { "field": "temp_max", "type": "quantitative" }
          }
        },
        {
          "mark": "bar",
          "encoding": {
            "x": { "aggregate": "count" },
            "y": { "field": "weather", "type": "nominal" }
          }
        }
      ]
    })`)
    await tick()

    await store.getState().bindCurrentVisualization()
    await tick()

    const nextState = store.getState()
    assert.equal(nextState.workspaceSourceType, 'importedSpec')
    assert.equal(nextState.widgets[0]?.source?.providerSpec?.spec?.data?.url, 'data/seattle-weather.csv')
    assert.equal('values' in (nextState.widgets[0]?.source?.providerSpec?.spec?.data || {}), false)
  } finally {
    cleanup()
  }
})

test('imported external Vega-Lite selections stay in runtime coordination state instead of host-rematerialized spec', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('bind-imported-gallery-selection')
  const runtimeBridge = await import('../../appRuntime/contracts/runtimeBridge.js')
  const { hydrateImportedRuntimeWidgets } = await import('../../features/workspace/imports/importedRuntimeHydration.js')

  try {
    await store.getState().loadVisualizationScript(`({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Seattle Weather, 2012-2015",
      "data": { "url": "data/seattle-weather.csv" },
      "vconcat": [
        {
          "encoding": {
            "color": {
              "condition": {
                "param": "brush",
                "field": "weather",
                "type": "nominal"
              },
              "value": "lightgray"
            },
            "x": { "field": "date", "type": "temporal" },
            "y": { "field": "temp_max", "type": "quantitative" }
          },
          "mark": "point",
          "params": [{
            "name": "brush",
            "select": { "type": "interval", "encodings": ["x"] }
          }],
          "transform": [{ "filter": { "param": "click" } }]
        },
        {
          "encoding": {
            "color": {
              "condition": {
                "param": "click",
                "field": "weather",
                "type": "nominal"
              },
              "value": "lightgray"
            },
            "x": { "aggregate": "count" },
            "y": { "field": "weather", "type": "nominal" }
          },
          "mark": "bar",
          "params": [{
            "name": "click",
            "select": { "type": "point", "encodings": ["color"] }
          }],
          "transform": [{ "filter": { "param": "brush" } }]
        }
      ]
    })`)
    await tick()

    await store.getState().bindCurrentVisualization()
    await tick()

    const nextState = store.getState()
    const contract = nextState.getActiveAgentRuntimeContract()
    const widgetRef = contract.describeWorkspace()?.widgets?.[0]?.ref

    const actionResult = await contract.executeAction({
      callId: 'imported_seattle_show_only_sun',
      actor: 'agent',
      name: 'widget.updateSelection',
      target: { widgetRef },
      params: {
        selection_type: 'category',
        field: 'weather',
        values: ['sun'],
        predicates: [{ field: 'weather', op: 'in', value: ['sun'] }],
        summary: 'weather: sun',
      },
    })

    const runtime = runtimeBridge.createFirstPartyRuntimeSessionFacade(nextState.runtimeSessionKey)
    const hydratedWidgets = hydrateImportedRuntimeWidgets(nextState.widgets, {
      readWidgetRenderPayload: (widgetId) => runtime.readWidgetRenderPayload(widgetId),
      describeWorkspace: () => runtime.describeWorkspace(),
    })
    const providerSpec = hydratedWidgets?.[0]?.source?.providerSpec || hydratedWidgets?.[0]?.providerSpec || {}
    const runtimeTransform = Array.isArray(providerSpec?.spec?.transform)
      ? providerSpec.spec.transform.find((entry) => entry?._widgetvaRuntimeSelection === true)
      : null
    const primarySelection = runtime.readCoordinationState()?.selections?.views?.primary || null

    assert.equal(actionResult?.ok, true)
    assert.equal(runtimeTransform, null)
    assert.equal(primarySelection?.sourceWidgetId, 'w_imported_primary')
    assert.deepEqual(primarySelection?.predicates, [{ field: 'weather', op: 'in', value: ['sun'] }])
  } finally {
    cleanup()
  }
})

test('imported external Vega-Lite categorical filtering uses a Vega-Lite compatible exclusion predicate', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('bind-imported-gallery-filter')
  const runtimeBridge = await import('../../appRuntime/contracts/runtimeBridge.js')
  try {
    await store.getState().loadVisualizationScript(`({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Seattle Weather, 2012-2015",
      "data": { "url": "data/seattle-weather.csv" },
      "vconcat": [
        {
          "mark": "point",
          "encoding": {
            "x": { "field": "date", "type": "temporal" },
            "y": { "field": "temp_max", "type": "quantitative" },
            "color": { "field": "weather", "type": "nominal" }
          }
        },
        {
          "mark": "bar",
          "encoding": {
            "x": { "aggregate": "count" },
            "y": { "field": "weather", "type": "nominal" }
          }
        }
      ]
    })`)
    await tick()

    await store.getState().bindCurrentVisualization()
    await tick()

    const nextState = store.getState()
    const contract = nextState.getActiveAgentRuntimeContract()
    const widgetRef = contract.describeWorkspace()?.widgets?.[0]?.ref

    const actionResult = await contract.executeAction({
      callId: 'imported_seattle_remove_other_weather',
      actor: 'agent',
      name: 'scatter.filterCategorical',
      target: { widgetRef },
      params: {
        field: 'weather',
        categoriesToRemove: ['fog', 'drizzle', 'rain', 'snow'],
      },
    })

    assert.equal(actionResult?.ok, true)
    assert.deepEqual(actionResult?.statePatch?.[widgetRef]?.transforms?.[0]?.predicate, {
      field: 'weather',
      op: 'notIn',
      value: ['fog', 'drizzle', 'rain', 'snow'],
    })

    const { hydrateImportedRuntimeWidgets } = await import('../../features/workspace/imports/importedRuntimeHydration.js')
    const { resolveWidgetNativePayload } = await import('../../features/workspace/models/widgetRenderSupport.js')
    const runtime = runtimeBridge.createFirstPartyRuntimeSessionFacade(nextState.runtimeSessionKey)
    const hydratedWidgets = hydrateImportedRuntimeWidgets(nextState.widgets, {
      readWidgetRenderPayload: (widgetId) => runtime.readWidgetRenderPayload(widgetId),
      describeWorkspace: () => runtime.describeWorkspace(),
    })
    const nativePayload = resolveWidgetNativePayload(hydratedWidgets?.[0] || {})
    assert.deepEqual(nativePayload?.payload?.vconcat?.[0]?.transform, [{
      _widgetvaTag: 'scatter.filterCategorical',
      filter: { not: { field: 'weather', oneOf: ['fog', 'drizzle', 'rain', 'snow'] } },
    }])
  } finally {
    cleanup()
  }
})

test('imported shared-source scatter filter keeps provider transform when visible data ref still has source rows', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('bind-imported-spend-scatter-filter')
  const runtimeBridge = await import('../../appRuntime/contracts/runtimeBridge.js')
  const { hydrateImportedRuntimeWidgets } = await import('../../features/workspace/imports/importedRuntimeHydration.js')
  const { resolveWidgetNativePayload } = await import('../../features/workspace/models/widgetRenderSupport.js')

  try {
    await bindImportedFixture(store, '03_spend_scatter.vl.js')

    const nextState = store.getState()
    const contract = nextState.getActiveAgentRuntimeContract()
    const widgetRef = contract.describeWorkspace()?.widgets?.[0]?.ref

    const actionResult = await contract.executeAction({
      callId: 'imported_spend_scatter_filter_central',
      actor: 'agent',
      name: 'scatter.filterCategorical',
      target: { widgetRef },
      params: {
        field: 'region',
        categoriesToRemove: ['Downtown', 'South LA', 'Harbor', 'Valley', 'Northeast'],
      },
    })

    assert.equal(actionResult?.ok, true)

    const runtime = runtimeBridge.createFirstPartyRuntimeSessionFacade(nextState.runtimeSessionKey)
    const hydratedWidgets = hydrateImportedRuntimeWidgets(nextState.widgets, {
      readWidgetRenderPayload: (widgetId) => runtime.readWidgetRenderPayload(widgetId),
      describeWorkspace: () => runtime.describeWorkspace(),
    })
    const nativePayload = resolveWidgetNativePayload(hydratedWidgets?.[0] || {})

    assert.deepEqual(nativePayload?.payload?.transform, [{
      _widgetvaTag: 'scatter.filterCategorical',
      filter: {
        not: {
          field: 'region',
          oneOf: ['Downtown', 'South LA', 'Harbor', 'Valley', 'Northeast'],
        },
      },
    }])
    assert.equal(nativePayload?.payload?.data?.values?.length, 192)
  } finally {
    cleanup()
  }
})

test('imported Vega-Lite line resample records canonical runtime reencode state', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('bind-imported-line-resample')
  try {
    await store.getState().loadVisualizationScript(`({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Monthly visitors",
      "data": {
        "values": [
          { "date": "2024-01-01", "visitors": 10 },
          { "date": "2024-02-01", "visitors": 20 },
          { "date": "2025-01-01", "visitors": 30 },
          { "date": "2025-02-01", "visitors": 40 }
        ]
      },
      "mark": "line",
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "visitors", "type": "quantitative" }
      }
    })`)
    await tick()

    await store.getState().bindCurrentVisualization()
    await tick()

    const nextState = store.getState()
    const contract = nextState.getActiveAgentRuntimeContract()
    const widgetRef = contract.describeWorkspace()?.widgets?.[0]?.ref

    const actionResult = await contract.executeAction({
      callId: 'imported_line_resample_year_sum',
      actor: 'agent',
      name: 'line.resampleXAxis',
      target: { widgetRef },
      params: {
        granularity: 'year',
        agg: 'sum',
      },
    })

    assert.equal(actionResult?.ok, true)
    const widgetState = actionResult?.statePatch?.[widgetRef] || null
    assert.equal(widgetState?.view?.reencode?.mode, 'resample')
    assert.equal(widgetState?.view?.reencode?.timeField, 'year_date')
    assert.equal(widgetState?.view?.reencode?.valueField, 'sum_visitors')
    assert.equal(widgetState?.data?.analysis?.resample?.granularity, 'year')
    assert.equal(widgetState?.data?.analysis?.resample?.agg, 'sum')
  } finally {
    cleanup()
  }
})

test('imported Vega-Lite line bold action hydrates the provider spec used by the rendered widget', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('bind-imported-line-bold')
  const runtimeBridge = await import('../../appRuntime/contracts/runtimeBridge.js')
  const { hydrateImportedRuntimeWidgets } = await import('../../features/workspace/imports/importedRuntimeHydration.js')
  try {
    await store.getState().loadVisualizationScript(`({
      "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
      "title": "Stock Prices 2023",
      "data": {
        "values": [
          { "date": "2023-01-01", "price": 80, "company": "RetailInc" },
          { "date": "2023-02-01", "price": 78, "company": "RetailInc" },
          { "date": "2023-01-01", "price": 150, "company": "TechCorp" },
          { "date": "2023-02-01", "price": 165, "company": "TechCorp" }
        ]
      },
      "mark": "line",
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "price", "type": "quantitative" },
        "color": { "field": "company", "type": "nominal" }
      }
    })`)
    await tick()

    await store.getState().bindCurrentVisualization()
    await tick()

    const nextState = store.getState()
    const contract = nextState.getActiveAgentRuntimeContract()
    const widgetRef = contract.describeWorkspace()?.widgets?.[0]?.ref

    const actionResult = await contract.executeAction({
      callId: 'imported_line_bold_techcorp',
      actor: 'agent',
      name: 'line.boldLines',
      target: { widgetRef },
      params: {
        lineNames: ['TechCorp'],
        boldWidth: 5,
        baseWidth: 1,
      },
    })

    const runtime = runtimeBridge.createFirstPartyRuntimeSessionFacade(nextState.runtimeSessionKey)
    const hydratedWidgets = hydrateImportedRuntimeWidgets(nextState.widgets, {
      readWidgetRenderPayload: (widgetId) => runtime.readWidgetRenderPayload(widgetId),
      describeWorkspace: () => runtime.describeWorkspace(),
    })
    const providerSpec = hydratedWidgets?.[0]?.source?.providerSpec || hydratedWidgets?.[0]?.providerSpec || {}

    assert.equal(actionResult?.ok, true)
    assert.equal(providerSpec?.spec?.encoding?.strokeWidth?.condition?.value, 5)
    assert.match(providerSpec?.spec?.encoding?.strokeWidth?.condition?.test || '', /TechCorp/)
  } finally {
    cleanup()
  }
})

test('loadVisualizationScript uses the current echarts environment to prepare a pasted option preview', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('imported-echarts-visualization-load')

  try {
    store.getState().setWorkspaceProviderEnvironment('echarts')

    await store.getState().loadVisualizationScript(`({
      "title": { "text": "Loaded ECharts line into current VA" },
      "xAxis": { "type": "category", "data": ["Jan", "Feb", "Mar"] },
      "yAxis": { "type": "value" },
      "series": [
        {
          "type": "line",
          "data": [1, 3, 2]
        }
      ]
    })`)
    await tick()

    const nextState = store.getState()

    assert.equal(nextState.workspaceSourceType, 'starter')
    assert.equal(nextState.workspaceProviderEnvironment, 'echarts')
    assert.equal(nextState.visualizationLoadError, null)
    assert.equal(nextState.visualizationLoadSummary, 'Visualization rendered successfully via echarts.')
    assert.equal(nextState.loadedVisualizationPreview?.provider, 'echarts')
    assert.equal(nextState.loadedVisualizationPreview?.widgetKind, 'line')
    assert.equal(nextState.loadedVisualizationPreview?.widget?.source?.providerSpec?.option?.series?.[0]?.type, 'line')
  } finally {
    cleanup()
  }
})

test('loadVisualizationScript uses the current vgplot environment to prepare a pasted vgplot preview', async () => {
  const { store, cleanup } = await setupIsolatedAppStoreSession('imported-vgplot-visualization-load')

  try {
    store.getState().setWorkspaceProviderEnvironment('vgplot')

    await store.getState().loadVisualizationScript(`
      export default (wg) => wg.plot(
        wg.line(
          [
            { month: 'Jan', value: 2 },
            { month: 'Feb', value: 5 }
          ],
          { x: 'month', y: 'value' }
        ),
        wg.width(360),
        wg.height(220)
      )
    `)
    await tick()

    const nextState = store.getState()

    assert.equal(nextState.workspaceSourceType, 'starter')
    assert.equal(nextState.workspaceProviderEnvironment, 'vgplot')
    assert.equal(nextState.visualizationLoadError, null)
    assert.equal(nextState.visualizationLoadSummary, 'Visualization rendered successfully via vgplot.')
    assert.equal(nextState.loadedVisualizationPreview?.provider, 'vgplot')
    assert.equal(nextState.loadedVisualizationPreview?.widgetKind, 'line')
    assert.match(nextState.loadedVisualizationPreview?.widget?.source?.providerSpec?.scriptText || '', /wg\.plot/)
  } finally {
    cleanup()
  }
})
