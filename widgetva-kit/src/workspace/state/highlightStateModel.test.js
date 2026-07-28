import test from 'node:test'
import assert from 'node:assert/strict'

import { deriveHighlightState } from './highlightStateModel.js'

test('deriveHighlightState summarizes widget feedback with active highlights', () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/detail_b'
  assert.deepEqual(
    deriveHighlightState({
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'detail_b',
          feedback: {
            highlightedKeys: ['USA'],
            inboundLinkIds: ['summary_highlights_detail'],
            highlightLinkIds: ['summary_highlights_detail'],
            linkedSourceRefs: ['wl://widgetva-app/workspace/main/widget/bar_a/selection/current'],
          },
        },
      },
    }),
    {
      entries: [{
        widgetRef,
        widgetId: 'detail_b',
        highlightedKeys: ['USA'],
        inboundLinkIds: ['summary_highlights_detail'],
        highlightLinkIds: ['summary_highlights_detail'],
        linkedSourceRefs: ['wl://widgetva-app/workspace/main/widget/bar_a/selection/current'],
        selectionRef: null,
        sourceWidgetRef: null,
        sourceWidgetId: null,
        predicates: [],
        summary: null,
      }],
      activeWidgetRefs: [widgetRef],
    },
  )
})
