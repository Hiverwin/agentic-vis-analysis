import test from 'node:test'
import assert from 'node:assert/strict'

import {
  makeWorkspacePlanningRequest,
  makeWorkspacePlanningResult,
} from './workspacePlanningShapes.js'

test('workspace planning shapes normalize nested request and result payloads', () => {
  const request = makeWorkspacePlanningRequest({
    task: { userQuery: 'compare monthly sales' },
  })
  const result = makeWorkspacePlanningResult({
    widgets: [{ widgetId: 'w1', source: { title: 'Primary' } }],
    links: [{ kind: 'filters', sourceWidgetId: 'w1', targetWidgetId: 'w2' }],
  })

  assert.equal(request.runMode, 'goal_oriented')
  assert.equal(request.task?.userQuery, 'compare monthly sales')
  assert.equal(result.topology, 'T1')
  assert.equal(result.widgets[0]?.source?.kind, 'baseSpec')
  assert.equal(result.links[0]?.kind, 'filter')
  assert.equal(result.links[0]?.activationPolicy, 'automatic')
})
