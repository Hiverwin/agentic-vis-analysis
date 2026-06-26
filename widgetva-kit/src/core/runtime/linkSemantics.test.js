import test from 'node:test'
import assert from 'node:assert/strict'

import {
  allowsSelectionPropagationToWidget,
  buildSelectionCoordinationContext,
  buildSelectionDomainCoordinationContext,
  buildSelectionCoordinationEffects,
  describeSelectionPropagationLinks,
  readAppliedLinkEffect,
  readDeclaredLinkEffect,
  readLinkResponseSpec,
  readPrimarySelectionValue,
  resolveSelectionDrivenRows,
  resolveSelectionDrivenViewState,
  resolveSelectionDrivenViewValue,
} from './linkSemantics.js'

test('advanced response links normalize declared and applied transformation effects', () => {
  const link = {
    sourceWidgetId: 'bar',
    targetWidgetId: 'line',
    primitive: 'drillDown',
    responseSpec: {
      kind: 'drillDown',
      params: {
        dimension: 'time',
        fromLevel: 'year',
        toLevel: 'month',
      },
    },
  }

  assert.equal(readDeclaredLinkEffect(link), 'transformView')
  assert.equal(readAppliedLinkEffect(link), 'transformView')
  assert.deepEqual(readLinkResponseSpec(link), {
    kind: 'drillDown',
    params: {
      dimension: 'time',
      fromLevel: 'year',
      toLevel: 'month',
    },
  })
})

test('describeSelectionPropagationLinks normalizes declared and applied effects for one source widget', () => {
  const links = describeSelectionPropagationLinks([
    {
      sourceWidgetId: 'bar',
      targetWidgetId: 'scatter',
      primitive: 'filter',
      effect: 'applyFilter',
      effectConstraint: 'highlightOnly',
    },
    {
      sourceWidgetId: 'line',
      targetWidgetId: 'scatter',
      primitive: 'filter',
      effect: 'applyFilter',
    },
  ], 'bar')

  assert.equal(links.length, 1)
  assert.equal(links[0]?.effect, 'applyFilter')
  assert.equal(links[0]?.appliedEffect, 'applyHighlight')
  assert.equal(links[0]?.activationPolicy, 'automatic')
  assert.equal(links[0]?.effectConstraint, 'highlightOnly')
})

test('allowsSelectionPropagationToWidget checks applied effect semantics instead of only primitive shape', () => {
  const links = [
    {
      sourceWidgetId: 'bar',
      targetWidgetId: 'scatter',
      primitive: 'filter',
      effect: 'applyFilter',
      effectConstraint: 'focusOnly',
    },
  ]

  assert.equal(allowsSelectionPropagationToWidget(links, 'bar', 'scatter', 'focusTarget'), true)
  assert.equal(allowsSelectionPropagationToWidget(links, 'bar', 'scatter', 'applyFilter'), false)
})

test('buildSelectionCoordinationEffects groups target-side responses by widget', () => {
  const effects = buildSelectionCoordinationEffects([
    {
      sourceWidgetId: 'bar',
      targetWidgetId: 'scatter',
      primitive: 'filter',
      effect: 'applyFilter',
    },
    {
      sourceWidgetId: 'bar',
      targetWidgetId: 'line',
      primitive: 'filter',
      effect: 'applyFilter',
      effectConstraint: 'highlightOnly',
    },
    {
      sourceWidgetId: 'bar',
      targetWidgetId: 'parallel',
      primitive: 'filter',
      effect: 'applyFilter',
      effectConstraint: 'focusOnly',
    },
  ], 'bar')

  assert.equal(effects.scatter.applyFilter, true)
  assert.equal(effects.scatter.applyHighlight, false)
  assert.equal(effects.line.applyHighlight, true)
  assert.equal(effects.line.applyFilter, false)
  assert.equal(effects.parallel.focusTarget, true)
  assert.deepEqual(effects.parallel.effects, ['focusTarget'])
})

test('readPrimarySelectionValue reads scalar values from equals and single-value in predicates', () => {
  const primarySelection = {
    predicates: [
      { field: 'origin', op: 'equals', value: 'Europe' },
      { field: 'year', op: 'in', value: [1970] },
    ],
  }

  assert.equal(readPrimarySelectionValue(primarySelection, 'origin'), 'Europe')
  assert.equal(readPrimarySelectionValue(primarySelection, 'year'), 1970)
  assert.equal(readPrimarySelectionValue(primarySelection, 'cylinders'), null)
})

test('buildSelectionCoordinationContext exposes per-widget filter/highlight/focus helpers', () => {
  const context = buildSelectionCoordinationContext({
    primarySelection: {
      sourceWidgetId: 'bar',
      predicates: [{ field: 'origin', op: 'equals', value: 'Europe' }],
    },
    links: [
      {
        sourceWidgetId: 'bar',
        targetWidgetId: 'scatter',
        primitive: 'filter',
        effect: 'applyFilter',
      },
      {
        sourceWidgetId: 'bar',
        targetWidgetId: 'line',
        primitive: 'filter',
        effect: 'applyFilter',
        effectConstraint: 'highlightOnly',
      },
      {
        sourceWidgetId: 'bar',
        targetWidgetId: 'parallel',
        primitive: 'filter',
        effect: 'applyFilter',
        effectConstraint: 'focusOnly',
      },
    ],
  })

  assert.equal(context.sourceWidgetId, 'bar')
  assert.equal(context.readPrimarySelectionValue('origin'), 'Europe')
  assert.equal(context.shouldApplyFilter('scatter'), true)
  assert.equal(context.shouldApplyHighlight('line'), true)
  assert.equal(context.shouldApplyFocus('parallel'), true)
  assert.equal(context.shouldApplyFilter('line'), false)
})

test('buildSelectionDomainCoordinationContext exposes syncDomain gating and forwarded selection domains', () => {
  const context = buildSelectionDomainCoordinationContext({
    primarySelection: {
      sourceWidgetId: 'scatter',
      domain: {
        xDomain: [80, 140],
        yDomain: [18, 30],
      },
    },
    links: [
      {
        sourceWidgetId: 'scatter',
        targetWidgetId: 'line',
        primitive: 'syncDomain',
      },
    ],
  })

  assert.equal(context.sourceWidgetId, 'scatter')
  assert.equal(context.shouldSyncDomain('line'), true)
  assert.deepEqual(context.readDomainForWidget('line'), {
    xDomain: [80, 140],
    yDomain: [18, 30],
  })
  assert.equal(context.shouldSyncDomain('heatmap'), false)
})

test('resolveSelectionDrivenViewValue uses source-widget self feedback before fallback', () => {
  const context = buildSelectionCoordinationContext({
    primarySelection: {
      sourceWidgetId: 'bar',
      predicates: [{ field: 'origin', op: 'equals', value: 'Europe' }],
    },
    links: [],
  })

  assert.equal(resolveSelectionDrivenViewValue({
    widgetId: 'bar',
    responseSourceWidgetId: 'bar',
    field: 'origin',
    fallbackValue: 'All',
    selectionCoordination: context,
    responseType: 'highlight',
  }), 'Europe')
})

test('resolveSelectionDrivenViewValue uses linked highlight/focus semantics instead of app-owned checks', () => {
  const context = buildSelectionCoordinationContext({
    primarySelection: {
      sourceWidgetId: 'heatmap',
      predicates: [
        { field: 'origin', op: 'equals', value: 'Japan' },
        { field: 'id', op: 'equals', value: 'toyota-corona-mark-ii' },
      ],
    },
    links: [
      {
        sourceWidgetId: 'heatmap',
        targetWidgetId: 'bar',
        primitive: 'filter',
        effect: 'applyFilter',
        effectConstraint: 'highlightOnly',
      },
      {
        sourceWidgetId: 'heatmap',
        targetWidgetId: 'parallel',
        primitive: 'filter',
        effect: 'applyFilter',
        effectConstraint: 'focusOnly',
      },
    ],
  })

  assert.equal(resolveSelectionDrivenViewValue({
    widgetId: 'bar',
    responseSourceWidgetId: 'bar',
    field: 'origin',
    fallbackValue: 'All',
    selectionCoordination: context,
    responseType: 'highlight',
  }), 'Japan')

  assert.equal(resolveSelectionDrivenViewValue({
    widgetId: 'parallel',
    responseSourceWidgetId: 'parallel',
    field: 'id',
    fallbackValue: null,
    selectionCoordination: context,
    responseType: 'focus',
  }), 'toyota-corona-mark-ii')
})

test('resolveSelectionDrivenViewValue supports value coercion and preserves fallback when selection should not drive target', () => {
  const context = buildSelectionCoordinationContext({
    primarySelection: {
      sourceWidgetId: 'heatmap',
      predicates: [{ field: 'cylinders', op: 'equals', value: 4 }],
    },
    links: [
      {
        sourceWidgetId: 'heatmap',
        targetWidgetId: 'bar',
        primitive: 'filter',
        effect: 'applyFilter',
        effectConstraint: 'highlightOnly',
      },
    ],
  })

  assert.deepEqual(resolveSelectionDrivenViewValue({
    widgetId: 'heatmap',
    responseSourceWidgetId: 'heatmap',
    field: 'cylinders',
    fallbackValue: [],
    selectionCoordination: context,
    responseType: 'highlight',
    mapValue: (value) => [value],
  }), [4])

  assert.equal(resolveSelectionDrivenViewValue({
    widgetId: 'scatter',
    responseSourceWidgetId: 'scatter',
    field: 'cylinders',
    fallbackValue: 'keep-current',
    selectionCoordination: context,
    responseType: 'highlight',
  }), 'keep-current')
})

test('resolveSelectionDrivenViewState resolves multiple widget response fields through library-owned coordination semantics', () => {
  const context = buildSelectionCoordinationContext({
    primarySelection: {
      sourceWidgetId: 'heatmap',
      predicates: [
        { field: 'origin', op: 'equals', value: 'Japan' },
        { field: 'cylinders', op: 'equals', value: 4 },
        { field: 'id', op: 'equals', value: 'toyota-corona-mark-ii' },
      ],
    },
    links: [
      {
        sourceWidgetId: 'heatmap',
        targetWidgetId: 'bar',
        primitive: 'filter',
        effect: 'applyFilter',
        effectConstraint: 'highlightOnly',
      },
      {
        sourceWidgetId: 'heatmap',
        targetWidgetId: 'parallel',
        primitive: 'filter',
        effect: 'applyFilter',
        effectConstraint: 'focusOnly',
      },
    ],
  })

  assert.deepEqual(resolveSelectionDrivenViewState({
    widgetId: 'bar',
    responseSourceWidgetId: 'bar',
    selectionCoordination: context,
    fields: [
      {
        viewKey: 'analysisOrigin',
        field: 'origin',
        fallbackValue: 'All',
        responseType: 'highlight',
      },
      {
        viewKey: 'analysisCylinders',
        field: 'cylinders',
        fallbackValue: [],
        responseType: 'highlight',
        mapValue: (value) => [value],
      },
    ],
  }), {
    analysisOrigin: 'Japan',
    analysisCylinders: [4],
  })

  assert.deepEqual(resolveSelectionDrivenViewState({
    widgetId: 'parallel',
    responseSourceWidgetId: 'parallel',
    selectionCoordination: context,
    fields: [
      {
        viewKey: 'focusedCarId',
        field: 'id',
        fallbackValue: null,
        responseType: 'focus',
      },
    ],
  }), {
    focusedCarId: 'toyota-corona-mark-ii',
  })
})

test('resolveSelectionDrivenRows chooses filtered rows only for widgets that receive filter propagation', () => {
  const context = buildSelectionCoordinationContext({
    primarySelection: {
      sourceWidgetId: 'bar',
      predicates: [{ field: 'origin', op: 'equals', value: 'Europe' }],
    },
    links: [
      {
        sourceWidgetId: 'bar',
        targetWidgetId: 'scatter',
        primitive: 'filter',
        effect: 'applyFilter',
      },
      {
        sourceWidgetId: 'bar',
        targetWidgetId: 'line',
        primitive: 'filter',
        effect: 'applyFilter',
        effectConstraint: 'highlightOnly',
      },
    ],
  })

  const filteredRows = [{ id: 'filtered' }]
  const fallbackRows = [{ id: 'fallback' }]

  assert.deepEqual(resolveSelectionDrivenRows({
    widgetId: 'scatter',
    selectionCoordination: context,
    filteredRows,
    fallbackRows,
  }), filteredRows)

  assert.deepEqual(resolveSelectionDrivenRows({
    widgetId: 'line',
    selectionCoordination: context,
    filteredRows,
    fallbackRows,
  }), fallbackRows)
})
