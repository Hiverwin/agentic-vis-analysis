import test from 'node:test'
import assert from 'node:assert/strict'

import { WidgetRegistry } from './widgetRegistry.js'

test('WidgetRegistry.describe exposes primary data and widget capability names', () => {
  const registry = new WidgetRegistry()

  registry.replaceWorkspace({
    description: {
      widgets: [
        {
          ref: 'wl://widgetva-app/workspace/main/widget/scatter_a',
          widgetId: 'scatter_a',
          kind: 'scatter',
          role: 'primary',
          title: 'Risk Scatterplot',
          description: 'Shows latency vs error rate.',
          analyticRoles: ['correlate', 'outlier'],
          recognizedKinds: ['scatter'],
          sourceKind: 'baseSpec',
          supportsSpecMutation: true,
          primaryDataRef: 'wl://widgetva-app/workspace/main/data/source',
          usageNotes: ['Use brushRegion to select an interval.'],
          actionNames: ['scatter.brushRegion', 'widget.clearSelection'],
          perceptionQueryNames: ['perception.inspectVisibleRows'],
          humanInteraction: { mode: 'brush2d' },
        },
      ],
      dataHandles: [
        {
          ref: 'wl://widgetva-app/workspace/main/data/source',
          title: 'Source Data',
          sourceKind: 'materialized',
          supportedQueries: ['summary', 'schema'],
        },
      ],
      links: [
        {
          ref: 'wl://widgetva-app/workspace/main/link/filter_scatter_bar',
          kind: 'filter',
          from: 'wl://widgetva-app/workspace/main/widget/scatter_a',
          to: 'wl://widgetva-app/workspace/main/widget/bar_a',
          trigger: 'selectionChanged',
          effect: 'applyFilter',
          automatic: true,
          propagationPolicy: 'automatic',
          fieldMapping: [],
        },
      ],
    },
    state: {
      widgets: {
        'wl://widgetva-app/workspace/main/widget/scatter_a': {
          widgetId: 'scatter_a',
          kind: 'scatter',
          role: 'primary',
          data: {
            sourceDataRef: 'wl://widgetva-app/workspace/main/data/source',
            currentDataRef: 'wl://widgetva-app/workspace/main/data/current_view',
          },
        },
      },
    },
    widgetAdapters: [
      {
        widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
        provider: 'vegaLite',
        providerCapabilities: {
          renderStrategy: 'vega-view',
          stateApplyStrategy: 'signals',
          interactionBindingStrategy: 'signals',
          supportsSignalPatching: true,
          supportsOptionMerging: false,
          supportsImperativeRender: true,
        },
        getHumanInteractionConfig() {
          return {
            mode: 'brush2d',
            actionName: 'scatter.brushRegion',
            supportsDirectManipulation: true,
          }
        },
        getDescription() {
          return {}
        },
        getState() {
          return {}
        },
        applyState() {},
        bindHumanInteractions() {},
        registerActions() {},
        registerPerceptionQueries() {},
      },
    ],
  })

  const summary = registry.describe()
  const widget = summary.widgets[0]
  const dataHandle = summary.dataHandles[0]
  const link = summary.links[0]

  assert.equal(widget?.title, 'Risk Scatterplot')
  assert.equal(widget?.description, 'Shows latency vs error rate.')
  assert.deepEqual(widget?.analyticRoles, ['correlate', 'outlier'])
  assert.deepEqual(widget?.recognizedKinds, ['scatter'])
  assert.equal(widget?.sourceKind, 'baseSpec')
  assert.equal(widget?.supportsSpecMutation, true)
  assert.equal(widget?.primaryDataRef, 'wl://widgetva-app/workspace/main/data/source')
  assert.deepEqual(widget?.usageNotes, ['Use brushRegion to select an interval.'])
  assert.deepEqual(widget?.actionNames, ['scatter.brushRegion', 'widget.clearSelection'])
  assert.deepEqual(widget?.perceptionQueryNames, ['perception.inspectVisibleRows'])
  assert.equal(widget?.adapterProvider, 'vegaLite')
  assert.equal(widget?.providerCapabilities?.renderStrategy, 'vega-view')
  assert.equal(widget?.adapterCapabilities?.canDescribe, true)
  assert.equal(widget?.adapterCapabilities?.canReadState, true)
  assert.equal(widget?.adapterCapabilities?.canApplyState, true)
  assert.equal(widget?.humanInteractionMode, 'brush2d')
  assert.equal(widget?.humanInteractionActionName, 'scatter.brushRegion')
  assert.equal(widget?.supportsDirectManipulation, true)
  assert.equal(dataHandle?.ref, 'wl://widgetva-app/workspace/main/data/source')
  assert.deepEqual(dataHandle?.supportedQueries, ['summary', 'schema'])
  assert.equal(link?.ref, 'wl://widgetva-app/workspace/main/link/filter_scatter_bar')
  assert.equal(link?.kind, 'filter')
  assert.equal(link?.effect, 'applyFilter')
})

test('WidgetRegistry normalizes kind-only workspace links into WidgetLink contract shape', () => {
  const registry = new WidgetRegistry()

  registry.replaceWorkspace({
    description: {
      widgets: [],
      dataHandles: [],
      links: [
        {
          ref: 'wl://widgetva-app/workspace/main/link/filter_scatter_bar',
          kind: 'filter',
          from: 'wl://widgetva-app/workspace/main/widget/scatter_a',
          to: 'wl://widgetva-app/workspace/main/widget/bar_a',
        },
      ],
    },
    state: {
      widgets: {},
    },
  })

  const describedLink = registry.describe().links[0]
  const resolvedLink = registry.getLink('wl://widgetva-app/workspace/main/link/filter_scatter_bar')

  assert.equal(describedLink?.kind, 'filter')
  assert.equal(Object.hasOwn(describedLink || {}, 'primitive'), false)
  assert.equal(resolvedLink?.kind, 'filter')
  assert.equal(Object.hasOwn(resolvedLink || {}, 'primitive'), false)
})

test('WidgetRegistry normalizes raw widget descriptions and widget states into protocol contract shape', () => {
  const registry = new WidgetRegistry()
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_a'

  registry.replaceWorkspace({
    description: {
      widgets: [
        {
          ref: widgetRef,
          kind: 'scatter',
        },
      ],
      dataHandles: [],
      links: [],
    },
    state: {
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          kind: 'scatter',
        },
      },
    },
  })

  const widget = registry.describe().widgets[0]
  const resolvedWidget = registry.getResolvedWidget(widgetRef)

  assert.equal(widget?.role, 'primary')
  assert.deepEqual(widget?.analyticRoles, [])
  assert.deepEqual(widget?.actionNames, [])
  assert.deepEqual(widget?.perceptionQueryNames, [])
  assert.equal(resolvedWidget?.title, '')
  assert.equal(resolvedWidget?.description, '')
  assert.equal(resolvedWidget?.role, 'primary')
  assert.equal(resolvedWidget?.data?.sourceDataRef, null)
  assert.equal(resolvedWidget?.data?.currentDataRef, null)
  assert.equal(resolvedWidget?.feedback?.highlightedKeys?.length, 0)
})
