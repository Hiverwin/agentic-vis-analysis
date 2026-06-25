import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveWidgetLayout,
  resolveWorkspaceCanvasWorkspace,
  shouldRenderWorkspaceCanvasPlaceholder,
} from './workspaceCanvasModel.js'

test('resolveWorkspaceCanvasWorkspace prefers runtime workspace snapshots even when no outer spec prop is present', () => {
  const widgetRef = 'wl://widgetva-app/workspace/main/widget/scatter_a'
  const workspace = resolveWorkspaceCanvasWorkspace({
    runtimeStoreSnapshot: {
      description: {
        widgets: [
          { ref: widgetRef, kind: 'scatter' },
        ],
      },
      state: {
        widgets: {
          [widgetRef]: {
            ref: widgetRef,
            widgetId: 'scatter_a',
            kind: 'scatter',
            rawSpec: { mark: 'point' },
          },
        },
        shared: {},
      },
    },
    spec: null,
  })

  const { primaryWidget } = resolveWidgetLayout(
    workspace.description.widgets,
    workspace.state.widgets,
    null,
  )

  assert.equal(primaryWidget?.description?.ref, widgetRef)
  assert.equal(shouldRenderWorkspaceCanvasPlaceholder({ spec: null, primaryWidget }), false)
})

test('shouldRenderWorkspaceCanvasPlaceholder only falls back when both spec and runtime widgets are absent', () => {
  assert.equal(
    shouldRenderWorkspaceCanvasPlaceholder({
      spec: null,
      primaryWidget: null,
    }),
    true,
  )

  assert.equal(
    shouldRenderWorkspaceCanvasPlaceholder({
      spec: { mark: 'point' },
      primaryWidget: null,
    }),
    false,
  )
})
