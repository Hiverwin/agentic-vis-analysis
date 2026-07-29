import test from 'node:test'
import assert from 'node:assert/strict'

import { buildWorkspaceSelectionEntry } from './selectionAdapter.js'

test('buildWorkspaceSelectionEntry derives canonical selection refs for first-party widget actions', () => {
  const session = {
    workspace: {
      getWidget(widgetId) {
        if (widgetId !== 'w_bar_origin') return null
        return {
          resolveWidgetRef: () => 'wl://workspace/widget/w_bar_origin',
        }
      },
    },
  }
  const entry = buildWorkspaceSelectionEntry(session, {
    sourceWidgetId: 'w_bar_origin',
    selectionId: 'origin',
    summary: 'Origin: Japan',
    predicates: [{ field: 'origin', op: 'equals', value: 'Japan' }],
    values: ['Japan'],
  })

  assert.equal(entry.selectionRef, 'selection://widgetva-system/w_bar_origin/origin')
  assert.equal(entry.sourceWidgetRef, 'wl://workspace/widget/w_bar_origin')
  assert.equal(entry.kind, 'point')
  assert.deepEqual(entry.values, ['Japan'])
})
