import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WIDGET_ACTION_PRIMITIVE_FAMILIES,
  WIDGET_ACTION_PRIMITIVE_MAP,
} from '../../widgets/actionPrimitiveMap.js'
import {
  applyActionAnalyticalPlacement,
  applyActionAnalyticalPlacementList,
  classifyActionAnalyticalPlacement,
  classifyPrimitiveAnalyticalPlacement,
  listAnalyticalPlacementRules,
} from './analyticalStatePlacement.js'

test('classifyPrimitiveAnalyticalPlacement classifies workspace-shared primitives into stable shared state surfaces', () => {
  assert.deepEqual(classifyPrimitiveAnalyticalPlacement('filter'), {
    primitive: 'filter',
    placement: 'workspace-shared-state',
    sharedSurface: 'sharedFilterContext',
    stateField: 'filters',
  })
  assert.deepEqual(classifyPrimitiveAnalyticalPlacement('select'), {
    primitive: 'select',
    placement: 'workspace-shared-state',
    sharedSurface: 'sharedSemanticFocus',
    stateField: 'selections',
  })
  assert.deepEqual(classifyPrimitiveAnalyticalPlacement('zoom'), {
    primitive: 'zoom',
    placement: 'workspace-shared-state',
    sharedSurface: 'sharedViewportContext',
    stateField: 'viewport',
  })
})

test('classifyPrimitiveAnalyticalPlacement classifies transformation primitives into widget-local shared summaries', () => {
  assert.deepEqual(classifyPrimitiveAnalyticalPlacement('reencode'), {
    primitive: 'reencode',
    placement: 'widget-local-shared-summary',
    sharedSurface: 'sharedTransformationContext',
    stateField: 'viewStatesByWidget',
  })
  assert.deepEqual(classifyPrimitiveAnalyticalPlacement('drillDown'), {
    primitive: 'drillDown',
    placement: 'widget-local-shared-summary',
    sharedSurface: 'sharedTransformationContext',
    stateField: 'viewStatesByWidget',
  })
  assert.deepEqual(classifyPrimitiveAnalyticalPlacement('aggregate'), {
    primitive: 'aggregate',
    placement: 'widget-local-shared-summary',
    sharedSurface: 'sharedTransformationContext',
    stateField: 'viewStatesByWidget',
  })
})

test('classifyActionAnalyticalPlacement resolves widget action names through the shared primitive map', () => {
  assert.deepEqual(classifyActionAnalyticalPlacement('line.zoomXRegion'), {
    actionName: 'line.zoomXRegion',
    primitive: 'zoom',
    placement: 'workspace-shared-state',
    sharedSurface: 'sharedViewportContext',
    stateField: 'viewport',
  })
  assert.deepEqual(classifyActionAnalyticalPlacement('bar.sortBars'), {
    actionName: 'bar.sortBars',
    primitive: 'sort',
    placement: 'widget-local-shared-summary',
    sharedSurface: 'sharedTransformationContext',
    stateField: 'viewStatesByWidget',
  })
  assert.deepEqual(classifyActionAnalyticalPlacement('sankey.expandNode'), {
    actionName: 'sankey.expandNode',
    primitive: 'navigate',
    placement: 'widget-local-shared-summary',
    sharedSurface: 'sharedTransformationContext',
    stateField: 'viewStatesByWidget',
  })
})

test('applyActionAnalyticalPlacement projects the stable analytical placement metadata onto known actions', () => {
  assert.deepEqual(
    applyActionAnalyticalPlacement({
      name: 'line.zoomXRegion',
      primitive: 'zoom',
    }),
    {
      name: 'line.zoomXRegion',
      primitive: 'zoom',
      analyticalPlacement: 'workspace-shared-state',
      sharedAnalyticalSurface: 'sharedViewportContext',
    },
  )

  assert.deepEqual(
    applyActionAnalyticalPlacement({
      name: 'custom.unknownAction',
      primitive: 'custom',
    }),
    {
      name: 'custom.unknownAction',
      primitive: 'custom',
    },
  )
})

test('applyActionAnalyticalPlacementList preserves ordering while enriching only mapped actions', () => {
  assert.deepEqual(
    applyActionAnalyticalPlacementList([
      { name: 'bar.sortBars', primitive: 'sort' },
      { name: 'custom.unknownAction', primitive: 'custom' },
    ]),
    [
      {
        name: 'bar.sortBars',
        primitive: 'sort',
        analyticalPlacement: 'widget-local-shared-summary',
        sharedAnalyticalSurface: 'sharedTransformationContext',
      },
      {
        name: 'custom.unknownAction',
        primitive: 'custom',
      },
    ],
  )
})

test('listAnalyticalPlacementRules returns the stable primitive placement table without unknown entries', () => {
  const rules = listAnalyticalPlacementRules()
  assert.equal(rules.some((entry) => entry.placement === 'unknown'), false)
  assert.equal(rules.some((entry) => entry.primitive === 'filter' && entry.sharedSurface === 'sharedFilterContext'), true)
  assert.equal(rules.some((entry) => entry.primitive === 'reencode' && entry.sharedSurface === 'sharedTransformationContext'), true)
})

test('every mapped widget action resolves to a non-unknown analytical placement', () => {
  for (const actionName of Object.keys(WIDGET_ACTION_PRIMITIVE_MAP)) {
    const placement = classifyActionAnalyticalPlacement(actionName)
    assert.notEqual(
      placement.placement,
      'unknown',
      `${actionName} should resolve to a stable analytical placement`,
    )
    assert.equal(typeof placement.sharedSurface, 'string')
    assert.equal(typeof placement.stateField, 'string')
  }
})

test('every declared primitive family is represented in the analytical placement rule table', () => {
  const rules = listAnalyticalPlacementRules()
  const primitivesInRules = new Set(rules.map((entry) => entry.primitive))
  for (const primitive of WIDGET_ACTION_PRIMITIVE_FAMILIES) {
    assert.equal(
      primitivesInRules.has(primitive),
      true,
      `${primitive} should have one stable analytical placement rule`,
    )
  }
})
