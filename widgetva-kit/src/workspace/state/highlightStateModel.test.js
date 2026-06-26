import test from 'node:test'
import assert from 'node:assert/strict'

import { deriveHighlightState } from './highlightStateModel.js'

test('deriveHighlightState summarizes widget feedback with active highlights', () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/table_b'
  assert.deepEqual(
    deriveHighlightState({
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'table_b',
          feedback: {
            highlightedKeys: ['USA'],
            inboundLinkIds: ['summary_highlights_table'],
            highlightLinkIds: ['summary_highlights_table'],
            linkedSourceRefs: ['wl://widgetva-app/workspace/main/widget/bar_a/selection/current'],
          },
        },
      },
    }),
    {
      entries: [{
        widgetRef,
        widgetId: 'table_b',
        highlightedKeys: ['USA'],
        inboundLinkIds: ['summary_highlights_table'],
        highlightLinkIds: ['summary_highlights_table'],
        linkedSourceRefs: ['wl://widgetva-app/workspace/main/widget/bar_a/selection/current'],
      }],
      activeWidgetRefs: [widgetRef],
    },
  )
})
