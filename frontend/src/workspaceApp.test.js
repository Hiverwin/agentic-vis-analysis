import test from 'node:test'
import assert from 'node:assert/strict'

import { createWidgetVAWorkspaceHostBridge } from './workspaceHostBridge.js'
import { useAppStore } from './state/appStore.js'

test('createWidgetVAWorkspaceHostBridge maps workspace app state explicitly into the kit host bridge contract', () => {
  useAppStore.setState({
    currentSessionId: 'session_a',
    baselineSpec: { mark: 'point' },
    currentSpec: { mark: 'bar' },
    currentWorkspaceSpec: { widgets: [{ widgetId: 'scatter_a' }] },
    currentWorkspacePlanningRequest: { runMode: 'goal_oriented', task: { taskId: 'task_a' } },
    runMode: 'goal_oriented',
    presetQueryDraft: 'compare categories',
    currentSelection: { source_widget_id: 'scatter_a', selection_id: 'brush' },
    currentSelections: {
      'scatter_a::brush': { source_widget_id: 'scatter_a', selection_id: 'brush' },
    },
    currentFocusedWidgetRef: 'wl://demo/workspace/main/widget/scatter_a',
    currentComparisonTargets: ['wl://demo/workspace/main/widget/table_a'],
    workspaceAnnotations: [{ id: 'note_1', text: 'Check outlier cluster' }],
  })

  const bridge = createWidgetVAWorkspaceHostBridge()

  assert.equal(bridge.readSessionId(), 'session_a')
  assert.deepEqual(bridge.readCurrentSpec(), { mark: 'bar' })
  assert.deepEqual(bridge.readWorkspaceSpec(), { widgets: [{ widgetId: 'scatter_a' }] })
  assert.deepEqual(bridge.readPlanningRequest(), { runMode: 'goal_oriented', task: { taskId: 'task_a' } })
  assert.equal(bridge.readUserIntent(), 'compare categories')
  assert.equal(bridge.readFocusedWidgetRef(), 'wl://demo/workspace/main/widget/scatter_a')
  assert.deepEqual(bridge.readComparisonTargets(), ['wl://demo/workspace/main/widget/table_a'])
  assert.deepEqual(bridge.readWorkspaceAnnotations(), [{ id: 'note_1', text: 'Check outlier cluster' }])

  bridge.writeUserIntent('inspect anomalies')
  bridge.writeRunMode('exploratory')
  bridge.setFocusedWidgetRef('wl://demo/workspace/main/widget/table_a')

  const nextState = useAppStore.getState()
  assert.equal(nextState.presetQueryDraft, 'inspect anomalies')
  assert.equal(nextState.runMode, 'exploratory')
  assert.equal(nextState.currentFocusedWidgetRef, 'wl://demo/workspace/main/widget/table_a')
})
