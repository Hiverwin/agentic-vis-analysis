import test from 'node:test'
import assert from 'node:assert/strict'

import { readFocusState } from './focusStateModel.js'

test('readFocusState derives normalized focus metadata from shared.focusedWidget', () => {
  assert.deepEqual(
    readFocusState(
      { focusedWidget: 'wl://widgetva-app/workspace/main/widget/scatter_a' },
      {
        'wl://widgetva-app/workspace/main/widget/scatter_a': {
          widgetId: 'scatter_a',
        },
      },
    ),
    {
      widgetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
      widgetId: 'scatter_a',
      source: 'workspace',
    },
  )
})
