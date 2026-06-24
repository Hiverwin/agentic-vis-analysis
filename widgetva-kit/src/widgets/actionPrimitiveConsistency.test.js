import test from 'node:test'
import assert from 'node:assert/strict'

import { WIDGET_ACTION_PRIMITIVE_MAP } from './actionPrimitiveMap.js'
import { describeWidgetVerificationContract } from './verificationContract.js'
import { describeLocalSelectionContract } from './localSelectionContract.js'
import { buildBarActionDescriptors } from './bar/actions.js'
import { buildHeatmapActionDescriptors } from './heatmap/actions.js'
import { buildLineActionDescriptors } from './line/actions.js'
import { buildParallelCoordinatesActionDescriptors } from './parallelCoordinates/actions.js'
import { buildSankeyActionDescriptors } from './sankey/actions.js'
import { buildScatterActionDescriptors } from './scatter/actions.js'

const ACTION_DESCRIPTOR_BUILDERS = {
  bar: buildBarActionDescriptors,
  heatmap: buildHeatmapActionDescriptors,
  line: buildLineActionDescriptors,
  parallelCoordinates: buildParallelCoordinatesActionDescriptors,
  sankey: buildSankeyActionDescriptors,
  scatter: buildScatterActionDescriptors,
}

function buildDescriptorPrimitiveIndex() {
  const entries = Object.entries(ACTION_DESCRIPTOR_BUILDERS).flatMap(([kind, buildDescriptors]) =>
    buildDescriptors({
      widgetRef: `${kind}-widget`,
      selectionRef: `${kind}-selection`,
    }).map((descriptor) => [descriptor.name, descriptor.primitive]),
  )

  return Object.fromEntries(entries)
}

function actionNameToKind(actionName) {
  return typeof actionName === 'string' ? actionName.split('.')[0] || null : null
}

function primitiveToVerificationEffectType(primitive) {
  return primitive === 'select' ? 'selection' : primitive
}

test('action primitive map matches every widget action descriptor primitive', () => {
  const descriptorPrimitiveByAction = buildDescriptorPrimitiveIndex()

  for (const [actionName, mappedPrimitive] of Object.entries(WIDGET_ACTION_PRIMITIVE_MAP)) {
    assert.equal(
      descriptorPrimitiveByAction[actionName],
      mappedPrimitive,
      `${actionName} descriptor primitive should match action primitive map`,
    )
  }
})

test('widget verification contracts support every primitive family used by their actions', () => {
  for (const [actionName, primitive] of Object.entries(WIDGET_ACTION_PRIMITIVE_MAP)) {
    const kind = actionNameToKind(actionName)
    const verification = describeWidgetVerificationContract(kind)
    assert.ok(verification, `${kind} verification contract should exist`)

    const effectType = primitiveToVerificationEffectType(primitive)
    assert.equal(
      verification.supportedEffectTypes.includes(effectType),
      true,
      `${kind} verification contract should support ${effectType} because of ${actionName}`,
    )
  }
})

test('local selection source actions remain selection primitives', () => {
  for (const kind of Object.keys(ACTION_DESCRIPTOR_BUILDERS)) {
    const localSelection = describeLocalSelectionContract(kind)
    assert.ok(localSelection, `${kind} local selection contract should exist`)

    for (const actionName of localSelection.sourceActionNames || []) {
      assert.equal(
        WIDGET_ACTION_PRIMITIVE_MAP[actionName],
        'select',
        `${actionName} should remain a select primitive because it is a local selection source`,
      )
    }
  }
})
