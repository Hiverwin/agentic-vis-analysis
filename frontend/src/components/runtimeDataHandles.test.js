import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeCurrentSelectionDataRef,
  makeCurrentViewDataRef,
  makeSelectionRef,
  makeSelectionScopedDataRef,
  makeWidgetRef,
  makeWidgetSelectionDataRef,
} from 'widgetva-kit/protocol'
import { resolveRuntimeDataHandleOptions } from './runtimeDataHandles.js'

test('resolveRuntimeDataHandleOptions prioritizes current_selection before widget-local selection handles', () => {
  const widgetRef = makeWidgetRef({ widgetId: 'scatter_a' })
  const selectionRef = makeSelectionRef({ widgetId: 'scatter_a', selectionId: 'brush' })
  const currentViewRef = makeCurrentViewDataRef()
  const currentSelectionRef = makeCurrentSelectionDataRef()
  const combinedSelectionRef = makeWidgetSelectionDataRef({ widgetId: 'scatter_a' })
  const scopedSelectionRef = makeSelectionScopedDataRef({ widgetId: 'scatter_a', selectionId: 'brush' })

  const { options } = resolveRuntimeDataHandleOptions({
    snapshot: {
      widgets: {
        [widgetRef]: {
          ref: widgetRef,
          widgetId: 'scatter_a',
          data: {
            currentDataRef: 'wl://widgetva-app/workspace/main/data/scatter_a_visible',
          },
          selections: {
            [selectionRef]: {
              kind: 'point',
            },
          },
        },
      },
      shared: {
        focusedWidget: widgetRef,
      },
    },
    workspace: {
      appId: 'widgetva-app',
      workspaceId: 'main',
      dataHandles: [
        { ref: currentViewRef, title: 'Current View Data', scope: 'workspaceCurrentView' },
        { ref: 'wl://widgetva-app/workspace/main/data/scatter_a_visible', title: 'Visible', scope: 'visible' },
        { ref: currentSelectionRef, title: 'Current Selection Data', scope: 'workspaceCurrent' },
        { ref: combinedSelectionRef, title: 'Scatter A Selection Data', scope: 'combined' },
        { ref: scopedSelectionRef, title: 'Scatter A Selection brush Data', scope: 'selection', sourceSelectionRef: selectionRef },
      ],
    },
  })

  assert.deepEqual(
    options.map((handle) => handle.ref),
    [
      currentViewRef,
      'wl://widgetva-app/workspace/main/data/scatter_a_visible',
      currentSelectionRef,
      scopedSelectionRef,
      combinedSelectionRef,
    ],
  )
})
