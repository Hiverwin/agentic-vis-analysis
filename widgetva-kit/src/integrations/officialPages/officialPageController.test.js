import test from 'node:test'
import assert from 'node:assert/strict'

import { createPostActionSyncProxy } from './officialPageController.js'

test('post-action sync proxy carries provider recoverableState back on action results', async () => {
  const recoverableState = {
    stateId: 'matrix:s1',
    brush: {
      targetRef: 'wl://widgetva-app/workspace/matrix/widget/cell_mpg_hp',
      xDomain: [10, 20],
      yDomain: [50, 150],
    },
  }
  const target = {
    async executeVerifiedAction() {
      return {
        ok: true,
        actionResult: {
          ok: true,
          stateId: 'matrix:s1',
        },
      }
    },
  }
  const proxy = createPostActionSyncProxy(target, async () => ({ recoverableState }))

  const result = await proxy.executeVerifiedAction({
    name: 'scatter.brushRegion',
  })

  assert.deepEqual(result.recoverableState, recoverableState)
  assert.deepEqual(result.actionResult.recoverableState, recoverableState)
})
