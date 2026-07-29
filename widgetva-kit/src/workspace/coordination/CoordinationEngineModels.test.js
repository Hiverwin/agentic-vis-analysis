import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildLinkStatePatch,
  describeAppliedStatePathsForEffect,
  makeCoordinationEngineSummary,
  makeCoordinationRelationLink,
  mapCoordinationSourceToTarget,
} from './CoordinationEngineModels.js'

test('makeCoordinationRelationLink normalizes canonical relations into engine links', () => {
  const link = makeCoordinationRelationLink({
    ref: 'rel-a',
    sourceStateRef: 'wl://widgetva-app/workspace/main/widget/source/selection/brush',
    targetStateRef: 'wl://widgetva-app/workspace/main/widget/target/view',
    transform: {
      kind: 'intervalToDomain',
      channelMapping: [{ sourceChannel: 'x', targetChannel: 'x' }],
    },
  })

  assert.equal(link.kind, 'intervalToDomain')
  assert.equal(link.effect, 'syncDomain')
  assert.equal(link.from, 'wl://widgetva-app/workspace/main/widget/source/selection/brush')
  assert.equal(link.to, 'wl://widgetva-app/workspace/main/widget/target')
  assert.equal(link.sourceWidgetId, 'source')
  assert.equal(link.targetWidgetId, 'target')
  assert.equal(link.isCoordinationRelation, true)
})

test('mapCoordinationSourceToTarget maps interval selections to target domains', () => {
  const mapped = mapCoordinationSourceToTarget({
    activeSelection: {
      channels: {
        x: { domain: [10, 20] },
      },
    },
    link: {
      transform: {
        kind: 'intervalToDomain',
        channelMapping: [{ sourceChannel: 'x', targetChannel: 'x' }],
      },
    },
  })

  assert.deepEqual(mapped.domain, { xDomain: [10, 20] })
})

test('coordination model helpers preserve patch and summary defaults', () => {
  assert.deepEqual(
    buildLinkStatePatch({
      beforeState: { shared: { focusedWidget: 'a' } },
      afterState: {
        shared: { focusedWidget: 'b' },
        widgets: { target: { widgetId: 'target', view: { xDomain: [0, 1] } } },
      },
      affectedRefs: ['target', 'missing'],
    }),
    {
      target: { widgetId: 'target', view: { xDomain: [0, 1] } },
      shared: { focusedWidget: 'b' },
    },
  )

  assert.deepEqual(describeAppliedStatePathsForEffect('syncDomain'), [
    'view.xDomain',
    'view.yDomain',
    'feedback.inboundLinkIds',
  ])

  const summary = makeCoordinationEngineSummary({
    linkKinds: [{ name: 'filter', appliedStatePaths: ['transforms'] }],
    capabilities: { propagationPlan: true },
  })
  assert.equal(summary.linkKindCount, 0)
  assert.equal(summary.linkKinds[0].name, 'filter')
  assert.equal(summary.capabilities.propagationPlan, true)
  assert.equal(summary.capabilities.propagationExecution, false)
})
