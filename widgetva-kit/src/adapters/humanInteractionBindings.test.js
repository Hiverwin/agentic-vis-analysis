import test from 'node:test'
import assert from 'node:assert/strict'

import { bindWidgetHumanInteractions } from './humanInteractionBindings.js'

test('bindWidgetHumanInteractions emits executor-ready human ActionCalls for brush2d interactions', () => {
  const signalListeners = new Map()
  const removedSignalListeners = []
  const emittedCalls = []

  const view = {
    addSignalListener(name, handler) {
      signalListeners.set(name, handler)
    },
    removeSignalListener(name, handler) {
      removedSignalListeners.push([name, handler])
    },
    addEventListener() {},
    removeEventListener() {},
    signal(name) {
      if (name === 'brush') {
        return {
          x: [10, 30],
          y: [20, 40],
        }
      }
      return null
    },
    data() {
      return []
    },
  }

  const cleanup = bindWidgetHumanInteractions({
    view,
    spec: {
      data: {
        values: [
          { Horsepower: 12, MPG: 22 },
          { Horsepower: 28, MPG: 35 },
        ],
      },
      encoding: {
        x: { field: 'Horsepower' },
        y: { field: 'MPG' },
      },
    },
    interactionConfig: {
      mode: 'brush2d',
      actionName: 'scatter.brushRegion',
    },
    selectionSourceWidgetId: 'scatter_a',
    actionTargetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    onActionCall(call) {
      emittedCalls.push(call)
    },
    onSelectionChange() {
      throw new Error('onSelectionChange should not be used when onActionCall is available.')
    },
  })

  assert.equal(typeof signalListeners.get('brush'), 'function')
  signalListeners.get('brush')()

  assert.equal(emittedCalls.length, 1)
  assert.deepEqual(emittedCalls[0], {
    callId: emittedCalls[0].callId,
    name: 'scatter.brushRegion',
    actor: 'human',
    targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
    params: {
      targetRef: 'wl://widgetva-app/workspace/main/widget/scatter_a',
      xField: 'Horsepower',
      yField: 'MPG',
      xRange: [10, 30],
      yRange: [20, 40],
    },
  })

  cleanup()
  assert.ok(removedSignalListeners.some(([name]) => name === 'brush'))
})
